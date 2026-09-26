import { NextResponse } from "next/server";
import { findStreamUrl } from "@/lib/stream-utils";

const ENC_DEC_API = "https://enc-dec.app/api";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";
const VIDFAST_REFERER = "https://vidfast.vc/";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const season = searchParams.get("season");
  const episode = searchParams.get("episode");

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }
  if (mediaType === "tv" && (!season || !episode)) {
    return NextResponse.json({ error: "season and episode are required for tv" }, { status: 400 });
  }

  const baseUrl =
    mediaType === "tv"
      ? `https://vidfast.vc/tv/${tmdbId}/${season}/${episode}/`
      : `https://vidfast.vc/movie/${tmdbId}/`;

  const vidfastHeaders = {
    "User-Agent": USER_AGENT,
    Referer: VIDFAST_REFERER,
    "X-Requested-With": "XMLHttpRequest",
  };

  try {
    // 1. Fetch the vidfast page and extract the embedded token.
    const pageResp = await fetch(baseUrl, { headers: { "User-Agent": USER_AGENT } });
    if (!pageResp.ok) {
      return NextResponse.json(
        { error: `Failed to fetch vidfast page: ${pageResp.status}` },
        { status: 502 }
      );
    }
    const html = await pageResp.text();
    const match = html.match(/\\"(?:en|token)\\":\\"(.*?)\\"/);
    if (!match) {
      return NextResponse.json(
        { error: "Could not locate token in vidfast page (site markup may have changed)" },
        { status: 502 }
      );
    }
    const extractedText = match[1];

    // 2. Encrypt the extracted text to get servers/stream URLs + CSRF token.
    const encResp = await fetch(`${ENC_DEC_API}/enc-vidfast?text=${encodeURIComponent(extractedText)}`);
    const encData = await validate<{ servers: string; stream: string; token: string }>(
      encResp,
      "enc-vidfast"
    );
    const { servers, stream, token } = encData;

    // 3. Fetch + decrypt the servers list.
    const serversResp = await fetch(servers, {
      method: "POST",
      headers: { ...vidfastHeaders, "X-CSRF-Token": token },
    });
    const serversEncrypted = await serversResp.text();

    const decServersResp = await fetch(`${ENC_DEC_API}/dec-vidfast`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: serversEncrypted }),
    });
    const serversDecrypted = await validate<Array<{ data: string; [key: string]: unknown }>>(
      decServersResp,
      "dec-vidfast (servers)"
    );

    if (!Array.isArray(serversDecrypted) || serversDecrypted.length === 0) {
      return NextResponse.json({ error: "No servers returned by vidfast" }, { status: 502 });
    }

    // 4. Try each server until one yields a playable stream URL.
    let lastError = "";
    for (const server of serversDecrypted) {
      try {
        const streamUrl = `${stream}/${server.data}`;
        const streamResp = await fetch(streamUrl, {
          method: "POST",
          headers: { ...vidfastHeaders, "X-CSRF-Token": token },
        });
        const streamEncrypted = await streamResp.text();

        const decStreamResp = await fetch(`${ENC_DEC_API}/dec-vidfast`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: streamEncrypted }),
        });
        const streamDecrypted = await validate<unknown>(decStreamResp, "dec-vidfast (stream)");

        const url = findStreamUrl(streamDecrypted);
        if (url) {
          return NextResponse.json({ url, referer: VIDFAST_REFERER });
        }
        lastError = "No URL found in decrypted stream payload";
      } catch (err) {
        lastError = err instanceof Error ? err.message : "Unknown server error";
      }
    }

    return NextResponse.json(
      { error: `All servers failed. Last error: ${lastError}` },
      { status: 502 }
    );
  } catch (error) {
    console.error("Vidfast stream error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
