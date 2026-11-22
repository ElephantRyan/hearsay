import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BROWSE_PAGE_SIZE, useBrowse, useLibraries } from "../../api/hooks";
import type { BrowseSort } from "../../api/types";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { LibraryPicker } from "../../components/domain/LibraryPicker";
import { RatingBadge } from "../../components/domain/RatingBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { useDebounced } from "../../lib/useDebounced";
import { RateButton } from "../rating/RateButton";

const sorts: { value: BrowseSort; label: string }[] = [
  { value: "title", label: "Title, A to Z" },
  { value: "title-desc", label: "Title, Z to A" },
  { value: "author", label: "Author, A to Z" },
  { value: "author-desc", label: "Author, Z to A" },
];

/**
 * Browse a library or search it, in the order chosen. The library, the search text and the
 * order live in the URL, so a search can be shared and Back does the obvious thing. More books
 * load as the end of the list scrolls into view.
 */
export function BrowsePage() {
  const search = useSearch({ from: "/app/browse" });
  const navigate = useNavigate({ from: "/browse" });
  const libraries = useLibraries();
  const searchId = useId();
  const sortId = useId();

  const libraryId = search.library ?? libraries.data?.[0]?.id;
  const q = search.q ?? "";
  const sort = search.sort;

  // The box edits local text at once; the URL (and so the request) follows
  // once typing pauses.
  const [typed, setTyped] = useState(q);
  const settled = useDebounced(typed, 300);
  useEffect(() => setTyped(q), [q]);
  useEffect(() => {
    const next = settled.trim();
    if (next === q) return;
    void navigate({ search: (prev) => ({ ...prev, q: next || undefined }), replace: true });
  }, [settled, q, navigate]);

  const results = useBrowse(libraryId, q, sort);
  const searching = q !== "";
  const pages = results.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Browse</h1>

      <div className="space-y-3 rounded-card border border-border bg-surface p-3">
        {libraries.data && libraryId && (
          <LibraryPicker
            libraries={libraries.data}
            value={libraryId}
            onChange={(id) => navigate({ search: (prev) => ({ ...prev, library: id }) })}
          />
        )}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor={searchId} className="mb-1 block text-sm font-medium">
              Search titles
            </label>
            <div className="relative">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted"
              />
              <input
                id={searchId}
                type="search"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                maxLength={100}
                autoComplete="off"
                placeholder="A title, or part of one"
                className="min-h-11 w-full rounded-lg border border-border bg-surface pr-3 pl-9 text-base"
              />
            </div>
          </div>
          <div>
            <label htmlFor={sortId} className="mb-1 block text-sm font-medium">
              Sort by
            </label>
            <select
              id={sortId}
              value={sort}
              onChange={(event) =>
                navigate({
                  search: (prev) => ({ ...prev, sort: event.target.value as BrowseSort }),
                })
              }
              className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 sm:w-auto"
            >
              {sorts.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {libraries.isError && (
        <ErrorState error={libraries.error} onRetry={() => libraries.refetch()} />
      )}
      {libraries.data && libraries.data.length === 0 && (
        <EmptyState title="No book libraries">
          Audiobookshelf has no book libraries this server can read.
        </EmptyState>
      )}
      {(libraries.isPending || (libraryId !== undefined && results.isPending)) && <LoadingState />}
      {results.isError && !results.isFetchNextPageError && (
        <ErrorState error={results.error} onRetry={() => results.refetch()} />
      )}

      {results.data && (
        <section aria-label="Results" aria-busy={results.isPlaceholderData}>
          <p role="status" className="mb-3 text-sm text-muted">
            {searching
              ? items.length === 0
                ? `No books match “${q}”.`
                : items.length >= BROWSE_PAGE_SIZE
                  ? `Showing the first ${BROWSE_PAGE_SIZE} matches for “${q}”. Add more to the search to narrow it.`
                  : `${items.length} ${items.length === 1 ? "match" : "matches"} for “${q}”.`
              : `${total.toLocaleString()} ${total === 1 ? "book" : "books"}`}
          </p>

          {items.length === 0 && !searching && (
            <EmptyState title="This library is empty">Nothing here to rate yet.</EmptyState>
          )}

          {items.length > 0 && (
            <BookGrid dimmed={results.isPlaceholderData}>
              {items.map((book) => (
                <BookCard
                  key={book.itemId}
                  itemId={book.itemId}
                  title={book.title}
                  authors={book.authors}
                  action={<RateButton itemId={book.itemId} title={book.title} />}
                  meta={
                    book.myScore != null || book.myRecommended ? (
                      <RatingBadge score={book.myScore} />
                    ) : undefined
                  }
                />
              ))}
            </BookGrid>
          )}

          {results.hasNextPage && !results.isPlaceholderData && (
            <MoreBooks
              loading={results.isFetchingNextPage}
              error={results.isFetchNextPageError ? results.error : null}
              onMore={() => void results.fetchNextPage()}
            />
          )}
        </section>
      )}
    </div>
  );
}

/**
 * The end of the list: asks for the next page once it comes within a screen of view. A failed
 * page says so and offers to try again rather than asking over and over.
 */
function MoreBooks({
  loading,
  error,
  onMore,
}: {
  loading: boolean;
  error: Error | null;
  onMore: () => void;
}) {
  const end = useRef<HTMLDivElement>(null);
  const more = useRef(onMore);
  more.current = onMore;
  const failed = error !== null;

  useEffect(() => {
    const target = end.current;
    if (!target || loading || failed || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) more.current();
      },
      { rootMargin: "100% 0px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [loading, failed]);

  return (
    <div ref={end} className="mt-5 flex flex-col items-center gap-2">
      {loading && <LoadingState rows={1} label="Loading more books" />}
      {!loading && !failed && typeof IntersectionObserver === "undefined" && (
        <Button variant="secondary" onClick={onMore}>
          Show more books
        </Button>
      )}
      {failed && (
        <>
          <p role="alert" className="text-sm text-danger">
            Couldn't load more books: {messageFor(error)}
          </p>
          <Button variant="secondary" onClick={onMore}>
            Try again
          </Button>
        </>
      )}
    </div>
  );
}
