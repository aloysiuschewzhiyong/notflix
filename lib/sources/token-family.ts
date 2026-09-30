import { findStreamUrl, findSubtitles, type SubtitleTrack } from "@/lib/stream-utils";

// vidfast, vidcore and vidup all share the exact same page-scrape + token
// dance (see samples/vidfast.py, vidcore.py, vidup.py in the EncDecEndpoints
// repo) - only the domain and enc-dec.app endpoint slug differ.

const ENC_DEC_API = "https://enc-dec.app/api";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

export interface TokenFamilySource {
  name: string;
  domain: string; // e.g. "https://vidfast.vc/"
  slug: string; // enc-dec.app endpoint suffix, e.g. "vidfast"
}

export const VIDFAST: TokenFamilySource = { name: "vidfast", domain: "https://vidfast.vc/", slug: "vidfast" };
export const VIDCORE: TokenFamilySource = { name: "vidcore", domain: "https://vidcore.io/", slug: "vidcore" };
export const VIDUP: TokenFamilySource = { name: "vidup", domain: "https://vidup.to/", slug: "vidup" };

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

export async function fetchTokenFamilyStream(
  source: TokenFamilySource,
  tmdbId: string,
  mediaType: "movie" | "tv",
  season: string | undefined,
  episode: string | undefined,
  trace: string[]
): Promise<{ url: string; referer: string; subtitles: SubtitleTrack[] } | null> {
  const baseUrl =
    mediaType === "tv"
      ? `${source.domain}tv/${tmdbId}/${season}/${episode}/`
      : `${source.domain}movie/${tmdbId}/`;

  const headers = {
    "User-Agent": USER_AGENT,
    Referer: source.domain,
    "X-Requested-With": "XMLHttpRequest",
  };

  try {
    const pageResp = await fetch(baseUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!pageResp.ok) {
      trace.push(`${source.name}: page fetch returned ${pageResp.status}`);
      return null;
    }
    const html = await pageResp.text();
    const match = html.match(/\\"(?:en|token)\\":\\"(.*?)\\"/);
    if (!match) {
      trace.push(`${source.name}: could not locate token in page (markup may have changed)`);
      return null;
    }
    const extractedText = match[1];

    const encResp = await fetch(
      `${ENC_DEC_API}/enc-${source.slug}?text=${encodeURIComponent(extractedText)}`
    );
    const encData = await validate<{ servers: string; stream: string; token: string }>(
      encResp,
      `enc-${source.slug}`
    );
    const { servers, stream, token } = encData;

    const serversResp = await fetch(servers, {
      method: "POST",
      headers: { ...headers, "X-CSRF-Token": token },
    });
    const serversEncrypted = await serversResp.text();

    const decServersResp = await fetch(`${ENC_DEC_API}/dec-${source.slug}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: serversEncrypted }),
    });
    const serversDecrypted = await validate<Array<{ data: string }>>(
      decServersResp,
      `dec-${source.slug} (servers)`
    );

    if (!Array.isArray(serversDecrypted) || serversDecrypted.length === 0) {
      trace.push(`${source.name}: no servers returned`);
      return null;
    }

    for (const server of serversDecrypted) {
      try {
        const streamUrl = `${stream}/${server.data}`;
        const streamResp = await fetch(streamUrl, {
          method: "POST",
          headers: { ...headers, "X-CSRF-Token": token },
        });
        const streamEncrypted = await streamResp.text();

        const decStreamResp = await fetch(`${ENC_DEC_API}/dec-${source.slug}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: streamEncrypted }),
        });
        const streamDecrypted = await validate<unknown>(decStreamResp, `dec-${source.slug} (stream)`);

        const url = findStreamUrl(streamDecrypted);
        if (url) return { url, referer: source.domain, subtitles: findSubtitles(streamDecrypted) };
        trace.push(`${source.name}: server decrypted to no URL`);
      } catch (err) {
        trace.push(`${source.name}: server failed - ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return null;
  } catch (err) {
    trace.push(`${source.name}: threw - ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
