"use server";

import { getMoviesByGenreAndSort, getTVShowsByGenreAndSort } from "@/utils/tmdb";
import { getAnimeByGenreAndSort } from "@/utils/anilist";

export async function loadMoreMovies(
  page: number,
  genreId?: number,
  sort?: string
) {
  try {
    // Same helper as the initial page load so every sort option paginates correctly
    const response = await getMoviesByGenreAndSort(
      genreId || 0,
      sort || "popularity.desc",
      page
    );

    return (
      response?.results?.map((movie: any, index: number) => ({
        ...movie,
        index: index + (page - 1) * 20,
      })) || []
    );
  } catch (error) {
    console.error("Error loading more movies:", error);
    return [];
  }
}

export async function loadMoreTVShows(
  page: number,
  genreId?: number,
  sort?: string
) {
  try {
    const response = await getTVShowsByGenreAndSort(
      genreId || 0,
      sort || "popular",
      page
    );

    return (
      response?.results?.map((show: any, index: number) => ({
        ...show,
        index: index + (page - 1) * 20,
      })) || []
    );
  } catch (error) {
    console.error("Error loading more TV shows:", error);
    return [];
  }
}

export async function loadMoreAnime(page: number, genreId?: number, sort?: string) {
  try {
    const response = await getAnimeByGenreAndSort(genreId || 0, sort || "popular", page);

    return (
      response?.results?.map((anime, index) => ({
        ...anime,
        index: index + (page - 1) * 20,
      })) || []
    );
  } catch (error) {
    console.error("Error loading more anime:", error);
    return [];
  }
}
