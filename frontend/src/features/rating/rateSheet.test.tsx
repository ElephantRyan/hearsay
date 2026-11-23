import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { pickScore } from "../../test/score";
import { book, server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

function mine(score: number, note: string, recommended: boolean) {
  return {
    ...book,
    userId: "u-1",
    username: "ryan",
    score,
    note,
    recommended,
    createdAt: 1795000000000,
    updatedAt: 1795000000000,
  };
}

/** The item page's answer for the canned book, with my rating if I have one. */
function itemAnswer(rating?: ReturnType<typeof mine>) {
  return http.get("/api/items/:itemId", () =>
    HttpResponse.json({
      book,
      average: rating ? rating.score : 0,
      count: rating?.recommended ? 1 : 0,
      ratings: rating ? [rating] : [],
    }),
  );
}

describe("the book page", () => {
  it("links to the book in Audiobookshelf's own player, in a new tab", async () => {
    server.use(signedIn, itemAnswer());
    mount(`/items/${book.itemId}`);

    const link = await screen.findByRole("link", { name: "Open in Audiobookshelf" });
    expect(link.getAttribute("href")).toMatch(
      new RegExp(`/audiobookshelf/item/${encodeURIComponent(book.itemId)}$`),
    );
    expect(link).toHaveAttribute("target", "_blank");
  });
});

describe("the rating sheet", () => {
  it("saves a note on its own, with no score or recommendation", async () => {
    const sent: unknown[] = [];
    server.use(
      signedIn,
      itemAnswer(),
      http.put("/api/ratings/:itemId", async ({ request, params }) => {
        sent.push({ itemId: params.itemId, ...((await request.json()) as object) });
        return HttpResponse.json({});
      }),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    const save = await within(sheet).findByRole("button", { name: "Save rating" });
    expect(save).toBeDisabled();
    await userEvent.type(within(sheet).getByRole("textbox"), "Start with book two");
    expect(save).toBeEnabled();
    await userEvent.click(save);

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([
      {
        itemId: book.itemId,
        score: null,
        note: "Start with book two",
        recommended: false,
        noteShared: false,
      },
    ]);
  });

  it("keeps a note private unless 'Share my note' is ticked", async () => {
    const sent: unknown[] = [];
    server.use(
      signedIn,
      itemAnswer(),
      http.put("/api/ratings/:itemId", async ({ request, params }) => {
        sent.push({ itemId: params.itemId, ...((await request.json()) as object) });
        return HttpResponse.json({});
      }),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    pickScore(8, await within(sheet).findByRole("slider"));
    await userEvent.type(within(sheet).getByRole("textbox"), "Loved the ending");
    // a rating that isn't recommended is private already; the checkbox only shows once it is
    expect(within(sheet).queryByLabelText(/Share my note/)).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole("button", { name: "Recommend this book" }));
    const share = within(sheet).getByLabelText(/Share my note/);
    expect(share).not.toBeChecked();
    await userEvent.click(share);
    await userEvent.click(within(sheet).getByRole("button", { name: "Save rating" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([
      {
        itemId: book.itemId,
        score: 8,
        note: "Loved the ending",
        recommended: true,
        noteShared: true,
      },
    ]);
  });

  it("recommends without a score, and Clear score empties the slider", async () => {
    const sent: unknown[] = [];
    server.use(
      signedIn,
      itemAnswer(mine(7, "", false)),
      http.put("/api/ratings/:itemId", async ({ request, params }) => {
        sent.push({ itemId: params.itemId, ...((await request.json()) as object) });
        return HttpResponse.json({});
      }),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    expect(await within(sheet).findByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "7 out of 10",
    );
    // Clear score is always there; with no score and no recommendation, Save waits
    await userEvent.click(within(sheet).getByRole("button", { name: "Clear score" }));
    expect(within(sheet).getByRole("slider")).toHaveAttribute("aria-valuetext", "No score");
    expect(within(sheet).getByRole("button", { name: "Update rating" })).toBeDisabled();
    await userEvent.click(within(sheet).getByRole("button", { name: "Recommend this book" }));
    expect(within(sheet).getByText("No score: recommended without one.")).toBeInTheDocument();

    expect(within(sheet).getByRole("button", { name: "Update rating" })).toBeEnabled();

    // taking the recommendation away again leaves nothing to save
    await userEvent.click(within(sheet).getByRole("button", { name: "Recommend this book" }));
    expect(within(sheet).getByRole("button", { name: "Update rating" })).toBeDisabled();
    expect(within(sheet).queryByRole("alert")).not.toBeInTheDocument();
    expect(sent).toEqual([]);

    await userEvent.click(within(sheet).getByRole("button", { name: "Recommend this book" }));
    await userEvent.click(within(sheet).getByRole("button", { name: "Update rating" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([
      { itemId: book.itemId, score: null, note: "", recommended: true, noteShared: false },
    ]);
  });

  it("rates a book from the home list and closes once saved", async () => {
    const sent: unknown[] = [];
    server.use(
      signedIn,
      itemAnswer(),
      http.put("/api/ratings/:itemId", async ({ request, params }) => {
        sent.push({ itemId: params.itemId, ...((await request.json()) as object) });
        return HttpResponse.json(mine(8, "", false));
      }),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    pickScore(8, await within(sheet).findByRole("slider"));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save rating" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(sent).toEqual([
      { itemId: book.itemId, score: 8, note: "", recommended: false, noteShared: false },
    ]);
  });

  it("opens on my current rating, and Escape closes it without saving", async () => {
    let saves = 0;
    server.use(
      signedIn,
      itemAnswer(mine(6, "Slow start", true)),
      http.put("/api/ratings/:itemId", () => {
        saves += 1;
        return HttpResponse.json(mine(6, "Slow start", true));
      }),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    expect(await within(sheet).findByRole("slider")).toHaveAttribute(
      "aria-valuetext",
      "6 out of 10",
    );
    expect(within(sheet).getByRole("textbox")).toHaveValue("Slow start");
    expect(within(sheet).getByRole("button", { name: "Recommend this book" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(sheet).getByRole("button", { name: "Update rating" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(saves).toBe(0);
  });

  it("stays open and says why when the save is refused", async () => {
    server.use(
      signedIn,
      itemAnswer(),
      http.put("/api/ratings/:itemId", () =>
        HttpResponse.json("Keep the note to 280 characters.", { status: 400 }),
      ),
    );
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    pickScore(3, await within(sheet).findByRole("slider"));
    await userEvent.click(within(sheet).getByRole("button", { name: "Save rating" }));

    expect(await within(sheet).findByRole("alert")).toHaveTextContent(
      "Keep the note to 280 characters.",
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes from its Close button", async () => {
    server.use(signedIn, itemAnswer());
    mount("/");

    await userEvent.click(await screen.findByRole("button", { name: `Rate ${book.title}` }));
    const sheet = await screen.findByRole("dialog", { name: book.title });
    await userEvent.click(within(sheet).getByRole("button", { name: "Close" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
