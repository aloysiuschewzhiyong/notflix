import { NextResponse } from "next/server";
import { fetchTokenFamilyStream, VIDFAST, VIDCORE, VIDUP } from "@/lib/sources/token-family";
import { fetchCinejoyStream } from "@/lib/sources/cinejoy";
import { fetchWyzieSubtitles } from "@/lib/subtitles/wyzie";
import { getMovieDetails, getTVShowDetails } from "@/utils/tmdb";
import type { SubtitleTrack } from "@/lib/stream-utils";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const season = searchParams.get("season") || undefined;
  const episode = searchParams.get("episode") || undefined;

  if (!tmdbId) {
    return NextResponse.json({ error: "tmdbId is required" }, { status: 400 });
  }
  if (mediaType === "tv" && (!season || !episode)) {
    return NextResponse.json({ error: "season and episode are required for tv" }, { status: 400 });
  }

  const trace: string[] = [];

  // Kicked off immediately so it overlaps with the video source cascade below
  // instead of adding its own latency to playback start.
  const subtitlesPromise = fetchWyzieSubtitles({ tmdbId, season, episode }).catch(() => []);

  async function withSubtitles(
    result: { url: string; referer: string; subtitles: SubtitleTrack[] },
    source: string
  ) {
    const external = await subtitlesPromise;
    const seen = new Set(result.subtitles.map((s) => s.lang));
    const subtitles = [...result.subtitles, ...external.filter((s) => !seen.has(s.lang))];
    return NextResponse.json({ ...result, subtitles, source });
  }

  // vidfast first: fastest path, needs no extra metadata.
  const vidfast = await fetchTokenFamilyStream(VIDFAST, tmdbId, mediaType, season, episode, trace);
  if (vidfast) return withSubtitles(vidfast, "vidfast");

  // cinejoy needs title/year/imdb_id, so only fetch that metadata if we get this far.
  try {
    const details =
      mediaType === "movie" ? await getMovieDetails(tmdbId) : await getTVShowDetails(tmdbId);
    const title = mediaType === "movie" ? details.title : details.name;
    const year =
      (mediaType === "movie" ? details.release_date : details.first_air_date)?.slice(0, 4) || "";
    const imdbId = mediaType === "movie" ? details.imdb_id : details.external_ids?.imdb_id;

    if (title) {
      const cinejoy = await fetchCinejoyStream(
        { tmdbId, imdbId, title, year, mediaType, season, episode },
        trace
      );
      if (cinejoy) return withSubtitles(cinejoy, "cinejoy");
    } else {
      trace.push("cinejoy: no title available from TMDB, skipped");
    }
  } catch (err) {
    trace.push(
      `cinejoy: metadata lookup failed - ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const vidcore = await fetchTokenFamilyStream(VIDCORE, tmdbId, mediaType, season, episode, trace);
  if (vidcore) return withSubtitles(vidcore, "vidcore");

  const vidup = await fetchTokenFamilyStream(VIDUP, tmdbId, mediaType, season, episode, trace);
  if (vidup) return withSubtitles(vidup, "vidup");

  console.error("Movie stream: all sources failed", trace);
  return NextResponse.json(
    { error: "All streaming sources are currently unreachable", trace },
    { status: 502 }
  );
}
