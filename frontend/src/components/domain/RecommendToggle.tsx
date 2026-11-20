import { useId } from "react";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The explicit publish switch, with plain copy about who sees what. */
export function RecommendToggle({ checked, onChange }: Props) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3">
      <input
        id={id}
        type="checkbox"
        role="switch"
        checked={checked}
        aria-checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        aria-describedby={`${id}-help`}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--accent)]"
      />
      <div>
        <label htmlFor={id} className="block text-sm font-medium">
          Recommend this book
        </label>
        <p id={`${id}-help`} className="mt-0.5 text-sm text-muted">
          {checked
            ? "Everyone on this server can see this score and note, and the book joins your list."
            : "Only you can see this rating."}
        </p>
      </div>
    </div>
  );
}
