import { useParams } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { ApiError } from "../../api/errors";
import { useItem, useMe } from "../../api/hooks";
import { BookCover } from "../../components/domain/BookCover";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { RecommenderChip } from "../../components/domain/RecommenderChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { absItemUrl, formatDate } from "../../lib/format";
import { RatingFormPanel } from "./RatingFormPanel";

export function ItemPage() {
  const { itemId } = useParams({ from: "/app/items/$itemId" });
  const item = useItem(itemId);
  const me = useMe();

  if (item.isPending) return <LoadingState rows={2} label="Loading book" />;
  if (item.isError) {
    if (item.error instanceof ApiError && item.error.status === 404) {
      return (
        <EmptyState title="This book isn't on the server any more">
          It may have been removed from Audiobookshelf. Any ratings of it are kept, but hidden.
        </EmptyState>
      );
    }
    return <ErrorState error={item.error} onRetry={() => item.refetch()} />;
  }

  const { book, average, count, ratings } = item.data;
  const mine = ratings.find((row) => row.userId === me.data?.userId);
  const others = ratings.filter((row) => row.userId !== me.data?.userId);
  const listenUrl = absItemUrl(book.itemId);

  return (
    <div className="space-y-8">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:items-start sm:text-left">
        <div className="w-56 shrink-0 sm:w-40">
          <BookCover itemId={book.itemId} title={book.title} size="fill" />
        </div>
        <div className="min-w-0">
          <h1 className="break-words text-xl font-semibold leading-tight">{book.title}</h1>
          <p className="mt-1 text-muted">{book.authors}</p>
          <div className="mt-3">
            {count > 0 ? (
              <RatingBadge score={average} count={count} />
            ) : (
              <p className="text-sm text-muted">Nobody has recommended this yet.</p>
            )}
          </div>
          {listenUrl && (
            <a
              href={listenUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-text no-underline hover:opacity-90"
            >
              Open in Audiobookshelf
              <ExternalLink aria-hidden="true" className="h-4 w-4" />
            </a>
          )}
        </div>
      </header>

      <section
        aria-labelledby="mine-heading"
        className="rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 id="mine-heading" className="mb-4 text-base font-semibold">
          {mine ? "Your rating" : "Rate this book"}
        </h2>
        <RatingFormPanel
          key={mine ? `${mine.updatedAt}` : "new"}
          itemId={book.itemId}
          existing={mine && { score: mine.score, note: mine.note, recommended: mine.recommended }}
        />
      </section>

      <section aria-labelledby="others-heading">
        <h2 id="others-heading" className="mb-3 text-base font-semibold">
          What others said
        </h2>
        {others.length === 0 ? (
          <p className="text-sm text-muted">No one else has recommended this book yet.</p>
        ) : (
          <ul className="space-y-3">
            {others.map((row) => (
              <li
                key={row.userId}
                className="rounded-card border border-border bg-surface p-3 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <RecommenderChip userId={row.userId} username={row.username} />
                  <RatingBadge score={row.score} />
                </div>
                {row.note && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.note}</p>
                )}
                <p className="mt-2 text-xs text-muted">
                  {formatDate(row.updatedAt)}
                  {row.via && ` · via ${row.via}`}
                  {row.matchedBy === "title" && " · matched by title"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
