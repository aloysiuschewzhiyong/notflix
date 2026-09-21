export interface SeasonSummary {
  id: number;
  name: string;
  season_number: number;
  episode_count: number;
}

export interface EpisodeRef {
  season: number;
  episode: number;
}

// Regular seasons in order, with "Specials" (season 0) moved to the end
export function orderSeasons(seasons: SeasonSummary[] = []) {
  const withEpisodes = seasons.filter((s) => s.episode_count > 0);
  return [
    ...withEpisodes
      .filter((s) => s.season_number > 0)
      .sort((a, b) => a.season_number - b.season_number),
    ...withEpisodes.filter((s) => s.season_number === 0),
  ];
}

export function defaultSeasonNumber(seasons: SeasonSummary[]) {
  return orderSeasons(seasons)[0]?.season_number ?? 1;
}

export function isAired(airDate?: string | null) {
  return !!airDate && new Date(airDate) <= new Date();
}

// Previous/next episode, crossing season boundaries. Specials are skipped.
export function getAdjacentEpisodes(
  seasons: SeasonSummary[],
  current: EpisodeRef,
  currentSeasonEpisodes: { episode_number: number; air_date?: string | null }[]
): { prev: EpisodeRef | null; next: EpisodeRef | null } {
  const regular = orderSeasons(seasons).filter((s) => s.season_number > 0);
  const idx = regular.findIndex((s) => s.season_number === current.season);

  let prev: EpisodeRef | null = null;
  if (current.episode > 1) {
    prev = { season: current.season, episode: current.episode - 1 };
  } else if (idx > 0) {
    const prevSeason = regular[idx - 1];
    prev = {
      season: prevSeason.season_number,
      episode: prevSeason.episode_count,
    };
  }

  let next: EpisodeRef | null = null;
  const nextInSeason = currentSeasonEpisodes.find(
    (e) => e.episode_number === current.episode + 1
  );
  if (nextInSeason) {
    if (isAired(nextInSeason.air_date)) {
      next = { season: current.season, episode: current.episode + 1 };
    }
  } else if (idx >= 0 && idx < regular.length - 1) {
    next = { season: regular[idx + 1].season_number, episode: 1 };
  }

  return { prev, next };
}

export function episodeHref(showId: string, ref: EpisodeRef) {
  return `/tv/${showId}/season/${ref.season}/episode/${ref.episode}`;
}

export function episodeLabel(ref: EpisodeRef) {
  return `S${ref.season} E${ref.episode}`;
}
