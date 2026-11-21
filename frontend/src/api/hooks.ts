import {
  keepPreviousData,
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { api } from "./client";
import { ApiError, messageOf, unwrap } from "./errors";
import { keys } from "./keys";
import type {
  RatingRow,
  RatingSort,
  RecommendationFilters,
  SettingName,
  SettingsChange,
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

/**
 * One page of a library, or the hits of a search when `q` is not blank. The
 * previous page stays on screen while the next loads, so paging and typing
 * don't flash a skeleton.
 */
export const useBrowse = (libraryId: string | undefined, page: number, q: string) =>
  useQuery({
    queryKey: keys.browse(libraryId ?? "", page, q),
    enabled: libraryId !== undefined,
    placeholderData: keepPreviousData,
    queryFn: async () =>
      unwrap(
        await api.GET("/libraries/{libraryId}/items", {
          params: {
            path: { libraryId: libraryId as string },
            query: { page, size: BROWSE_PAGE_SIZE, ...(q ? { q } : {}) },
          },
        }),
      ),
  });

export interface RatingDraft {
  itemId: string;
  score: number;
  note: string;
  recommended: boolean;
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
          body: { score: draft.score, note: draft.note, recommended: draft.recommended },
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
              ? { ...row, score: draft.score, note: draft.note, recommended: draft.recommended }
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
 * The new settings come back from the server; the rest is refetched.
 */
function refreshAfterSettingsChange(queryClient: ReturnType<typeof useQueryClient>) {
  return queryClient.invalidateQueries({
    predicate: (query) => query.queryKey[0] !== "me" && query.queryKey[1] !== "settings",
  });
}

export function useSaveSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (change: SettingsChange) =>
      unwrap(await api.PUT("/admin/settings", { body: change })),
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
    mutationFn: async (name: SettingName) =>
      unwrap(await api.DELETE("/admin/settings/{name}", { params: { path: { name } } })),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminLinks }),
  });
}

/** Unlink a server. The answer says whether that server could be told. */
export function useUnlinkServer() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      unwrap(await api.DELETE("/admin/links/{id}", { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: keys.adminLinks }),
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
    mutationFn: async (input: { absUrl: string; username: string; password: string }) =>
      unwrap(await api.POST("/setup", { body: input })),
    onSuccess: () => queryClient.invalidateQueries(),
  });
}
