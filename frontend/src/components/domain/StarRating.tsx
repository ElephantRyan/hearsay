import { Star } from "lucide-react";
import { useState } from "react";
import { MAX_SCORE, MIN_SCORE } from "../../lib/ratings";

interface Props {
  /** The score already picked, if any; the stars up to it are filled. */
  value?: number | undefined;
  onPick: (score: number) => void;
  disabled?: boolean;
}

const scores = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

/**
 * Ten stars in a row; a tap picks that many. Hovering previews the score. Each star is a button
 * with its own name ("7 out of 10"), so it works the same from the keyboard and a screen reader.
 */
export function StarRating({ value, onPick, disabled }: Props) {
  const [hover, setHover] = useState<number | undefined>(undefined);
  const lit = hover ?? value ?? 0;

  return (
    <fieldset className="m-0 border-0 p-0" onMouseLeave={() => setHover(undefined)}>
      <legend className="sr-only">Your score, out of 10</legend>
      <div className="flex justify-center">
        {scores.map((score) => (
          <button
            key={score}
            type="button"
            aria-label={`${score} out of 10`}
            aria-pressed={value === score}
            disabled={disabled}
            onMouseEnter={() => setHover(score)}
            onFocus={() => setHover(score)}
            onBlur={() => setHover(undefined)}
            onClick={() => onPick(score)}
            className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-md px-px text-accent focus-visible:outline-2 focus-visible:outline-[var(--focus)] disabled:opacity-60"
          >
            <Star
              aria-hidden="true"
              className="h-auto w-full max-w-7 sm:max-w-8"
              fill={score <= lit ? "currentColor" : "none"}
              strokeWidth={1.75}
            />
          </button>
        ))}
      </div>
      <p
        aria-hidden="true"
        className="h-5 text-center text-sm font-semibold tabular-nums text-muted"
      >
        {lit > 0 ? `${lit} / 10` : ""}
      </p>
    </fieldset>
  );
}
