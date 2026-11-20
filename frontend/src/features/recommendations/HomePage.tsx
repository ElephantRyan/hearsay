import { Link } from "@tanstack/react-router";
import { useRecommendations, useRecommenders } from "../../api/hooks";
import { BookRow } from "../../components/domain/BookRow";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { RecommenderChip } from "../../components/domain/RecommenderChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";

/** The best of what everyone recommends, and who is recommending. */
export function HomePage() {
  const top = useRecommendations({});
  const people = useRecommenders();

  return (
    <div className="space-y-8">
      <section aria-labelledby="people-heading">
        <h2 id="people-heading" className="mb-3 text-base font-semibold">
          Recommenders
        </h2>
        {people.isPending && <LoadingState rows={1} label="Loading recommenders" />}
        {people.isError && <ErrorState error={people.error} onRetry={() => people.refetch()} />}
        {people.data && people.data.length === 0 && (
          <p className="text-sm text-muted">Nobody has published recommendations yet.</p>
        )}
        {people.data && people.data.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {people.data.map((person) => (
              <li key={person.userId}>
                <RecommenderChip
                  userId={person.userId}
                  username={person.username}
                  count={person.count}
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="top-heading">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 id="top-heading" className="text-base font-semibold">
            Top recommended
          </h2>
          <Link to="/recommendations" search={{}} className="text-sm">
            See all
          </Link>
        </div>
        {top.isPending && <LoadingState />}
        {top.isError && <ErrorState error={top.error} onRetry={() => top.refetch()} />}
        {top.data && top.data.length === 0 && (
          <EmptyState
            title="No recommendations yet"
            action={
              <Link to="/browse" search={{ page: 0 }} className="text-sm">
                Browse the library and rate a book
              </Link>
            }
          >
            Rate a book and turn on "Recommend this book" to start the list.
          </EmptyState>
        )}
        {top.data && top.data.length > 0 && (
          <ol className="space-y-3">
            {top.data.slice(0, 10).map((book, index) => (
              <BookRow
                key={book.itemId}
                position={index + 1}
                itemId={book.itemId}
                title={book.title}
                authors={book.authors}
                aside={<RatingBadge score={book.average} count={book.count} />}
              />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
