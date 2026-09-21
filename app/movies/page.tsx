import {
  getPopularMovies,
  getMovieGenres,
  getTopRatedMovies,
  getMoviesByReleaseDate,
  getMoviesByGenreAndSort,
} from "@/utils/tmdb";
import { BrowseHero } from "@/components/browse-hero";
import { BrowseView } from "@/components/browse-view";
import { loadMoreMovies } from "../actions";
import { SORT_OPTIONS } from "@/utils/sort-options";

export const revalidate = 0;

interface MoviesPageProps {
  searchParams: Promise<{
    genreId?: string;
    sort?: string;
  }>;
}

export default async function MoviesPage({ searchParams }: MoviesPageProps) {
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genreId
    ? Number(resolvedParams.genreId)
    : undefined;
  const sort = resolvedParams.sort;

  const [initialMovies, genres] = await Promise.all([
    getMoviesByGenreAndSort(genreId || 0, sort || "popularity.desc", 1),
    getMovieGenres(),
  ]);

  const genreName = genreId
    ? genres.find((g) => g.id === genreId)?.name
    : undefined;

  const sortLabel =
    SORT_OPTIONS.movie.find((opt) => opt.value === sort)?.label ?? "Popular";

  const noun = "Movies";
  // Avoid "TV Movie Movies"
  const genreLabel = genreName?.replace(/ Movie$/, "");
  const title = genreLabel ? `${sortLabel} ${genreLabel} ${noun}` : `${sortLabel} ${noun}`;
  const total = initialMovies.total_results as number | undefined;

  return (
    <>
      <BrowseHero
        eyebrow={genreName ?? "All genres"}
        title={title}
        subtitle={total ? `${total.toLocaleString()} titles to explore` : undefined}
        items={initialMovies.results}
      />
      <BrowseView
        key={`movies-${genreId || "all"}-${sort}`}
        mediaType="movie"
        genres={genres}
        genreId={genreId}
        sort={sort}
        initialItems={initialMovies.results}
        loadMore={loadMoreMovies}
      />
    </>
  );
}
