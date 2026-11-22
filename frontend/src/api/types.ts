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
export type MissingBook = Ok<paths["/recommendations/users/{userId}/missing"]["get"]>[number];

export type AdminSettings = Ok<paths["/admin/settings"]["get"]>;
export type SettingValue = AdminSettings["absUrl"];
export type AdminStatus = Ok<paths["/admin/status"]["get"]>;
export type SyncResult = Ok<paths["/sync"]["post"]>[number];
export type SetupState = Ok<paths["/setup"]["get"]>;
export type LinkedServer = Ok<paths["/admin/links"]["get"]>[number];
export type LinkInvite = Ok<paths["/admin/links/invite"]["post"]>;

/** How people sign in: the `AUTH_MODE` values. */
export type AuthMode = "abs" | "oidc" | "both";

/** What PUT /admin/settings takes: only the settings being changed. */
export interface SettingsChange {
  absUrl?: string;
  serviceToken?: string;
  mirrorEnabled?: boolean;
  authMode?: AuthMode;
  frontendUrl?: string;
  oidcIssuer?: string;
  oidcClientId?: string;
  oidcClientSecret?: string;
  oidcRedirectUri?: string;
  serverName?: string;
}

/** The setting names DELETE /admin/settings/{name} knows. */
export type SettingName = keyof SettingsChange;

export type RatingSort = "score" | "newest" | "title";
export type BrowseSort = NonNullable<
  NonNullable<paths["/libraries/{libraryId}/items"]["get"]["parameters"]["query"]>["sort"]
>;

export interface RecommendationFilters {
  userId?: string | undefined;
  libraryId?: string | undefined;
  minScore?: number | undefined;
}
