import Link from "next/link";
import { HeroSection } from "@/components/hero-section";
import { MediaRow } from "@/components/media-row";
import { ContinueWatchingRow } from "@/components/watch-progress";
import { getMediaList, getMovieGenres } from "@/utils/tmdb";

const GENRE_ROWS = [
  { title: "Action Movies", type: "movie", genreId: 28 },
  { title: "Crime Series", type: "tv", genreId: 80 },
  { title: "Comedy Movies", type: "movie", genreId: 35 },
  { title: "Sci-Fi & Fantasy Series", type: "tv", genreId: 10765 },
] as const;

export default async function Home() {
  const [
    heroItems,
    trendingMovies,
    trendingSeries,
    nowPlaying,
    topRatedMovies,
    topRatedSeries,
    movieGenres,
    ...genreRows
  ] = await Promise.all([
    getMediaList("/trending/all/week"),
    getMediaList("/trending/movie/week", {}, "movie"),
    getMediaList("/trending/tv/week", {}, "tv"),
    getMediaList("/movie/now_playing", {}, "movie"),
    getMediaList("/movie/top_rated", {}, "movie"),
    getMediaList("/tv/top_rated", {}, "tv"),
    getMovieGenres(),
    ...GENRE_ROWS.map((row) =>
      getMediaList(
        `/discover/${row.type}`,
        { with_genres: String(row.genreId), sort_by: "popularity.desc" },
        row.type
      )
    ),
  ]);

  return (
    <div className="pb-16">
      <HeroSection items={heroItems} />

      <div className="relative z-10 mt-6 md:-mt-16 space-y-8 md:space-y-12">
        <ContinueWatchingRow />
        <MediaRow title="Trending Movies" items={trendingMovies} href="/movies" />
        <MediaRow
          title="Top 10 Series This Week"
          items={trendingSeries}
          href="/series"
          variant="ranked"
        />
        <MediaRow title="New in Theaters" items={nowPlaying} />
        <MediaRow
          title="Top Rated Movies"
          items={topRatedMovies}
          href="/movies?sort=top_rated"
        />

        {/* Genre quick links */}
        <section className="px-4 md:px-12">
          <h2 className="text-xl md:text-2xl font-bold mb-3">Browse by Genre</h2>
          <div className="flex flex-wrap gap-2">
            {movieGenres.map((g: { id: number; name: string }) => (
              <Link
                key={g.id}
                href={`/movies?genreId=${g.id}`}
                className="rounded-full border px-4 py-1.5 text-sm hover:bg-secondary transition-colors"
              >
                {g.name}
              </Link>
            ))}
          </div>
        </section>

        {GENRE_ROWS.map((row, i) => (
          <MediaRow
            key={row.title}
            title={row.title}
            items={genreRows[i]}
            href={`/${row.type === "movie" ? "movies" : "series"}?genreId=${row.genreId}`}
          />
        ))}
        <MediaRow
          title="Top Rated Series"
          items={topRatedSeries}
          href="/series?sort=top_rated"
        />
      </div>
    </div>
  );
}
