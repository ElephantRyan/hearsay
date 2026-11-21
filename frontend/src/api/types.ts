import type { paths } from "./schema";

type Json<T> = T extends { content: { "application/json": infer B } } ? B : never;
type Ok<T> = T extends { responses: { 200: infer R } } ? Json<R> : never;

export type Me = Ok<paths["/me"]["get"]>;
export type Health = Ok<paths["/health"]["get"]>;
export type RecommendedBook = Ok<paths["/recommendations"]["get"]>[number];
export type Recommender = Ok<paths["/recommendations/users"]["get"]>[number];
export type RatingRow = Ok<paths["/ratings/mine"]["get"]>[number];
export type ItemDetail = Ok<paths["/items/{itemId}"]["get"]>;
export type Library = Ok<paths["/libraries"]["get"]>[number];
export type BrowseResult = Ok<paths["/libraries/{libraryId}/items"]["get"]>;
export type BrowseItem = BrowseResult["items"][number];
export type Rating = Ok<paths["/ratings/{itemId}"]["put"]>;
export type ListenedBook = Ok<paths["/me/listening"]["get"]>[number];

export type RatingSort = "score" | "newest" | "title";

export interface RecommendationFilters {
  userId?: string | undefined;
  libraryId?: string | undefined;
  minScore?: number | undefined;
}
