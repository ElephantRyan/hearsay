import { screen, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { book, server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

const fromAlex = {
  ...book,
  userId: "linked-l1-p2",
  username: "sam · Alex's library",
  score: 6,
  note: "from over there",
  recommended: true,
  createdAt: 1795000000000,
  updatedAt: 1795000000000,
  via: "Alex's library",
  matchedBy: "title",
};

describe("linked servers' recommendations", () => {
  it("show on the book page with where they came from, and a weak match says so", async () => {
    server.use(
      signedIn,
      http.get("/api/items/:itemId", () =>
        HttpResponse.json({ book, average: 6, count: 1, ratings: [fromAlex], series: [] }),
      ),
    );
    mount(`/items/${book.itemId}`);

    const note = (await screen.findByText("from over there")).closest("li") as HTMLElement;
    expect(within(note).getByText("sam · Alex's library")).toBeInTheDocument();
    expect(within(note).getByText(/via Alex's library · matched by title/)).toBeInTheDocument();
  });

  it("list a linked person's books this library hasn't under Not in your library", async () => {
    server.use(
      signedIn,
      http.get("/api/recommendations/users/:userId", () => HttpResponse.json([fromAlex])),
      http.get("/api/recommendations/users/:userId/missing", () =>
        HttpResponse.json([
          {
            title: "Not Here",
            authors: "Nobody",
            score: 9,
            note: "find it",
            updatedAt: 1795000000000,
            via: "Alex's library",
          },
        ]),
      ),
    );
    mount("/recommendations/users/linked-l1-p2");

    const section = await screen.findByRole("region", { name: "Not in your library" });
    expect(within(section).getByText("Not Here")).toBeInTheDocument();
    expect(within(section).getByText("find it")).toBeInTheDocument();
    expect(within(section).getByText(/Recommended on Alex's library/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("sam · Alex's library");
  });

  it("aren't asked for on this server's own people", async () => {
    let asked = false;
    server.use(
      signedIn,
      http.get("/api/recommendations/users/:userId", () =>
        HttpResponse.json([{ ...fromAlex, userId: "u-2", username: "ann", via: null }]),
      ),
      http.get("/api/recommendations/users/:userId/missing", () => {
        asked = true;
        return HttpResponse.json([]);
      }),
    );
    mount("/recommendations/users/u-2");

    expect(await screen.findByText("from over there")).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Not in your library" })).not.toBeInTheDocument();
    expect(asked).toBe(false);
  });
});
