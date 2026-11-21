import { RecommendButton } from "./RecommendButton";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** The explicit publish control, a thumbs up, with plain copy about who sees what. */
export function RecommendToggle({ checked, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <RecommendButton on={checked} onChange={onChange} label="Recommend this book" />
      <div>
        <p className="text-sm font-medium">{checked ? "Recommended" : "Recommend this book"}</p>
        <p className="mt-0.5 text-sm text-muted">
          {checked
            ? "Everyone on this server can see this score and note, and the book joins your list."
            : "Only you can see this rating."}
        </p>
      </div>
    </div>
  );
}
