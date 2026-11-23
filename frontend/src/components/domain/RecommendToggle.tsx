import { RecommendButton } from "./RecommendButton";

interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** What is recommended: "book" unless a series. */
  what?: "book" | "series";
}

/** The explicit publish control, a thumbs up, with plain copy about who sees what. */
export function RecommendToggle({ checked, onChange, what = "book" }: Props) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-surface p-3">
      <RecommendButton on={checked} onChange={onChange} label={`Recommend this ${what}`} />
      <div>
        <p className="text-sm font-medium">{checked ? "Recommended" : `Recommend this ${what}`}</p>
        <p className="mt-0.5 text-sm text-muted">
          {checked
            ? `Everyone on this server can see this rating and note, and the ${what} joins your list. A score is optional.`
            : "Only you can see this rating."}
        </p>
      </div>
    </div>
  );
}
