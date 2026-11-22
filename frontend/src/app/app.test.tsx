import { screen, waitFor, within } from "@testing-library/react";
import { HttpResponse, http } from "msw";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { mount } from "../test/mount";
import { server } from "../test/server";

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("the app against the API's contract", () => {
  it("sends a signed-out visitor to sign-in, remembering where they were", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json("sign in first", { status: 401 })));
    const router = mount("/recommendations?minScore=8");

    expect(await screen.findByRole("link", { name: /sign in with authentik/i })).toHaveAttribute(
      "href",
      "/api/auth/login",
    );
    expect(screen.getByLabelText(/audiobookshelf username/i)).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/sign-in");
    expect(router.state.location.search).toMatchObject({
      redirect: expect.stringContaining("/recommendations"),
    });
  });

  it("shows only the methods the server offers", async () => {
    server.use(
      http.get("/api/me", () => HttpResponse.json("sign in first", { status: 401 })),
      http.get("/api/auth/modes", () => HttpResponse.json({ password: false, oidc: true })),
    );
    mount("/sign-in");

    await screen.findByRole("link", { name: /sign in with authentik/i });
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("explains a callback error in words, not a code", async () => {
    server.use(http.get("/api/me", () => HttpResponse.json("sign in first", { status: 401 })));
    mount("/sign-in?error=no-account");

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /sign in to audiobookshelf once first/i,
    );
  });

  it("renders the home screen for a signed-in person", async () => {
    server.use(
      http.get("/api/me", () =>
        HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
      ),
    );
    const router = mount("/");

    expect(await screen.findByText(/after the rabbit/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Recommended by 3 people, averaging 8.7 out of 10"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ryan\s*2/i })).toHaveAttribute(
      "href",
      "/recommendations/users/u-1",
    );
    await waitFor(() => expect(router.state.location.pathname).toBe("/"));
  });

  it("ends the home screen with my Up next list, in my order, as a shelf", async () => {
    const upNext = (n: number, position: number) => ({
      itemId: `it-${n}`,
      libraryId: "lib-1",
      title: `Book number ${n}`,
      authors: "An Author",
      position,
      addedAt: 1795000000000,
    });
    server.use(
      http.get("/api/me", () =>
        HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
      ),
      http.get("/api/me/up-next", () => HttpResponse.json([upNext(7, 0), upNext(3, 1)])),
    );
    mount("/");

    const shelf = await screen.findByRole("region", { name: "Up next" });
    const titles = within(shelf)
      .getAllByRole("link")
      .map((link) => link.textContent?.match(/^Book number \d+/)?.[0])
      .filter((title) => title !== undefined);
    expect(titles).toEqual(["Book number 7", "Book number 3"]);
    expect(within(shelf).getByRole("link", { name: "See all" })).toHaveAttribute(
      "href",
      "/me/up-next",
    );
    // the last section on the page
    const sections = screen.getAllByRole("region");
    expect(sections[sections.length - 1]).toBe(shelf);
  });

  it("leaves the Up next shelf out while the list is empty", async () => {
    server.use(
      http.get("/api/me", () =>
        HttpResponse.json({ userId: "u-1", username: "ryan", userType: "user" }),
      ),
    );
    mount("/");

    expect(await screen.findByText(/after the rabbit/i)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Up next" })).not.toBeInTheDocument();
  });
});
