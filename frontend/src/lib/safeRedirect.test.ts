import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("allows a path on this site, with its query", () => {
    expect(safeRedirect("/recommendations?minScore=8")).toBe("/recommendations?minScore=8");
    expect(safeRedirect("/items/abc-123")).toBe("/items/abc-123");
  });

  it("falls back to home when there is nothing", () => {
    expect(safeRedirect(undefined)).toBe("/");
    expect(safeRedirect("")).toBe("/");
  });

  it.each([
    "https://evil.test/",
    "http://evil.test",
    "//evil.test/path",
    "/\\evil.test",
    "javascript:alert(1)",
    "evil.test",
  ])("refuses %s, which would leave this site", (target) => {
    expect(safeRedirect(target)).toBe("/");
  });

  it("never sends someone back to the sign-in page", () => {
    expect(safeRedirect("/sign-in?redirect=/")).toBe("/");
  });
});
