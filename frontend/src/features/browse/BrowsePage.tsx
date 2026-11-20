import { useNavigate, useSearch } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { BROWSE_PAGE_SIZE, useBrowse, useLibraries } from "../../api/hooks";
import { BookRow } from "../../components/domain/BookRow";
import { LibraryPicker } from "../../components/domain/LibraryPicker";
import { Pager } from "../../components/domain/Pager";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { useDebounced } from "../../lib/useDebounced";

/**
 * Browse a library A to Z or search it. The library, the search text and the
 * page all live in the URL, so a search can be shared and Back does the
 * obvious thing.
 */
export function BrowsePage() {
  const search = useSearch({ from: "/app/browse" });
  const navigate = useNavigate({ from: "/browse" });
  const libraries = useLibraries();
  const searchId = useId();

  const libraryId = search.library ?? libraries.data?.[0]?.id;
  const q = search.q ?? "";
  const page = search.page;

  // The box edits local text at once; the URL (and so the request) follows
  // once typing pauses.
  const [typed, setTyped] = useState(q);
  const settled = useDebounced(typed, 300);
  useEffect(() => setTyped(q), [q]);
  useEffect(() => {
    const next = settled.trim();
    if (next === q) return;
    void navigate({
      search: (prev) => ({ ...prev, q: next || undefined, page: 0 }),
      replace: true,
    });
  }, [settled, q, navigate]);

  const results = useBrowse(libraryId, page, q);
  const searching = q !== "";
  const total = results.data?.total ?? 0;
  const pageCount = Math.ceil(total / BROWSE_PAGE_SIZE);

  function goToPage(next: number) {
    void navigate({ search: (prev) => ({ ...prev, page: next }) });
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Browse</h1>

      <div className="space-y-3 rounded-card border border-border bg-surface p-3">
        {libraries.data && libraryId && (
          <LibraryPicker
            libraries={libraries.data}
            value={libraryId}
            onChange={(id) => navigate({ search: (prev) => ({ ...prev, library: id, page: 0 }) })}
          />
        )}
        <div>
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
      {results.isError && <ErrorState error={results.error} onRetry={() => results.refetch()} />}

      {results.data && (
        <section aria-label="Results" aria-busy={results.isPlaceholderData}>
          <p role="status" className="mb-3 text-sm text-muted">
            {searching
              ? results.data.items.length === 0
                ? `No books match “${q}”.`
                : results.data.items.length >= BROWSE_PAGE_SIZE
                  ? `Showing the first ${BROWSE_PAGE_SIZE} matches for “${q}”. Add more to the search to narrow it.`
                  : `${results.data.items.length} ${results.data.items.length === 1 ? "match" : "matches"} for “${q}”.`
              : `${total.toLocaleString()} ${total === 1 ? "book" : "books"}`}
          </p>

          {results.data.items.length === 0 && !searching && (
            <EmptyState title="This library is empty">Nothing here to rate yet.</EmptyState>
          )}

          {results.data.items.length > 0 && (
            <ul className={`space-y-3 ${results.isPlaceholderData ? "opacity-60" : ""}`}>
              {results.data.items.map((book) => (
                <BookRow
                  key={book.itemId}
                  itemId={book.itemId}
                  title={book.title}
                  authors={book.authors || "Unknown author"}
                  aside={
                    book.myScore === undefined || book.myScore === null ? undefined : (
                      <RatingBadge score={book.myScore} />
                    )
                  }
                />
              ))}
            </ul>
          )}

          {!searching && (
            <div className="mt-5">
              <Pager page={page} pageCount={pageCount} onPage={goToPage} />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
