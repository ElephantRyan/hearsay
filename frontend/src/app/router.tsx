import type { QueryClient } from "@tanstack/react-query";
import {
  createRootRouteWithContext,
  createRoute,
  createRouter,
  lazyRouteComponent,
  Outlet,
  type RouterHistory,
  redirect,
} from "@tanstack/react-router";
import { z } from "zod";
import { ApiError } from "../api/errors";
import { meQuery } from "../api/hooks";
import { EmptyState } from "../components/domain/StateViews";
import { HomePage } from "../features/recommendations/HomePage";
import { AppShell } from "./AppShell";

interface RouterContext {
  queryClient: QueryClient;
}

const rootRoute = createRootRouteWithContext<RouterContext>()({
  component: Outlet,
  notFoundComponent: () => (
    <main className="mx-auto max-w-sm px-4 py-16">
      <EmptyState title="Page not found">That address doesn't go anywhere here.</EmptyState>
    </main>
  ),
});

const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/sign-in",
  validateSearch: z.object({
    redirect: z.string().optional(),
    error: z.string().optional(),
  }),
  component: lazyRouteComponent(() => import("../features/auth/SignInPage"), "SignInPage"),
});

/**
 * Everything behind sign-in. A 401 from /me sends the visitor to the sign-in
 * page with a return address; any other failure is left to the page to show.
 */
const appRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "app",
  beforeLoad: async ({ context, location }) => {
    try {
      await context.queryClient.ensureQueryData(meQuery);
    } catch (error) {
      if (error instanceof ApiError && error.isUnauthenticated) {
        throw redirect({ to: "/sign-in", search: { redirect: location.href } });
      }
    }
  },
  component: AppShell,
});

const homeRoute = createRoute({ getParentRoute: () => appRoute, path: "/", component: HomePage });

const browseRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/browse",
  validateSearch: z.object({
    library: z.string().optional(),
    q: z.string().optional(),
    page: z.number().int().min(0).catch(0),
  }),
  component: lazyRouteComponent(() => import("../features/browse/BrowsePage"), "BrowsePage"),
});

const recommendationsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/recommendations",
  validateSearch: z.object({
    userId: z.string().optional(),
    libraryId: z.string().optional(),
    minScore: z.number().int().min(1).max(10).optional(),
  }),
  component: lazyRouteComponent(
    () => import("../features/recommendations/RecommendationsPage"),
    "RecommendationsPage",
  ),
});

const recommendersRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/recommendations/users",
  component: lazyRouteComponent(
    () => import("../features/recommendations/RecommendersPage"),
    "RecommendersPage",
  ),
});

const userListRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/recommendations/users/$userId",
  component: lazyRouteComponent(
    () => import("../features/recommendations/UserListPage"),
    "UserListPage",
  ),
});

const itemRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/items/$itemId",
  component: lazyRouteComponent(() => import("../features/rating/ItemPage"), "ItemPage"),
});

const myRatingsRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/me/ratings",
  validateSearch: z.object({
    sort: z.enum(["score", "newest", "title"]).catch("newest"),
  }),
  component: lazyRouteComponent(() => import("../features/rating/MyRatingsPage"), "MyRatingsPage"),
});

const myBooksRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/me/books",
  validateSearch: z.object({
    shelf: z.enum(["listening", "finished"]).catch("listening"),
  }),
  component: lazyRouteComponent(() => import("../features/mine/MyBooksPage"), "MyBooksPage"),
});

const adminRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/admin",
  component: lazyRouteComponent(() => import("../features/admin/AdminPage"), "AdminPage"),
});

const rateRoute = createRoute({
  getParentRoute: () => appRoute,
  path: "/rate",
  component: lazyRouteComponent(() => import("../features/rate/RatePage"), "RatePage"),
});

const routeTree = rootRoute.addChildren([
  signInRoute,
  appRoute.addChildren([
    homeRoute,
    browseRoute,
    recommendationsRoute,
    recommendersRoute,
    userListRoute,
    itemRoute,
    myRatingsRoute,
    myBooksRoute,
    rateRoute,
    adminRoute,
  ]),
]);

/** One router per app instance (and per test), so no state leaks between them. */
export function createAppRouter(queryClient: QueryClient, history?: RouterHistory) {
  return createRouter({
    routeTree,
    context: { queryClient },
    defaultPreload: "intent",
    ...(history ? { history } : {}),
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createAppRouter>;
  }
}
