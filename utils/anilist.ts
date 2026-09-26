const ANILIST_API = "https://graphql.anilist.co";

export interface AnimeGenre {
  id: number;
  name: string;
}

export interface AnimeCard {
  id: number;
  title: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  media_type: "anime";
  first_air_date?: string;
  original_language: string;
}

export interface AnimeDetails {
  id: number;
  idMal: number | null;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  episodes: number | null;
  status: string;
  genres: string[];
  format: string | null;
}

// AniList's genre enum, minus Hentai to keep this in line with the rest of the
// (non-adult) catalog. Synthetic numeric ids so this slots into the existing
// Genre{id,name} shape shared with the TMDB-backed movie/series genre menus.
export const ANIME_GENRES: AnimeGenre[] = [
  "Action",
  "Adventure",
  "Comedy",
  "Drama",
  "Ecchi",
  "Fantasy",
  "Horror",
  "Mahou Shoujo",
  "Mecha",
  "Music",
  "Mystery",
  "Psychological",
  "Romance",
  "Sci-Fi",
  "Slice of Life",
  "Sports",
  "Supernatural",
  "Thriller",
].map((name, i) => ({ id: i + 1, name }));

const SORT_MAP: Record<string, string> = {
  popular: "POPULARITY_DESC",
  trending: "TRENDING_DESC",
  top_rated: "SCORE_DESC",
  "start_date.desc": "START_DATE_DESC",
  "start_date.asc": "START_DATE",
  "title.asc": "TITLE_ROMAJI",
  "title.desc": "TITLE_ROMAJI_DESC",
  "favourites.desc": "FAVOURITES_DESC",
};

async function anilistFetch(query: string, variables: Record<string, unknown>) {
  const res = await fetch(ANILIST_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 * 60 },
  });
  if (!res.ok) throw new Error(`AniList API error: ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "AniList query failed");
  return json.data;
}

function mapToCard(media: any): AnimeCard {
  const poster: string | null = media.coverImage?.extraLarge || media.coverImage?.large || null;
  return {
    id: media.id,
    title: media.title?.english || media.title?.romaji || media.title?.native || "Untitled",
    poster_path: poster,
    backdrop_path: media.bannerImage || poster,
    vote_average: media.averageScore ? Number((media.averageScore / 10).toFixed(1)) : 0,
    media_type: "anime",
    first_air_date: media.startDate?.year ? `${media.startDate.year}-01-01` : undefined,
    original_language: "ja",
  };
}

export async function getAnimeGenres(): Promise<AnimeGenre[]> {
  return ANIME_GENRES;
}

export async function getAnimeByGenreAndSort(genreId = 0, sort = "popular", page = 1) {
  const genre = genreId ? ANIME_GENRES.find((g) => g.id === genreId)?.name : undefined;
  const sortEnum = SORT_MAP[sort] || SORT_MAP.popular;

  const query = `
    query ($page: Int, $sort: [MediaSort], $genre: String) {
      Page(page: $page, perPage: 20) {
        pageInfo { total }
        media(type: ANIME, sort: $sort, genre: $genre, isAdult: false) {
          id
          title { romaji english native }
          coverImage { extraLarge large }
          bannerImage
          averageScore
          startDate { year }
        }
      }
    }
  `;

  const data = await anilistFetch(query, { page, sort: [sortEnum], genre });
  const results = (data.Page.media as any[]).map(mapToCard);
  return { results, total_results: data.Page.pageInfo.total as number };
}

export async function getAnimeDetails(anilistId: string | number): Promise<AnimeDetails | null> {
  const query = `
    query ($id: Int) {
      Media(id: $id, type: ANIME) {
        id
        idMal
        title { romaji english native }
        coverImage { extraLarge large }
        bannerImage
        description(asHtml: false)
        genres
        averageScore
        episodes
        format
        status
      }
    }
  `;

  const data = await anilistFetch(query, { id: Number(anilistId) });
  const m = data.Media;
  if (!m) return null;

  const poster: string | null = m.coverImage?.extraLarge || m.coverImage?.large || null;
  return {
    id: m.id,
    idMal: m.idMal ?? null,
    title: m.title?.english || m.title?.romaji || m.title?.native || "Untitled",
    overview: (m.description || "").replace(/<[^>]+>/g, ""),
    poster_path: poster,
    backdrop_path: m.bannerImage || poster,
    vote_average: m.averageScore ? Number((m.averageScore / 10).toFixed(1)) : 0,
    episodes: m.episodes ?? null,
    status: m.status || "UNKNOWN",
    genres: m.genres || [],
    format: m.format ?? null,
  };
}
