import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import type { ReactNode } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { useRemoveRating } from "../../api/hooks";
import { keys } from "../../api/keys";
import type { RatingRow } from "../../api/types";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

function myRating(n: number, recommended: boolean): RatingRow {
  return {
    userId: "u-1",
    username: "ryan",
    itemId: `it-${n}`,
    libraryId: "lib-1",
    title: `Book number ${n}`,
    authors: "An Author",
    score: 7,
    note: `note ${n}`,
    recommended,
    createdAt: 1795000000000,
    updatedAt: 1795000000000,
  };
}

describe("the my-ratings screen", () => {
  it("flips a rating to recommended in place, keeping its score and note", async () => {
    let rows = [myRating(1, false)];
    const sent: unknown[] = [];
    server.use(
      signedIn,
      http.get("/api/ratings/mine", () => HttpResponse.json(rows)),
      http.put("/api/ratings/:itemId", async ({ request, params }) => {
        const body = (await request.json()) as { recommended: boolean };
        sent.push({ itemId: params.itemId, ...body });
        rows = rows.map((row) => ({ ...row, recommended: body.recommended }));
        return HttpResponse.json(rows[0]);
      }),
    );
    mount("/me/ratings");

    const toggle = await screen.findByRole("switch", { name: "Recommend Book number 1" });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Only you")).toBeInTheDocument();

    await userEvent.click(toggle);

    expect(await screen.findByText("Shared with everyone")).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(sent).toEqual([{ itemId: "it-1", score: 7, note: "note 1", recommended: true }]);
  });

  it("flips back and says so when the server refuses", async () => {
    server.use(
      signedIn,
      http.get("/api/ratings/mine", () => HttpResponse.json([myRating(1, true)])),
      http.put("/api/ratings/:itemId", () =>
        HttpResponse.json("Audiobookshelf is unreachable", { status: 503 }),
      ),
    );
    mount("/me/ratings");

    const toggle = await screen.findByRole("switch", { name: "Recommend Book number 1" });
    await userEvent.click(toggle);

    const row = toggle.closest("li") as HTMLElement;
    expect(await within(row).findByRole("alert")).toHaveTextContent(
      "Couldn't change who sees this: Audiobookshelf is unreachable",
    );
    expect(toggle).toHaveAttribute("aria-checked", "true");
    expect(within(row).getByText("Shared with everyone")).toBeInTheDocument();
  });
});

describe("removing a rating", () => {
  function seeded() {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    });
    const key = keys.myRatings("newest");
    queryClient.setQueryData<RatingRow[]>(key, [myRating(1, false), myRating(2, true)]);
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const listed = () => queryClient.getQueryData<RatingRow[]>(key)?.map((row) => row.itemId);
    return { wrapper, listed };
  }

  it("leaves my lists at once", async () => {
    let release = () => {};
    const answered = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.delete("/api/ratings/:itemId", async () => {
        await answered;
        return new HttpResponse(null, { status: 204 });
      }),
      http.get("/api/ratings/mine", () => HttpResponse.json([myRating(2, true)])),
    );
    const { wrapper, listed } = seeded();
    const { result } = renderHook(() => useRemoveRating(), { wrapper });

    act(() => result.current.mutate("it-1"));

    await waitFor(() => expect(listed()).toEqual(["it-2"]));
    release();
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  it("comes back if the server refuses", async () => {
    server.use(
      http.delete("/api/ratings/:itemId", () =>
        HttpResponse.json("Audiobookshelf is unreachable", { status: 503 }),
      ),
      http.get("/api/ratings/mine", () =>
        HttpResponse.json([myRating(1, false), myRating(2, true)]),
      ),
    );
    const { wrapper, listed } = seeded();
    const { result } = renderHook(() => useRemoveRating(), { wrapper });

    act(() => result.current.mutate("it-1"));

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listed()).toEqual(["it-1", "it-2"]);
  });
});
