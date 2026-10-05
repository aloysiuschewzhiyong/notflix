import { ndjsonResponse } from "@/lib/ndjson-stream";
import { fetchTokenFamilyStream, VIDFAST, VIDCORE, VIDUP } from "@/lib/sources/token-family";
import { fetchCinejoyStream } from "@/lib/sources/cinejoy";
import { fetchCinesrcStream } from "@/lib/sources/cinesrc";
import { MOVIE_SOURCES } from "@/lib/sources/registry";
import { fetchWyzieSubtitles } from "@/lib/subtitles/wyzie";
import { getMovieDetails, getTVShowDetails } from "@/utils/tmdb";
import type { SubtitleTrack } from "@/lib/stream-utils";

type SourceResult = { url: string; referer: string; subtitles: SubtitleTrack[] } | null;

interface Metadata {
  title: string;
  year: string;
  imdbId?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tmdbId = searchParams.get("tmdbId");
  const mediaType = searchParams.get("mediaType") === "tv" ? "tv" : "movie";
  const season = searchParams.get("season") || undefined;
  const episode = searchParams.get("episode") || undefined;
  const requestedSource = searchParams.get("source");

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

    // cinejoy and cinesrc need title/year/imdb id; fetch once, only if reached.
    let metadataPromise: Promise<Metadata | null> | undefined;
    const getMetadata = () => {
      metadataPromise ??= (async () => {
        try {
          const details =
            mediaType === "movie" ? await getMovieDetails(tmdbId) : await getTVShowDetails(tmdbId);
          const title = mediaType === "movie" ? details.title : details.name;
          const year =
            (mediaType === "movie" ? details.release_date : details.first_air_date)?.slice(0, 4) || "";
          const imdbId = mediaType === "movie" ? details.imdb_id : details.external_ids?.imdb_id;
          return title ? { title, year, imdbId } : null;
        } catch (err) {
          trace.push(`metadata lookup failed - ${err instanceof Error ? err.message : String(err)}`);
          return null;
        }
      })();
      return metadataPromise;
    };

    const sources: Array<{ name: string; run: () => Promise<SourceResult> }> = [
      {
        name: "vidfast",
        run: () => fetchTokenFamilyStream(VIDFAST, tmdbId, mediaType, season, episode, trace),
      },
      {
        name: "cinejoy",
        run: async () => {
          const meta = await getMetadata();
          if (!meta) {
            trace.push("cinejoy: no title available from TMDB, skipped");
            return null;
          }
          return fetchCinejoyStream({ tmdbId, imdbId: meta.imdbId, ...meta, mediaType, season, episode }, trace);
        },
      },
      {
        name: "vidcore",
        run: () => fetchTokenFamilyStream(VIDCORE, tmdbId, mediaType, season, episode, trace),
      },
      {
        name: "vidup",
        run: () => fetchTokenFamilyStream(VIDUP, tmdbId, mediaType, season, episode, trace),
      },
      {
        name: "cinesrc",
        run: async () => {
          const meta = await getMetadata();
          if (!meta?.imdbId) {
            trace.push("cinesrc: no IMDB id available from TMDB, skipped");
            return null;
          }
          return fetchCinesrcStream({ tmdbId, imdbId: meta.imdbId, mediaType, season, episode }, trace);
        },
      },
    ];

    // A specific source can be forced (manual switching); otherwise cascade through all.
    const forced = requestedSource && requestedSource !== "auto";
    if (forced && !(MOVIE_SOURCES as readonly string[]).includes(requestedSource)) {
      send({ type: "error", error: `Unknown source: ${requestedSource}` });
      return;
    }
    const queue = forced ? sources.filter((s) => s.name === requestedSource) : sources;

    const failed: string[] = [];
    for (const source of queue) {
      send({
        type: "status",
        message: failed.length
          ? `${failed[failed.length - 1]} unavailable, trying ${source.name}...`
          : `Trying ${source.name}...`,
      });

      const result = await source.run().catch((err) => {
        trace.push(`${source.name}: threw - ${err instanceof Error ? err.message : String(err)}`);
        return null;
      });

      if (result) {
        const external = await subtitlesPromise;
        const seen = new Set(result.subtitles.map((s) => s.lang));
        const subtitles = [...result.subtitles, ...external.filter((s) => !seen.has(s.lang))];
        send({ type: "status", message: `Connected via ${source.name}` });
        send({ type: "result", ...result, subtitles, source: source.name });
        return;
      }
      failed.push(source.name);
    }

    console.error("Movie stream: all sources failed", trace);
    send({
      type: "error",
      error: `All sources failed (${failed.join(", ")})`,
      trace,
    });
  });
}
