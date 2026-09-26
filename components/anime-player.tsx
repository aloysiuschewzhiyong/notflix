"use client";

import { useState } from "react";
import { HlsPlayer, type StreamResult } from "@/components/hls-player";
import { cn } from "@/lib/utils";

interface AnimePlayerProps {
  anilistId: string | number;
  seasonNumber?: number;
  episodeNumber?: number;
}

const AUDIO_TRACKS = ["sub", "dub"] as const;

export function AnimePlayer({
  anilistId,
  seasonNumber = 1,
  episodeNumber = 1,
}: AnimePlayerProps) {
  const [audio, setAudio] = useState<(typeof AUDIO_TRACKS)[number]>("sub");

  const fetchStream = async (): Promise<StreamResult> => {
    const params = new URLSearchParams({
      anilistId: String(anilistId),
      season: String(seasonNumber),
      episode: String(episodeNumber),
      audio,
    });

    const response = await fetch(`/api/stream/animekai?${params.toString()}`);
    const data = await response.json();

    if (!response.ok || !data.url) {
      throw new Error(data.error || "Failed to fetch stream");
    }

    return { url: data.url, referer: data.referer };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 self-start rounded-full bg-secondary p-1">
        {AUDIO_TRACKS.map((track) => (
          <button
            key={track}
            type="button"
            onClick={() => setAudio(track)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide transition-colors",
              audio === track
                ? "bg-brand text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {track}
          </button>
        ))}
      </div>
      <HlsPlayer
        key={`${anilistId}-${seasonNumber}-${episodeNumber}-${audio}`}
        label={`Episode ${episodeNumber}`}
        fetchStream={fetchStream}
      />
    </div>
  );
}
