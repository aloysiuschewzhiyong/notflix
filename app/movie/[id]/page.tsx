import { getMovieDetails, checkVidStreamAvailability } from "@/utils/tmdb";
import { notFound } from "next/navigation";
import Image from "next/image";
import { MoviePlayer } from "@/components/movie-player";
import { Badge } from "@/components/ui/badge";
import { getLanguageName } from "@/utils/helpers";
import { Star } from "lucide-react";
import { BackdropImage } from "@/components/backdrop-image";

interface MoviePageProps {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function MoviePage({ params, searchParams }: MoviePageProps) {
  try {
    const resolvedParams = await params;
    const movieId = resolvedParams.id;

    const movie = await getMovieDetails(movieId);

    return (
      <>
        <BackdropImage
          src={`https://image.tmdb.org/t/p/original${movie.backdrop_path}`}
        />

        <div className="container mx-auto px-4 -mt-56 relative z-10">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="md:col-span-1">
              <Image
                src={`https://image.tmdb.org/t/p/w500${movie.poster_path}`}
                alt={movie.title}
                width={500}
                height={750}
                className="w-full h-auto rounded-lg shadow-lg"
              />
            </div>
            <div className="md:col-span-2">
              <h1 className="text-3xl font-bold mb-6">{movie.title}</h1>

              {/* Overview */}
              <p className="text-base mb-8 text-muted-foreground">
                {movie.overview}
              </p>

              {/* Main metadata grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Language
                  </h3>
                  <p className="text-base">
                    {movie.original_language
                      ? getLanguageName(movie.original_language)
                      : "N/A"}
                  </p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Release Date
                  </h3>
                  <p className="text-base">{movie.release_date}</p>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Rating
                  </h3>
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4 fill-current text-primary" />
                    <span>{movie.vote_average.toFixed(1)}/10</span>
                    <span className="text-sm text-muted-foreground">
                      ({movie.vote_count?.toLocaleString()} votes)
                    </span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Content Rating
                  </h3>
                  <p className="text-base">{movie.content_rating}</p>
                </div>
                <div className="col-span-2">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">
                    Genres
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {movie.genres.map((g: any) => (
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
                  {movie.credits.cast
                    .slice(0, 5)
                    .map((actor: any) => actor.name)
                    .join(", ")}
                </p>
              </div>

              {/* Player */}
              <div className="mb-8">
                <MoviePlayer movieId={movieId} mediaType="movie" />
              </div>
            </div>
          </div>
        </div>
      </>
    );
  } catch (error) {
    console.error("Error loading movie:", error);
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-4">Error</h1>
        <p>Sorry, there was an error loading the movie.</p>
      </div>
    );
  }
}
