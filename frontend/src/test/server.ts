import { HttpResponse, http } from "msw";
import { setupServer } from "msw/node";

/** Canned API answers shaped exactly like backend/openapi.json describes. */
export const book = {
  itemId: "it-1",
  libraryId: "lib-1",
  title: "After the Rabbit: Waldo Rabbit Series, Book 2",
  authors: "Nelson Chereta",
};

export const handlers = [
  http.get("/api/me/listening", () => HttpResponse.json([])),
  http.get("/api/auth/modes", () => HttpResponse.json({ password: true, oidc: true })),
  http.get("/api/setup", () => HttpResponse.json({ needed: false })),
  http.get("/api/abs", () => HttpResponse.json({ url: "https://abs.test" })),
  http.get("/api/me/up-next", () => HttpResponse.json([])),
  http.get("/api/me/account", () => HttpResponse.json({ username: "ryan", displayName: "ryan" })),
  http.get("/api/libraries", () => HttpResponse.json([library])),
  http.get("/api/recommendations/users", () =>
    HttpResponse.json([{ userId: "u-1", username: "ryan", count: 2 }]),
  ),
  http.get("/api/recommendations", () =>
    HttpResponse.json([{ ...book, average: 8.67, count: 3, latest: 1795000000000 }]),
  ),
];

export const server = setupServer(...handlers);

/** Library fixtures for the browse screen. */
export const library = { id: "lib-1", name: "Audiobooks", mediaType: "book" };

export function bookNamed(n: number, myScore: number | null = null) {
  return {
    itemId: `it-${n}`,
    libraryId: "lib-1",
    title: `Book number ${n}`,
    authors: n % 2 === 0 ? "An Author" : "",
    myScore,
    myRecommended: false,
  };
}
