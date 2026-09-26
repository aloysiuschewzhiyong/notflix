"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { SearchBox } from "@/components/search-box";
import { cn } from "@/lib/utils";
import type { MediaListItem } from "@/utils/tmdb";

interface Genre {
  id: number;
  name: string;
}

type MenuKey = "movie" | "tv" | "anime";

interface HeaderProps {
  movieGenres: Genre[];
  tvGenres: Genre[];
  animeGenres: Genre[];
  trending: MediaListItem[];
}

const MENU_LABEL: Record<MenuKey, string> = {
  movie: "Movie",
  tv: "Series",
  anime: "Anime",
};

const MENU_BASE: Record<MenuKey, string> = {
  movie: "/movies",
  tv: "/series",
  anime: "/anime",
};

// Springy hover/tap from the original header
const navMotion = {
  whileHover: { scale: 1.03 },
  whileTap: { scale: 0.97 },
  transition: { type: "spring", stiffness: 400, damping: 20 },
} as const;

const NAV_ITEMS: {
  label: string;
  href: string;
  menu?: MenuKey;
  match: (p: string) => boolean;
}[] = [
  { label: "Home", href: "/", match: (p) => p === "/" },
  {
    label: "Movies",
    href: "/movies",
    menu: "movie",
    match: (p) => p.startsWith("/movies") || p.startsWith("/movie/"),
  },
  {
    label: "Series",
    href: "/series",
    menu: "tv",
    match: (p) => p.startsWith("/series") || p.startsWith("/tv/"),
  },
  {
    label: "Anime",
    href: "/anime",
    menu: "anime",
    match: (p) => p.startsWith("/anime"),
  },
];

const MENU_CLOSE_DELAY = 150;

export default function Header({ movieGenres, tvGenres, animeGenres, trending }: HeaderProps) {
  const pathname = usePathname();
  const lastMenu = useRef<MenuKey>("movie");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [menu, setMenu] = useState<MenuKey | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const headerRef = useRef<HTMLElement>(null);

  // Close menus/search when navigating
  useEffect(() => {
    setMobileSearchOpen(false);
    setMenu(null);
  }, [pathname]);

  // Publish the header height so sticky elements (e.g. browse toolbars) can sit below it
  useEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() =>
      document.documentElement.style.setProperty("--header-h", `${el.offsetHeight}px`)
    );
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Escape or clicking outside closes the genre menu
  useEffect(() => {
    if (!menu) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    const onClick = (e: MouseEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setMenu(null);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [menu]);

  // Hover intent: open immediately, close after a short delay so the pointer
  // can travel from the nav link down into the panel
  const openMenu = (key: MenuKey) => {
    clearTimeout(closeTimer.current);
    setMenu(key);
  };
  const scheduleClose = () => {
    clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setMenu(null), MENU_CLOSE_DELAY);
  };

  const navLinks = (mobile: boolean) =>
    NAV_ITEMS.map((item) => {
      const active = item.match(pathname);
      const hasMenu = !!item.menu;
      return (
        <div
          key={item.href}
          className="flex items-center"
          onPointerEnter={(e) =>
            !mobile && hasMenu && e.pointerType === "mouse" && openMenu(item.menu!)
          }
          onPointerLeave={(e) => !mobile && e.pointerType === "mouse" && scheduleClose()}
        >
          <motion.span {...navMotion} className="inline-block">
            <Link
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "block py-2 transition-colors hover:text-primary",
                active ? "text-foreground font-semibold" : "text-muted-foreground",
                menu === item.menu && hasMenu && "text-primary"
              )}
            >
              {item.label}
            </Link>
          </motion.span>
          {hasMenu && (
            // Click/tap/keyboard access to the genre menu (hover isn't available on touch)
            <button
              type="button"
              onClick={() => setMenu((m) => (m === item.menu ? null : item.menu!))}
              aria-label={`${item.label} genres`}
              aria-expanded={menu === item.menu}
              className="p-1.5 -mr-1.5 text-muted-foreground hover:text-primary transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-4 w-4 transition-transform",
                  menu === item.menu && "rotate-180"
                )}
              />
            </button>
          )}
        </div>
      );
    });

  // Keep showing the last menu's content while the panel animates out
  if (menu) lastMenu.current = menu;
  const shown = lastMenu.current;
  const genres = shown === "movie" ? movieGenres : shown === "anime" ? animeGenres : tvGenres;
  const base = MENU_BASE[shown];

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-50 border-b"
    >
      {/* Glass background lives on its own layer: a backdrop-filter on the header
          itself would stop the dropdown panels from blurring the page behind them */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-background/80 backdrop-blur-sm" />
      <div className="px-4 md:px-12 md:py-2">
        <div className="flex h-16 md:h-[72px] items-center gap-10">
          <Link href="/" className="relative w-24 md:w-28 h-10 shrink-0" aria-label="Notflix home">
            <Image src="/logo.png" alt="Notflix" fill className="object-contain" priority />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-base lg:text-lg">
            {navLinks(false)}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <SearchBox
              trending={trending}
              className="hidden md:block"
              inputClassName="w-56 lg:w-72 transition-all duration-300 ease-in-out focus:lg:w-[350px]"
            />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden"
              onClick={() => setMobileSearchOpen((o) => !o)}
              aria-label={mobileSearchOpen ? "Close search" : "Search"}
              aria-expanded={mobileSearchOpen}
            >
              {mobileSearchOpen ? <X className="h-5 w-5" /> : <Search className="h-5 w-5" />}
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {/* Mobile: search field or nav tabs */}
        <div className="md:hidden pb-3">
          {mobileSearchOpen ? (
            <SearchBox trending={trending} autoFocus onNavigate={() => setMobileSearchOpen(false)} />
          ) : (
            <nav className="flex gap-7 text-base">{navLinks(true)}</nav>
          )}
        </div>
      </div>

      {/* Genre mega-menu (glass panel under the header) */}
      <AnimatePresence>
        {menu && (
          <motion.div
            key="genre-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            onPointerEnter={(e) => e.pointerType === "mouse" && clearTimeout(closeTimer.current)}
            onPointerLeave={(e) => e.pointerType === "mouse" && scheduleClose()}
            // Same-page genre changes don't change the pathname, so close on any link click
            onClick={(e) => (e.target as HTMLElement).closest("a") && setMenu(null)}
            className="absolute inset-x-0 top-full border-b bg-background/85 backdrop-blur-md shadow-xl"
          >
            <div className="px-4 md:px-12 py-5 md:py-6 max-h-[70vh] overflow-y-auto">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-4">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  {MENU_LABEL[shown]} genres
                </h3>
                <div className="flex gap-4 text-sm">
                  <Link href={base} className="font-medium hover:text-brand transition-colors">
                    Popular
                  </Link>
                  <Link
                    href={`${base}?sort=top_rated`}
                    className="font-medium hover:text-brand transition-colors"
                  >
                    Top rated
                  </Link>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-1">
                {genres.map((g) => (
                  <Link
                    key={g.id}
                    href={`${base}?genreId=${g.id}`}
                    className="group rounded-md px-3 py-2 text-sm hover:bg-secondary transition-colors"
                  >
                    <span className="inline-block transition-transform group-hover:translate-x-0.5 group-hover:text-brand">
                      {g.name}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
