"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "@/utils/tmdb";

interface MediaRowProps {
  title: string;
  items: MediaListItem[];
  href?: string;
  // "ranked" shows a large 1–10 number beside each poster
  variant?: "poster" | "ranked";
}

export function MediaRow({ title, items, href, variant = "poster" }: MediaRowProps) {
  const list = variant === "ranked" ? items.slice(0, 10) : items;
  if (!list.length) return null;

  return (
    <RowShell title={title} href={href}>
      {list.map((item, i) =>
        variant === "ranked" ? (
          <RankedCard key={item.id} item={item} rank={i + 1} />
        ) : (
          <PosterCard key={item.id} item={item} />
        )
      )}
    </RowShell>
  );
}

// Heading + horizontally scrolling track with arrow buttons
export function RowShell({
  title,
  href,
  children,
}: {
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const track = useRef<HTMLDivElement>(null);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  const update = () => {
    const el = track.current;
    if (!el) return;
    setCanPrev(el.scrollLeft > 4);
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const scroll = (dir: 1 | -1) =>
    track.current?.scrollBy({
      left: dir * track.current.clientWidth * 0.85,
      behavior: "smooth",
    });

  return (
    <section className="group/row">
      <div className="px-4 md:px-12 flex items-baseline justify-between mb-3">
        <h2 className="text-xl md:text-2xl font-bold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors py-2 -my-2 pl-3"
          >
            See all ›
          </Link>
        )}
      </div>
      <div className="relative">
        <div
          ref={track}
          onScroll={update}
          className="flex gap-3 overflow-x-auto scroll-smooth snap-x snap-mandatory no-scrollbar px-4 md:px-12 py-4 -my-2"
        >
          {children}
        </div>
        <ArrowButton side="left" show={canPrev} onClick={() => scroll(-1)} />
        <ArrowButton side="right" show={canNext} onClick={() => scroll(1)} />
      </div>
    </section>
  );
}

function ArrowButton({
  side,
  show,
  onClick,
}: {
  side: "left" | "right";
  show: boolean;
  onClick: () => void;
}) {
  const Icon = side === "left" ? ChevronLeft : ChevronRight;
  return (
    <button
      onClick={onClick}
      aria-label={side === "left" ? "Scroll left" : "Scroll right"}
      tabIndex={show ? 0 : -1}
      className={cn(
        "hidden md:flex absolute top-0 bottom-2 w-12 items-center justify-center z-10 transition-opacity",
        "from-background/90 to-transparent opacity-0",
        side === "left" ? "left-0 bg-gradient-to-r" : "right-0 bg-gradient-to-l",
        show ? "group-hover/row:opacity-100" : "pointer-events-none"
      )}
    >
      <Icon className="h-8 w-8" />
    </button>
  );
}

function mediaTitle(item: MediaListItem) {
  return item.title ?? item.name ?? "";
}

function PosterCard({ item }: { item: MediaListItem }) {
  const year = (item.release_date ?? item.first_air_date)?.slice(0, 4);
  return (
    // Same hover as the original MovieCard: slight lift, glow, underlined title
    <div className="group snap-start shrink-0 w-[38vw] sm:w-40 md:w-44 lg:w-48 transition-transform duration-200 ease-out hover:scale-[1.02] active:scale-95">
      <Link href={`/${item.media_type}/${item.id}`} className="block">
        <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-md ring-1 ring-black/5 dark:ring-white/5 transition-all duration-200 group-hover:shadow-glow">
          <Image
            src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
            alt={mediaTitle(item)}
            fill
            sizes="200px"
            className="object-cover transition-all duration-300 group-hover:brightness-110"
          />
          <span className="absolute top-2 left-2 rounded-md bg-black/60 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-white opacity-0 group-hover:opacity-100 transition-opacity">
            {item.media_type === "movie" ? "Movie" : "TV Show"}
          </span>
          <div className="absolute top-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-xs font-medium text-white">
            <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
            {item.vote_average.toFixed(1)}
          </div>
        </div>
        <h3 className="mt-2 text-sm font-medium line-clamp-1 transition-colors group-hover:text-brand decoration-brand group-hover:underline group-hover:underline-offset-4">
          {mediaTitle(item)}
        </h3>
        {year && <p className="text-xs text-muted-foreground">{year}</p>}
      </Link>
    </div>
  );
}

function RankedCard({ item, rank }: { item: MediaListItem; rank: number }) {
  return (
    <Link
      href={`/${item.media_type}/${item.id}`}
      className="group snap-start shrink-0 flex items-end"
      aria-label={`#${rank} ${mediaTitle(item)}`}
    >
      <span
        aria-hidden
        className="text-[7rem] md:text-[9rem] font-black leading-[0.8] -mr-4 md:-mr-5 text-background select-none"
        style={{ WebkitTextStroke: "3px hsl(var(--muted-foreground) / 0.7)" }}
      >
        {rank}
      </span>
      <div className="relative w-28 md:w-36 aspect-[2/3] rounded-lg overflow-hidden bg-muted shadow-md ring-1 ring-black/5 dark:ring-white/5 transition-all duration-200 group-hover:scale-[1.02] group-hover:shadow-glow">
        <Image
          src={`https://image.tmdb.org/t/p/w342${item.poster_path}`}
          alt=""
          fill
          sizes="150px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
    </Link>
  );
}
