import { findStreamUrl, findSubtitles, type SubtitleTrack } from "@/lib/stream-utils";
import { fetchWithTimeout } from "@/lib/fetch-timeout";
import { solveStage1, solveStage2 } from "./cinesrc-challenge";

// See samples/cinesrc.py in the EncDecEndpoints repo: bootstrap cookies ->
// two proof-of-work challenges -> enc-cinesrc -> Next.js server actions for the
// provider list and stream -> dec-cinesrc.

const ENC_DEC_API = "https://enc-dec.app/api";
const ORIGIN = "https://cinesrc.st";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.37 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.37";

const BASE_HEADERS = {
  Origin: ORIGIN,
  Referer: `${ORIGIN}/`,
  "Content-Type": "text/plain;charset=UTF-8",
  "User-Agent": USER_AGENT,
};

export interface CinesrcParams {
  tmdbId: string;
  imdbId: string;
  mediaType: "movie" | "tv";
  season?: string;
  episode?: string;
}

async function getJson<T>(url: string, headers: Record<string, string>): Promise<T> {
  const resp = await fetchWithTimeout(url, { headers }, 10000);
  if (!resp.ok) throw new Error(`${new URL(url).pathname} returned ${resp.status}`);
  return resp.json();
}

export async function fetchCinesrcStream(
  params: CinesrcParams,
  trace: string[]
): Promise<{ url: string; referer: string; subtitles: SubtitleTrack[] } | null> {
  const isTv = params.mediaType === "tv";
  const embedUrl = isTv
    ? `${ORIGIN}/embed/tv/${params.imdbId}?s=${params.season}&e=${params.episode}`
    : `${ORIGIN}/embed/movie/${params.imdbId}`;

  try {
    const fields = [params.mediaType, params.tmdbId, isTv ? params.season : null, isTv ? params.episode : null];
    const encoded = Buffer.from(JSON.stringify(fields)).toString("base64url");

    const bootstrapResp = await fetchWithTimeout(
      `${ORIGIN}/api/c/bootstrap`,
      { method: "POST", headers: { ...BASE_HEADERS, "x-cs-q": encoded } },
      10000
    );
    if (!bootstrapResp.ok) {
      trace.push(`cinesrc: bootstrap returned ${bootstrapResp.status}`);
      return null;
    }
    const bootstrap: { r: string; p: string } = await bootstrapResp.json();
    const cookies = { "x-cs-q": encoded, "x-cs-r": bootstrap.r, "x-cs-p": bootstrap.p };
    const challengeHeaders = { ...BASE_HEADERS, ...cookies };

    const challenge1 = await getJson<{ w: string }>(`${ORIGIN}/api/c/issue`, challengeHeaders);
    const challenge2 = await getJson<{ pack: string[] }>(`${ORIGIN}/api/c/stage2/issue`, challengeHeaders);
    const challengeData = {
      stage1: { challenge: challenge1, solution: solveStage1(challenge1) },
      stage2: { challenge: challenge2, solution: solveStage2(challenge2) },
    };

    const encResp = await fetchWithTimeout(`${ENC_DEC_API}/enc-cinesrc`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: embedUrl, agent: USER_AGENT, challenge_data: challengeData }),
    });
    const encJson: {
      status: number;
      error?: string;
      result?: {
        token: string;
        key: string;
        headers: { getProviderList: string; getStream: string };
      };
    } = await encResp.json();
    if (encJson.status !== 200 || !encJson.result) {
      trace.push(`cinesrc: enc-cinesrc error - ${encJson.error || "unknown"}`);
      return null;
    }
    const { token, key, headers: actions } = encJson.result;
    const fullToken = `${token}::c3::${cookies["x-cs-r"]}`;

    const providersResp = await fetchWithTimeout(embedUrl, {
      method: "POST",
      headers: { ...BASE_HEADERS, "Next-Action": actions.getProviderList },
      body: "[]",
    });
    const providersText = await providersResp.text();
    const providersLine = providersText.split("\n")[1];
    if (!providersLine) {
      trace.push(`cinesrc: unexpected provider list response (${providersResp.status})`);
      return null;
    }
    const providers: Array<{ id: string }> = JSON.parse(providersLine.slice(providersLine.indexOf(":") + 1));

    for (const provider of providers) {
      try {
        const streamResp = await fetchWithTimeout(embedUrl, {
          method: "POST",
          headers: { ...BASE_HEADERS, "Next-Action": actions.getStream },
          body: JSON.stringify([
            params.tmdbId,
            isTv ? "show" : "movie",
            isTv ? params.season : "$undefined",
            isTv ? params.episode : "$undefined",
            fullToken,
            provider.id,
          ]),
        });
        if (!streamResp.ok) {
          trace.push(`cinesrc: provider ${provider.id} returned ${streamResp.status}`);
          continue;
        }
        const rawText = await streamResp.text();
        if (rawText.includes("invalid_challenge")) {
          trace.push("cinesrc: server rejected the proof-of-work challenge (invalid_challenge)");
          return null;
        }
        const line = rawText.split("\n")[1] || "";
        const afterComma = line.slice(line.indexOf(",") + 1);
        const encrypted = afterComma.split(":")[0];

        const decResp = await fetchWithTimeout(`${ENC_DEC_API}/dec-cinesrc`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: encrypted, key }),
        });
        const decJson: { status: number; result?: unknown; error?: string } = await decResp.json();
        if (decJson.status !== 200 || decJson.result === undefined) {
          trace.push(`cinesrc: provider ${provider.id} dec error - ${decJson.error || "unknown"}`);
          continue;
        }

        const url = findStreamUrl(decJson.result);
        if (url) return { url, referer: `${ORIGIN}/`, subtitles: findSubtitles(decJson.result) };
        trace.push(`cinesrc: provider ${provider.id} decrypted to no URL`);
      } catch (err) {
        trace.push(`cinesrc: provider ${provider.id} failed - ${err instanceof Error ? err.message : String(err)}`);
      }
    }
    return null;
  } catch (err) {
    trace.push(`cinesrc: threw - ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}
