import { ThumbsUp } from "lucide-react";

interface Props {
  on: boolean;
  onChange: (on: boolean) => void;
  /** What a screen reader hears: "Recommend Dune". */
  label: string;
  disabled?: boolean;
  size?: "sm" | "lg";
}

/** The thumbs up: pressed means recommended, so everyone on the server can see the rating. */
export function RecommendButton({ on, onChange, label, disabled, size = "sm" }: Props) {
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
