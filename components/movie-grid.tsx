"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { MovieCard } from "./movie-card";
import { MovieCardSkeleton } from "./movie-card-skeleton";

export interface GridFilters {
  minRating: number;
  language: string; // "all" or ISO 639-1 code
  contentRating: string; // "all" or a certification
}

interface MovieGridProps {
  title?: string;
  initialMovies: any[];
  loadMore?: (page: number, genreId?: number, sort?: string) => Promise<any[]>;
  genreId?: number;
  sort?: string;
  className?: string;
  showLoadMore?: boolean;
  filters?: GridFilters;
}

const GRID =
  "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4";

function matches(movie: any, f?: GridFilters) {
  if (!f) return true;
  return (
    Number(movie.vote_average) >= f.minRating &&
    (f.language === "all" || movie.original_language === f.language) &&
    (f.contentRating === "all" || movie.content_rating === f.contentRating)
  );
}

export function MovieGrid({
  title,
  initialMovies,
  loadMore,
  genreId,
  sort,
  className = "",
  showLoadMore = true,
  filters,
}: MovieGridProps) {
  const [movies, setMovies] = useState(initialMovies);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const loader = useRef<HTMLDivElement>(null);

  const canLoad = showLoadMore && !!loadMore;

  const handleObserver = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (!entries[0].isIntersecting || !hasMore || loading || !loadMore) return;
      setLoading(true);
      const nextPage = page + 1;
      loadMore(nextPage, genreId, sort)
        .then((newMovies) => {
          if (!newMovies.length) {
            setHasMore(false);
            return;
          }
          setMovies((prev) => {
            // Pages can overlap when TMDB rankings shift; skip duplicates
            const seen = new Set(prev.map((m) => m.id));
            return [...prev, ...newMovies.filter((m) => !seen.has(m.id))];
          });
          setPage(nextPage);
        })
        .catch(() => setHasMore(false))
        .finally(() => setLoading(false));
    },
    [hasMore, loading, loadMore, page, genreId, sort]
  );

  useEffect(() => {
    if (!canLoad) return;
    const observer = new IntersectionObserver(handleObserver, {
      rootMargin: "400px",
    });
    if (loader.current) observer.observe(loader.current);
    return () => observer.disconnect();
  }, [handleObserver, canLoad]);

  const visible = movies.filter((m) => matches(m, filters));

  return (
    <section>
      {title && <h2 className="text-2xl font-bold mb-6">{title}</h2>}

      {visible.length === 0 && !loading ? (
        <div className="glass rounded-2xl py-16 text-center text-muted-foreground">
          Nothing matches these filters{canLoad && hasMore ? " yet — try scrolling or" : " —"}{" "}
          loosen them a little.
        </div>
      ) : (
        <div className={`${GRID} ${className}`}>
          {visible.map((movie, index) => (
            // CSS fade-in (tailwindcss-animate) instead of a Motion instance per card
            <div
              key={`${movie.id}-${index}`}
              className="animate-in fade-in slide-in-from-bottom-2 duration-300"
            >
              <MovieCard movie={movie} />
            </div>
          ))}
          {loading &&
            Array.from({ length: 5 }, (_, i) => <MovieCardSkeleton key={`sk-${i}`} />)}
        </div>
      )}

      {canLoad && (
        <div ref={loader} className="w-full h-20 flex items-center justify-center">
          {loading && (
            <span className="glass-chip rounded-full px-4 py-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading more…
            </span>
          )}
          {!hasMore && movies.length > 0 && (
            <p className="text-sm text-muted-foreground">You&apos;ve reached the end</p>
          )}
        </div>
      )}
    </section>
  );
}
