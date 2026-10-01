"use client";

import { HlsPlayer, type StreamResult } from "@/components/hls-player";
import { readNdjsonStream } from "@/lib/ndjson-stream";

interface MoviePlayerProps {
  movieId: string;
  mediaType?: "movie" | "tv";
  seasonNumber?: number;
  episodeNumber?: number;
}

export function MoviePlayer({
  movieId,
  mediaType = "movie",
  seasonNumber,
  episodeNumber,
}: MoviePlayerProps) {
  const fetchStream = async (onStatus: (message: string) => void): Promise<StreamResult> => {
    const params = new URLSearchParams({ tmdbId: movieId, mediaType });
    if (mediaType === "tv" && seasonNumber && episodeNumber) {
      params.set("season", String(seasonNumber));
      params.set("episode", String(episodeNumber));
    }

    const response = await fetch(`/api/stream/movie?${params.toString()}`);
    const data = await readNdjsonStream<{ url: string; referer?: string; subtitles?: StreamResult["subtitles"] }>(
      response,
      onStatus
    );

    return { url: data.url, referer: data.referer, subtitles: data.subtitles };
  };

  return (
    <HlsPlayer
      key={`${movieId}-${mediaType}-${seasonNumber}-${episodeNumber}`}
      label={mediaType === "movie" ? "Movie" : "Episode"}
      fetchStream={fetchStream}
    />
  );
}
