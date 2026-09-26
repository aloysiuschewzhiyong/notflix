import { NextResponse } from "next/server";
import { findStreamUrl } from "@/lib/stream-utils";

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

// Decrypts a megaup/rapidshare-style "/media/" JSON response using whichever
// enc-dec.app endpoint matches the hosting domain.
async function decryptHosterMedia(mediaUrl: string, referer: string): Promise<string | null> {
  const mediaResp = await fetch(mediaUrl, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json", Referer: referer },
  });
  if (!mediaResp.ok) throw new Error(`Hoster returned ${mediaResp.status}`);
  const mediaJson: { result?: string } = await mediaResp.json();
  if (!mediaJson.result) throw new Error("No encrypted payload from hoster");

  const decEndpoint = mediaUrl.includes("rapidshare") ? "dec-rapid" : "dec-mega";
  const decResp = await fetch(`${ENC_DEC_API}/${decEndpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: mediaJson.result, agent: USER_AGENT }),
  });
  const decrypted = await validate<unknown>(decResp, decEndpoint);
  return findStreamUrl(decrypted);
}

// Fast path: the kai database ships pre-scraped megaup paths per episode, so
// most of the time we can skip scraping animekai.to entirely.
async function tryDatabasePath(
  entry: KaiEntry,
  season: string,
  episode: string,
  preferredAudio: string,
  trace: string[]
): Promise<{ url: string; referer: string } | null> {
  const episodeData = entry.episodes?.[season]?.[episode];
  const megaupMirrors = entry.info?.mirrors?.megaup || [];
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

  for (const track of audioTracks) {
    const sources = episodeData.sources?.[track];
    if (!sources) continue;

    for (const serverKey of ["server1", "server2"]) {
      const path = sources[serverKey];
      if (!path) continue;

      for (const mirror of megaupMirrors) {
        try {
          const url = await decryptHosterMedia(`${mirror}${path}`, mirror);
          if (url) return { url, referer: mirror };
          trace.push(`fast: ${mirror} (${track}/${serverKey}) decrypted to no URL`);
        } catch (err) {
          trace.push(
            `fast: ${mirror} (${track}/${serverKey}) failed - ${
              err instanceof Error ? err.message : String(err)
            }`
          );
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
): Promise<{ url: string; referer: string } | null> {
  const watchPath = entry.info?.kai_watch;
  const animekaiMirrors = entry.info?.mirrors?.animekai || [];
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
      const pageResp = await fetch(`${site}${watchPath}`, {
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
      const encIdResp = await fetch(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(contentId)}`);
      const encId = await validate<string>(encIdResp, "enc-kai (content id)");

      const episodesResp = await fetch(
        `${site}ajax/episodes/list?ani_id=${contentId}&_=${encId}`,
        { headers: kaiHeaders }
      );
      const episodesJson = await episodesResp.json();
      if (episodesJson.status !== 200) {
        trace.push(`live: ${site} episodes/list status ${episodesJson.status}`);
        continue;
      }

      const episodesParsedResp = await fetch(`${ENC_DEC_API}/parse-html`, {
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
      const encTokenResp = await fetch(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(token)}`);
      const encToken = await validate<string>(encTokenResp, "enc-kai (token)");

      const serversResp = await fetch(`${site}ajax/links/list?token=${token}&_=${encToken}`, {
        headers: kaiHeaders,
      });
      const serversJson = await serversResp.json();
      if (serversJson.status !== 200) {
        trace.push(`live: ${site} links/list status ${serversJson.status}`);
        continue;
      }

      const serversParsedResp = await fetch(`${ENC_DEC_API}/parse-html`, {
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
            const encLidResp = await fetch(`${ENC_DEC_API}/enc-kai?text=${encodeURIComponent(lid)}`);
            const encLid = await validate<string>(encLidResp, "enc-kai (lid)");

            const embedResp = await fetch(`${site}ajax/links/view?id=${lid}&_=${encLid}`, {
              headers: kaiHeaders,
            });
            const embedJson = await embedResp.json();
            if (embedJson.status !== 200) {
              trace.push(`live: ${site} links/view (${track}/${serverId}) status ${embedJson.status}`);
              continue;
            }

            const decKaiResp = await fetch(`${ENC_DEC_API}/dec-kai`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: embedJson.result }),
            });
            const decKai = await validate<{ url: string }>(decKaiResp, "dec-kai");
            const embedUrl = decKai.url;

            // 5. Resolve the embed to a /media/ url and decrypt via the matching hoster.
            const hosterReferer = embedUrl.split("/e/")[0] + "/";
            const mediaUrl = embedUrl.replace("/e/", "/media/");
            const url = await decryptHosterMedia(mediaUrl, hosterReferer);
            if (url) return { url, referer: hosterReferer };
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

  if (!anilistId) {
    return NextResponse.json({ error: "anilistId is required" }, { status: 400 });
  }

  try {
    const findResp = await fetch(`${KAI_DB}/find?anilist_id=${encodeURIComponent(anilistId)}`);
    if (!findResp.ok) {
      return NextResponse.json(
        { error: `kai database lookup failed: ${findResp.status}` },
        { status: 502 }
      );
    }
    const entries: KaiEntry[] = await findResp.json();
    if (!Array.isArray(entries) || entries.length === 0) {
      return NextResponse.json(
        { error: "This title isn't in the animekai database yet" },
        { status: 404 }
      );
    }
    const entry = entries[0];
    const trace: string[] = [];

    const fast = await tryDatabasePath(entry, season, episode, preferredAudio, trace).catch(
      (err) => {
        trace.push(`fast: threw - ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    );
    if (fast) return NextResponse.json(fast);

    const live = await tryLiveScrape(entry, season, episode, preferredAudio, trace).catch(
      (err) => {
        trace.push(`live: threw - ${err instanceof Error ? err.message : String(err)}`);
        return null;
      }
    );
    if (live) return NextResponse.json(live);

    console.error("AnimeKai: all sources failed", trace);
    return NextResponse.json(
      {
        error: "All known servers for this episode are currently unreachable",
        trace,
      },
      { status: 502 }
    );
  } catch (error) {
    console.error("AnimeKai stream error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
