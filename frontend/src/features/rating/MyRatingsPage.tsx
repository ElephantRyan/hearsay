import { useNavigate, useSearch } from "@tanstack/react-router";
import { Eye, EyeOff } from "lucide-react";
import { useId } from "react";
import { useMyRatings } from "../../api/hooks";
import type { RatingSort } from "../../api/types";
import { BookRow } from "../../components/domain/BookRow";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";

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
            <BookRow
              key={row.itemId}
              itemId={row.itemId}
              title={row.title}
              authors={row.authors}
              detail={
                <span className="inline-flex items-center gap-1">
                  {row.recommended ? (
                    <Eye aria-hidden="true" className="h-4 w-4" />
                  ) : (
                    <EyeOff aria-hidden="true" className="h-4 w-4" />
                  )}
                  {row.recommended ? "Shared with everyone" : "Only you"}
                </span>
              }
              aside={<RatingBadge score={row.score} />}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
