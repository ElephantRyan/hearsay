import { formatAverage } from "../../lib/format";

interface Props {
  score: number;
  /** How many ratings the score is an average of; left out for a single score. */
  count?: number;
}

/**
 * A score with a dot from the single-hue ramp. The number carries the
 * meaning, the dot only reinforces it, so colour is never the sole cue.
 */
export function RatingBadge({ score, count }: Props) {
  const rounded = Math.min(10, Math.max(1, Math.round(score)));
  const label =
    count === undefined
      ? `Rated ${score} out of 10`
      : `Average ${formatAverage(score)} out of 10 from ${count} ${count === 1 ? "rating" : "ratings"}`;
  return (
    <span
      role="img"
      aria-label={label}
      className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-sm font-semibold tabular-nums"
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 rounded-full"
        style={{ background: `var(--rate-${rounded})` }}
      />
      <span aria-hidden="true">{count === undefined ? score : formatAverage(score)}</span>
      {count !== undefined && (
        <span aria-hidden="true" className="font-normal text-muted">
          from {count}
        </span>
      )}
    </span>
  );
}
