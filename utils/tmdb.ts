const API_KEY = process.env.TMDB_API_KEY || process.env.NEXT_PUBLIC_TMDB_API_KEY;
const BASE_URL = "https://api.themoviedb.org/3";

export async function fetchFromTMDB(
  endpoint: string,
  params: Record<string, string> = {}
) {
  try {
    const url = new URL(`${BASE_URL}${endpoint}`);
    url.searchParams.append("api_key", API_KEY!);

    // Add any additional params
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value);
    });

    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
      },
      next: { revalidate: 60 * 60 }, // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    return response.json();
  } catch (error) {
    console.error("Error fetching from TMDB:", error);
    throw error;
  }
}

export async function getPopularMovies(page = 1, genreId?: number) {
  const res = await fetch(
    `${BASE_URL}/movie/popular?api_key=${API_KEY}&page=${page}&language=en-US${
      genreId ? `&with_genres=${genreId}` : ""
    }`
  );
  const data = await res.json();

  // Get ratings for all movies in parallel
  const moviesWithRatings = await Promise.all(
    data.results
      .filter((m: any) => m.poster_path && m.vote_average > 0)
      .map(async (movie: any) => {
        // Use getMovieContentRating instead of getProperContentRating
        const rating = await getMovieContentRating(movie.id);

        return {
          ...movie,
          vote_average: Number(movie.vote_average).toFixed(1),
          content_rating: rating,
          bgPosition: determineBgPosition(movie.id),
        };
      })
  );

  return { ...data, results: moviesWithRatings };
}

function determineBgPosition(movieId: number) {
  // Map of known good positions for specific movies
  const positions: Record<number, string> = {
    238: "50% 25%", // Godfather
    278: "50% 15%", // Shawshank
    680: "50% 0%", // Pulp Fiction
    // Add more as needed
  };

  return positions[movieId] || "50% 15%";
}

export async function getPopularTVShows(page = 1) {
  const res = await fetch(
    `${BASE_URL}/trending/tv/week?api_key=${API_KEY}&page=${page}&language=en-US`
  );
  const data = await res.json();

  // Get content ratings for all shows in parallel
  const showsWithRatings = await Promise.all(
    data.results
      .filter((m: any) => m.poster_path && m.vote_average > 0)
      .map(async (show: any) => {
        const rating = await getTVShowContentRating(show.id);
        return {
          ...show,
          vote_average: Number(show.vote_average).toFixed(1),
          content_rating: rating,
        };
      })
  );

  return { ...data, results: showsWithRatings };
}

export async function searchMulti(query: string, page = 1) {
  return fetchFromTMDB("/search/multi", { query, page: page.toString() });
}

export async function getMovieDetails(movieId: string) {
  const response = await fetch(
    `https://api.themoviedb.org/3/movie/${movieId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,release_dates`
  );
  const data = await response.json();
  const contentRating = await getMovieContentRating(Number(movieId));

  return {
    ...data,
    content_rating: contentRating,
  };
}

export async function getTVShowDetails(tvShowId: string) {
  const response = await fetch(
    `https://api.themoviedb.org/3/tv/${tvShowId}?api_key=${process.env.TMDB_API_KEY}&append_to_response=credits,content_ratings`
  );
  const data = await response.json();
  const contentRating = await getTVShowContentRating(Number(tvShowId));

  return {
    ...data,
    content_rating: contentRating,
  };
}

export async function getSeasonDetails(tvId: string, seasonNumber: number) {
  return fetchFromTMDB(`/tv/${tvId}/season/${seasonNumber}`);
}

export async function getEpisodeDetails(
  tvId: string,
  seasonNumber: number,
  episodeNumber: number
) {
  return fetchFromTMDB(
    `/tv/${tvId}/season/${seasonNumber}/episode/${episodeNumber}`
  );
}

export async function getMovieGenres() {
  const response = await fetchFromTMDB("/genre/movie/list");
  return response.genres;
}

export async function getTVGenres() {
  const response = await fetchFromTMDB("/genre/tv/list");
  return response.genres;
}

// Update the VidStream availability check function
// Note: This check often fails on hosted environments like Vercel due to IP blocking.
// We return true by default to prevent blocking content on the server.
export async function checkVidStreamAvailability(id: string, type: string) {
  // Always return true to avoid blocking on the server. 
  // Let the player handle actual availability.
  return true;
}

