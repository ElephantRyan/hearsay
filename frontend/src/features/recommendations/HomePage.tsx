import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useMyListening, useRecommendations, useRecommenders, useUpNext } from "../../api/hooks";
import { BookCard } from "../../components/domain/BookCard";
import { Shelf } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { RecommenderChip } from "../../components/domain/RecommenderChip";
import { SeriesCard } from "../../components/domain/SeriesCard";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { RateButton } from "../rating/RateButton";
import { UpNextButton } from "../upnext/UpNextButton";

/**
 * What I'm in the middle of, what I've finished and not scored, what everyone recommends, and
 * what's on my Up next list.
 */
export function HomePage() {
  const listening = useMyListening();
  const top = useRecommendations({});
  const people = useRecommenders();
  const upNext = useUpNext();

  const inProgress = listening.data?.filter((book) => !book.finished) ?? [];
  // How far into each book I am, for the bar along an Up next cover, as Continue listening has.
  const percentOf = new Map(
    (listening.data ?? [])
      .filter((book) => !book.finished)
      .map((book) => [book.itemId, book.percent]),
  );
  const toRate = listening.data?.filter((book) => book.finished && book.myScore == null) ?? [];

  return (
    <div className="space-y-10">
      {inProgress.length > 0 && (
        <ShelfSection
          id="continue"
          title="Continue listening"
          more={
            <Link to="/me/books" search={{ shelf: "listening" }} className="text-sm">
              See all
            </Link>
          }
        >
          <Shelf label="Continue listening">
            {inProgress.slice(0, 20).map((book) => (
              <BookCard
                key={book.itemId}
                itemId={book.itemId}
                title={book.title}
                authors={book.authors}
                percent={book.percent}
                action={<RateButton itemId={book.itemId} title={book.title} />}
              />
            ))}
          </Shelf>
        </ShelfSection>
      )}

      {toRate.length > 0 && (
        <ShelfSection
          id="to-rate"
          title="Finished, not rated yet"
          more={
            <Link to="/rate" className="text-sm font-medium">
              Rate {toRate.length === 1 ? "it" : `all ${toRate.length}`}
            </Link>
          }
        >
          <Shelf label="Finished, not rated yet">
            {toRate.slice(0, 20).map((book) => (
              <BookCard
                key={book.itemId}
                itemId={book.itemId}
                title={book.title}
                authors={book.authors}
                action={<RateButton itemId={book.itemId} title={book.title} />}
              />
            ))}
          </Shelf>
        </ShelfSection>
      )}

      {listening.isError && (
        <ErrorState error={listening.error} onRetry={() => listening.refetch()} />
      )}

      <ShelfSection
        id="top"
        title="Top recommended"
        more={
          <Link to="/recommendations" search={{}} className="text-sm">
            See all
          </Link>
        }
      >
        {top.isPending && <LoadingState rows={1} label="Loading recommendations" />}
        {top.isError && <ErrorState error={top.error} onRetry={() => top.refetch()} />}
        {top.data && top.data.length === 0 && (
          <EmptyState
            title="No recommendations yet"
            action={
              <Link to="/rate" className="text-sm">
                Rate what you've listened to
              </Link>
            }
          >
            Rate a book and give it a thumbs up to start the list.
          </EmptyState>
        )}
        {top.data && top.data.length > 0 && (
          <Shelf label="Top recommended">
            {top.data.slice(0, 20).map((book, index) =>
              book.seriesId ? (
                <SeriesCard
                  key={`series-${book.seriesId}`}
                  seriesId={book.seriesId}
                  name={book.title}
                  authors={book.authors}
                  books={book.seriesBooks}
                  firstItemId={book.itemId}
                  badge={
                    <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                      {index + 1}
                    </span>
                  }
                  meta={<RatingBadge score={book.average} count={book.count} />}
                />
              ) : (
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
                  action={
                    <>
                      <UpNextButton itemId={book.itemId} title={book.title} />
                      <RateButton itemId={book.itemId} title={book.title} />
                    </>
                  }
                  meta={<RatingBadge score={book.average} count={book.count} />}
                />
              ),
            )}
          </Shelf>
        )}
      </ShelfSection>

      <ShelfSection id="people" title="Recommenders">
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
      </ShelfSection>

      {upNext.data && upNext.data.length > 0 && (
        <ShelfSection
          id="up-next"
          title="Up next"
          more={
            <Link to="/me/up-next" className="text-sm">
              See all
            </Link>
          }
        >
          <Shelf label="Up next">
            {upNext.data.slice(0, 20).map((book) => (
              <BookCard
                key={book.itemId}
                itemId={book.itemId}
                title={book.title}
                authors={book.authors}
                percent={percentOf.get(book.itemId)}
                action={<RateButton itemId={book.itemId} title={book.title} />}
              />
            ))}
          </Shelf>
        </ShelfSection>
      )}
    </div>
  );
}

function ShelfSection({
  id,
  title,
  more,
  children,
}: {
  id: string;
  title: string;
  more?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-lg font-semibold">
          {title}
        </h2>
        {more}
      </div>
      {children}
    </section>
  );
}
