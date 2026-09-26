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

      if (trimmed.startsWith("#EXT-X-KEY") || trimmed.startsWith("#EXT-X-MAP")) {
        return trimmed.replace(/URI="([^"]+)"/, (_, uri) => `URI="${toProxyUrl(uri)}"`);
      }

      if (trimmed.startsWith("#")) return line;

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