export async function getTopRatedMovies(page = 1) {
  const res = await fetch(
    `${BASE_URL}/movie/top_rated?api_key=${API_KEY}&page=${page}`
  );
  const data = await res.json();

  // Get ratings for all movies in parallel
  const moviesWithRatings = await Promise.all(
    data.results
      .filter((m: any) => m.poster_path && m.vote_average > 0)
      .map(async (movie: any) => {
        // Use getMovieContentRating here too
        const rating = await getMovieContentRating(movie.id);

        return {
          ...movie,
          vote_average: Number(movie.vote_average).toFixed(1),
          content_rating: rating,
          bgPosition: determineBgPosition(movie.id),
        };
      })
  );

  return { ...data, results: moviesWithRatings };
}

export async function getMoviesByReleaseDate(page = 1) {
  const today = new Date().toISOString().split("T")[0]; // Get today's date in YYYY-MM-DD format
  const res = await fetch(
    `${BASE_URL}/discover/movie?api_key=${API_KEY}&sort_by=release_date.desc&page=${page}&release_date.lte=${today}`
  );
  return res.json();
}

export async function getMovieContentRating(movieId: number) {
  try {
    const url = `https://api.themoviedb.org/3/movie/${movieId}/release_dates?api_key=${process.env.TMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      return "NR";
    }

    const data = await response.json();

    // Priority order for ratings
    const countryPriority = ["SG", "US", "GB", "AU", "MY"];

    // Try each country in priority order
    for (const country of countryPriority) {
      const release = data.results.find((r: any) => r.iso_3166_1 === country);
      if (release?.release_dates) {
        // Try theatrical release first
        const theatricalRating = release.release_dates.find(
          (d: any) => d.type === 3 && d.certification
        )?.certification;
        if (theatricalRating) return theatricalRating;

        // If no theatrical, try any rating from this country
        const anyRating = release.release_dates.find(
          (d: any) => d.certification
        )?.certification;
        if (anyRating) return anyRating;
      }
    }

    // If no rating found from priority countries, try any country
    for (const country of data.results) {
      const theatricalRating = country.release_dates.find(
        (d: any) => d.type === 3 && d.certification
      )?.certification;
      if (theatricalRating) return theatricalRating;

      const anyRating = country.release_dates.find(
        (d: any) => d.certification
      )?.certification;
      if (anyRating) return anyRating;
    }

    return "NR";
  } catch (error) {
    return "NR";
  }
}

export async function getMoviesByGenreAndSort(
  genreId?: number,
  sort: string = "popular",
  page = 1
) {
  let endpoint = "/discover/movie";
  let params: Record<string, string> = {
    api_key: process.env.TMDB_API_KEY!,
    page: page.toString(),
    include_adult: "false",
    ["vote_count.gte"]: "100", // Fixed syntax for parameter with dot
  };

  // Always add genre if provided
  if (genreId) {
    params.with_genres = genreId.toString();
  }

  // Handle different sort options
  switch (sort) {
    case "popular":
      if (!genreId) {
        endpoint = "/movie/popular";
      } else {
        params["sort_by"] = "popularity.desc";
      }
      break;
    case "top_rated":
      if (!genreId) {
        endpoint = "/movie/top_rated";
      } else {
        params["sort_by"] = "vote_average.desc";
        params["vote_count.gte"] = "1000"; // Fixed syntax here too
      }
      break;
    default:
      params["sort_by"] = sort;
  }

  const response = await fetch(
    `${BASE_URL}${endpoint}?${new URLSearchParams(params)}`
  );
  const data = await response.json();

  // Get content ratings for each movie
  const moviesWithRatings = await Promise.all(
    data.results.map(async (movie: any) => {
      const contentRating = await getMovieContentRating(movie.id);
      return {
        ...movie,
        content_rating: contentRating,
      };
    })
  );

  return {
    ...data,
    results: moviesWithRatings,
  };
}

export async function getTVShowsByGenreAndSort(
  genreId?: number,
  sort: string = "popular",
  page = 1
) {
  let endpoint = "/discover/tv";
  let params: Record<string, string> = {
    api_key: process.env.TMDB_API_KEY!,
    page: page.toString(),
    include_adult: "false",
  };

  // Always add genre if provided
  if (genreId) {
    params.with_genres = genreId.toString();
  }

  switch (sort) {
    case "popular":
      if (!genreId) {
        endpoint = "/trending/tv/week";
      } else {
        params["sort_by"] = "popularity.desc";
      }
      break;
    case "top_rated":
      if (!genreId) {
        endpoint = "/tv/top_rated";
      } else {
        params["sort_by"] = "vote_average.desc";
        params["vote_count.gte"] = "1000";
      }
      break;
    case "first_air_date.desc":
      endpoint = "/discover/tv";
      params["sort_by"] = "first_air_date.desc";
      params["air_date.lte"] = new Date().toISOString().split("T")[0];
      params["with_original_language"] = "en"; // English shows for better results

      params["vote_count.gte"] = "5"; // At least some votes
      break;
    default:
      params["sort_by"] = sort;
      params["vote_count.gte"] = "100";
  }

  const response = await fetch(
    `${BASE_URL}${endpoint}?${new URLSearchParams(params)}`
  );
  const data = await response.json();

  // Get content ratings for each show
  const showsWithRatings = await Promise.all(
    data.results.map(async (show: any) => {
      const contentRating = await getTVShowContentRating(show.id);
      return {
        ...show,
        content_rating: contentRating,
      };
    })
  );

  return {
    ...data,
    results: showsWithRatings,
  };
}

export async function getTopRatedTVShows(page = 1) {
  const res = await fetch(
    `${BASE_URL}/tv/top_rated?api_key=${API_KEY}&page=${page}`
  );
  const data = await res.json();

  // Get content ratings for all shows in parallel
  const showsWithRatings = await Promise.all(
    data.results
      .filter((m: any) => m.poster_path && m.vote_average > 0)
      .map(async (show: any) => {
        // Use the same function as individual pages
        const rating = await getTVShowContentRating(show.id);

        return {
          ...show,
          vote_average: Number(show.vote_average).toFixed(1),
          content_rating: rating,
        };
      })
  );

  return { ...data, results: showsWithRatings };
}

// Modify getTVContentRating to return raw ratings
export function getTVContentRating(show: any) {
  const usRating = show.content_ratings?.results?.find(
    (r: any) => r.iso_3166_1 === "US"
  );
  return usRating?.rating || "NR";
}

export async function getTVShowContentRating(tvShowId: number) {
  try {
    const url = `https://api.themoviedb.org/3/tv/${tvShowId}/content_ratings?api_key=${process.env.TMDB_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) {
      return "NR";
    }

    const data = await response.json();

    // Priority order for ratings
    const countryPriority = ["SG", "US", "GB", "AU", "MY"];

    // Try each country in priority order
    for (const country of countryPriority) {
      const rating = data.results.find(
        (r: any) => r.iso_3166_1 === country
      )?.rating;
      if (rating) return rating;
    }

    // If no rating found from priority countries, use first available
    const firstRating = data.results[0]?.rating;
    if (firstRating) return firstRating;

    return "NR";
  } catch (error) {
    return "NR";
  }
}

