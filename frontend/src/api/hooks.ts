import {
  keepPreviousData,
  queryOptions,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { builtInAbsUrl } from "../lib/format";
import { api } from "./client";
import { ApiError, messageOf, unwrap } from "./errors";
import { keys } from "./keys";
import type {
  BrowseResult,
  BrowseSort,
  RatingRow,
  RatingSort,
  RecommendationFilters,
  SettingName,
  SettingsChange,
  UpNextBook,
} from "./types";

/** Who is signed in. A 401 is an answer ("nobody"), not an error to retry. */
export const meQuery = queryOptions({
  queryKey: keys.me,
  queryFn: async () => unwrap(await api.GET("/me")),
  retry: false,
  staleTime: 60_000,
});

export const useMe = () => useQuery(meQuery);

/** Which sign-in methods the server offers. Public: asked before anyone is signed in. */
export const useSignInModes = () =>
  useQuery({
    queryKey: ["sign-in-modes"],
    queryFn: async () => unwrap(await api.GET("/auth/modes")),
    staleTime: Number.POSITIVE_INFINITY,
  });

export const useRecommendations = (filters: RecommendationFilters) =>
  useQuery({
    queryKey: keys.recommendations(filters),
    queryFn: async () =>
      unwrap(
        await api.GET("/recommendations", {
          params: {
            query: {
              ...(filters.userId ? { userId: filters.userId } : {}),
              ...(filters.libraryId ? { libraryId: filters.libraryId } : {}),
              ...(filters.minScore ? { minScore: filters.minScore } : {}),
            },
          },
        }),
      ),
  });

export const useRecommenders = () =>
  useQuery({
    queryKey: keys.recommenders,
    queryFn: async () => unwrap(await api.GET("/recommendations/users")),
  });

export const usePicks = (userId: string) =>
  useQuery({
    queryKey: keys.picks(userId),
    queryFn: async () =>
      unwrap(await api.GET("/recommendations/users/{userId}", { params: { path: { userId } } })),
  });

/**
 * What a linked server's person recommends that this library doesn't have. Only their ids
 * start with "linked-", so nobody else's page asks.
 */
export const useMissing = (userId: string) =>
  useQuery({
    queryKey: keys.missing(userId),
    enabled: userId.startsWith("linked-"),
    queryFn: async () =>
      unwrap(
        await api.GET("/recommendations/users/{userId}/missing", { params: { path: { userId } } }),
      ),
  });

export const useItem = (itemId: string) =>
  useQuery({
    queryKey: keys.item(itemId),
    queryFn: async () => unwrap(await api.GET("/items/{itemId}", { params: { path: { itemId } } })),
  });

/** The books I have started or finished in ABS, most recent first, with my scores. */
export const useMyListening = () =>
  useQuery({
    queryKey: keys.listening,
    queryFn: async () => unwrap(await api.GET("/me/listening")),
  });

export const useMyRatings = (sort: RatingSort) =>
  useQuery({
    queryKey: keys.myRatings(sort),
    queryFn: async () => unwrap(await api.GET("/ratings/mine", { params: { query: { sort } } })),
  });

/** The book libraries on the server. They rarely change, so they are cached for a while. */
export const useLibraries = () =>
  useQuery({
    queryKey: keys.libraries,
    queryFn: async () => unwrap(await api.GET("/libraries")),
    staleTime: 10 * 60_000,
  });

export const BROWSE_PAGE_SIZE = 24;

/** Which books a browse lists: the whole library, one author's, or one series'. */
export interface BrowseScope {
  author?: string | undefined;
  series?: string | undefined;
}

/**
 * A library a page at a time in `sort` order (or one author's or series' books in it), or the
 * hits of a search when `q` is not blank (ABS doesn't page a search, so there is only ever one
 * page of hits). The old list stays on screen while a new search or order loads, so typing
 * doesn't flash a skeleton.
 */
export const useBrowse = (
  libraryId: string | undefined,
  q: string,
  sort: BrowseSort,
  scope: BrowseScope = {},
) =>
  useInfiniteQuery({
    queryKey: keys.browse(libraryId ?? "", q, sort, `${scope.author ?? ""}|${scope.series ?? ""}`),
    enabled: libraryId !== undefined,
    placeholderData: keepPreviousData,
    initialPageParam: 0,
    getNextPageParam: (last: BrowseResult) =>
      q === "" && (last.page + 1) * last.limit < last.total ? last.page + 1 : undefined,
    queryFn: async ({ pageParam }) =>
      unwrap(
        await api.GET("/libraries/{libraryId}/items", {
          params: {
            path: { libraryId: libraryId as string },
            query: {
              page: pageParam,
              size: BROWSE_PAGE_SIZE,
              sort,
              ...(q ? { q } : {}),
              ...(scope.author ? { author: scope.author } : {}),
              ...(scope.series ? { series: scope.series } : {}),
            },
          },
        }),
      ),
  });

export interface RatingDraft {
  itemId: string;
  /** None for a recommendation without a score. */
  score: number | null;
  note: string;
  recommended: boolean;
  /** Whether others may see the note; it is the writer's own otherwise. */
  noteShared: boolean;
}

/** Everything a changed rating can change: lists, averages, rankings. */
async function refreshAfterRatingChange(
  queryClient: ReturnType<typeof useQueryClient>,
  itemId: string,
) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: keys.allMyRatings }),
    queryClient.invalidateQueries({ queryKey: keys.allBrowse }),
    queryClient.invalidateQueries({ queryKey: keys.allRecommendations }),
    queryClient.invalidateQueries({ queryKey: keys.recommenders }),
    queryClient.invalidateQueries({ queryKey: keys.item(itemId) }),
    queryClient.invalidateQueries({ queryKey: keys.allPicks }),
    queryClient.invalidateQueries({ queryKey: keys.listening }),
    queryClient.invalidateQueries({ queryKey: keys.allSeries }),
    queryClient.invalidateQueries({ queryKey: keys.allSeriesPicks }),
  ]);
}

