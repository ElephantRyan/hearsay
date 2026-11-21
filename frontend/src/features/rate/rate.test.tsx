import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ListenedBook } from "../../api/types";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

function listened(n: number, over: Partial<ListenedBook> = {}): ListenedBook {
  return {
    itemId: `it-${n}`,
    libraryId: "lib-1",
    title: `Book number ${n}`,
    authors: "An Author",
    finished: true,
    percent: 100,
    lastListenedAt: 1795000000000 - n,
    myScore: null,
    recommended: false,
    ...over,
  };
}

/** Serves `books` as my listening, and records every rating saved. */
function serve(books: ListenedBook[]) {
  const saved: unknown[] = [];
  server.use(
    signedIn,
    http.get("/api/me/listening", () => HttpResponse.json(books)),
    http.put("/api/ratings/:itemId", async ({ request, params }) => {
      saved.push({ itemId: params.itemId, ...((await request.json()) as object) });
      return HttpResponse.json({});
    }),
  );
  return saved;
}

/** Waits for the card of the named book (the previous one stays up while a save is in flight). */
const card = (name: string) => screen.findByRole("article", { name });

describe("the Rate tab", () => {
  it("shows the unrated books one at a time, and asks before saving a star", async () => {
    const saved = serve([
      listened(1),
      listened(2, { myScore: 7 }),
      listened(3, { finished: false, percent: 40 }),
    ]);
    mount("/rate");

    expect(await card("Book number 1")).toBeInTheDocument();
    expect(screen.getByText("2 books to go")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "8 out of 10" }));

    const confirm = await screen.findByRole("dialog", { name: "Save 8 out of 10?" });
    await userEvent.click(within(confirm).getByRole("button", { name: "Save" }));

    expect(await card("Book number 3")).toBeInTheDocument();
    expect(screen.getByText("40% through")).toBeInTheDocument();
    expect(saved).toEqual([{ itemId: "it-1", score: 8, note: "", recommended: false }]);
  });

  it("saves the thumbs up with the score, and stops asking once told to", async () => {
    const saved = serve([listened(1), listened(2)]);
    mount("/rate");

    await card("Book number 1");
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    await userEvent.click(screen.getByRole("button", { name: "9 out of 10" }));
    const confirm = await screen.findByRole("dialog");
    expect(confirm).toHaveTextContent("recommended to everyone on this server");
    await userEvent.click(within(confirm).getByLabelText(/Don't ask again/));
    await userEvent.click(within(confirm).getByRole("button", { name: "Save" }));

    expect(await card("Book number 2")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask before saving a score")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "3 out of 10" }));

    expect(await screen.findByText("All rated")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-1", score: 9, note: "", recommended: true },
      { itemId: "it-2", score: 3, note: "", recommended: false },
    ]);
  });

  it("sends a skipped book to the back, then offers the skipped ones again", async () => {
    serve([listened(1), listened(2)]);
    mount("/rate");

    expect(await card("Book number 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await card("Book number 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByText("That's everything unrated")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go through the 2 skipped books" }));

    expect(await card("Book number 1")).toBeInTheDocument();
  });

  it("keeps the book and says why when the save is refused", async () => {
    serve([listened(1)]);
    server.use(
      http.put("/api/ratings/:itemId", () =>
        HttpResponse.json("Audiobookshelf is unreachable", { status: 503 }),
      ),
    );
    localStorage.setItem("rate.askBeforeSaving", "no");
    mount("/rate");

    await card("Book number 1");
    await userEvent.click(screen.getByRole("button", { name: "5 out of 10" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save that: Audiobookshelf is unreachable",
    );
    expect(screen.getByRole("article")).toHaveAccessibleName("Book number 1");
  });

  it("says so when there is nothing to rate", async () => {
    serve([listened(1, { myScore: 6 })]);
    mount("/rate");

    expect(await screen.findByText("Nothing to rate")).toBeInTheDocument();
  });
});

describe("my books", () => {
  it("splits what I'm listening to from what I've finished", async () => {
    serve([listened(1, { myScore: 9 }), listened(2, { finished: false, percent: 25 })]);
    const router = mount("/me/books?shelf=listening");

    expect(await screen.findByText("Book number 2")).toBeInTheDocument();
    expect(screen.getByText("25% through")).toBeInTheDocument();
    expect(screen.queryByText("Book number 1")).not.toBeInTheDocument();

    await router.navigate({ to: "/me/books", search: { shelf: "finished" } });
    expect(await screen.findByText("Book number 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Rated 9 out of 10")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Book number 2")).not.toBeInTheDocument());
  });
});
