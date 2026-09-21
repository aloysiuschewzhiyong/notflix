"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { getLanguageName } from "@/utils/helpers";

interface MediaItem {
  id: number;
  title?: string;
  name?: string;
  poster_path: string;
  vote_average?: number | string;
  media_type?: "movie" | "tv";
  release_date?: string;
  first_air_date?: string;
  original_language?: string;
  content_rating?: string;
}

interface MovieCardProps {
  movie: MediaItem;
}

function ratingColor(rating: number) {
  if (rating >= 8) return "fill-green-400 text-green-400";
  if (rating >= 6) return "fill-yellow-400 text-yellow-400";
  return "fill-red-400 text-red-400";
}

export function MovieCard({ movie }: MovieCardProps) {
  const [loaded, setLoaded] = useState(false);

  const title = movie.title || movie.name || "Unknown Title";
  const mediaType = movie.media_type || (movie.title ? "movie" : "tv");
  const year = (movie.release_date || movie.first_air_date)?.slice(0, 4);
  const rating = Number(movie.vote_average) || 0;
  const meta = [
    year,
    movie.original_language && getLanguageName(movie.original_language),
    movie.content_rating && movie.content_rating !== "NR" && movie.content_rating,
  ].filter(Boolean);

  return (
    // CSS transitions only: dozens of these render at once, so no per-card
    // Framer Motion instances or backdrop blurs (those made scrolling janky)
    <div className="group w-full transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-95">
      <Link href={`/${mediaType}/${movie.id}`} className="block">
        <div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-md ring-1 ring-black/5 dark:ring-white/10 transition-shadow duration-200 group-hover:shadow-glow">
          {movie.poster_path && (
            <Image
              src={`https://image.tmdb.org/t/p/w342${movie.poster_path}`}
              alt={title}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className={cn(
                "object-cover transition-all duration-300 group-hover:brightness-110",
                loaded ? "opacity-100" : "opacity-0"
              )}
              onLoad={() => setLoaded(true)}
            />
          )}
          {!loaded && <div className="absolute inset-0 bg-muted animate-pulse" />}

          {/* Glass badges */}
          <span className="absolute top-2 left-2 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
            {mediaType === "movie" ? "Movie" : "Series"}
          </span>
          {rating > 0 && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
              <Star className={cn("h-3 w-3", ratingColor(rating))} />
              {rating.toFixed(1)}
            </span>
          )}

          {/* Glass-style info panel: a scrim + translucent panel, no backdrop blur */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
          <div className="absolute inset-x-2 bottom-2 rounded-lg border border-white/15 bg-white/10 p-2 sm:p-2.5 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] transition-colors group-hover:bg-white/15">
            <h3 className="text-xs sm:text-sm font-semibold leading-snug line-clamp-2 decoration-brand underline-offset-4 group-hover:underline">
              {title}
            </h3>
            {meta.length > 0 && (
              <p className="mt-0.5 text-[10px] sm:text-[11px] text-white/75 line-clamp-1">
                {meta.join(" · ")}
              </p>
            )}
          </div>
        </div>
      </Link>
    </div>
  );
}
