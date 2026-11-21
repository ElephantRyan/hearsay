import { Link, useSearch } from "@tanstack/react-router";
import { useMyListening } from "../../api/hooks";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { RateButton } from "../rating/RateButton";
import { MineTabs } from "./MineTabs";

/** The books I'm listening to, or have finished, as Audiobookshelf records them. */
export function MyBooksPage() {
  const { shelf } = useSearch({ from: "/app/me/books" });
  const listening = useMyListening();
  const finished = shelf === "finished";
  const books = listening.data?.filter((book) => book.finished === finished) ?? [];
  const unrated = books.filter((book) => book.myScore == null).length;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">My books</h1>
      <MineTabs />

      {listening.isPending && <LoadingState label="Loading your books" />}
      {listening.isError && (
        <ErrorState error={listening.error} onRetry={() => listening.refetch()} />
      )}
      {listening.data && books.length === 0 && (
        <EmptyState title={finished ? "Nothing finished yet" : "Nothing in progress"}>
          {finished
            ? "Books you finish in Audiobookshelf show up here."
            : "Start a book in Audiobookshelf and it shows up here."}
        </EmptyState>
      )}
      {books.length > 0 && (
        <>
          <p role="status" className="text-sm text-muted">
            {books.length} {books.length === 1 ? "book" : "books"}
            {unrated > 0 && (
              <>
                {" · "}
                <Link to="/rate">
                  {unrated} without a score — rate {unrated === 1 ? "it" : "them"}
                </Link>
              </>
            )}
          </p>
          <BookGrid label={finished ? "Finished" : "Listening"}>
            {books.map((book) => (
              <BookCard
                key={book.itemId}
                itemId={book.itemId}
                title={book.title}
                authors={book.authors}
                percent={finished ? undefined : book.percent}
                action={<RateButton itemId={book.itemId} title={book.title} />}
                meta={
                  book.myScore == null ? (
                    finished ? undefined : (
                      `${book.percent}% through`
                    )
                  ) : (
                    <RatingBadge score={book.myScore} />
                  )
                }
              />
            ))}
          </BookGrid>
        </>
      )}
    </div>
  );
}
