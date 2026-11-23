import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { Search, Library as SeriesIcon, UserRound, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { BROWSE_PAGE_SIZE, useBrowse, useLibraries } from "../../api/hooks";
import type { BrowseItem, BrowseMatch, BrowseSort } from "../../api/types";
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
import { UpNextButton } from "../upnext/UpNextButton";

const sorts: { value: BrowseSort; label: string }[] = [
  { value: "title", label: "Title, A to Z" },
  { value: "title-desc", label: "Title, Z to A" },
  { value: "author", label: "Author, A to Z" },
  { value: "author-desc", label: "Author, Z to A" },
];

/** Only a series has an order of its own. */
const seriesSort: { value: BrowseSort; label: string } = { value: "series", label: "Series order" };

/**
 * Browse a library, one author's or series' books in it, or search it, in the order chosen. A
 * search also offers the authors and series whose names matched (ABS matches books by title
 * only), each opening as its own list; a series in its own order. The library, search, scope and
 * order live in the URL, so any of them can be shared and Back does the obvious thing. More books
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
  const inSeries = search.series !== undefined;
  const sort: BrowseSort = search.sort ?? (inSeries ? "series" : "title");
  const scopeName = search.author ? search.authorName : search.seriesName;

  // The box edits local text at once; the URL (and so the request) follows
  // once typing pauses.
  const [typed, setTyped] = useState(q);
  const settled = useDebounced(typed, 300);
  // The box follows the URL only when the URL says something else (Back, a shared link, opening a
  // series): the URL holds the text trimmed, so copying it back would eat a space mid-typing.
  useEffect(() => setTyped((current) => (current.trim() === q ? current : q)), [q]);
  // A search starts only when the typed text settles on something new, never because the URL
  // moved (a heading link, Back): q and the box are read as they are now, not watched.
  const qNow = useRef(q);
  qNow.current = q;
  const typedNow = useRef(typed);
  typedNow.current = typed;
  useEffect(() => {
    const next = settled.trim();
    if (next === qNow.current) return;
    // Still catching up with the box (it was just cleared, say): wait for it.
    if (next !== typedNow.current.trim()) return;
    // A search covers the whole library, so it leaves an author's or series' list.
    void navigate({
      search: (prev) => ({
        ...prev,
        q: next || undefined,
        ...(next ? { author: undefined, authorName: undefined } : {}),
        ...(next
          ? {
              series: undefined,
              seriesName: undefined,
              sort: prev.sort === "series" ? undefined : prev.sort,
            }
          : {}),
      }),
      replace: true,
    });
  }, [settled, navigate]);

  const results = useBrowse(libraryId, q, sort, { author: search.author, series: search.series });
  const searching = q !== "";
  const pages = results.data?.pages ?? [];
  const items = pages.flatMap((page) => page.items);
  const total = pages[0]?.total ?? 0;
  const authorMatches = searching ? (pages[0]?.authors ?? []) : [];
  const seriesMatches = searching ? (pages[0]?.series ?? []) : [];

  function leaveScope() {
    void navigate({ search: (prev) => ({ library: prev.library }) });
  }

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
              Search titles, authors and series
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
                placeholder="A title, an author or a series"
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
              {(inSeries ? [seriesSort, ...sorts] : sorts).map((option) => (
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

      {(search.author || search.series) && (
        <div className="flex items-center gap-2">
          <span className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent-soft px-4 text-sm font-medium text-accent">
            {search.author ? (
              <UserRound aria-hidden="true" className="h-4 w-4" />
            ) : (
              <SeriesIcon aria-hidden="true" className="h-4 w-4" />
            )}
            {search.author
              ? `Books by ${scopeName ?? "this author"}`
              : `Series: ${scopeName ?? "this series"}`}
          </span>
          <button
            type="button"
            onClick={leaveScope}
            aria-label="Show the whole library"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-muted hover:bg-surface-2"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>
      )}

      {results.data && (
        <section aria-label="Results" aria-busy={results.isPlaceholderData}>
          <p role="status" className="mb-3 text-sm text-muted">
            {searching
              ? items.length === 0
                ? authorMatches.length + seriesMatches.length > 0
                  ? `No titles match “${q}”; ${matchesLine(authorMatches.length, seriesMatches.length)} below.`
                  : `No books match “${q}”.`
                : items.length >= BROWSE_PAGE_SIZE
                  ? `Showing the first ${BROWSE_PAGE_SIZE} matches for “${q}”. Add more to the search to narrow it.`
                  : `${items.length} ${items.length === 1 ? "match" : "matches"} for “${q}”.`
              : `${total.toLocaleString()} ${total === 1 ? "book" : "books"}`}
          </p>

          {items.length === 0 && !searching && (
            <EmptyState title="This library is empty">Nothing here to rate yet.</EmptyState>
          )}

          {items.length > 0 && <BookCards items={items} dimmed={results.isPlaceholderData} />}

          {results.hasNextPage && !results.isPlaceholderData && (
            <MoreBooks
              loading={results.isFetchingNextPage}
              error={results.isFetchNextPageError ? results.error : null}
              onMore={() => void results.fetchNextPage()}
            />
          )}
        </section>
      )}

      {libraryId !== undefined &&
        authorMatches.map((match) => (
          <MatchSection
            key={`author-${match.id}`}
            libraryId={libraryId}
            match={match}
            kind="author"
            sort={sort === "series" ? "title" : sort}
          />
        ))}
      {libraryId !== undefined &&
        seriesMatches.map((match) => (
          <MatchSection
            key={`series-${match.id}`}
            libraryId={libraryId}
            match={match}
            kind="series"
            sort="series"
          />
        ))}
    </div>
  );
}

/** "2 authors and 1 series", for the line under a search with no title matches. */
function matchesLine(authors: number, series: number): string {
  const parts = [
    authors > 0 ? `${authors} ${authors === 1 ? "author" : "authors"}` : "",
    series > 0 ? `${series} series` : "",
  ].filter(Boolean);
  return `${parts.join(" and ")} with that name ${authors + series === 1 ? "is" : "are"}`;
}

/** Books as cover cards, each with its Up next and Rate buttons and my score. */
function BookCards({ items, dimmed }: { items: BrowseItem[]; dimmed?: boolean }) {
  return (
    <BookGrid dimmed={dimmed}>
      {items.map((book) => (
        <BookCard
          key={book.itemId}
          itemId={book.itemId}
          title={book.title}
          authors={book.authors}
          action={
            <>
              <UpNextButton itemId={book.itemId} title={book.title} />
              <RateButton itemId={book.itemId} title={book.title} />
            </>
          }
          meta={
            book.myScore != null || book.myRecommended ? (
              <RatingBadge score={book.myScore} />
            ) : undefined
          }
        />
      ))}
    </BookGrid>
  );
}

/**
 * One author or series a search matched, with all its books (more as the section's end scrolls
 * into view); a series in its own order. The heading opens it as its own list, where the order
 * can be changed.
 */
function MatchSection({
  libraryId,
  match,
  kind,
  sort,
}: {
  libraryId: string;
  match: BrowseMatch;
  kind: "author" | "series";
  sort: BrowseSort;
}) {
  const books = useBrowse(
    libraryId,
    "",
    sort,
    kind === "author" ? { author: match.id } : { series: match.id },
  );
  const items = books.data?.pages.flatMap((page) => page.items) ?? [];
  const heading = kind === "author" ? `Books by ${match.name}` : `Series: ${match.name}`;
  const headingId = `${kind}-${match.id}-heading`;
  return (
    <section aria-labelledby={headingId} className="space-y-3">
      <h2 id={headingId} className="flex flex-wrap items-baseline gap-x-2 text-lg font-semibold">
        <Link
          to="/browse"
          search={
            kind === "author"
              ? { author: match.id, authorName: match.name }
              : { series: match.id, seriesName: match.name }
          }
          className="text-text no-underline hover:underline"
        >
          {kind === "author" ? (
            <UserRound aria-hidden="true" className="mr-1 inline h-4 w-4 align-[-2px]" />
          ) : (
            <SeriesIcon aria-hidden="true" className="mr-1 inline h-4 w-4 align-[-2px]" />
          )}
          {heading}
        </Link>
        <span className="text-sm font-normal text-muted">
          {match.books} {match.books === 1 ? "book" : "books"}
        </span>
      </h2>
      {books.isPending && <LoadingState rows={1} label={`Loading ${heading}`} />}
      {books.isError && !books.isFetchNextPageError && (
        <ErrorState error={books.error} onRetry={() => books.refetch()} />
      )}
      {items.length > 0 && <BookCards items={items} />}
      {books.hasNextPage && (
        <MoreBooks
          loading={books.isFetchingNextPage}
          error={books.isFetchNextPageError ? books.error : null}
          onMore={() => void books.fetchNextPage()}
        />
      )}
    </section>
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
