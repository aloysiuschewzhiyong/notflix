import {
  getPopularTVShows,
  getTVGenres,
  getTopRatedTVShows,
  getTVShowsByGenreAndSort,
} from "@/utils/tmdb";
import { BrowseHero } from "@/components/browse-hero";
import { BrowseView } from "@/components/browse-view";
import { loadMoreTVShows } from "../actions";
import { SORT_OPTIONS } from "@/utils/sort-options";

export const revalidate = 0;

interface SeriesPageProps {
  searchParams: Promise<{
    genreId?: string;
    sort?: string;
  }>;
}

export default async function SeriesPage({ searchParams }: SeriesPageProps) {
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genreId
    ? Number(resolvedParams.genreId)
    : undefined;
  const sort = resolvedParams.sort;

  const [initialShows, genres] = await Promise.all([
    getTVShowsByGenreAndSort(genreId || 0, sort || "popular", 1),
    getTVGenres(),
  ]);

  const genreName = genreId
    ? genres.find((g) => g.id === genreId)?.name
    : undefined;

  // Get the sort label from SORT_OPTIONS
  const sortLabel =
    SORT_OPTIONS.tv.find((opt) => opt.value === sort)?.label ?? "Popular";

  const noun = "Series";
  const title = genreName ? `${sortLabel} ${genreName} ${noun}` : `${sortLabel} ${noun}`;
  const total = initialShows.total_results as number | undefined;

  return (
    <>
      <BrowseHero
        eyebrow={genreName ?? "All genres"}
        title={title}
        subtitle={total ? `${total.toLocaleString()} titles to explore` : undefined}
        items={initialShows.results}
      />
      <BrowseView
        key={`series-${genreId || "all"}-${sort}`}
        mediaType="tv"
        genres={genres}
        genreId={genreId}
        sort={sort}
        initialItems={initialShows.results}
        loadMore={loadMoreTVShows}
      />
    </>
  );
}
