import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import type { ListenedBook } from "../../api/types";
import { mount } from "../../test/mount";
import { pickScore } from "../../test/score";
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
    myNote: "",
    myNoteShared: false,
    series: null,
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
    pickScore(8);

    // picking a star saves nothing and stays on the book; Skip becomes Submit
    expect(screen.getByRole("article")).toHaveAccessibleName("Book number 1");
    expect(screen.queryByRole("button", { name: "Skip" })).not.toBeInTheDocument();
    expect(saved).toEqual([]);
    // a different star changes the pick; Submit saves it and moves on
    pickScore(7);
    pickScore(8);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await card("Book number 3")).toBeInTheDocument();
    expect(screen.getByText("40% through")).toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-1", score: 8, note: "", recommended: false, noteShared: false },
    ]);
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

  it("saves the thumbs up with the score, and Clear score takes it back", async () => {
    const saved = serve([listened(1), listened(2)]);
    mount("/rate");

    await card("Book number 1");
    await userEvent.click(screen.getByRole("button", { name: "Recommend Book number 1" }));
    pickScore(9);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await card("Book number 2")).toBeInTheDocument();
    pickScore(3);
    // Clear score takes the pick back, and Submit goes back to Skip
    await userEvent.click(screen.getByRole("button", { name: "Clear score" }));
    expect(screen.getByRole("slider")).toHaveAttribute("aria-valuetext", "No score");
    expect(screen.getByRole("button", { name: "Skip" })).toBeInTheDocument();
    pickScore(3);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    expect(await screen.findByText("All rated")).toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-1", score: 9, note: "", recommended: true, noteShared: false },
      { itemId: "it-2", score: 3, note: "", recommended: false, noteShared: false },
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
    pickScore(5);
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
    expect(saved).toEqual([
      { itemId: "it-1", score: null, note: "", recommended: true, noteShared: false },
    ]);
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
    pickScore(6);
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
    pickScore(8);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await card("Book number 3")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(await screen.findByText("That's every one without a score")).toBeInTheDocument();
    expect(saved).toEqual([
      { itemId: "it-2", score: 6, note: "", recommended: false, noteShared: false },
      { itemId: "it-1", score: 8, note: "", recommended: true, noteShared: false },
    ]);
  });

  it("keeps the note of a book recommended earlier when it's scored here", async () => {
    const saved = serve([
      listened(1, { recommended: true, myNote: "Great narrator", myNoteShared: true }),
    ]);
    mount("/rate");

    await userEvent.click(
      await screen.findByRole("button", { name: "Score the 1 you recommended without one" }),
    );
    expect(await card("Book number 1")).toBeInTheDocument();
    pickScore(9);
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => expect(saved).toHaveLength(1));
    expect(saved).toEqual([
      { itemId: "it-1", score: 9, note: "Great narrator", recommended: true, noteShared: true },
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

const hwfwm = {
  seriesId: "s-hw",
  name: "He Who Fights With Monsters",
  rated: false,
  myScore: null,
  recommended: false,
};

/** Serves my account with the skip setting as given, and records every series rating saved. */
function serveSeries(skipRatedSeriesBooks: boolean) {
  const saved: unknown[] = [];
  server.use(
    http.get("/api/me/account", () =>
      HttpResponse.json({
        username: "ryan",
        displayName: "ryan",
        shareNotesByDefault: false,
        skipRatedSeriesBooks,
      }),
    ),
    http.put("/api/series-ratings/:seriesId", async ({ request, params }) => {
      saved.push({ seriesId: params.seriesId, ...((await request.json()) as object) });
      return HttpResponse.json({});
    }),
  );
  return saved;
}

describe("the Rate tab and series", () => {
  it("says which series a book is in, its number there, and my rating of the series", async () => {
    serve([
      listened(1, { series: { ...hwfwm, sequence: "4" } }),
      listened(2, {
        series: {
          ...hwfwm,
          seriesId: "s-dcc",
          name: "Dungeon Crawler Carl",
          sequence: "2",
          rated: true,
          myScore: 9,
          recommended: true,
        },
      }),
    ]);
    serveSeries(false);
    mount("/rate");

    const first = await card("Book number 1");
    expect(first).toHaveTextContent("Series: He Who Fights With Monsters · Book 4");
    expect(first).toHaveTextContent("Series not rated yet");
    expect(screen.getByRole("button", { name: "Rate the series" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Skip" }));
    const second = await card("Book number 2");
    expect(second).toHaveTextContent("You gave the series 9/10 and recommend it");
    expect(screen.getByRole("button", { name: "Change" })).toBeInTheDocument();
  });

  it("leaves out books of a series I've rated when I asked it to", async () => {
    serve([
      listened(1, { series: { ...hwfwm, sequence: "4", rated: true, recommended: true } }),
      listened(2),
    ]);
    serveSeries(true);
    mount("/rate");

    expect(await card("Book number 2")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Book number 1" })).not.toBeInTheDocument();
    expect(screen.getByText("1 book to go")).toBeInTheDocument();
  });

  it("goes through the series I've started, one card each, and saves on Submit", async () => {
    const saved = serveSeries(false);
    server.use(
      http.get("/api/series/:seriesId", () =>
        HttpResponse.json({
          seriesId: "s-hw",
          libraryId: "lib-1",
          name: "He Who Fights With Monsters",
          authors: "Shirtaloon",
          books: 12,
          firstItemId: "hw-1",
          average: null,
          count: 0,
          ratings: [],
        }),
      ),
    );
    serve([
      listened(1, { series: { ...hwfwm, sequence: "4" } }),
      listened(2, { series: { ...hwfwm, sequence: "2" } }),
      listened(3),
    ]);
    mount("/rate");

    await userEvent.click(await screen.findByRole("button", { name: "Series" }));
    const series = await card("He Who Fights With Monsters");
    // The card reads the series from ABS: its book 1 for the cover, and how many books it has.
    expect(
      await within(series).findByText(/you've listened to 2 of its 12 books/),
    ).toBeInTheDocument();
    expect(screen.getByText("1 series to go")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Recommend He Who Fights With Monsters" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    await waitFor(() =>
      expect(saved).toEqual([
        { seriesId: "s-hw", score: null, note: "", recommended: true, noteShared: false },
      ]),
    );
  });
});
