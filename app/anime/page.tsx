import { getAnimeByGenreAndSort, getAnimeGenres } from "@/utils/anilist";
import { BrowseHero } from "@/components/browse-hero";
import { BrowseView } from "@/components/browse-view";
import { loadMoreAnime } from "../actions";
import { SORT_OPTIONS } from "@/utils/sort-options";

export const revalidate = 0;

interface AnimePageProps {
  searchParams: Promise<{
    genreId?: string;
    sort?: string;
  }>;
}

export default async function AnimePage({ searchParams }: AnimePageProps) {
  const resolvedParams = await searchParams;
  const genreId = resolvedParams.genreId ? Number(resolvedParams.genreId) : undefined;
  const sort = resolvedParams.sort;

  const [initialAnime, genres] = await Promise.all([
    getAnimeByGenreAndSort(genreId || 0, sort || "popular", 1),
    getAnimeGenres(),
  ]);

  const genreName = genreId ? genres.find((g) => g.id === genreId)?.name : undefined;

  const sortLabel = SORT_OPTIONS.anime.find((opt) => opt.value === sort)?.label ?? "Popular";

  const noun = "Anime";
  const title = genreName ? `${sortLabel} ${genreName} ${noun}` : `${sortLabel} ${noun}`;
  const total = initialAnime.total_results;

  return (
    <>
      <BrowseHero
        eyebrow={genreName ?? "All genres"}
        title={title}
        subtitle={total ? `${total.toLocaleString()} titles to explore` : undefined}
        items={initialAnime.results}
      />
      <BrowseView
        key={`anime-${genreId || "all"}-${sort}`}
        mediaType="anime"
        genres={genres}
        genreId={genreId}
        sort={sort}
        initialItems={initialAnime.results}
        loadMore={loadMoreAnime}
      />
    </>
  );
}
