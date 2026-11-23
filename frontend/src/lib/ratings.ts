import { z } from "zod";

export const MIN_SCORE = 1;
export const MAX_SCORE = 10;
export const MAX_NOTE = 280;

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

/**
 * The length of a note as a person counts it. The server counts grapheme
 * clusters (fiig's `length()`), so "é" written as two code points and a
 * family emoji are each one character here too, and the two agree on what
 * "280 characters" means.
 */
export function noteLength(note: string): number {
  let count = 0;
  for (const _ of segmenter.segment(note)) count += 1;
  return count;
}

/**
 * The same rules the server enforces (backend/src/ratings/CheckRating.fiig). A recommendation, or
 * a rating that is only a note, may go without a score.
 */
export const ratingSchema = z
  .object({
    score: z
      .number()
      .int()
      .min(MIN_SCORE, "Pick a score from 1 to 10.")
      .max(MAX_SCORE, "Pick a score from 1 to 10.")
      .optional(),
    note: z
      .string()
      .refine((note) => noteLength(note) <= MAX_NOTE, `Keep the note to ${MAX_NOTE} characters.`),
    recommended: z.boolean(),
    noteShared: z.boolean(),
  })
  .refine((form) => hasSomething(form), {
    path: ["score"],
    message: "Pick a score, recommend the book, or write a note.",
  });

/** A rating needs at least one of a score, a recommendation, or a note; a note alone is private. */
export function hasSomething(form: {
  score?: number | undefined;
  recommended: boolean;
  note: string;
}) {
  return form.score !== undefined || form.recommended || form.note.trim() !== "";
}

export type RatingForm = z.infer<typeof ratingSchema>;
