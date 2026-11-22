import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ListenedBook } from "../../api/types";
import { mount } from "../../test/mount";
import { server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
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
  it("shows the unrated books one at a time, and saves a star only on Submit", async () => {
    const saved = serve([
      listened(1),
      listened(2, { myScore: 7 }),
      listened(3, { finished: false, percent: 40 }),
    ]);
    mount("/rate");

    expect(await card("Book number 1")).toBeInTheDocument();
    expect(screen.getByText("2 books to go")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "8 out of 10" }));

    // picking a star saves nothing and stays on the book; Skip becomes Submit
    expect(screen.getByRole("article")).toHaveAccessibleName("Book number 1");
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(saved).toEqual([]);
    // a different star changes the pick; Submit saves it and moves on
    await userEvent.click(screen.getByRole("button", { name: "7 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "8 out of 10" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await card("Book number 3")).toBeInTheDocument();
    expect(screen.getByText("40% through")).toBeInTheDocument();
    expect(saved).toEqual([{ itemId: "it-1", score: 8, note: "", recommended: false }]);
  });

  it("puts every finished book before the ones still being listened to", async () => {
    serve([
      listened(1, { finished: false, percent: 30 }),
      listened(2),
      listened(3, { finished: false, percent: 60 }),
      listened(4),
    ]);
    mount("/rate");

    expect(await card("Book number 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await card("Book number 4")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await card("Book number 1")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await card("Book number 3")).toBeInTheDocument();
  });

  it("saves the thumbs up with the score, and takes back a star tapped again", async () => {
    const saved = serve([listened(1), listened(2)]);
    mount("/rate");

    await card("Book number 1");
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    await userEvent.click(screen.getByRole("button", { name: "9 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await card("Book number 2")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "3 out of 10" }));
    // the same star again clears the pick, and Submit goes back to Skip
    await userEvent.click(screen.getByRole("button", { name: "3 out of 10" }));
    expect(screen.getByRole("button", { name: "3 out of 10" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "3 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("All rated")).toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-1", score: 9, note: "", recommended: true },
      { itemId: "it-2", score: 3, note: "", recommended: false },
    ]);
  });

  it("sends a skipped book to the back, then offers the skipped ones again", async () => {
    serve([listened(1), listened(2)]);
    mount("/rate");

    expect(await card("Book number 1")).toBeInTheDocument();
    expect(screen.getByText("2 books to go")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    expect(await card("Book number 2")).toBeInTheDocument();
    // a skip counts down, as a save does
    expect(screen.getByText("1 book to go")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByText("That's everything unrated")).toBeInTheDocument();
    expect(screen.queryByRole("article")).not.toBeInTheDocument();
    expect(screen.queryByText(/to go/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Go through the 2 skipped books" }));

    expect(await card("Book number 1")).toBeInTheDocument();
    expect(screen.getByText("2 books to go")).toBeInTheDocument();
  });

  it("keeps the book and says why when the save is refused", async () => {
    serve([listened(1)]);
    server.use(
      http.put("/api/ratings/:itemId", () =>
        HttpResponse.json("Audiobookshelf is unreachable", { status: 503 }),
      ),
    );
    mount("/rate");

    await card("Book number 1");
    await userEvent.click(screen.getByRole("button", { name: "5 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save that: Audiobookshelf is unreachable",
    );
    expect(screen.getByRole("article")).toHaveAccessibleName("Book number 1");
  });

  it("turns Skip into Submit once the thumbs is up, and recommends without a score", async () => {
    const saved = serve([listened(1), listened(2)]);
    mount("/rate");

    await card("Book number 1");
    expect(screen.queryByRole("button", { name: "Submit" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    // turning it off again brings Skip back
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await card("Book number 2")).toBeInTheDocument();
    expect(saved).toEqual([{ itemId: "it-1", score: null, note: "", recommended: true }]);
  });

  it("leaves recommended books without a score out, then offers them once the rest are done", async () => {
    const saved = serve([
      listened(1, { recommended: true }),
      listened(2),
      listened(3, { recommended: true, finished: false, percent: 50 }),
    ]);
    mount("/rate");

    expect(await card("Book number 2")).toBeInTheDocument();
    expect(screen.getByText("1 book to go")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "6 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("All rated")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Score the 2 you recommended without one" }),
    );

    // the thumbs is already up, and Skip stays Skip until a score is picked
    expect(await card("Book number 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Recommend Book number 1" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "8 out of 10" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await card("Book number 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByText("That's every one without a score")).toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-2", score: 6, note: "", recommended: false },
      { itemId: "it-1", score: 8, note: "", recommended: true },
    ]);
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
