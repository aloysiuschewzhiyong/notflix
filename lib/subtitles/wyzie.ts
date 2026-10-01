import type { SubtitleTrack } from "@/lib/stream-utils";
import { fetchWithTimeout } from "@/lib/fetch-timeout";

// Wyzie Subs (sub.wyzie.io): a purpose-built subtitle search API. The video
// decrypt sources (vidfast/cinejoy/etc.) don't carry subtitle data themselves,
// so this is a separate lookup keyed by TMDB/IMDB id. Requires a free key -
// see docs.wyzie.io. Degrades to no subtitles if WYZIE_API_KEY isn't set.

const WYZIE_API = "https://sub.wyzie.io";

// A handful of common languages; Wyzie returns every match for these, we then
// keep just the first (best) result per language.
const LANGUAGES = "en,es,fr,de,pt,ja,ko,zh,ar,hi";

interface WyzieResult {
  url: string;
  display: string;
  language: string;
  isHearingImpaired: boolean;
}

export interface WyzieLookup {
  tmdbId?: string;
  imdbId?: string;
  season?: string;
  episode?: string;
}

export async function fetchWyzieSubtitles(lookup: WyzieLookup): Promise<SubtitleTrack[]> {
  const apiKey = process.env.WYZIE_API_KEY;
  const id = lookup.imdbId || lookup.tmdbId;
  if (!apiKey || !id) return [];

  const params = new URLSearchParams({ id, key: apiKey, language: LANGUAGES });
  if (lookup.season && lookup.episode) {
    params.set("season", lookup.season);
    params.set("episode", lookup.episode);
  }

  try {
    const resp = await fetchWithTimeout(`${WYZIE_API}/search?${params.toString()}`);
    if (!resp.ok) return [];
    const results: WyzieResult[] = await resp.json();
    if (!Array.isArray(results)) return [];

    const seenLanguages = new Set<string>();
    const tracks: SubtitleTrack[] = [];
    for (const r of results) {
      if (r.isHearingImpaired || seenLanguages.has(r.language)) continue;
      seenLanguages.add(r.language);
      tracks.push({
        url: `${r.url}&to=vtt`,
        label: r.display,
        lang: r.language,
        // Never auto-enable: the free tier injects a promotional cue at the
        // start of every file, which looks like a broken player if it's on
        // by default. Let people opt in via the CC menu instead.
        default: false,
      });
    }
    return tracks;
  } catch {
    return [];
  }
}