/**
 * Rate a book. The "my ratings" lists update at once and roll back if the
 * server refuses (FRONTEND.md section 4); everything that depends on the
 * rating is refetched afterwards, since averages and rankings change too.
 */
export function useRateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: RatingDraft) =>
      unwrap(
        await api.PUT("/ratings/{itemId}", {
          params: { path: { itemId: draft.itemId } },
          body: {
            score: draft.score,
            note: draft.note,
            recommended: draft.recommended,
            noteShared: draft.noteShared,
          },
        }),
      ),
    onMutate: async (draft) => {
      await queryClient.cancelQueries({ queryKey: keys.allMyRatings });
      const snapshots = queryClient.getQueriesData<RatingRow[]>({ queryKey: keys.allMyRatings });
      for (const [key, rows] of snapshots) {
        if (!rows) continue;
        queryClient.setQueryData<RatingRow[]>(
          key,
          rows.map((row) =>
            row.itemId === draft.itemId
              ? {
                  ...row,
                  score: draft.score,
                  note: draft.note,
                  recommended: draft.recommended,
                  noteShared: draft.noteShared,
                }
              : row,
          ),
        );
      }
      return { snapshots };
    },
    onError: (_error, _draft, context) => {
      for (const [key, rows] of context?.snapshots ?? []) queryClient.setQueryData(key, rows);
    },
    onSettled: (_data, _error, draft) => refreshAfterRatingChange(queryClient, draft.itemId),
  });
}

/** Remove my rating. It leaves the "my ratings" lists at once and comes back if the server refuses. */
export function useRemoveRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrap(await api.DELETE("/ratings/{itemId}", { params: { path: { itemId } } })),
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: keys.allMyRatings });
      const snapshots = queryClient.getQueriesData<RatingRow[]>({ queryKey: keys.allMyRatings });
      for (const [key, rows] of snapshots) {
        if (rows)
          queryClient.setQueryData<RatingRow[]>(
            key,
            rows.filter((row) => row.itemId !== itemId),
          );
      }
      return { snapshots };
    },
    onError: (_error, _itemId, context) => {
      for (const [key, rows] of context?.snapshots ?? []) queryClient.setQueryData(key, rows);
    },
    onSettled: (_data, _error, itemId) => refreshAfterRatingChange(queryClient, itemId),
  });
}

/** POST /session answers through a conversion,, whose body (the identity) is ignored: /me is refetched instead. */
export function usePasswordSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (credentials: { username: string; password: string }) => {
      const { error, response } = await api.POST("/session", { body: credentials });
      if (!response.ok) {
        throw new ApiError(response.status, messageOf(error, "Sign-in failed. Try again."));
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.me }),
  });
}

export function useSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.DELETE("/session");
    },
    onSettled: () => queryClient.clear(),
  });
}

/** An Audiobookshelf admin or its owner: the people who see the admin screen. */
export const isAdmin = (userType: string | undefined) =>
  userType === "admin" || userType === "root";

