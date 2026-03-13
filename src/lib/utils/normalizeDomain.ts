/**
 * Normalize a URL or domain string to a bare domain key.
 * Used as the cache key for the brands table.
 *
 * Examples:
 *   "https://www.yana.company/"  → "yana.company"
 *   "http://yana.company"        → "yana.company"
 *   "yana.company"               → "yana.company"
 *   "www.yana.company"           → "yana.company"
 */
export function normalizeDomain(input: string): string {
  let s = input.trim().toLowerCase();

  // Add scheme if missing so URL() can parse it
  if (!s.startsWith("http://") && !s.startsWith("https://")) {
    s = "https://" + s;
  }

  try {
    const url = new URL(s);
    let host = url.hostname;
    // Strip leading www.
    if (host.startsWith("www.")) {
      host = host.slice(4);
    }
    return host;
  } catch {
    // Fallback: strip scheme and www manually
    s = s.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0];
    return s;
  }
}
