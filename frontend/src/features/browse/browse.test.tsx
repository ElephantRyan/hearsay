import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../../test/mount";
import { bookNamed, library, server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

const signedIn = http.get("/api/me", () =>
  HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
);

/** What the browse screen asked the API for, in order. */
function recordRequests(total = 100) {
  const asked: URL[] = [];
  server.use(
    signedIn,
    http.get("/api/libraries/:libraryId/items", ({ request }) => {
      const url = new URL(request.url);
      asked.push(url);
      const q = url.searchParams.get("q");
      const page = Number(url.searchParams.get("page") ?? 0);
      if (q === "nothing") {
        return HttpResponse.json({ total: 0, page: 0, limit: 24, items: [] });
      }
      if (q) {
        return HttpResponse.json({
          total: 2,
          page: 0,
          limit: 24,
          items: [bookNamed(101), bookNamed(102, 7)],
        });
      }
      return HttpResponse.json({
        total,
        page,
        limit: 24,
        items: [bookNamed(page * 24 + 1), bookNamed(page * 24 + 2, 9)],
      });
    }),
  );
  return { asked, last: () => asked[asked.length - 1] };
}

describe("the browse screen", () => {
  it("lists a library with the viewer's own scores, and no picker for one library", async () => {
    const { asked } = recordRequests(1117);
    mount("/browse");

    expect(await screen.findByText("Book number 1")).toBeInTheDocument();
    expect(screen.getByText("Book number 2")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("1,117 books");
    expect(screen.getByLabelText("Rated 9 out of 10")).toBeInTheDocument();
    expect(screen.queryByLabelText("Library")).not.toBeInTheDocument();
    expect(asked[0]?.pathname).toBe(`/api/libraries/${library.id}/items`);
    expect(asked[0]?.searchParams.get("size")).toBe("24");
  });

  it("offers a library picker only when there are several, and switches libraries", async () => {
    const { last } = recordRequests();
    server.use(
      http.get("/api/libraries", () =>
        HttpResponse.json([library, { id: "lib-2", name: "Classics", mediaType: "book" }]),
      ),
    );
    mount("/browse");

    const picker = await screen.findByLabelText("Library");
    await userEvent.selectOptions(picker, "lib-2");
    await waitFor(() => expect(last()?.pathname).toBe("/api/libraries/lib-2/items"));
  });

  it("pages forward and back, counting pages from 1 for people and 0 for the API", async () => {
    const { last } = recordRequests(100);
    mount("/browse");

    await screen.findByText("Book number 1");
    expect(screen.getByText("Page 1 of 5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: /next/i }));
    expect(await screen.findByText("Book number 25")).toBeInTheDocument();
    expect(last()?.searchParams.get("page")).toBe("1");
    expect(screen.getByText("Page 2 of 5")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /previous/i }));
    expect(await screen.findByText("Book number 1")).toBeInTheDocument();
  });

  it("searches once typing pauses, shows the matches, and hides the pager", async () => {
    const { asked, last } = recordRequests();
    const router = mount("/browse");

    await screen.findByText("Book number 1");
    const box = screen.getByLabelText("Search titles");
    await userEvent.type(box, "rabbit");

    expect(await screen.findByText("Book number 101")).toBeInTheDocument();
    expect(last()?.searchParams.get("q")).toBe("rabbit");
    expect(screen.getByRole("status")).toHaveTextContent("2 matches for “rabbit”.");
    expect(screen.queryByRole("navigation", { name: "Pages" })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ q: "rabbit", page: 0 });
    // typing six letters made one search, not six
    expect(asked.filter((url) => url.searchParams.get("q")).length).toBe(1);
  });

  it("starts from a shared link and says plainly when nothing matches", async () => {
    recordRequests();
    mount("/browse?q=nothing");

    expect(await screen.findByText("No books match “nothing”.")).toBeInTheDocument();
    expect(screen.getByLabelText("Search titles")).toHaveValue("nothing");
  });

  it("shows a retryable error, in words, when the server fails", async () => {
    server.use(
      signedIn,
      http.get("/api/libraries/:libraryId/items", () =>
        HttpResponse.json("Audiobookshelf is unreachable", { status: 503 }),
      ),
    );
    mount("/browse");

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByText(/audiobookshelf is unreachable/i)).toBeInTheDocument();
    expect(within(alert).getByRole("button", { name: /try again/i })).toBeInTheDocument();
  });
});
