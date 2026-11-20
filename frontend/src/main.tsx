import { QueryCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ApiError } from "./api/errors";
import { createAppRouter } from "./app/router";
import "./styles/app.css";

/**
 * A 401 anywhere means the session ended (expired, or signed out elsewhere):
 * clear what was cached for the old person and go to sign-in, remembering
 * where they were (FRONTEND.md section 6, flow 4).
 */
const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.isUnauthenticated) {
        const here = router.state.location;
        if (here.pathname !== "/sign-in") {
          queryClient.clear();
          void router.navigate({ to: "/sign-in", search: { redirect: here.href } });
        }
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    },
  },
});

const router = createAppRouter(queryClient);

const root = document.getElementById("root");
if (!root) throw new Error("index.html has no #root");

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
