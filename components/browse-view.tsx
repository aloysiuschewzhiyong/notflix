"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, X } from "lucide-react";
import { MovieGrid, type GridFilters } from "@/components/movie-grid";
import { SortSelect } from "@/components/sort-select";
import { getLanguageName } from "@/utils/helpers";
import { cn } from "@/lib/utils";

interface Genre {
  id: number;
  name: string;
}

interface BrowseViewProps {
  mediaType: "movie" | "tv" | "anime";
  genres: Genre[];
  genreId?: number;
  sort?: string;
  initialItems: any[];
  loadMore: (page: number, genreId?: number, sort?: string) => Promise<any[]>;
}

const DEFAULT_FILTERS: GridFilters = { minRating: 0, language: "all", contentRating: "all" };
const MIN_RATINGS = [0, 6, 7, 8];
const LANGUAGES = ["en", "ko", "ja", "es", "fr", "hi", "zh", "de", "it", "pt"];

export function BrowseView({
  mediaType,
  genres,
  genreId,
  sort,
  initialItems,
  loadMore,
}: BrowseViewProps) {
  const searchParams = useSearchParams();
  const base = mediaType === "movie" ? "/movies" : mediaType === "anime" ? "/anime" : "/series";
  const [filters, setFilters] = useState<GridFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeChip = useRef<HTMLAnchorElement>(null);
  const chipRow = useRef<HTMLElement>(null);

  // Genre links keep the current sort
  const genreHref = (id?: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) params.set("genreId", String(id));
    else params.delete("genreId");
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  };

  // Content ratings vary by country (SG/US/...), so offer the ones actually present
  const contentRatings = useMemo(
    () =>
      Array.from(
        new Set(
          initialItems
            .map((i) => i.content_rating)
            .filter((r): r is string => !!r && r !== "NR")
        )
      ).sort(),
    [initialItems]
  );

  const activeCount =
    (filters.minRating > 0 ? 1 : 0) +
    (filters.language !== "all" ? 1 : 0) +
    (filters.contentRating !== "all" ? 1 : 0);

  // Phones: centre the selected chip within the swipeable row. Only the row
  // scrolls (scrollIntoView could also scroll the page); on desktop the chips
  // wrap, so there's nothing to scroll.
  useEffect(() => {
    const row = chipRow.current;
    const chipEl = activeChip.current;
    if (!row || !chipEl || row.scrollWidth <= row.clientWidth) return;
    row.scrollLeft = chipEl.offsetLeft - row.clientWidth / 2 + chipEl.offsetWidth / 2;
  }, [genreId]);

  const chip = (active: boolean) =>
    cn(
      "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-all",
      active
        ? "bg-brand text-white shadow-md shadow-brand/30"
        : "glass-chip text-foreground/80 hover:text-foreground hover:bg-white/70 dark:hover:bg-white/10"
    );

  const option = (active: boolean) =>
    cn(
      "rounded-full px-3 py-1.5 text-sm transition-colors",
      active
        ? "bg-foreground text-background"
        : "glass-chip hover:bg-white/70 dark:hover:bg-white/10"
    );

  return (
    <>
      {/* Glass toolbar (pinned under the header on desktop; scrolls away on phones to save space) */}
      <div className="relative md:sticky md:top-[var(--header-h,64px)] z-30 px-4 md:px-12 py-3">
        <div className="glass rounded-2xl p-2 flex flex-col md:flex-row md:items-start gap-2">
          {/* Phones: one swipeable row. Desktop: chips wrap so every genre is visible. */}
          <nav
            ref={chipRow}
            aria-label="Genres"
            className="relative flex gap-2 overflow-x-auto no-scrollbar min-w-0 flex-1 [mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] pr-6 md:flex-wrap md:overflow-visible md:[mask-image:none] md:pr-0"
          >
            <Link
              href={genreHref()}
              ref={!genreId ? activeChip : undefined}
              aria-current={!genreId ? "page" : undefined}
              className={chip(!genreId)}
            >
              All
            </Link>
            {genres.map((g) => (
              <Link
                key={g.id}
                href={genreHref(g.id)}
                ref={genreId === g.id ? activeChip : undefined}
                aria-current={genreId === g.id ? "page" : undefined}
                className={chip(genreId === g.id)}
              >
                {g.name}
              </Link>
            ))}
          </nav>

          <div className="flex gap-2 shrink-0">
            <SortSelect className="glass-chip h-9 rounded-full border-0 md:w-44 flex-1" />
            <button
              type="button"
              onClick={() => setFiltersOpen((o) => !o)}
              aria-expanded={filtersOpen}
              className={cn(
                "glass-chip flex h-9 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors hover:bg-white/70 dark:hover:bg-white/10",
                filtersOpen && "ring-2 ring-brand/60"
              )}
            >
              <SlidersHorizontal className="h-4 w-4" />
              Filters
              {activeCount > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white">
                  {activeCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden"
            >
              <div className="glass rounded-2xl mt-2 p-4 md:p-5 grid gap-5 md:grid-cols-[auto_1fr_auto] md:gap-8">
                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Min rating
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {MIN_RATINGS.map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, minRating: r }))}
                        className={option(filters.minRating === r)}
                      >
                        {r === 0 ? "Any" : `${r}+ ★`}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset>
                  <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Language
                  </legend>
                  <div className="flex flex-wrap gap-2">
                    {["all", ...LANGUAGES].map((l) => (
                      <button
                        key={l}
                        type="button"
                        onClick={() => setFilters((f) => ({ ...f, language: l }))}
                        className={option(filters.language === l)}
                      >
                        {l === "all" ? "Any" : getLanguageName(l)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                {contentRatings.length > 0 && (
                  <fieldset>
                    <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Age rating
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {["all", ...contentRatings].map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setFilters((f) => ({ ...f, contentRating: c }))}
                          className={option(filters.contentRating === c)}
                        >
                          {c === "all" ? "Any" : c}
                        </button>
                      ))}
                    </div>
                  </fieldset>
                )}

                {activeCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setFilters(DEFAULT_FILTERS)}
                    className="md:col-span-3 justify-self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-brand transition-colors"
                  >
                    <X className="h-4 w-4" /> Clear filters
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="px-4 md:px-12 pt-2 pb-16">
        <MovieGrid
          initialMovies={initialItems}
          loadMore={loadMore}
          genreId={genreId}
          sort={sort}
          filters={filters}
        />
      </div>
    </>
  );
}
