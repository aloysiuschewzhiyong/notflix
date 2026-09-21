import {
  getTVShowDetails,
  getEpisodeDetails,
  getSeasonDetails,
} from "@/utils/tmdb";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { MoviePlayer } from "@/components/movie-player";
import { BackdropImage } from "@/components/backdrop-image";
import { Button } from "@/components/ui/button";
import { EpisodeList } from "@/components/episode-list";
import { SeasonPicker } from "@/components/season-picker";
import { TrackEpisode } from "@/components/watch-progress";
import {
  orderSeasons,
  getAdjacentEpisodes,
  episodeHref,
  episodeLabel,
} from "@/utils/episodes";
import { Metadata } from "next";

interface EpisodePageProps {
  params: Promise<{
    id: string;
    seasonNumber: string;
    episodeNumber: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export async function generateMetadata({
  params,
}: EpisodePageProps): Promise<Metadata> {
  try {
    const resolvedParams = await params;
    const { id, seasonNumber, episodeNumber } = resolvedParams;

    const [show, episode] = await Promise.all([
      getTVShowDetails(id),
      getEpisodeDetails(id, Number(seasonNumber), Number(episodeNumber)),
    ]);

    return {
      title: `${show.name} - S${seasonNumber}E${episodeNumber}: ${episode.name}`,
      description: episode.overview,
    };
  } catch {
    return {
      title: "Episode Not Found",
    };
  }
}

export default async function EpisodePage({
  params,
  searchParams,
}: EpisodePageProps) {
  try {
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const seasonNumber = Number(resolvedParams.seasonNumber);
    const episodeNumber = Number(resolvedParams.episodeNumber);

    const [show, episode, currentSeason] = await Promise.all([
      getTVShowDetails(id),
      getEpisodeDetails(id, seasonNumber, episodeNumber),
      getSeasonDetails(id, seasonNumber),
    ]);

    const seasons = orderSeasons(show.seasons);
    const { prev, next } = getAdjacentEpisodes(
      show.seasons,
      { season: seasonNumber, episode: episodeNumber },
      currentSeason.episodes
    );

    // The sidebar can browse another season without leaving this episode
    const requested = Number((await searchParams)?.season);
    const listSeason =
      requested !== seasonNumber &&
      seasons.some((s) => s.season_number === requested)
        ? await getSeasonDetails(id, requested)
        : currentSeason;

    return (
      <>
        <TrackEpisode
          showId={id}
          season={seasonNumber}
          episode={episodeNumber}
          showName={show.name}
          image={episode.still_path || show.backdrop_path}
        />
        <BackdropImage
          src={`https://image.tmdb.org/t/p/w1280${
            episode.still_path || show.backdrop_path
          }`}
          className="h-[22vh] md:h-[45vh]"
        />
        <div className="container mx-auto px-4 pb-8 -mt-16 md:-mt-48 relative z-10">
          <nav className="text-sm text-muted-foreground mb-2 flex flex-wrap items-center gap-x-1">
            <Link href={`/tv/${id}`} className="hover:text-foreground py-1">
              {show.name}
            </Link>
            {" › "}
            <Link
              href={`/tv/${id}?season=${seasonNumber}#episodes`}
              className="hover:text-foreground py-1"
            >
              Season {seasonNumber}
            </Link>
            {" › "}
            <span className="text-foreground">Episode {episodeNumber}</span>
          </nav>
          <h1 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">
            {episode.name}
          </h1>

          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <MoviePlayer
                key={`${seasonNumber}-${episodeNumber}`}
                movieId={id}
                episodeNumber={episodeNumber}
                seasonNumber={seasonNumber}
                mediaType="tv"
              />

              <div className="flex items-center justify-between gap-4 mt-4">
                {prev ? (
                  <Button asChild variant="secondary">
                    <Link href={episodeHref(id, prev)}>
                      <ChevronLeft className="h-4 w-4" />
                      Prev · {episodeLabel(prev)}
                    </Link>
                  </Button>
                ) : (
                  <span />
                )}
                {next && (
                  <Button asChild>
                    <Link href={episodeHref(id, next)}>
                      Next · {episodeLabel(next)}
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Button>
                )}
              </div>

              <div className="mt-6">
                <p className="text-sm text-muted-foreground mb-2">
                  {episodeLabel({ season: seasonNumber, episode: episodeNumber })}
                  {episode.runtime ? ` · ${episode.runtime}m` : ""}
                  {episode.air_date ? ` · ${episode.air_date}` : ""}
                </p>
                <p className="text-lg text-muted-foreground">{episode.overview}</p>
              </div>
            </div>

            <aside className="lg:col-span-1">
              <div className="flex flex-col gap-3 mb-4">
                <h2 className="text-xl font-bold">Episodes</h2>
                <SeasonPicker
                  seasons={seasons}
                  selected={listSeason.season_number}
                  basePath={episodeHref(id, {
                    season: seasonNumber,
                    episode: episodeNumber,
                  })}
                />
              </div>
              <div className="lg:max-h-[70vh] lg:overflow-y-auto pr-1">
                <EpisodeList
                  showId={id}
                  episodes={listSeason.episodes}
                  variant="compact"
                  current={{ season: seasonNumber, episode: episodeNumber }}
                />
              </div>
            </aside>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error loading episode:", error);
    notFound();
  }
}
