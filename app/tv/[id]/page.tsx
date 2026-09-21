import { getTVShowDetails, getSeasonDetails } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { SeasonPicker } from "@/components/season-picker";
import { EpisodeList } from "@/components/episode-list";
import { ContinueWatching } from "@/components/watch-progress";
import { orderSeasons, defaultSeasonNumber } from "@/utils/episodes";
import { Star } from "lucide-react";
import { getLanguageName } from "@/utils/helpers";
import { BackdropImage } from "@/components/backdrop-image";

interface TVShowPageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TVShowPage({
  params,
  searchParams,
}: TVShowPageProps) {
  try {
    const resolvedParams = await params;
    const showId = resolvedParams.id;

    const show = await getTVShowDetails(showId);
    const seasons = orderSeasons(show.seasons);

    const requested = Number((await searchParams)?.season);
    const selectedSeason = seasons.some((s) => s.season_number === requested)
      ? requested
      : defaultSeasonNumber(show.seasons);
    const season = seasons.length
      ? await getSeasonDetails(showId, selectedSeason)
      : null;

    return (
      <>
        <BackdropImage
          src={`https://image.tmdb.org/t/p/w1280${show.backdrop_path}`}
        />

        <div className="container mx-auto px-4 -mt-32 md:-mt-56 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="hidden md:block md:col-span-1">
              <Image
                src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                alt={show.name}
                width={500}
                height={750}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-4">{show.name}</h1>

              {seasons.length > 0 && (
                <div className="mb-6">
                  <ContinueWatching
                    showId={showId}
                    fallback={{ season: defaultSeasonNumber(show.seasons), episode: 1 }}
                  />
                </div>
              )}

              {/* Overview */}
              <p className="text-base mb-8 text-muted-foreground">
                {show.overview}
              </p>

              {/* Main metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Language
                  </h3>
                  <p className="text-base">
                    {show.original_language
                      ? getLanguageName(show.original_language)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    First Air Date
                  </h3>
                  <p className="text-base">{show.first_air_date}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Rating
                  </h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-current text-primary" />
                    <span>{show.vote_average.toFixed(1)}/10</span>
                    <span className="text-sm text-muted-foreground">
                      ({show.vote_count?.toLocaleString()} votes)
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Content Rating
                  </h3>
                  <p className="text-base">{show.content_rating}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Genres
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {show.genres.map((g: any) => (
                      <Badge key={g.id} variant="secondary">
                        {g.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Cast */}
              <div className="mb-8">
                <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                  Cast
                </h3>
                <p className="text-base">
                  {show.credits.cast
                    .slice(0, 5)
                    .map((actor: any) => actor.name)
                    .join(", ")}
                </p>
              </div>

              {/* Episodes */}
              {season && (
                <section id="episodes" className="mb-8 scroll-mt-24">
                  <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                    <h2 className="text-2xl font-bold">Episodes</h2>
                    <SeasonPicker
                      seasons={seasons}
                      selected={selectedSeason}
                      basePath={`/tv/${showId}`}
                    />
                  </div>
                  <EpisodeList showId={showId} episodes={season.episodes} />
                </section>
              )}
            </div>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error loading TV show:", error);
    notFound();
  }
}