// Function to get movie list with ratings
export async function getMoviesList(endpoint: string) {
  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}?api_key=${process.env.TMDB_API_KEY}`
  );
  const data = await response.json();

  // Fetch ratings for each movie
  const moviesWithRatings = await Promise.all(
    data.results.map(async (movie: any) => {
      const rating = await getMovieContentRating(movie.id);
      return {
        ...movie,
        content_rating: rating,
      };
    })
  );

  return {
    ...data,
    results: moviesWithRatings,
  };
}

// Function to get TV show list with ratings
export async function getTVShowsList(
  endpoint: string,
  params: Record<string, string> = {}
) {
  // Convert params object to URL search params
  const searchParams = new URLSearchParams(params);

  const response = await fetch(
    `https://api.themoviedb.org/3${endpoint}?api_key=${
      process.env.TMDB_API_KEY
    }&${searchParams.toString()}`
  );
  const data = await response.json();

  // Fetch ratings for each TV show
  const showsWithRatings = await Promise.all(
    data.results.map(async (show: any) => {
      const rating = await getTVShowContentRating(show.id);
      return {
        ...show,
        content_rating: rating,
      };
    })
  );

  return {
    ...data,
    results: showsWithRatings,
  };
}

export async function getSeriesList(page: number = 1) {
  try {
    // First get the list of TV shows
    const response = await fetch(
      `https://api.themoviedb.org/3/discover/tv?api_key=${process.env.TMDB_API_KEY}&page=${page}`
    );
    const data = await response.json();

    // Then get ratings for each show
    const showsWithRatings = await Promise.all(
      data.results.map(async (show: any) => {
        const rating = await getTVShowContentRating(show.id);
        return {
          ...show,
          content_rating: rating,
        };
      })
    );

    return {
      ...data,
      results: showsWithRatings,
    };
  } catch (error) {
    console.error("Error fetching series list:", error);
    return { results: [] };
  }
}