/** The settings an admin can change, and where each value comes from. */
export const useAdminSettings = () =>
  useQuery({
    queryKey: keys.adminSettings,
    queryFn: async () => unwrap(await api.GET("/admin/settings")),
  });

/** Whether Audiobookshelf answers and whose token this server holds. Asks ABS each time. */
export const useAdminStatus = () =>
  useQuery({
    queryKey: keys.adminStatus,
    queryFn: async () => unwrap(await api.GET("/admin/status")),
    staleTime: 0,
  });

/**
 * After a settings change everything may read differently: another server, another token.
 * The new settings are fetched with the change; the rest is refetched.
 */
function refreshAfterSettingsChange(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== "me" && query.queryKey[1] !== "settings",
  });
}

/**
 * The settings as they stand after a change. Asked for in a request of its own: the request that
 * saves reads the settings as they were when it began (fiig ADR 0140 §3), so its answer shows the
 * values from before the change.
 */
async function settingsAfterChange() {
  return unwrap(await api.GET("/admin/settings"));
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: SettingsChange) => {
      unwrap(await api.PUT("/admin/settings", { body: change }));
      return settingsAfterChange();
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData(keys.adminSettings, settings);
      await refreshAfterSettingsChange(queryClient);
    },
  });
}

/** Forget a saved setting, so the environment's value applies again. */
export function useResetSetting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: SettingName) => {
      unwrap(await api.DELETE("/admin/settings/{name}", { params: { path: { name } } }));
      return settingsAfterChange();
    },
    onSuccess: async (settings) => {
      queryClient.setQueryData(keys.adminSettings, settings);
      await refreshAfterSettingsChange(queryClient);
    },
  });
}

/** Mirror recommendations into ABS collections, or (dryRun) only say what would change. */
export function useSyncCollections() {
  return useMutation({
    mutationFn: async ({ dryRun }: { dryRun: boolean }) =>
      unwrap(await api.POST("/sync", { params: { query: { dryRun } } })),
  });
}

/**
 * Read every saved book and series again from Audiobookshelf, as the daily refresh does. Every
 * list may show something new after it, so all are refetched.
 */
export function useRefreshFromAbs() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/admin/refresh")),
    onSuccess: () =>
      queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "me" }),
  });
}

/** A link, a fetch or an unlink changes every list that counts linked ratings. */
function refreshAfterLinkChange(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "me" });
}

/** The servers linked to this one (LINKED.md section 4). */
export const useLinkedServers = () =>
  useQuery({
    queryKey: keys.adminLinks,
    queryFn: async () => unwrap(await api.GET("/admin/links")),
  });

/** A one-time link code for another server's admin, good for 24 hours. */
export function useInviteServer() {
  return useMutation({
    mutationFn: async () => unwrap(await api.POST("/admin/links/invite")),
  });
}

/** Take up another server's invite with the code its admin gave. */
export function useLinkServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (code: string) => unwrap(await api.POST("/admin/links", { body: { code } })),
    onSuccess: () => refreshAfterLinkChange(queryClient),
  });
}

/**
 * Fetch a linked server's recommendations now. A server that doesn't answer still comes back
 * as a server, with its problem; only a refusal by this one is an error.
 */
export function useRefreshLink() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.POST("/admin/links/{id}/refresh", { params: { path: { id } } })),
    onSuccess: () => refreshAfterLinkChange(queryClient),
  });
}

/** Unlink a server. The answer says whether that server could be told. */
export function useUnlinkServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE("/admin/links/{id}", { params: { path: { id } } })),
    onSuccess: () => refreshAfterLinkChange(queryClient),
  });
}

/** Whether this server still needs its first-run setup. Public, like the sign-in modes. */
export const useSetupState = () =>
  useQuery({
    queryKey: keys.setup,
    queryFn: async () => unwrap(await api.GET("/setup")),
  });

/**
 * The first run: Audiobookshelf's address and an ABS admin's login. That admin comes back
 * signed in, so the whole cache starts over.
 */
