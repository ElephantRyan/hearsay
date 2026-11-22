/**
 * The Audiobookshelf address built into this copy of the app (VITE_ABS_URL), for a server whose
 * saved ABS address is one browsers can't reach, such as a Docker-internal name. Usually unset:
 * the app asks the server instead (useAbsUrl).
 */
export const builtInAbsUrl =
  (import.meta.env.VITE_ABS_URL as string | undefined)?.replace(/\/$/, "") || undefined;

/**
 * ABS serves covers without authentication, so the browser loads them straight from ABS at
 * `absUrl`. Undefined, and placeholder art shown, while there's no ABS address.
 */
export function coverUrl(itemId: string, absUrl: string | undefined): string | undefined {
  return absUrl ? `${absUrl}/api/items/${encodeURIComponent(itemId)}/cover` : undefined;
}

/**
 * The book in ABS's own web app, where Play is one tap away. ABS serves its web app under
 * /audiobookshelf/ (its default router base path). Undefined while there's no ABS address.
 */
export function absItemUrl(itemId: string, absUrl: string | undefined): string | undefined {
  return absUrl ? `${absUrl}/audiobookshelf/item/${encodeURIComponent(itemId)}` : undefined;
}

/** An average as shown: one decimal, "8.7". */
export function formatAverage(average: number): string {
  return average.toFixed(1);
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export function formatDate(unixMillis: number): string {
  return dateFormat.format(new Date(unixMillis));
}

export function initialsOf(name: string): string {
  const letters = name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "?";
}

/** "Ryan Recommends": a possessive-free title that reads for any name. */
export function listTitle(username: string): string {
  return `${username} recommends`;
}
