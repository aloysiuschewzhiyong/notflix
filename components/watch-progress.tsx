"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RowShell } from "@/components/media-row";
import { episodeHref, episodeLabel, type EpisodeRef } from "@/utils/episodes";

const PREFIX = "watch-progress:";
const storageKey = (showId: string) => `${PREFIX}${showId}`;

interface SavedProgress extends EpisodeRef {
  showName?: string;
  image?: string | null;
  updatedAt?: number;
}

function parse(raw: string | null): SavedProgress | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.season === "number" && typeof parsed?.episode === "number") {
      return parsed;
    }
  } catch {}
  return null;
}

function readProgress(showId: string): SavedProgress | null {
  try {
    return parse(localStorage.getItem(storageKey(showId)));
  } catch {
    return null;
  }
}

// Records the episode being viewed so the show and home pages can offer "Continue"
export function TrackEpisode({
  showId,
  season,
  episode,
  showName,
  image,
}: { showId: string; showName?: string; image?: string | null } & EpisodeRef) {
  useEffect(() => {
    try {
      const saved: SavedProgress = {
        season,
        episode,
        showName,
        image,
        updatedAt: Date.now(),
      };
      localStorage.setItem(storageKey(showId), JSON.stringify(saved));
    } catch {}
  }, [showId, season, episode, showName, image]);

  return null;
}

// "Continue S2 E5" if there's saved progress, otherwise "Start S1 E1"
export function ContinueWatching({
  showId,
  fallback,
}: {
  showId: string;
  fallback: EpisodeRef;
}) {
  const [saved, setSaved] = useState<EpisodeRef | null>(null);

  useEffect(() => {
    setSaved(readProgress(showId));
  }, [showId]);

  const target = saved ?? fallback;

  return (
    <Button asChild size="lg">
      <Link href={episodeHref(showId, target)}>
        <Play className="h-4 w-4 fill-current" />
        {saved ? "Continue" : "Start"} {episodeLabel(target)}
      </Link>
    </Button>
  );
}

// Home page row of shows with saved progress, most recent first
export function ContinueWatchingRow() {
  const [entries, setEntries] = useState<(SavedProgress & { showId: string })[]>([]);

  useEffect(() => {
    try {
      const found: (SavedProgress & { showId: string })[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith(PREFIX)) continue;
        const p = parse(localStorage.getItem(key));
        // Entries saved before names were recorded can't be shown nicely
        if (p?.showName) found.push({ ...p, showId: key.slice(PREFIX.length) });
      }
      found.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
      setEntries(found.slice(0, 20));
    } catch {}
  }, []);

  if (!entries.length) return null;

  return (
    <RowShell title="Continue Watching">
      {entries.map((e) => (
        <Link
          key={e.showId}
          href={episodeHref(e.showId, e)}
          className="group snap-start shrink-0 w-[70vw] sm:w-64 md:w-72"
        >
          <div className="relative aspect-video rounded-md overflow-hidden bg-muted">
            {e.image && (
              <Image
                src={`https://image.tmdb.org/t/p/w500${e.image}`}
                alt=""
                fill
                sizes="300px"
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="rounded-full bg-black/60 p-3">
                <Play className="h-6 w-6 fill-white text-white" />
              </span>
            </div>
            <div className="absolute bottom-2 left-3 right-3 text-white">
              <p className="text-sm font-semibold line-clamp-1">{e.showName}</p>
              <p className="text-xs text-white/80">{episodeLabel(e)}</p>
            </div>
          </div>
        </Link>
      ))}
    </RowShell>
  );
}
