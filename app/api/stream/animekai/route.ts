import { ndjsonResponse } from "@/lib/ndjson-stream";
import { findStreamUrl, findSubtitles, type SubtitleTrack } from "@/lib/stream-utils";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

const ENC_DEC_API = "https://enc-dec.app/api";
const KAI_DB = "https://enc-dec.app/db/kai";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

interface EncDecResponse<T> {
  status: number;
  result?: T;
  error?: string;
}

async function validate<T>(response: Response, path: string): Promise<T> {
  const data: EncDecResponse<T> = await response.json();
  if (data.status !== 200 || data.result === undefined) {
    throw new Error(`enc-dec API error at ${path}: ${data.error || "unknown"}`);
  }
  return data.result;
}

interface KaiEntry {
  info?: {
    kai_watch?: string;
    mirrors?: { animekai?: string[]; megaup?: string[] };
  };
  episodes?: Record<
    string,
    Record<string, { token?: string; sources?: Record<string, Record<string, string>> }>
  >;
}

// The kai database ships a per-title mirror list that can go stale (these
// domains rotate often). Supplement it with the domains the EncDecEndpoints
// README currently documents instead of trusting the cache alone.
const CURRENT_ANIMEKAI_MIRRORS = ["https://animekai.to/", "https://anikai.to/"];
const CURRENT_MEGAUP_MIRRORS = [
  "https://megaup.site/",
  "https://megaup.live/",
  "https://4spromax.site/",
];

function mergeMirrors(cached: string[] | undefined, current: string[]): string[] {
  const normalize = (u: string) => (u.endsWith("/") ? u : `${u}/`);
  const seen = new Set<string>();
  const merged: string[] = [];
  for (const url of [...(cached || []), ...current]) {
    const n = normalize(url);
    if (!seen.has(n)) {
      seen.add(n);
      merged.push(n);
    }
  }
  return merged;
}

