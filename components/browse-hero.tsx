import Image from "next/image";

interface BrowseHeroProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  // First few results; the top one's backdrop becomes the blurred background
  items: { id: number; poster_path?: string | null; backdrop_path?: string | null }[];
}

export function BrowseHero({ eyebrow, title, subtitle, items }: BrowseHeroProps) {
  const backdrop = items.find((i) => i.backdrop_path)?.backdrop_path;
  const posters = items.filter((i) => i.poster_path).slice(0, 3);

  return (
    <section className="relative overflow-hidden">
      {backdrop && (
        <div aria-hidden className="absolute inset-0">
          <Image
            src={backdrop.startsWith("http") ? backdrop : `https://image.tmdb.org/t/p/w1280${backdrop}`}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover scale-110 blur-2xl opacity-90 dark:opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/30 to-background" />
        </div>
      )}

      <div className="relative px-4 md:px-12 pt-8 pb-6 md:pt-14 md:pb-10">
        <div className="glass rounded-2xl p-5 md:p-8 flex items-center gap-8 overflow-hidden">
          <div className="min-w-0 flex-1">
            <span className="glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              {eyebrow}
            </span>
            <h1 className="mt-3 text-3xl md:text-5xl font-extrabold tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="mt-2 text-sm md:text-base text-muted-foreground">{subtitle}</p>
            )}
          </div>

          {/* Fanned posters of the top results (desktop) */}
          {posters.length === 3 && (
            <div aria-hidden className="relative hidden md:block h-40 w-56 shrink-0">
              {posters.map((p, i) => (
                <div
                  key={p.id}
                  className="absolute top-1/2 h-36 w-24 overflow-hidden rounded-lg shadow-xl ring-1 ring-white/20"
                  style={{
                    left: `${i * 56}px`,
                    transform: `translateY(-50%) rotate(${(i - 1) * 8}deg) scale(${i === 1 ? 1.08 : 1})`,
                    zIndex: i === 1 ? 2 : 1,
                  }}
                >
                  <Image
                    src={
                      p.poster_path!.startsWith("http")
                        ? p.poster_path!
                        : `https://image.tmdb.org/t/p/w185${p.poster_path}`
                    }
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
