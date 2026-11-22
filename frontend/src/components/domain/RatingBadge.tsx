import { ThumbsUp } from "lucide-react";
import { formatAverage } from "../../lib/format";

interface Props {
  /** A score, or a book's average; null when no score was given (a recommendation without one). */
  score: number | null | undefined;
  /** How many people recommend the book; left out for one person's score. */
  count?: number;
}

/**
 * A score with a dot from the single-hue ramp. The number carries the meaning, the dot only
 * reinforces it, so colour is never the sole cue. With `count` it is a book's standing: how many
 * recommend it, and the average of the scores they gave, if any did.
 */
export function RatingBadge({ score, count }: Props) {
  const scored = score !== null && score !== undefined;
  const label =
    count === undefined
      ? scored
        ? `Rated ${score} out of 10`
        : "Recommended without a score"
      : `Recommended by ${count} ${count === 1 ? "person" : "people"}${
          scored ? `, averaging ${formatAverage(score)} out of 10` : ", none of them scored it"
        }`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums"
    >
      {scored && (
        <>
          <span
            aria-hidden="true"
            className="h-2.5 w-2.5 rounded-full"
            style={{ background: `var(--rate-${Math.min(10, Math.max(1, Math.round(score)))})` }}
          />
          <span aria-hidden="true">{count === undefined ? score : formatAverage(score)}</span>
        </>
      )}
      {!scored && count === undefined && (
        <span aria-hidden="true" className="font-normal text-muted">
          No score
        </span>
      )}
      {count !== undefined && (
        <span aria-hidden="true" className="inline-flex items-center gap-1 font-normal text-muted">
          {scored && "·"}
          <ThumbsUp aria-hidden="true" className="h-3.5 w-3.5" />
          {count}
        </span>
      )}
    </span>
  );
}
