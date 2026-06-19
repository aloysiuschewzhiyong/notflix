"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUp, Film, Tv2, Star, Clock, TrendingUp } from "lucide-react";

export default function Footer() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="border-t py-12 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          {/* Logo and Description */}
          <div className="space-y-4">
            <Link href="/" className="relative w-28 h-12 block">
              <Image
                src="/logo.png"
                alt="Notflix"
                fill
                className="object-contain"
              />
            </Link>
            <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px]">
              Your favorite movies and TV shows streaming platform. Watch
              anywhere, anytime.
            </p>
          </div>

          {/* Quick Links - Split into two columns */}
          <div className="grid grid-cols-2 gap-8 md:px-4">
            {/* Movies Column */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                <Film className="h-4 w-4" />
                Movies
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/movies"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    All Movies
                  </Link>
                </li>
                <li>
                  <Link
                    href="/movies?sort=top_rated"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Top Rated
                  </Link>
                </li>
                <li>
                  <Link
                    href="/movies?sort=popular"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Popular
                  </Link>
                </li>
                <li>
                  <Link
                    href="/movies?sort=release_date.desc"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Latest
                  </Link>
                </li>
              </ul>
            </div>

            {/* TV Shows Column */}
            <div>
              <h3 className="font-semibold mb-4 flex items-center gap-2 text-primary">
                <Tv2 className="h-4 w-4" />
                TV Shows
              </h3>
              <ul className="space-y-3">
                <li>
                  <Link
                    href="/series"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    All Shows
                  </Link>
                </li>
                <li>
                  <Link
                    href="/series?sort=top_rated"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Top Rated
                  </Link>
                </li>
                <li>
                  <Link
                    href="/series?sort=popular"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Popular
                  </Link>
                </li>
                <li>
                  <Link
                    href="/series?sort=first_air_date.desc"
                    className="text-sm text-muted-foreground hover:text-primary transition"
                  >
                    Latest
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          {/* Quick Actions & Tech Stack */}
          <div className="space-y-6">
            {/* Quick Actions - Now First */}
            <div className="space-y-4">
              <h3 className="font-semibold text-primary">Quick Actions</h3>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={scrollToTop}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground border border-border"
                >
                  <ArrowUp className="h-4 w-4" />
                  <span>Back to top</span>
                </button>
                <Link
                  href="/movies?sort=popular"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground border border-border"
                >
                  <TrendingUp className="h-4 w-4" />
                  <span>Trending</span>
                </Link>
                <Link
                  href="/movies?sort=top_rated"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground border border-border"
                >
                  <Star className="h-4 w-4" />
                  <span>Top Rated</span>
                </Link>
                <Link
                  href="/movies?sort=release_date.desc"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-md hover:bg-accent transition-colors text-sm text-muted-foreground hover:text-foreground border border-border"
                >
                  <Clock className="h-4 w-4" />
                  <span>Latest</span>
                </Link>
              </div>
            </div>

            {/* Tech Stack & TMDB - Now Second */}
            <div className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-3">
                <span>Built with</span>
                <Link
                  href="https://nextjs.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-16 h-4 flex items-center hover:opacity-75 transition-opacity"
                >
                  <Image
                    src="/next.svg"
                    alt="Next.js"
                    fill
                    className="object-contain dark:invert"
                    style={{ objectPosition: "0 45%" }}
                  />
                </Link>
                <span>&</span>
                <Link
                  href="https://tailwindcss.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-20 h-4 flex items-center hover:opacity-75 transition-opacity"
                >
                  <Image
                    src="/tailwind.svg"
                    alt="Tailwind CSS"
                    fill
                    className="object-contain"
                    style={{ objectPosition: "0 45%" }}
                  />
                </Link>
              </div>
              <div className="flex items-center gap-2">
                <span>Data from</span>
                <Link
                  href="https://www.themoviedb.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative w-20 h-3.5 hover:opacity-75 transition-opacity"
                >
                  <Image
                    src="/tmdb.svg"
                    alt="TMDB"
                    fill
                    className="object-contain"
                  />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 pt-8 border-t text-center">
          <p className="text-sm text-muted-foreground">
            Made by Aloysius Chew. Check out my <a href="https://chewaloy.vercel.app" target="_blank"  className="hover:text-primary transition-colors underline underline-offset-2">other stuff</a>
          </p>
        </div>
      </div>
    </footer>
  );
}
