import { useId } from "react";
import { MAX_SCORE, MIN_SCORE } from "../../lib/ratings";

interface Props {
  value: number | undefined;
  onChange: (score: number) => void;
  name?: string;
  invalid?: boolean;
}

const scores = Array.from({ length: MAX_SCORE - MIN_SCORE + 1 }, (_, i) => MIN_SCORE + i);

/**
 * A 1-10 radio group. Real radio inputs give arrow-key movement, screen
 * reader semantics, and form behaviour for free; the labels are the large
 * touch targets. Number keys are handled on the group.
 */
export function RatingInput({ value, onChange, name, invalid }: Props) {
  const groupName = useId();

  function onKeyDown(event: React.KeyboardEvent) {
    // "1".."9" pick that score; "0" picks 10, matching the keyboard's row.
    if (!/^[0-9]$/.test(event.key)) return;
    event.preventDefault();
    onChange(event.key === "0" ? 10 : Number(event.key));
  }

  return (
    <fieldset
      className="m-0 border-0 p-0"
      aria-invalid={invalid ? "true" : undefined}
      onKeyDown={onKeyDown}
    >
      <legend className="mb-2 text-sm font-medium">Your score, out of 10</legend>
      <div className="grid grid-cols-5 gap-2">
        {scores.map((score) => (
          <label key={score} className="relative">
            <input
              type="radio"
              name={name ?? groupName}
              value={score}
              checked={value === score}
              onChange={() => onChange(score)}
              className="peer sr-only"
            />
            <span className="flex min-h-12 cursor-pointer items-center justify-center rounded-lg border border-border bg-surface text-base font-semibold tabular-nums peer-checked:border-accent peer-checked:bg-accent peer-checked:text-accent-text peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[var(--focus)] hover:bg-surface-2 peer-checked:hover:bg-accent">
              {score}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
