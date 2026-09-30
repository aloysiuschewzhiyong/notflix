import { NextRequest, NextResponse } from "next/server";

const DEFAULT_REFERER = "https://vidfast.vc/";
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36";

function isPlaylist(url: string, contentType: string) {
  return (
    url.includes(".m3u8") ||
    contentType.includes("mpegurl") ||
    contentType.includes("x-mpegurl")
  );
}

function isSubtitle(url: string, contentType: string) {
  return (
    /\.(vtt|srt)(\?|$)/i.test(url) ||
    contentType.includes("vtt") ||
    contentType.includes("x-subrip") ||
    contentType.includes("srt")
  );
}

// The <track> element only understands WebVTT, but these sources sometimes
// hand out .srt - convert on the fly instead of dropping the track.
function srtToVtt(srt: string): string {
  const body = srt
    .replace(/\r+/g, "")
    .replace(/^\d+\n(?=\d{2}:\d{2}:\d{2})/gm, "")
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, "$1.$2");
  return `WEBVTT\n\n${body}`;
}

// Wyzie's free tier injects a "you're on the free plan" promo cue into every
// file - strip any cue block that mentions it rather than showing it as if
// it were part of the actual subtitles.
function stripPromoCues(vtt: string): string {
  const [header, ...blocks] = vtt.split(/\n\n+/);
  return [header, ...blocks.filter((b) => !b.toLowerCase().includes("wyzie.io"))].join("\n\n");
}

function rewritePlaylist(text: string, baseUrl: string, proxyBase: string, referer: string) {
  const toProxyUrl = (raw: string) => {
    const abs = raw.startsWith("http") ? raw : new URL(raw, baseUrl).toString();
    return `${proxyBase}?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(referer)}`;
  };

  return text
    .split("\n")
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;

      if (trimmed.startsWith("#")) {
        // Rewrite any URI="..." attribute: covers EXT-X-KEY, EXT-X-MAP, and
        // EXT-X-MEDIA (how HLS embeds subtitle/audio renditions) alike, so
        // subtitle playlists get the same Referer treatment as video segments.
        if (/URI="[^"]+"/.test(trimmed)) {
          return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${toProxyUrl(uri)}"`);
        }
        return line;
      }

      return toProxyUrl(trimmed);
    })
    .join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");
  const referer = searchParams.get("ref") || DEFAULT_REFERER;

  if (!target) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  try {
    const upstream = await fetch(target, {
      headers: {
        "User-Agent": USER_AGENT,
        Referer: referer,
      },
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { error: `Upstream returned ${upstream.status}` },
        { status: upstream.status }
      );
    }

    const contentType = upstream.headers.get("content-type") || "";

    if (isPlaylist(target, contentType)) {
      const text = await upstream.text();
      const baseUrl = target.substring(0, target.lastIndexOf("/") + 1);
      const proxyBase = new URL("/api/stream/proxy", request.url).toString();
      const rewritten = rewritePlaylist(text, baseUrl, proxyBase, referer);

      return new NextResponse(rewritten, {
        headers: {
          "Content-Type": "application/vnd.apple.mpegurl",
          "Cache-Control": "no-cache",
        },
      });
    }

    if (isSubtitle(target, contentType)) {
      const text = await upstream.text();
      const vtt = /\.srt(\?|$)/i.test(target) || contentType.includes("srt") ? srtToVtt(text) : text;

      return new NextResponse(stripPromoCues(vtt), {
        headers: {
          "Content-Type": "text/vtt; charset=utf-8",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const buffer = await upstream.arrayBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": contentType || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Proxy error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy failed" },
      { status: 502 }
    );
  }
}