// Decrypts a megaup/rapidshare-style "/media/" JSON response using whichever
// enc-dec.app endpoint matches the hosting domain.
async function decryptHosterMedia(
  mediaUrl: string,
  referer: string
): Promise<{ url: string; subtitles: SubtitleTrack[] } | null> {
  const mediaResp = await fetchWithTimeout(mediaUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", Referer: referer },
  });
  if (!mediaResp.ok) throw new Error(`Hoster returned ${mediaResp.status}`);
  const mediaJson: { result?: string } = await mediaResp.json();
  if (!mediaJson.result) throw new Error("No encrypted payload from hoster");

  const decEndpoint = mediaUrl.includes("rapidshare") ? "dec-rapid" : "dec-mega";
  const decResp = await fetchWithTimeout(`${ENC_DEC_API}/${decEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: mediaJson.result, agent: USER_AGENT }),
  });
  const decrypted = await validate<unknown>(decResp, decEndpoint);
  const url = findStreamUrl(decrypted);
  if (!url) return null;
  return { url, subtitles: findSubtitles(decrypted) };
}

// Fast path: the kai database ships pre-scraped megaup paths per episode, so
// most of the time we can skip scraping animekai.to entirely.
async function tryDatabasePath(
  entry: KaiEntry,
  season: string,
  episode: string,
  preferredAudio: string,
  trace: string[]
): Promise<{ url: string; referer: string; subtitles: SubtitleTrack[] } | null> {
  const episodeData = entry.episodes?.[season]?.[episode];
  const megaupMirrors = mergeMirrors(entry.info?.mirrors?.megaup, CURRENT_MEGAUP_MIRRORS);
  if (!episodeData) {
    trace.push(`fast: no episode data for ${season}x${episode}`);
    return null;
  }
  if (megaupMirrors.length === 0) {
    trace.push("fast: no megaup mirrors listed in database entry");
    return null;
  }

  const audioTracks = [preferredAudio, "sub", "softsub", "dub"].filter(
    (v, i, arr) => arr.indexOf(v) === i
  );

  // Mirror as the outer loop: if one is entirely down, a single timeout
  // retires it instead of re-waiting on it for every track/server combo.
  for (const mirror of megaupMirrors) {
    let mirrorDead = false;

    for (const track of audioTracks) {
      if (mirrorDead) break;
      const sources = episodeData.sources?.[track];
      if (!sources) continue;

      for (const serverKey of ["server1", "server2"]) {
        if (mirrorDead) break;
        const path = sources[serverKey];
        if (!path) continue;

        try {
          const result = await decryptHosterMedia(`${mirror}${path}`, mirror);
          if (result) return { ...result, referer: mirror };
          trace.push(`fast: ${mirror} (${track}/${serverKey}) decrypted to no URL`);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          trace.push(`fast: ${mirror} (${track}/${serverKey}) failed - ${message}`);
          if (message.includes("timed out") || message.includes("fetch failed")) {
            mirrorDead = true;
          }
        }
      }
    }
  }
  return null;
}

// Fallback: scrape animekai.to live (mirrors the animekai.py sample). Slower,
// but picks up currently-working servers even if the cached database entry
// points at a dead mirror.
async function tryLiveScrape(
  entry: KaiEntry,
  season: string,
  episode: string,
  preferredAudio: string,
  trace: string[]
): Promise<{ url: string; referer: string; subtitles: SubtitleTrack[] } | null> {
  const watchPath = entry.info?.kai_watch;
  const animekaiMirrors = mergeMirrors(entry.info?.mirrors?.animekai, CURRENT_ANIMEKAI_MIRRORS);
  if (!watchPath) {
    trace.push("live: no kai_watch path in database entry");
    return null;
  }
  if (animekaiMirrors.length === 0) {
    trace.push("live: no animekai mirrors listed in database entry");
    return null;
  }

  for (const site of animekaiMirrors) {
    try {
      const kaiHeaders = { "User-Agent": USER_AGENT, Referer: site, Accept: "application/json" };

      // 1. Fetch the watch page and extract animekai's internal content id.
      const pageResp = await fetchWithTimeout(`${site}${watchPath}`, {
        headers: { "User-Agent": USER_AGENT },
      });
      if (!pageResp.ok) {
        trace.push(`live: ${site} watch page returned ${pageResp.status}`);
        continue;
      }
      const html = await pageResp.text();
      const idMatch = html.match(/<div[^>]*id="anime-rating"[^>]*data-id="([^"]+)"/);
      if (!idMatch) {
        trace.push(`live: ${site} watch page had no data-id (markup may have changed)`);
        continue;
      }
      const contentId = idMatch[1];

      // 2. Encrypt the content id, then fetch + parse the episodes list.
      const encIdResp = await fetchWithTimeout(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(contentId)}`);
      const encId = await validate<string>(encIdResp, "enc-kai (content id)");

      const episodesResp = await fetchWithTimeout(
        `${site}ajax/episodes/list?ani_id=${contentId}&_=${encId}`,
        { headers: kaiHeaders }
      );
      const episodesJson = await episodesResp.json();
      if (episodesJson.status !== 200) {
        trace.push(`live: ${site} episodes/list status ${episodesJson.status}`);
        continue;
      }

      const episodesParsedResp = await fetchWithTimeout(`${ENC_DEC_API}/parse-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: episodesJson.result }),
      });
      const episodes = await validate<Record<string, Record<string, { token: string }>>>(
        episodesParsedResp,
        "parse-html (episodes)"
      );

      const token = episodes?.[season]?.[episode]?.token;
      if (!token) {
        trace.push(`live: ${site} has no token for episode ${season}x${episode}`);
        continue;
      }

      // 3. Encrypt the episode token, then fetch + parse the servers list.
      const encTokenResp = await fetchWithTimeout(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(token)}`);
      const encToken = await validate<string>(encTokenResp, "enc-kai (token)");

      const serversResp = await fetchWithTimeout(`${site}ajax/links/list?token=${token}&_=${encToken}`, {
        headers: kaiHeaders,
      });
      const serversJson = await serversResp.json();
      if (serversJson.status !== 200) {
        trace.push(`live: ${site} links/list status ${serversJson.status}`);
        continue;
      }

      const serversParsedResp = await fetchWithTimeout(`${ENC_DEC_API}/parse-html`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: serversJson.result }),
      });
      const servers = await validate<Record<string, Record<string, { lid: string }>>>(
        serversParsedResp,
        "parse-html (servers)"
      );

      const audioTracks = [preferredAudio, "sub", "softsub", "dub"].filter(
        (v, i, arr) => arr.indexOf(v) === i
      );

      for (const track of audioTracks) {
        const trackServers = servers?.[track];
        if (!trackServers) continue;

        for (const serverId of Object.keys(trackServers)) {
          const lid = trackServers[serverId]?.lid;
          if (!lid) continue;

          try {
            // 4. Encrypt the server lid, fetch the embed view, and decrypt it.
            const encLidResp = await fetchWithTimeout(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(lid)}`);
            const encLid = await validate<string>(encLidResp, "enc-kai (lid)");

            const embedResp = await fetchWithTimeout(`${site}ajax/links/view?id=${lid}&_=${encLid}`, {
              headers: kaiHeaders,
            });
            const embedJson = await embedResp.json();
            if (embedJson.status !== 200) {
              trace.push(`live: ${site} links/view (${track}/${serverId}) status ${embedJson.status}`);
              continue;
            }

            const decKaiResp = await fetchWithTimeout(`${ENC_DEC_API}/dec-kai`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: embedJson.result }),
            });
            const decKai = await validate<{ url: string }>(decKaiResp, "dec-kai");
            const embedUrl = decKai.url;

            // 5. Resolve the embed to a /media/ url and decrypt via the matching hoster.
            const hosterReferer = embedUrl.split("/e/")[0] + "/";
            const mediaUrl = embedUrl.replace("/e/", "/media/");
            const result = await decryptHosterMedia(mediaUrl, hosterReferer);
            if (result) return { ...result, referer: hosterReferer };
            trace.push(`live: ${site} (${track}/${serverId}) decrypted to no URL`);
          } catch (err) {
            trace.push(
              `live: ${site} (${track}/${serverId}) failed - ${
                err instanceof Error ? err.message : String(err)
              }`
            );
          }
        }
      }
    } catch (err) {
      trace.push(`live: ${site} failed - ${err instanceof Error ? err.message : String(err)}`);
    }
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const anilistId = searchParams.get("anilistId");
  const season = searchParams.get("season") || "1";
  const episode = searchParams.get("episode") || "1";
  const preferredAudio = searchParams.get("audio") === "dub" ? "dub" : "sub";

  return ndjsonResponse(async (send) => {
    if (!anilistId) {
      send({ type: "error", error: "anilistId is required" });
      return;
    }

    try {
      send({ type: "status", message: "Looking up episode..." });
      const findResp = await fetchWithTimeout(`${KAI_DB}/find?anilist_id=${encodeURIComponent(anilistId)}`);
      if (!findResp.ok) {
        send({ type: "error", error: `kai database lookup failed: ${findResp.status}` });
        return;
      }
      const entries: KaiEntry[] = await findResp.json();
      if (!Array.isArray(entries) || entries.length === 0) {
        send({ type: "error", error: "This title isn't in the animekai database yet" });
        return;
      }
      const entry = entries[0];
      const trace: string[] = [];

      send({ type: "status", message: "Trying animekai (megaup)..." });
      const fast = await tryDatabasePath(entry, season, episode, preferredAudio, trace).catch(
        (err) => {
          trace.push(`fast: threw - ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }
      );
      if (fast) {
        send({ type: "result", ...fast, source: "animekai" });
        return;
      }

      send({ type: "status", message: "megaup unavailable, trying animekai live scrape..." });
      const live = await tryLiveScrape(entry, season, episode, preferredAudio, trace).catch(
        (err) => {
          trace.push(`live: threw - ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }
      );
      if (live) {
        send({ type: "result", ...live, source: "animekai" });
        return;
      }

      console.error("AnimeKai: all sources failed", trace);
      send({ error: "All known servers for this episode are currently unreachable", type: "error", trace });
    } catch (error) {
      console.error("AnimeKai stream error:", error);
      send({ type: "error", error: error instanceof Error ? error.message : "Unknown error" });
    }
  });
}
