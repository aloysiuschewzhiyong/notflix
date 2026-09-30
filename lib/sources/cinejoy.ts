import { findStreamUrl, findSubtitles, type SubtitleTrack } from "@/lib/stream-utils";

// cinejoy.pk resolves servers through a separate relay (api.wing.st) and
// exchanges raw encrypted bytes rather than JSON text (see samples/cinejoy.py).

const ENC_DEC_API = "https://enc-dec.app/api";
const WING_API = "https://api.wing.st";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

const HEADERS = {
  Accept: "*/*",
  Origin: "https://cinejoy.pk",
  Referer: "https://cinejoy.pk/",
  "User-Agent": USER_AGENT,
};

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

function base64UrlEncode(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(str: string): Buffer {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Buffer.from(s, "base64");
}

export interface CinejoyParams {
  tmdbId: string;
  imdbId?: string;
  title: string;
  year: string;
  mediaType: "movie" | "tv";
  season?: string;
  episode?: string;
}

export async function fetchCinejoyStream(
  params: CinejoyParams,
  trace: string[]
): Promise<{ url: string; referer: string; subtitles: SubtitleTrack[] } | null> {
  try {
    const serversResp = await fetch(`${WING_API}/servers`, { headers: HEADERS });
    if (!serversResp.ok) {
      trace.push(`cinejoy: servers list returned ${serversResp.status}`);
      return null;
    }
    const { servers } = await serversResp.json();
    if (!Array.isArray(servers) || servers.length === 0) {
      trace.push("cinejoy: no servers returned");
      return null;
    }

    // Prefer servers wing.st itself reports as healthy, but still fall back
    // to the rest rather than giving up outright.
    const okServers = servers.filter((s: { status?: string }) => s.status === "ok");
    const orderedServers = okServers.length > 0 ? okServers : servers;

    const type = params.mediaType === "tv" ? "series" : "movie";

    for (const serverInfo of orderedServers) {
      try {
        const server = serverInfo.name;
        const wingUrl = new URL(WING_API + "/");
        wingUrl.searchParams.set("title", params.title);
        wingUrl.searchParams.set("type", type);
        wingUrl.searchParams.set("year", params.year);
        wingUrl.searchParams.set("imdb", params.imdbId || "");
        wingUrl.searchParams.set("tmdb", params.tmdbId);
        wingUrl.searchParams.set("server", server);
        if (params.mediaType === "tv") {
          wingUrl.searchParams.set("season", params.season || "1");
          wingUrl.searchParams.set("episode", params.episode || "1");
        }

        const encResp = await fetch(
          `${ENC_DEC_API}/enc-cinejoy?url=${encodeURIComponent(wingUrl.toString())}`
        );
        const enc = await validate<{ data: string; state: unknown }>(encResp, "enc-cinejoy");

        const relayResp = await fetch(`${WING_API}/g`, {
          method: "POST",
          headers: HEADERS,
          body: base64UrlDecode(enc.data),
        });
        if (!relayResp.ok) {
          trace.push(`cinejoy: server ${server} relay returned ${relayResp.status}`);
          continue;
        }
        const encryptedBuffer = Buffer.from(await relayResp.arrayBuffer());

        const decResp = await fetch(`${ENC_DEC_API}/dec-cinejoy`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: base64UrlEncode(encryptedBuffer), state: enc.state }),
        });
        const decrypted = await validate<unknown>(decResp, "dec-cinejoy");

        const url = findStreamUrl(decrypted);
        if (url) return { url, referer: HEADERS.Referer, subtitles: findSubtitles(decrypted) };
        trace.push(`cinejoy: server ${server} decrypted to no URL`);
      } catch (err) {
        trace.push(
          `cinejoy: server ${serverInfo?.name} failed - ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
    return null;
  } catch (err) {
    trace.push(`cinejoy: threw - ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
