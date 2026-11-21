import { useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useId } from "react";
import { useMyRatings, useRateItem } from "../../api/hooks";
import type { RatingRow, RatingSort } from "../../api/types";
import { BookRow } from "../../components/domain/BookRow";
import { RatingBadge } from "../../components/domain/RatingBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";

const sorts: { value: RatingSort; label: string }[] = [
  { value: "newest", label: "Newest" },
  { value: "score", label: "Highest score" },
  { value: "title", label: "Title" },
];

export function MyRatingsPage() {
  const { sort } = useSearch({ from: "/app/me/ratings" });
  const navigate = useNavigate({ from: "/me/ratings" });
  const ratings = useMyRatings(sort);
  const sortId = useId();

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <h1 className="text-xl font-semibold">My ratings</h1>
        <div>
          <label htmlFor={sortId} className="mb-1 block text-sm font-medium">
            Sort by
          </label>
          <select
            id={sortId}
            value={sort}
            onChange={(event) => navigate({ search: { sort: event.target.value as RatingSort } })}
            className="min-h-11 rounded-lg border border-border bg-surface px-3"
          >
            {sorts.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {ratings.isPending && <LoadingState />}
      {ratings.isError && <ErrorState error={ratings.error} onRetry={() => ratings.refetch()} />}
      {ratings.data && ratings.data.length === 0 && (
        <EmptyState title="You haven't rated anything yet">
          Open a book from the recommendations to give it a score.
        </EmptyState>
      )}
      {ratings.data && ratings.data.length > 0 && (
        <ul className="space-y-3">
          {ratings.data.map((row) => (
            <MyRating key={row.itemId} row={row} />
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * One of my ratings, with its publish switch right on the row (FRONTEND.md section 5). Flipping it
 * saves the same score and note; the row changes at once and flips back if the server refuses.
 */
function MyRating({ row }: { row: RatingRow }) {
  const rate = useRateItem();
  const shared = row.recommended;
  const flip = () =>
    rate.mutate({ itemId: row.itemId, score: row.score, note: row.note, recommended: !shared });

  return (
    <BookRow
      itemId={row.itemId}
      title={row.title}
      authors={row.authors}
      detail={shared ? "Shared with everyone" : "Only you"}
      aside={<RatingBadge score={row.score} />}
      action={
        <button
          type="button"
          role="switch"
          aria-checked={shared}
          aria-label={`Recommend ${row.title}`}
          disabled={rate.isPending}
          onClick={flip}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text disabled:opacity-60"
        >
          {shared ? (
            <Eye aria-hidden="true" className="h-5 w-5 text-accent" />
          ) : (
            <EyeOff aria-hidden="true" className="h-5 w-5" />
          )}
        </button>
      }
      footer={
        rate.isError && (
          <p role="alert" className="text-sm text-danger">
            Couldn't change who sees this: {messageFor(rate.error)}
          </p>
        )
      }
    />
  );
}
