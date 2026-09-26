import { getAnimeDetails } from "@/utils/anilist";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AnimePlayer } from "@/components/anime-player";
import { Star } from "lucide-react";
import { BackdropImage } from "@/components/backdrop-image";
import { cn } from "@/lib/utils";

interface AnimePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ season?: string; episode?: string }>;
}

export default async function AnimePage({ params, searchParams }: AnimePageProps) {
  try {
    const { id } = await params;
    const sp = (await searchParams) || {};

    const anime = await getAnimeDetails(id);
    if (!anime) notFound();

    const season = Number(sp.season) || 1;
    const episode = Number(sp.episode) || 1;
    const episodeCount = anime.episodes || 1;

    return (
      <>
        <BackdropImage src={anime.backdrop_path || anime.poster_path || ""} />

        <div className="container mx-auto px-4 -mt-32 md:-mt-56 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="hidden md:block md:col-span-1">
              {anime.poster_path && (
                <Image
                  src={anime.poster_path}
                  alt={anime.title}
                  width={500}
                  height={750}
                  className="w-full h-auto rounded-lg shadow-lg"
                />
              )}
            </div>
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-6">{anime.title}</h1>

              <p className="text-base mb-8 text-muted-foreground">{anime.overview}</p>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Format</h3>
                  <p className="text-base">{anime.format || "N/A"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Episodes</h3>
                  <p className="text-base">{anime.episodes ?? "Unknown"}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Rating</h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-current text-primary" />
                    <span>{anime.vote_average.toFixed(1)}/10</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Status</h3>
                  <p className="text-base capitalize">
                    {anime.status.toLowerCase().replace(/_/g, " ")}
                  </p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Genres</h3>
                  <div className="flex flex-wrap gap-2">
                    {anime.genres.map((g) => (
                      <Badge key={g} variant="secondary">
                        {g}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Player */}
              <div className="mb-8">
                <AnimePlayer anilistId={id} seasonNumber={season} episodeNumber={episode} />
              </div>

              {/* Episodes */}
              {episodeCount > 1 && (
                <section id="episodes" className="mb-8 scroll-mt-24">
                  <h2 className="text-2xl font-bold mb-4">Episodes</h2>
                  <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                    {Array.from({ length: episodeCount }, (_, i) => i + 1).map((ep) => (
                      <Link
                        key={ep}
                        href={`/anime/${id}?season=${season}&episode=${ep}`}
                        className={cn(
                          "flex h-10 items-center justify-center rounded-md text-sm font-medium transition-colors",
                          ep === episode
                            ? "bg-brand text-white"
                            : "bg-secondary hover:bg-secondary/70"
                        )}
                      >
                        {ep}
                      </Link>
                    ))}
                  </div>
                </section>
              )}
            </div>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error loading anime:", error);
    notFound();
  }
}