export function useRunSetup() {
  const queryClient = useQueryClient();
  return useMutation({
    // The address the app is open at becomes its own, for links and sign-in redirects.
    mutationFn: async (input: { absUrl: string; username: string; password: string }) =>
      unwrap(
        await api.POST("/setup", {
          body: { ...input, frontendUrl: globalThis.location?.origin ?? null },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}

/**
 * Where browsers reach Audiobookshelf, for covers and "Open in Audiobookshelf": the address built
 * into the app if there is one, or else the server's (saved in the app, or ABS_URL). Undefined
 * until it is known. A settings change refetches it with everything else.
 */
export function useAbsUrl(): string | undefined {
  const server = useQuery({
    queryKey: keys.abs,
    enabled: builtInAbsUrl === undefined,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async () => unwrap(await api.GET("/abs")),
  });
  return builtInAbsUrl ?? server.data?.url?.replace(/\/$/, "") ?? undefined;
}

/** My account: the username I sign in with, and the name everyone else sees. */
export const useAccount = () =>
  useQuery({
    queryKey: keys.account,
    queryFn: async () => unwrap(await api.GET("/me/account")),
  });

/** Change the name everyone else sees. Every list showing names is refetched with it. */
export function useSaveAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    // Only what changes is sent: a name, or one of the settings.
    mutationFn: async (change: {
      displayName?: string;
      shareNotesByDefault?: boolean;
      skipRatedSeriesBooks?: boolean;
    }) => unwrap(await api.PUT("/me/account", { body: change })),
    onSuccess: async (account) => {
      queryClient.setQueryData(keys.account, account);
      await queryClient.invalidateQueries({
        predicate: (query) => query.queryKey[0] !== "me" && query.queryKey[0] !== "account",
      });
    },
  });
}

/** My Up next list, in my order. */
export const useUpNext = () =>
  useQuery({
    queryKey: keys.upNext,
    queryFn: async () => unwrap(await api.GET("/me/up-next")),
  });

/** Put a book at the end of my Up next list. */
export function useAddToUpNext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrap(await api.PUT("/me/up-next/{itemId}", { params: { path: { itemId } } })),
    onSuccess: (books) => queryClient.setQueryData(keys.upNext, books),
  });
}

/** Take a book off my Up next list, removed or read. */
export function useRemoveFromUpNext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) =>
      unwrap(await api.DELETE("/me/up-next/{itemId}", { params: { path: { itemId } } })),
    onSuccess: (books) => queryClient.setQueryData(keys.upNext, books),
  });
}

/**
 * Put my Up next list in a new order. It moves at once and goes back if the server refuses, so
 * dragging and the arrows feel immediate.
 */
export function useReorderUpNext() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (books: UpNextBook[]) =>
      unwrap(await api.PUT("/me/up-next", { body: { itemIds: books.map((book) => book.itemId) } })),
    onMutate: async (books) => {
      await queryClient.cancelQueries({ queryKey: keys.upNext });
      const before = queryClient.getQueryData<UpNextBook[]>(keys.upNext);
      queryClient.setQueryData(keys.upNext, books);
      return { before };
    },
    onError: (_error, _books, context) => queryClient.setQueryData(keys.upNext, context?.before),
    onSuccess: (books) => queryClient.setQueryData(keys.upNext, books),
  });
}

/** One series with its books' count and book 1, and the ratings of it I may see. */
export const useSeries = (seriesId: string | undefined) =>
  useQuery({
    queryKey: keys.series(seriesId ?? ""),
    enabled: seriesId !== undefined,
    queryFn: async () =>
      unwrap(
        await api.GET("/series/{seriesId}", {
          params: { path: { seriesId: seriesId as string } },
        }),
      ),
  });

/** The series one person recommends, best first. */
export const useSeriesPicks = (userId: string) =>
  useQuery({
    queryKey: keys.seriesPicks(userId),
    queryFn: async () =>
      unwrap(
        await api.GET("/recommendations/users/{userId}/series", { params: { path: { userId } } }),
      ),
  });

/** Rate or recommend a series; everything that ranks or lists series is refetched after. */
export function useRateSeries() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: RatingDraft) =>
      unwrap(
        await api.PUT("/series-ratings/{seriesId}", {
          params: { path: { seriesId: draft.itemId } },
          body: {
            score: draft.score,
            note: draft.note,
            recommended: draft.recommended,
            noteShared: draft.noteShared,
          },
        }),
      ),
    onSettled: (_data, _error, draft) => refreshAfterRatingChange(queryClient, draft.itemId),
  });
}

/** Remove my rating of a series. */
export function useRemoveSeriesRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (seriesId: string) =>
      unwrap(await api.DELETE("/series-ratings/{seriesId}", { params: { path: { seriesId } } })),
    onSettled: (_data, _error, seriesId) => refreshAfterRatingChange(queryClient, seriesId),
  });
}
