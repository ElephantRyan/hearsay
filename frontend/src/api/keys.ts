import type { RatingSort, RecommendationFilters } from "./types";

/** Query keys in one place, so invalidation is never a guess. */
export const keys = {
  me: ["me"] as const,
  recommendations: (filters: RecommendationFilters) => ["recommendations", filters] as const,
  allRecommendations: ["recommendations"] as const,
  recommenders: ["recommenders"] as const,
  picks: (userId: string) => ["picks", userId] as const,
  allPicks: ["picks"] as const,
  item: (itemId: string) => ["item", itemId] as const,
  libraries: ["libraries"] as const,
  browse: (libraryId: string, page: number, q: string) => ["browse", libraryId, page, q] as const,
  allBrowse: ["browse"] as const,
  myRatings: (sort: RatingSort) => ["my-ratings", sort] as const,
  allMyRatings: ["my-ratings"] as const,
  listening: ["listening"] as const,
  adminSettings: ["admin", "settings"] as const,
  adminStatus: ["admin", "status"] as const,
  adminLinks: ["admin", "links"] as const,
  setup: ["setup"] as const,
};
