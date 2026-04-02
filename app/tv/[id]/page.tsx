import {
  getTVShowDetails,
  checkVidStreamAvailability,
  getTVContentRating,
} from "@/utils/tmdb";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Badge } from "@/components/ui/badge";
import { SeasonAccordion } from "@/components/season-accordion";
import { Star } from "lucide-react";
import { getLanguageName } from "@/utils/helpers";
import { BackdropImage } from "@/components/backdrop-image";
import { MoviePlayer } from "@/components/movie-player";

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

    return (
      <>
        <BackdropImage
          src={`https://image.tmdb.org/t/p/original${show.backdrop_path}`}
        />

        <div className="container mx-auto px-4 -mt-56 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Image
                src={`https://image.tmdb.org/t/p/w500${show.poster_path}`}
                alt={show.name}
                width={500}
                height={750}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-6">{show.name}</h1>

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

              {/* Seasons */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold mb-4">Seasons</h2>
                <SeasonAccordion seasons={show.seasons} tvShowId={showId} />
              </div>
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
