import { describe, expect, it } from "vitest";
import { MAX_NOTE, noteLength, ratingSchema } from "./ratings";

const note = (length: number) => "a".repeat(length);

describe("ratingSchema (mirrors backend/rules/create_rating.fiig)", () => {
  const check = (score: number, text = "") =>
    ratingSchema.safeParse({ score, note: text, recommended: true, noteShared: false }).success;

  it("accepts scores 1 through 10 and refuses 0 and 11", () => {
    expect(check(1)).toBe(true);
    expect(check(10)).toBe(true);
    expect(check(0)).toBe(false);
    expect(check(11)).toBe(false);
  });

  it("refuses a fractional score", () => {
    expect(check(5.5)).toBe(false);
  });

  it("accepts a note of exactly 280 characters and refuses 281", () => {
    expect(check(5, note(MAX_NOTE))).toBe(true);
    expect(check(5, note(MAX_NOTE + 1))).toBe(false);
  });

  it("refuses a missing score with the same words the form shows", () => {
    const result = ratingSchema.safeParse({
      score: undefined,
      note: "",
      recommended: false,
      noteShared: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("noteLength counts characters as the server does (grapheme clusters)", () => {
  it("counts a family emoji, a flag and a combined accent as one each", () => {
    expect(noteLength("👨‍👩‍👧‍👦")).toBe(1);
    expect(noteLength("🇺🇸")).toBe(1);
    expect(noteLength("é")).toBe(1);
    expect(noteLength("é")).toBe(1);
  });

  it("lets 280 emoji through, though they are far more than 280 UTF-16 units", () => {
    const text = "😀".repeat(280);
    expect(text.length).toBeGreaterThan(280);
    expect(noteLength(text)).toBe(280);
    expect(
      ratingSchema.safeParse({ score: 5, note: text, recommended: false, noteShared: false })
        .success,
    ).toBe(true);
  });
});
