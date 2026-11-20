const absUrl = (import.meta.env.VITE_ABS_URL as string | undefined)?.replace(/\/$/, "");

/**
 * ABS serves covers without authentication, so the browser loads them
 * straight from ABS. With no VITE_ABS_URL the UI shows placeholder art.
 */
export function coverUrl(itemId: string): string | undefined {
  return absUrl ? `${absUrl}/api/items/${encodeURIComponent(itemId)}/cover` : undefined;
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
