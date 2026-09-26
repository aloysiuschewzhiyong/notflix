"use client";

import { HlsPlayer, type StreamResult } from "@/components/hls-player";

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
  const fetchStream = async (): Promise<StreamResult> => {
    const params = new URLSearchParams({ tmdbId: movieId, mediaType });
    if (mediaType === "tv" && seasonNumber && episodeNumber) {
      params.set("season", String(seasonNumber));
      params.set("episode", String(episodeNumber));
    }

    const response = await fetch(`/api/stream/vidfast?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Failed to fetch stream");
    }

    return { url: data.url, referer: data.referer };
  };

  return (
    <HlsPlayer
      key={`${movieId}-${mediaType}-${seasonNumber}-${episodeNumber}`}
      label={mediaType === "movie" ? "Movie" : "Episode"}
      fetchStream={fetchStream}
    />
  );
}
