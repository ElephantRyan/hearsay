import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { pickScore } from "../../test/score";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

const dcc = {
  seriesId: "dcc",
  libraryId: "lib-1",
  name: "Dungeon Crawler Carl",
  authors: "Matt Dinniman",
  books: 7,
  firstItemId: "dcc-1",
};

describe("a recommended series", () => {
  it("shows in the ranked list as one stacked card that opens the series", async () => {
    server.use(
      signedIn,
      http.get("/api/recommendations", () =>
        HttpResponse.json([
          {
            itemId: "dcc-1",
            libraryId: "lib-1",
            title: "Dungeon Crawler Carl",
            authors: "Matt Dinniman",
            average: 9,
            count: 2,
            latest: 1,
            seriesId: "dcc",
            seriesBooks: 7,
          },
        ]),
      ),
    );
    mount("/recommendations");

    const card = await screen.findByRole("link", {
      name: "Dungeon Crawler Carl, a series of 7 books",
    });
    expect(card).toHaveAttribute("href", expect.stringContaining("series=dcc"));
    expect(within(card).getByText("Series · 7 books")).toBeInTheDocument();
  });

  it("is rated from the series' own page, as a whole", async () => {
    const sent: unknown[] = [];
    server.use(
      signedIn,
      http.get("/api/series/:seriesId", () =>
        HttpResponse.json({ ...dcc, average: null, count: 0, ratings: [] }),
      ),
      http.get("/api/libraries/:libraryId/items", () =>
        HttpResponse.json({ total: 0, page: 0, limit: 24, items: [], authors: [], series: [] }),
      ),
      http.put("/api/series-ratings/:seriesId", async ({ request, params }) => {
        sent.push({ seriesId: params.seriesId, ...((await request.json()) as object) });
        return HttpResponse.json({});
      }),
    );
    mount("/browse?series=dcc&seriesName=Dungeon%20Crawler%20Carl");

    const panel = await screen.findByRole("region", { name: "Rate this series" });
    pickScore(9, within(panel).getByRole("slider"));
    await userEvent.click(within(panel).getByRole("button", { name: "Recommend this series" }));
    await userEvent.click(within(panel).getByRole("button", { name: "Save rating" }));

    await waitFor(() =>
      expect(sent).toEqual([
        { seriesId: "dcc", score: 9, note: "", recommended: true, noteShared: false },
      ]),
    );
  });

  it("says so when Audiobookshelf no longer has the series", async () => {
    server.use(
      signedIn,
      http.get(
        "/api/series/:seriesId",
        () => new HttpResponse("no series with that id in Audiobookshelf", { status: 404 }),
      ),
      http.get("/api/libraries/:libraryId/items", () =>
        HttpResponse.json({ total: 0, page: 0, limit: 24, items: [], authors: [], series: [] }),
      ),
    );
    mount("/browse?series=gone&seriesName=Gone");

    expect(
      await screen.findByText("This series isn't in Audiobookshelf any more"),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("shows on a person's list as a stacked card", async () => {
    server.use(
      signedIn,
      http.get("/api/recommendations/users/:userId", () => HttpResponse.json([])),
      http.get("/api/recommendations/users/:userId/series", () =>
        HttpResponse.json([
          {
            ...dcc,
            userId: "u-2",
            username: "bryson",
            score: 9,
            note: "Start at book 1",
            recommended: true,
            createdAt: 1,
            updatedAt: 1,
            noteShared: true,
          },
        ]),
      ),
    );
    mount("/recommendations/users/u-2");

    expect(await screen.findByRole("heading", { name: /bryson recommends/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Dungeon Crawler Carl, a series of 7 books" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Start at book 1")).toBeInTheDocument();
  });
});
