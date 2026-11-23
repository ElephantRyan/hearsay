import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { UpNextBook } from "../../api/types";
import { mount } from "../../test/mount";
import { pickScore } from "../../test/score";
import { book, bookNamed, server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

function onList(n: number, position: number): UpNextBook {
  return {
    itemId: `it-${n}`,
    libraryId: "lib-1",
    title: `Book number ${n}`,
    authors: "An Author",
    position,
    addedAt: 1795000000000 + n,
  };
}

/** Serves an Up next list that changes as the page asks, and records each change. */
function serveList(start: UpNextBook[]) {
  const sent: unknown[] = [];
  let list = start;
  server.use(
    signedIn,
    http.get("/api/me/up-next", () => HttpResponse.json(list)),
    http.put("/api/me/up-next", async ({ request }) => {
      const body = (await request.json()) as { itemIds: string[] };
      sent.push({ order: body.itemIds });
      list = body.itemIds.map((id, i) => ({
        ...(list.find((b) => b.itemId === id) as UpNextBook),
        position: i,
      }));
      return HttpResponse.json(list);
    }),
    http.put("/api/me/up-next/:itemId", ({ params }) => {
      sent.push({ add: params.itemId });
      const n = Number(String(params.itemId).replace("it-", ""));
      list = [...list, { ...onList(n, list.length), title: book.title }];
      return HttpResponse.json(list);
    }),
    http.delete("/api/me/up-next/:itemId", ({ params }) => {
      sent.push({ remove: params.itemId });
      list = list.filter((b) => b.itemId !== params.itemId);
      return HttpResponse.json(list);
    }),
    http.put("/api/ratings/:itemId", async ({ request, params }) => {
      sent.push({ rate: params.itemId, ...((await request.json()) as object) });
      return HttpResponse.json({});
    }),
    http.get("/api/items/:itemId", () =>
      HttpResponse.json({ book, average: null, count: 0, ratings: [] }),
    ),
  );
  return sent;
}

const titles = () =>
  within(screen.getByRole("list", { name: "Up next" }))
    .getAllByRole("listitem")
    .map((row) => within(row).getAllByRole("link")[1]?.textContent);

describe("the Up next list", () => {
  it("is added to from Browse, and the button then says it's there", async () => {
    const sent = serveList([]);
    server.use(
      http.get("/api/libraries/:libraryId/items", () =>
        HttpResponse.json({ total: 1, page: 0, limit: 24, items: [bookNamed(1)] }),
      ),
    );
    mount("/browse");

    await userEvent.click(
      await screen.findByRole("button", { name: "Add Book number 1 to Up next" }),
    );
    expect(
      await screen.findByRole("link", { name: "Book number 1 is on your Up next list" }),
    ).toBeInTheDocument();
    expect(sent).toEqual([{ add: "it-1" }]);
  });

  it("moves books up and down, and keeps the new order", async () => {
    const sent = serveList([onList(1, 0), onList(2, 1), onList(3, 2)]);
    mount("/me/up-next");

    await screen.findByRole("list", { name: "Up next" });
    expect(screen.getByRole("button", { name: "Move Book number 1 up" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Move Book number 3 up" }));
    await waitFor(() =>
      expect(titles()).toEqual(["Book number 1", "Book number 3", "Book number 2"]),
    );
    await userEvent.click(screen.getByRole("button", { name: "Move Book number 1 down" }));
    await waitFor(() =>
      expect(titles()).toEqual(["Book number 3", "Book number 1", "Book number 2"]),
    );
    expect(sent).toEqual([
      { order: ["it-1", "it-3", "it-2"] },
      { order: ["it-3", "it-1", "it-2"] },
    ]);
  });

  it("marks a book read with a rating, or with Skip, and removes one outright", async () => {
    const sent = serveList([onList(1, 0), onList(2, 1), onList(3, 2)]);
    server.use(
      http.get("/api/me/listening", () =>
        HttpResponse.json([
          {
            itemId: "it-2",
            libraryId: "lib-1",
            title: "Book number 2",
            authors: "An Author",
            finished: true,
            percent: 100,
            lastListenedAt: 1,
            myScore: null,
            recommended: false,
            myNote: "",
            myNoteShared: false,
          },
        ]),
      ),
    );
    mount("/me/up-next");

    // ABS says book 2 is finished; it stays until marked read
    expect(await screen.findByText("Finished in Audiobookshelf")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Mark Book number 2 as read" }));
    const sheet = await screen.findByRole("dialog", { name: "Finished Book number 2?" });
    pickScore(9, await within(sheet).findByRole("slider"));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save rating" }));
    await waitFor(() => expect(titles()).toEqual(["Book number 1", "Book number 3"]));

    await userEvent.click(screen.getByRole("button", { name: "Mark Book number 1 as read" }));
    const skipSheet = await screen.findByRole("dialog", { name: "Finished Book number 1?" });
    await userEvent.click(within(skipSheet).getByRole("button", { name: "Skip rating" }));
    await waitFor(() => expect(titles()).toEqual(["Book number 3"]));

    await userEvent.click(
      screen.getByRole("button", { name: "Remove Book number 3 from Up next" }),
    );
    expect(await screen.findByText("Nothing up next")).toBeInTheDocument();
    expect(sent).toEqual([
      { rate: "it-2", score: 9, note: "", recommended: false, noteShared: false },
      { remove: "it-2" },
      { remove: "it-1" },
      { remove: "it-3" },
    ]);
  });
});
