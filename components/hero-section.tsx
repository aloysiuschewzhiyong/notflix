"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Info, Star, ListVideo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "@/utils/tmdb";

const SLIDE_MS = 8000;

export function HeroSection({ items }: { items: MediaListItem[] }) {
  const slides = items.filter((m) => m.backdrop_path).slice(0, 6);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const go = useCallback(
    (delta: number) =>
      setIndex((i) => (i + delta + slides.length) % slides.length),
    [slides.length]
  );

  useEffect(() => {
    if (paused || slides.length < 2) return;
    const t = setTimeout(() => go(1), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, paused, go, slides.length]);

  if (!slides.length) return null;

  const item = slides[index];
  const title = item.title ?? item.name ?? "";
  const year = (item.release_date ?? item.first_air_date)?.slice(0, 4);
  const href = `/${item.media_type}/${item.id}`;

  const controls = slides.length > 1 && (
    <div className="flex items-center gap-2 md:gap-3">
      <button
        onClick={() => go(-1)}
        className="p-2 rounded-full bg-background/60 backdrop-blur-sm border border-black/10 dark:border-white/10 shadow-sm hover:bg-background/80 transition"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <div className="flex">
        {slides.map((s, i) => (
          // Padding gives each dot a touch-friendly hit area
          <button
            key={s.id}
            onClick={() => setIndex(i)}
            aria-label={`Show ${s.title ?? s.name}`}
            aria-current={i === index}
            className="h-8 px-1.5 flex items-center"
          >
            <span
              className={cn(
                "block h-1.5 rounded-full transition-all",
                i === index ? "w-6 bg-foreground" : "w-1.5 bg-foreground/40"
              )}
            />
          </button>
        ))}
      </div>
      <button
        onClick={() => go(1)}
        className="p-2 rounded-full bg-background/60 backdrop-blur-sm border border-black/10 dark:border-white/10 shadow-sm hover:bg-background/80 transition"
        aria-label="Next slide"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );

  return (
    // Mobile: image in a 4:3 frame with the text below it.
    // Desktop: full-bleed image with the text overlaid.
    <section
      className="relative md:h-[80vh] md:min-h-[520px] overflow-hidden"
      onPointerEnter={(e) => e.pointerType === "mouse" && setPaused(true)}
      onPointerLeave={(e) => e.pointerType === "mouse" && setPaused(false)}
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchStartX.current;
        touchStartX.current = null;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
      aria-roledescription="carousel"
    >
      <div className="relative aspect-[4/3] sm:aspect-video md:aspect-auto md:absolute md:inset-0">
        <AnimatePresence initial={false}>
          <motion.div
            key={item.id}
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9, ease: "easeOut" }}
            className="absolute inset-0"
          >
            <Image
              src={`https://image.tmdb.org/t/p/w1280${item.backdrop_path}`}
              alt=""
              fill
              priority={index === 0}
              sizes="100vw"
              className="object-cover object-[50%_25%]"
            />
          </motion.div>
        </AnimatePresence>

        {/* Readability gradients: left for overlaid text (desktop), bottom to blend */}
        <div className="hidden md:block absolute inset-0 bg-gradient-to-r from-background via-background/70 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 md:h-2/5 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="relative z-10 px-4 md:px-12 -mt-16 md:mt-0 md:h-full flex md:items-end md:pb-32">
        <AnimatePresence mode="wait">
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.5 }}
            className="max-w-xl w-full"
          >
            <span className="inline-block text-[11px] md:text-xs font-semibold tracking-widest uppercase text-brand mb-2 md:mb-3">
              {item.media_type === "movie" ? "Movie" : "Series"} · Trending #
              {index + 1}
            </span>
            <h1 className="text-2xl sm:text-4xl md:text-6xl font-extrabold leading-tight mb-2 md:mb-3 drop-shadow line-clamp-2">
              {title}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mb-3 md:mb-4">
              <span className="flex items-center gap-1 text-foreground">
                <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                {item.vote_average.toFixed(1)}
              </span>
              {year && <span>{year}</span>}
            </div>
            <p className="text-sm md:text-base text-muted-foreground line-clamp-2 md:line-clamp-3 mb-4 md:mb-6">
              {item.overview}
            </p>
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2 md:gap-3">
                <Button asChild size="lg" className="h-10 md:h-11">
                  <Link href={href}>
                    <Info className="h-4 w-4" />
                    More Info
                  </Link>
                </Button>
                {item.media_type === "tv" && (
                  <Button asChild size="lg" variant="secondary" className="h-10 md:h-11">
                    <Link href={`${href}#episodes`}>
                      <ListVideo className="h-4 w-4" />
                      Episodes
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {controls && (
        <>
          {/* Mobile: controls centred under the text; desktop: bottom-right */}
          <div className="md:hidden flex justify-center mt-3">{controls}</div>
          <div className="hidden md:block absolute z-20 bottom-24 right-12">{controls}</div>
        </>
      )}
    </section>
  );
}
