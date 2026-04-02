import { searchMulti } from "@/utils/tmdb";
import { MovieGrid } from "@/components/movie-grid";

interface SearchPageProps {
  searchParams: Promise<{
    q: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedParams = await searchParams;
  const query = resolvedParams.q;

  const results = await searchMulti(query);

  // Filter out results without images
  const filteredResults = results.results.filter(
    (result: any) => result.poster_path || result.backdrop_path
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8">
        Search Results for &quot;{query}&quot;
      </h1>

      <MovieGrid initialMovies={filteredResults} showLoadMore={false} />
    </div>
  );
}
