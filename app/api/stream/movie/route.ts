import { ndjsonResponse } from "@/lib/ndjson-stream";
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

  return ndjsonResponse(async (send) => {
    if (!tmdbId) {
      send({ type: "error", error: "tmdbId is required" });
      return;
    }
    if (mediaType === "tv" && (!season || !episode)) {
      send({ type: "error", error: "season and episode are required for tv" });
      return;
    }

    const trace: string[] = [];

    // Kicked off immediately so it overlaps with the video source cascade
    // below instead of adding its own latency to playback start.
    const subtitlesPromise = fetchWyzieSubtitles({ tmdbId, season, episode }).catch(() => []);

    async function finish(result: { url: string; referer: string; subtitles: SubtitleTrack[] }, source: string) {
      const external = await subtitlesPromise;
      const seen = new Set(result.subtitles.map((s) => s.lang));
      const subtitles = [...result.subtitles, ...external.filter((s) => !seen.has(s.lang))];
      send({ type: "result", ...result, subtitles, source });
    }

    // Generic "Server N" labels: real progress without naming the actual
    // providers behind each attempt.
    send({ type: "status", message: "Connecting to Server 1..." });
    const vidfast = await fetchTokenFamilyStream(VIDFAST, tmdbId, mediaType, season, episode, trace);
    if (vidfast) return finish(vidfast, "vidfast");

    send({ type: "status", message: "Server 1 unavailable, trying Server 2..." });
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
        if (cinejoy) return finish(cinejoy, "cinejoy");
      } else {
        trace.push("cinejoy: no title available from TMDB, skipped");
      }
    } catch (err) {
      trace.push(
        `cinejoy: metadata lookup failed - ${err instanceof Error ? err.message : String(err)}`
      );
    }

    send({ type: "status", message: "Server 2 unavailable, trying Server 3..." });
    const vidcore = await fetchTokenFamilyStream(VIDCORE, tmdbId, mediaType, season, episode, trace);
    if (vidcore) return finish(vidcore, "vidcore");

    send({ type: "status", message: "Server 3 unavailable, trying Server 4..." });
    const vidup = await fetchTokenFamilyStream(VIDUP, tmdbId, mediaType, season, episode, trace);
    if (vidup) return finish(vidup, "vidup");

    console.error("Movie stream: all sources failed", trace);
    send({ type: "error", error: "All streaming sources are currently unreachable", trace });
  });
}
