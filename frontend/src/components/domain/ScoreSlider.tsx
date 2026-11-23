import { useId } from "react";
import { MAX_SCORE, MIN_SCORE } from "../../lib/ratings";

interface Props {
  /** The score picked, or undefined for none yet (or a recommendation without one). */
  value: number | undefined;
  onChange: (score: number) => void;
  disabled?: boolean;
  invalid?: boolean;
}

const ticks = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

/**
 * A 1-10 slider, the one way to score a book. It starts with no score: the thumb is faded and the
 * label says "No score" until it's moved or tapped, which picks wherever it lands. A native range
 * input, so arrow keys, Home/End and screen readers work as they do everywhere.
 */
export function ScoreSlider({ value, onChange, disabled, invalid }: Props) {
  const id = useId();
  const unset = value === undefined;

  // A tap or key on an unset slider whose thumb is already where it lands fires no change, so
  // the first touch picks the value it shows.
  function pickShown(target: HTMLInputElement) {
    if (unset) onChange(Number(target.value));
  }

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-medium">
          Your score, out of 10
        </label>
        <output
          htmlFor={id}
          aria-live="polite"
          className={unset ? "text-sm text-muted" : "text-2xl font-semibold tabular-nums"}
        >
          {unset ? "No score" : value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={MIN_SCORE}
        max={MAX_SCORE}
        step={1}
        value={value ?? Math.ceil((MIN_SCORE + MAX_SCORE) / 2)}
        disabled={disabled}
        aria-invalid={invalid ? "true" : undefined}
        aria-valuetext={unset ? "No score" : `${value} out of 10`}
        onChange={(event) => onChange(Number(event.target.value))}
        onPointerUp={(event) => pickShown(event.currentTarget)}
        onKeyUp={(event) => pickShown(event.currentTarget)}
        className={`h-11 w-full cursor-pointer accent-[var(--color-accent)] disabled:cursor-not-allowed ${
          unset ? "opacity-40" : ""
        }`}
      />
      <div aria-hidden="true" className="flex justify-between px-1 text-xs text-muted tabular-nums">
        {ticks.map((tick) => (
          <span key={tick} className={tick === value ? "font-semibold text-accent" : ""}>
            {tick}
          </span>
        ))}
      </div>
    </div>
  );
}
