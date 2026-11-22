import { Link } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Check, GripVertical, X } from "lucide-react";
import { useState } from "react";
import {
  useItem,
  useMe,
  useMyListening,
  useRemoveFromUpNext,
  useReorderUpNext,
  useUpNext,
} from "../../api/hooks";
import type { UpNextBook } from "../../api/types";
import { BookCover } from "../../components/domain/BookCover";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { MineTabs } from "../mine/MineTabs";
import { RatingFormPanel } from "../rating/RatingFormPanel";

/** `books` with the one at `from` moved to `to`. */
function moved(books: UpNextBook[], from: number, to: number): UpNextBook[] {
  const next = [...books];
  const [book] = next.splice(from, 1);
  if (book) next.splice(to, 0, book);
  return next;
}

/**
 * My Up next list: the books I mean to listen to, in the order I choose. Arrows move a book up or
 * down (drag works too on a computer). Mark as read offers to rate it, or Skip, and either way it
 * leaves the list; Remove just takes it off. A book Audiobookshelf says I've finished is labelled
 * so, and stays until I mark it read.
 */
export function UpNextPage() {
  const list = useUpNext();
  const listening = useMyListening();
  const reorder = useReorderUpNext();
  const remove = useRemoveFromUpNext();
  const [reading, setReading] = useState<UpNextBook | undefined>(undefined);
  const [dragging, setDragging] = useState<number | undefined>(undefined);

  const finished = new Set(
    (listening.data ?? []).filter((book) => book.finished).map((book) => book.itemId),
  );

  function move(from: number, to: number) {
    if (!list.data || to < 0 || to >= list.data.length || from === to) return;
    reorder.mutate(moved(list.data, from, to));
  }

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">My books</h1>
      <MineTabs />

      {list.isPending && <LoadingState label="Loading your Up next list" />}
      {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
      {list.data && list.data.length === 0 && (
        <EmptyState
          title="Nothing up next"
          action={
            <Link to="/browse" search={{ sort: "title" }} className="text-sm">
              Browse the library
            </Link>
          }
        >
          Add books you mean to listen to with the list button on any book, then put them in the
          order you want to get to them.
        </EmptyState>
      )}
      {(reorder.isError || remove.isError) && (
        <p role="alert" className="text-sm text-danger">
          Couldn't change your list: {messageFor(reorder.error ?? remove.error)}
        </p>
      )}

      {list.data && list.data.length > 0 && (
        <ol aria-label="Up next" className="space-y-2">
          {list.data.map((book, index) => (
            <li
              key={book.itemId}
              draggable
              onDragStart={() => setDragging(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (dragging !== undefined) move(dragging, index);
                setDragging(undefined);
              }}
              onDragEnd={() => setDragging(undefined)}
              className={`flex items-center gap-3 rounded-card border border-border bg-surface p-2 shadow-card sm:p-3 ${
                dragging === index ? "opacity-50" : ""
              }`}
            >
              <GripVertical
                aria-hidden="true"
                className="hidden h-5 w-5 shrink-0 cursor-grab text-muted sm:block"
              />
              <span className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted">
                {index + 1}
              </span>
              <Link to="/items/$itemId" params={{ itemId: book.itemId }} className="shrink-0">
                <BookCover itemId={book.itemId} title={book.title} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <Link
                  to="/items/$itemId"
                  params={{ itemId: book.itemId }}
                  className="line-clamp-2 font-medium break-words text-text no-underline"
                >
                  {book.title}
                </Link>
                <p className="truncate text-sm text-muted">{book.authors || "Unknown author"}</p>
                {finished.has(book.itemId) && (
                  <p className="text-xs font-medium text-accent">Finished in Audiobookshelf</p>
                )}
              </div>
              <div className="flex shrink-0 flex-col">
                <IconButton
                  label={`Move ${book.title} up`}
                  disabled={index === 0 || reorder.isPending}
                  onClick={() => move(index, index - 1)}
                >
                  <ArrowUp aria-hidden="true" className="h-4 w-4" />
                </IconButton>
                <IconButton
                  label={`Move ${book.title} down`}
                  disabled={index === list.data.length - 1 || reorder.isPending}
                  onClick={() => move(index, index + 1)}
                >
                  <ArrowDown aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
              <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
                <Button
                  variant="secondary"
                  aria-label={`Mark ${book.title} as read`}
                  onClick={() => setReading(book)}
                >
                  <Check aria-hidden="true" className="h-4 w-4" />
                  <span className="hidden sm:inline">Mark as read</span>
                </Button>
                <IconButton
                  label={`Remove ${book.title} from Up next`}
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(book.itemId)}
                >
                  <X aria-hidden="true" className="h-4 w-4" />
                </IconButton>
              </div>
            </li>
          ))}
        </ol>
      )}

      {reading && (
        <MarkAsRead
          book={reading}
          onClose={() => setReading(undefined)}
          onDone={() => {
            remove.mutate(reading.itemId);
            setReading(undefined);
          }}
        />
      )}
    </div>
  );
}

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg text-muted hover:bg-surface-2 disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/**
 * Marking a book read: rate it now (my rating so far, if I have one, filled in), or Skip. Either
 * way it leaves the list; closing the sheet leaves it where it was.
 */
function MarkAsRead({
  book,
  onClose,
  onDone,
}: {
  book: UpNextBook;
  onClose: () => void;
  onDone: () => void;
}) {
  const item = useItem(book.itemId);
  const me = useMe();
  const mine = item.data?.ratings.find((row) => row.userId === me.data?.userId);
  return (
    <Sheet title={`Finished ${book.title}?`} onClose={onClose}>
      <p className="text-sm text-muted">Rate it if you like. It comes off your Up next list.</p>
      {item.isPending && <LoadingState rows={1} label="Loading your rating" />}
      {item.isError && <ErrorState error={item.error} onRetry={() => item.refetch()} />}
      {item.data && (
        <RatingFormPanel
          itemId={book.itemId}
          existing={
            mine && { score: mine.score ?? null, note: mine.note, recommended: mine.recommended }
          }
          onDone={onDone}
        />
      )}
      <Button variant="ghost" className="w-full" onClick={onDone}>
        Skip rating
      </Button>
    </Sheet>
  );
}
