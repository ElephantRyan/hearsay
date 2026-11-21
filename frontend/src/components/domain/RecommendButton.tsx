import { ThumbsUp } from "lucide-react";

interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** What a screen reader hears: "Recommend Dune". */
  label: string;
  disabled?: boolean;
  /** "card" sits over cover art: a small dark chip in a full-size touch target. */
  size?: "sm" | "lg" | "card";
}

/** The thumbs up: pressed means recommended, so everyone on the server can see the rating. */
export function RecommendButton({ on, onChange, label, disabled, size = "sm" }: Props) {
  if (size === "card") {
    return (
      <button
        type="button"
        aria-pressed={on}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!on)}
        className="group/btn inline-flex min-h-10 min-w-10 items-center justify-center disabled:opacity-60"
      >
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm ${
            on ? "bg-accent text-accent-text" : "bg-black/55 text-white group-hover/btn:bg-black/75"
          }`}
        >
          <ThumbsUp aria-hidden="true" className="h-4 w-4" fill={on ? "currentColor" : "none"} />
        </span>
      </button>
    );
  }
  const box = size === "lg" ? "min-h-12 min-w-12" : "min-h-10 min-w-10";
  const icon = size === "lg" ? "h-6 w-6" : "h-5 w-5";
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`inline-flex ${box} items-center justify-center rounded-full border shadow-card disabled:opacity-60 ${
        on
          ? "border-accent bg-accent text-accent-text"
          : "border-border bg-surface/90 text-muted hover:text-text"
      }`}
    >
      <ThumbsUp aria-hidden="true" className={icon} fill={on ? "currentColor" : "none"} />
    </button>
  );
}
