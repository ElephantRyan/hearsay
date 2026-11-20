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

/** The same rules the server enforces (backend/rules/create_rating.fiig). */
export const ratingSchema = z.object({
  score: z
    .number({ error: "Pick a score from 1 to 10." })
    .int()
    .min(MIN_SCORE, "Pick a score from 1 to 10.")
    .max(MAX_SCORE, "Pick a score from 1 to 10."),
  note: z
    .string()
    .refine((note) => noteLength(note) <= MAX_NOTE, `Keep the note to ${MAX_NOTE} characters.`),
  recommended: z.boolean(),
});

export type RatingForm = z.infer<typeof ratingSchema>;
