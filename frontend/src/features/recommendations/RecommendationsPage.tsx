import { useNavigate, useSearch } from "@tanstack/react-router";
import { useId } from "react";
import { useRecommendations, useRecommenders } from "../../api/hooks";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { RateButton } from "../rating/RateButton";

/** The combined ranking. Filters live in the URL, so a filtered view can be shared. */
export function RecommendationsPage() {
  const search = useSearch({ from: "/app/recommendations" });
  const navigate = useNavigate({ from: "/recommendations" });
  const people = useRecommenders();
  const list = useRecommendations(search);
  const personId = useId();
  const scoreId = useId();
  const filtered = Boolean(search.userId || search.minScore);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">All recommendations</h1>

      <form
        aria-label="Filters"
        className="grid grid-cols-1 gap-3 rounded-card border border-border bg-surface p-3 sm:grid-cols-[1fr_1fr_auto]"
        onSubmit={(event) => event.preventDefault()}
      >
        <div>
          <label htmlFor={personId} className="mb-1 block text-sm font-medium">
            Recommended by
          </label>
          <select
            id={personId}
            value={search.userId ?? ""}
            onChange={(event) =>
              navigate({ search: (prev) => ({ ...prev, userId: event.target.value || undefined }) })
            }
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
          >
            <option value="">Everyone</option>
            {people.data?.map((person) => (
              <option key={person.userId} value={person.userId}>
                {person.username} ({person.count})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor={scoreId} className="mb-1 block text-sm font-medium">
            Average at least
          </label>
          <select
            id={scoreId}
            value={search.minScore ?? ""}
            onChange={(event) =>
              navigate({
                search: (prev) => ({
                  ...prev,
                  minScore: event.target.value ? Number(event.target.value) : undefined,
                }),
              })
            }
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
          >
            <option value="">Any</option>
            {[5, 6, 7, 8, 9].map((score) => (
              <option key={score} value={score}>
                {score}
              </option>
            ))}
          </select>
        </div>
        {filtered && (
          <Button variant="ghost" className="self-end" onClick={() => navigate({ search: {} })}>
            Clear
          </Button>
        )}
      </form>

      {list.isPending && <LoadingState />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && (
        <EmptyState title={filtered ? "Nothing matches those filters" : "No recommendations yet"}>
          {filtered
            ? "Try a lower score, or choose everyone."
            : "Be the first to recommend a book."}
        </EmptyState>
      )}
      {list.data && list.data.length > 0 && (
        <BookGrid ordered label="Recommended books, best first">
          {list.data.map((book, index) => (
            <BookCard
              key={book.itemId}
              itemId={book.itemId}
              title={book.title}
              authors={book.authors}
              badge={
                <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
              }
              action={<RateButton itemId={book.itemId} title={book.title} />}
              meta={<RatingBadge score={book.average} count={book.count} />}
            />
          ))}
        </BookGrid>
      )}
    </div>
  );
}
