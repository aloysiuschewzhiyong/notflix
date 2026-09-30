// Recursively search a decrypted enc-dec.app payload for a playable stream URL.
// The exact response shape varies by provider (vidfast, megaup, ...), so this
// walks the structure looking for common file/url keys or url-like strings.
export function findStreamUrl(value: unknown): string | null {
  if (typeof value === "string") {
    if (/\.(m3u8|mp4)(\?|$)/i.test(value) || value.startsWith("http")) {
      return value;
    }
    return null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStreamUrl(item);
      if (found) return found;
    }
    return null;
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    for (const key of ["file", "url", "src", "link"]) {
      if (typeof obj[key] === "string") return obj[key] as string;
    }
    for (const key of Object.keys(obj)) {
      const found = findStreamUrl(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

export interface SubtitleTrack {
  url: string;
  label: string;
  lang?: string;
  default?: boolean;
}

// Field names these providers use for a subtitle/caption track list.
const SUBTITLE_ARRAY_KEYS = ["tracks", "captions", "subtitles", "subs"];

function normalizeSubtitle(item: unknown): SubtitleTrack | null {
  if (!item || typeof item !== "object") return null;
  const obj = item as Record<string, unknown>;
  const url = obj.file || obj.url || obj.src;
  if (typeof url !== "string" || !url) return null;
  const lang = typeof obj.lang === "string" ? obj.lang : typeof obj.language === "string" ? obj.language : undefined;
  const label = typeof obj.label === "string" ? obj.label : lang || "Subtitle";
  return { url, label, lang, default: obj.default === true };
}

// Recursively search a decrypted payload for a subtitle/caption track list,
// trying known field names first before scanning every array in the payload.
export function findSubtitles(value: unknown, depth = 0): SubtitleTrack[] {
  if (depth > 6 || !value || typeof value !== "object") return [];

  if (Array.isArray(value)) {
    const normalized = value.map(normalizeSubtitle).filter((t): t is SubtitleTrack => t !== null);
    if (normalized.length > 0 && normalized.length === value.length) return normalized;
    return value.flatMap((v) => findSubtitles(v, depth + 1));
  }

  const obj = value as Record<string, unknown>;
  for (const key of SUBTITLE_ARRAY_KEYS) {
    if (Array.isArray(obj[key])) {
      const normalized = (obj[key] as unknown[])
        .map(normalizeSubtitle)
        .filter((t): t is SubtitleTrack => t !== null);
      if (normalized.length > 0) return normalized;
    }
  }
  for (const key of Object.keys(obj)) {
    const found = findSubtitles(obj[key], depth + 1);
    if (found.length > 0) return found;
  }
  return [];
}
