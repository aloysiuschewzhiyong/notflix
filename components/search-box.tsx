"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, Search, Star, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "@/utils/tmdb";

const MAX_SUGGESTIONS = 6;
const DEBOUNCE_MS = 250;

interface SearchBoxProps {
  // Shown before the user types anything
  trending: MediaListItem[];
  autoFocus?: boolean;
  onNavigate?: () => void;
  className?: string;
  inputClassName?: string;
}

function toSuggestions(results: any[]): MediaListItem[] {
  return results
    .filter(
      (r) => (r.media_type === "movie" || r.media_type === "tv") && r.poster_path
    )
    .slice(0, MAX_SUGGESTIONS);
}

export function SearchBox({
  trending,
  autoFocus,
  onNavigate,
  className,
  inputClassName,
}: SearchBoxProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<MediaListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);

  const q = query.trim();
  const items = q ? results : trending;
  // The last option (when typing) is "See all results"
  const optionCount = items.length + (q ? 1 : 0);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Debounced live search
  useEffect(() => {
    setActive(-1);
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    // Ignore responses for queries the user has already typed past. (Aborting the
    // fetch instead trips Next's dev overlay with an "AbortError" runtime error.)
    let stale = false;
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
        const data = await res.json();
        if (!stale) setResults(toSuggestions(data.results ?? []));
      } catch {
        if (!stale) setResults([]);
      } finally {
        if (!stale) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => {
      stale = true;
      clearTimeout(t);
    };
  }, [q]);

  const go = (href: string) => {
    router.push(href);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
    onNavigate?.();
  };

  const seeAll = () => q && go(`/search?q=${encodeURIComponent(q)}`);

  const choose = (i: number) => {
    if (i >= 0 && i < items.length) {
      const item = items[i];
      go(`/${item.media_type}/${item.id}`);
    } else {
      seeAll();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      if (!optionCount) return;
      // Cycle through -1 (the input itself) and each option
      const step = e.key === "ArrowDown" ? 1 : -1;
      const n = optionCount + 1;
      setActive((a) => ((((a + 1 + step) % n) + n) % n) - 1);
    } else if (e.key === "Escape") {
      setOpen(false);
      setActive(-1);
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (open && active >= 0) choose(active);
    else seeAll();
  };

  const showPanel = open && (items.length > 0 || !!q);
  const optionId = (i: number) => `${listId}-opt-${i}`;

  return (
    <form role="search" onSubmit={onSubmit} className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search movies & series..."
        aria-label="Search movies and series"
        enterKeyHint="search"
        autoComplete="off"
        role="combobox"
        aria-expanded={showPanel}
        aria-controls={listId}
        aria-activedescendant={active >= 0 ? optionId(active) : undefined}
        className={cn("pl-9 pr-9", inputClassName)}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        // Delay so clicks on suggestions register before the panel closes
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
      )}

      <AnimatePresence>
        {showPanel && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-full md:w-[26rem] z-50 overflow-hidden rounded-xl border bg-background/90 backdrop-blur-md shadow-xl"
          >
            <p className="flex items-center gap-1.5 px-3 pt-3 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {q ? (
                <>Suggestions</>
              ) : (
                <>
                  <TrendingUp className="h-3.5 w-3.5 text-brand" /> Trending today
                </>
              )}
            </p>
            <ul id={listId} role="listbox" className="p-1.5">
              {items.map((item, i) => {
                const title = item.title ?? item.name ?? "";
                const year = (item.release_date ?? item.first_air_date)?.slice(0, 4);
                return (
                  <li
                    key={`${item.media_type}-${item.id}`}
                    id={optionId(i)}
                    role="option"
                    aria-selected={active === i}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(i)}
                    onMouseEnter={() => setActive(i)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg p-1.5 cursor-pointer transition-colors",
                      active === i && "bg-secondary"
                    )}
                  >
                    <div className="relative h-14 w-10 shrink-0 overflow-hidden rounded bg-muted">
                      <Image
                        src={`https://image.tmdb.org/t/p/w92${item.poster_path}`}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium line-clamp-1">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.media_type === "movie" ? "Movie" : "Series"}
                        {year ? ` · ${year}` : ""}
                      </p>
                    </div>
                    {item.vote_average > 0 && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 pr-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        {item.vote_average.toFixed(1)}
                      </span>
                    )}
                  </li>
                );
              })}
              {q && !loading && items.length === 0 && (
                <li className="px-2 py-3 text-sm text-muted-foreground">
                  No matches for &ldquo;{q}&rdquo;
                </li>
              )}
              {q && (
                <li
                  id={optionId(items.length)}
                  role="option"
                  aria-selected={active === items.length}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={seeAll}
                  onMouseEnter={() => setActive(items.length)}
                  className={cn(
                    "mt-1 flex items-center gap-2 rounded-lg border-t px-2 py-2.5 text-sm cursor-pointer transition-colors",
                    active === items.length && "bg-secondary"
                  )}
                >
                  <Search className="h-4 w-4 text-brand" />
                  <span className="truncate">
                    See all results for{" "}
                    <span className="font-medium">&ldquo;{q}&rdquo;</span>
                  </span>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
