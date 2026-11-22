import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HttpResponse, http } from "msw";
import { act } from "react";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { mount } from "../../test/mount";
import { bookNamed, library, server } from "../../test/server";

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.unstubAllGlobals();
});
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

/** Stands in for the browser's IntersectionObserver; `scrollToEnd` brings the list's end into view. */
function stubScrolling() {
  const watching = new Set<IntersectionObserverCallback>();
  class Observer {
    constructor(private readonly callback: IntersectionObserverCallback) {}
    observe() {
      watching.add(this.callback);
    }
    disconnect() {
      watching.delete(this.callback);
    }
  }
  vi.stubGlobal("IntersectionObserver", Observer);
  return {
    scrollToEnd: () =>
      act(() => {
        for (const callback of [...watching]) {
          callback(
            [{ isIntersecting: true } as IntersectionObserverEntry],
            {} as IntersectionObserver,
          );
        }
      }),
  };
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
    // covers come straight from ABS, at the address the server has for it
    await waitFor(() =>
      expect(document.querySelector("img")?.getAttribute("src")).toBe(
        "https://abs.test/api/items/it-1/cover",
      ),
    );
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

  it("loads the next page as the end of the list scrolls into view, and stops at the last", async () => {
    const { asked, last } = recordRequests(50);
    const { scrollToEnd } = stubScrolling();
    mount("/browse");

    await screen.findByText("Book number 1");
    expect(screen.queryByRole("button", { name: /^(previous|next)$/i })).not.toBeInTheDocument();
    expect(asked).toHaveLength(1);

    scrollToEnd();
    expect(await screen.findByText("Book number 25")).toBeInTheDocument();
    expect(last()?.searchParams.get("page")).toBe("1");
    // the first page stays: the list grows rather than turning over
    expect(screen.getByText("Book number 1")).toBeInTheDocument();

    scrollToEnd();
    expect(await screen.findByText("Book number 49")).toBeInTheDocument();
    expect(last()?.searchParams.get("page")).toBe("2");

    // 50 books is three pages of 24; there is no fourth to ask for
    scrollToEnd();
    expect(asked).toHaveLength(3);
  });

  it("offers a button for more books in a browser that can't watch the scroll", async () => {
    const { last } = recordRequests(50);
    mount("/browse");

    await userEvent.click(await screen.findByRole("button", { name: "Show more books" }));
    expect(await screen.findByText("Book number 25")).toBeInTheDocument();
    expect(last()?.searchParams.get("page")).toBe("1");
  });

  it("sorts by title or author either way, starting again from the top", async () => {
    const { last } = recordRequests(50);
    const { scrollToEnd } = stubScrolling();
    const router = mount("/browse");

    await screen.findByText("Book number 1");
    expect(last()?.searchParams.get("sort")).toBe("title");
    scrollToEnd();
    await screen.findByText("Book number 25");

    await userEvent.selectOptions(screen.getByLabelText("Sort by"), "Author, Z to A");
    await waitFor(() => expect(last()?.searchParams.get("sort")).toBe("author-desc"));
    expect(last()?.searchParams.get("page")).toBe("0");
    expect(router.state.location.search).toMatchObject({ sort: "author-desc" });
    await waitFor(() => expect(screen.queryByText("Book number 25")).not.toBeInTheDocument());
  });

  it("starts from a shared link's order", async () => {
    const { last } = recordRequests();
    mount("/browse?sort=title-desc");

    expect(await screen.findByText("Book number 1")).toBeInTheDocument();
    expect(last()?.searchParams.get("sort")).toBe("title-desc");
    expect(screen.getByLabelText("Sort by")).toHaveValue("title-desc");
  });

  it("searches once typing pauses, shows the matches, and asks for no more", async () => {
    const { asked, last } = recordRequests();
    const router = mount("/browse");

    await screen.findByText("Book number 1");
    const box = screen.getByLabelText("Search titles");
    await userEvent.type(box, "rabbit");

    expect(await screen.findByText("Book number 101")).toBeInTheDocument();
    expect(last()?.searchParams.get("q")).toBe("rabbit");
    expect(screen.getByRole("status")).toHaveTextContent("2 matches for “rabbit”.");
    expect(screen.queryByRole("button", { name: "Show more books" })).not.toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ q: "rabbit", sort: "title" });
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
