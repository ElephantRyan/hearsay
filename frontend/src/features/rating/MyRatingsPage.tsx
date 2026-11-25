import { useNavigate, useSearch } from "@tanstack/react-router";
import { useId } from "react";
import { useMyRatings, useRateItem } from "../../api/hooks";
import type { RatingRow, RatingSort } from "../../api/types";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { RecommendButton } from "../../components/domain/RecommendButton";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { MineTabs } from "../mine/MineTabs";
import { RateButton } from "./RateButton";

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
      <h1 className="text-xl font-semibold">My books</h1>
      {/* The label sits beside the select, not above it, so this row is no taller than the
          tabs alone and they don't move from where the other Mine tabs have them. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <MineTabs />
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm font-medium">
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
          The Rate tab goes through the books you've listened to, one at a time.
        </EmptyState>
      )}
      {ratings.data && ratings.data.length > 0 && (
        <BookGrid label="My ratings">
          {ratings.data.map((row) => (
            <MyRating key={row.itemId} row={row} />
          ))}
        </BookGrid>
      )}
    </div>
  );
}

/**
 * One of my ratings, with its thumbs up right on the card (FRONTEND.md section 5). Pressing it
 * saves the same score and note; the card changes at once and flips back if the server refuses.
 */
function MyRating({ row }: { row: RatingRow }) {
  const rate = useRateItem();
  const shared = row.recommended;

  return (
    <BookCard
      itemId={row.itemId}
      title={row.title}
      authors={row.authors}
      action={
        <>
          <RecommendButton
            size="card"
            on={shared}
            label={`Recommend ${row.title}`}
            // A recommendation without a score can't be made private: there would be nothing left.
            disabled={rate.isPending || (shared && row.score == null && row.note.trim() === "")}
            onChange={(on) =>
              rate.mutate({
                itemId: row.itemId,
                score: row.score ?? null,
                note: row.note,
                recommended: on,
                noteShared: row.noteShared,
              })
            }
          />
          <RateButton itemId={row.itemId} title={row.title} />
        </>
      }
      meta={
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            {shared || row.score != null ? (
              <RatingBadge score={row.score} />
            ) : (
              <span className="rounded-full bg-surface-2 px-2.5 py-1 text-sm text-muted">
                Note only
              </span>
            )}
            <span>
              {shared
                ? row.score == null
                  ? row.note.trim() === ""
                    ? "Shared with everyone; give it a score or a note to make it private"
                    : "Shared with everyone"
                  : "Shared with everyone"
                : "Only you"}
            </span>
          </div>
          {rate.isError && (
            <p role="alert" className="text-danger">
              Couldn't change who sees this: {messageFor(rate.error)}
            </p>
          )}
        </div>
      }
    />
  );
}
