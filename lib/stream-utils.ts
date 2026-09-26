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
