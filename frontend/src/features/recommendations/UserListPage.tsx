import { useParams } from "@tanstack/react-router";
import { useMissing, usePicks } from "../../api/hooks";
import type { MissingBook } from "../../api/types";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { listTitle } from "../../lib/format";
import { RateButton } from "../rating/RateButton";

/**
 * One person's list: "Ryan recommends", best first, with their notes. For someone on a linked
 * server, the books they recommend that this library doesn't have follow, as a plain list.
 */
export function UserListPage() {
  const { userId } = useParams({ from: "/app/recommendations/users/$userId" });
  const picks = usePicks(userId);
  const missing = useMissing(userId);
  const name = picks.data?.[0]?.username;
  const nothingMissing = (missing.data?.length ?? 0) === 0;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{name ? listTitle(name) : "Recommendations"}</h1>
      {picks.isPending && <LoadingState />}
      {picks.isError && <ErrorState error={picks.error} onRetry={() => picks.refetch()} />}
      {picks.data && picks.data.length === 0 && nothingMissing && (
        <EmptyState title="Nothing here">This person hasn't recommended any books.</EmptyState>
      )}
      {picks.data && picks.data.length > 0 && (
        <BookGrid ordered label={name ? listTitle(name) : "Recommendations"}>
          {picks.data.map((pick, index) => (
            <BookCard
              key={pick.itemId}
              itemId={pick.itemId}
              title={pick.title}
              authors={pick.authors}
              badge={
                <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-semibold text-white tabular-nums">
                  {index + 1}
                </span>
              }
              action={<RateButton itemId={pick.itemId} title={pick.title} />}
              meta={
                <div className="space-y-1">
                  <RatingBadge score={pick.score} />
                  {pick.note && <p className="line-clamp-3">{pick.note}</p>}
                </div>
              }
            />
          ))}
        </BookGrid>
      )}
      {missing.data && missing.data.length > 0 && <NotInYourLibrary books={missing.data} />}
    </div>
  );
}

function NotInYourLibrary({ books }: { books: MissingBook[] }) {
  return (
    <section aria-labelledby="not-in-library" className="space-y-3">
      <h2 id="not-in-library" className="text-base font-semibold">
        Not in your library
      </h2>
      <p className="text-sm text-muted">
        Recommended on {books[0]?.via}, but this library doesn't have them, or they couldn't be
        recognised here.
      </p>
      <ul className="space-y-2">
        {books.map((book) => (
          <li
            key={`${book.title}-${book.updatedAt}`}
            className="rounded-card border border-border bg-surface p-3 text-sm shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium break-words">{book.title}</p>
                <p className="text-muted break-words">{book.authors}</p>
              </div>
              <RatingBadge score={book.score} />
            </div>
            {book.note && <p className="mt-2 whitespace-pre-wrap break-words">{book.note}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
