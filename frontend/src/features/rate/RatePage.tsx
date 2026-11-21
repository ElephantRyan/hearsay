import { Link } from "@tanstack/react-router";
import { SkipForward } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useMyListening, useRateItem } from "../../api/hooks";
import type { ListenedBook } from "../../api/types";
import { BookCover } from "../../components/domain/BookCover";
import { RecommendButton } from "../../components/domain/RecommendButton";
import { StarRating } from "../../components/domain/StarRating";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { Dialog } from "../../components/ui/Dialog";

/** Whether picking a star asks first. Kept per browser; a blocked storage just means "ask". */
const ASK_KEY = "rate.askBeforeSaving";

function readAsk(): boolean {
  try {
    return localStorage.getItem(ASK_KEY) !== "no";
  } catch {
    return true;
  }
}

function writeAsk(ask: boolean) {
  try {
    if (ask) localStorage.removeItem(ASK_KEY);
    else localStorage.setItem(ASK_KEY, "no");
  } catch {
    // Not remembered; the next visit asks again.
  }
}

/**
 * The Rate tab: the books I've finished and not scored, one card at a time, most recently
 * listened first; the ones I'm still listening to come after all of those. A star saves the score (after a confirm, unless turned off); Skip
 * sends the book to the back. Once every book left has been skipped, a closing card offers to go
 * through the skipped ones again.
 */
export function RatePage() {
  const listening = useMyListening();
  const [queue, setQueue] = useState<string[] | undefined>(undefined);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [ratedHere, setRatedHere] = useState(0);
  const [ask, setAsk] = useState(readAsk);
  const askId = useId();

  // The queue is fixed when the list first arrives, so a refetch after each save doesn't reshuffle it.
  useEffect(() => {
    if (queue === undefined && listening.data) {
      const unrated = listening.data.filter((book) => book.myScore == null);
      // The server sends most recent first; finished books lead, in that order.
      const ordered = [
        ...unrated.filter((book) => book.finished),
        ...unrated.filter((book) => !book.finished),
      ];
      setQueue(ordered.map((book) => book.itemId));
    }
  }, [queue, listening.data]);

  if (listening.isPending) return <LoadingState rows={1} label="Loading your books" />;
  if (listening.isError)
    return <ErrorState error={listening.error} onRetry={() => listening.refetch()} />;
  if (queue === undefined) return null;

  const byId = new Map(listening.data.map((book) => [book.itemId, book]));
  const remaining = queue.filter((id) => byId.has(id));
  const current = remaining[0];
  // Skipped books go to the back, so the front is skipped only once every book left has been.
  const allSkipped = current !== undefined && skipped.has(current);
  const book = current === undefined ? undefined : byId.get(current);

  function skip(itemId: string) {
    setQueue((q) => [...(q ?? []).filter((id) => id !== itemId), itemId]);
    setSkipped((s) => new Set(s).add(itemId));
  }

  function rated(itemId: string) {
    setQueue((q) => (q ?? []).filter((id) => id !== itemId));
    setRatedHere((n) => n + 1);
  }

  function changeAsk(next: boolean) {
    setAsk(next);
    writeAsk(next);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="sr-only text-xl font-semibold sm:not-sr-only">Rate</h1>
        {remaining.length > 0 && (
          <p className="text-sm text-muted">
            {remaining.length} {remaining.length === 1 ? "book" : "books"} to go
          </p>
        )}
      </div>

      {remaining.length === 0 && (
        <EmptyState
          title={ratedHere > 0 ? "All rated" : "Nothing to rate"}
          action={
            <Link to="/me/ratings" search={{ sort: "newest" }} className="text-sm">
              See your ratings
            </Link>
          }
        >
          Every book you've started or finished in Audiobookshelf has a score. New ones show up here
          as you listen.
        </EmptyState>
      )}

      {allSkipped && (
        <EmptyState
          title="That's everything unrated"
          action={
            <Button onClick={() => setSkipped(new Set())}>
              Go through the {remaining.length} skipped {remaining.length === 1 ? "book" : "books"}
            </Button>
          }
        >
          You've seen every book you've listened to that doesn't have a score yet. You skipped{" "}
          {remaining.length === 1 ? "one" : remaining.length}. Want another look?
        </EmptyState>
      )}

      {book && !allSkipped && (
        <RateCard
          key={book.itemId}
          book={book}
          ask={ask}
          onAskChange={changeAsk}
          onSkip={() => skip(book.itemId)}
          onRated={() => rated(book.itemId)}
        />
      )}

      <div className="flex items-center justify-center gap-2 text-sm text-muted">
        <input
          id={askId}
          type="checkbox"
          checked={ask}
          onChange={(event) => changeAsk(event.target.checked)}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <label htmlFor={askId}>Ask before saving a score</label>
      </div>
    </div>
  );
}

interface CardProps {
  book: ListenedBook;
  ask: boolean;
  onAskChange: (ask: boolean) => void;
  onSkip: () => void;
  onRated: () => void;
}

/** One book: cover, title and author, a thumbs up, ten stars, and Skip. Swipe left to skip too. */
function RateCard({ book, ask, onAskChange, onSkip, onRated }: CardProps) {
  const rate = useRateItem();
  const [recommended, setRecommended] = useState(false);
  const [confirming, setConfirming] = useState<number | undefined>(undefined);
  const [dragX, setDragX] = useState(0);
  const start = useRef<number | undefined>(undefined);

  function save(score: number) {
    setConfirming(undefined);
    rate.mutate({ itemId: book.itemId, score, note: "", recommended }, { onSuccess: onRated });
  }

  function pick(score: number) {
    if (ask) setConfirming(score);
    else save(score);
  }

  return (
    <>
      <article
        aria-label={book.title}
        className="touch-pan-y rounded-card border border-border bg-surface p-4 shadow-card transition-transform select-none sm:p-5"
        style={
          dragX
            ? { transform: `translateX(${dragX}px) rotate(${dragX / 40}deg)`, transition: "none" }
            : undefined
        }
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse") start.current = event.clientX;
        }}
        onPointerMove={(event) => {
          if (start.current !== undefined) setDragX(Math.min(0, event.clientX - start.current));
        }}
        onPointerUp={() => {
          const swiped = dragX < -90;
          start.current = undefined;
          setDragX(0);
          if (swiped) onSkip();
        }}
        onPointerCancel={() => {
          start.current = undefined;
          setDragX(0);
        }}
      >
        <div className="mx-auto w-[min(16rem,24dvh)] sm:w-[min(16rem,30dvh)]">
          <BookCover itemId={book.itemId} title={book.title} size="fill" />
        </div>
        <div className="mt-3 text-center">
          <h2 className="line-clamp-2 break-words text-base font-semibold leading-snug sm:text-lg">
            {book.title}
          </h2>
          <p className="mt-0.5 text-muted">{book.authors || "Unknown author"}</p>
          <p className="mt-1 text-xs text-muted">
            {book.finished ? "Finished" : `${book.percent}% through`}
          </p>
        </div>

        <div className="mt-3 space-y-2">
          <StarRating
            value={rate.isPending ? rate.variables?.score : confirming}
            onPick={pick}
            disabled={rate.isPending}
          />
          {rate.isError && (
            <p role="alert" className="text-center text-sm text-danger">
              Couldn't save that: {messageFor(rate.error)}
            </p>
          )}
          {/* The thumbs up and Skip share a row, so the card fits a small phone's screen. */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <RecommendButton
                size="lg"
                on={recommended}
                onChange={setRecommended}
                label={`Recommend ${book.title}`}
                disabled={rate.isPending}
              />
              <span className="text-sm text-muted">
                {recommended ? "Recommended" : "Recommend?"}
              </span>
            </div>
            <Button variant="ghost" onClick={onSkip} disabled={rate.isPending}>
              <SkipForward aria-hidden="true" className="h-4 w-4" />
              Skip
            </Button>
          </div>
        </div>
      </article>

      {confirming !== undefined && (
        <ConfirmScore
          title={book.title}
          score={confirming}
          recommended={recommended}
          onCancel={() => setConfirming(undefined)}
          onSave={(stopAsking) => {
            if (stopAsking) onAskChange(false);
            save(confirming);
          }}
        />
      )}
    </>
  );
}

function ConfirmScore({
  title,
  score,
  recommended,
  onCancel,
  onSave,
}: {
  title: string;
  score: number;
  recommended: boolean;
  onCancel: () => void;
  onSave: (stopAsking: boolean) => void;
}) {
  const [stopAsking, setStopAsking] = useState(false);
  const stopId = useId();
  return (
    <Dialog title={`Save ${score} out of 10?`} onClose={onCancel}>
      <p className="text-sm">
        For <span className="font-medium">{title}</span>
        {recommended ? ", recommended to everyone on this server." : ", visible only to you."}
      </p>
      <div className="flex items-start gap-2 text-sm">
        <input
          id={stopId}
          type="checkbox"
          checked={stopAsking}
          onChange={(event) => setStopAsking(event.target.checked)}
          className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
        />
        <label htmlFor={stopId}>Don't ask again: save as soon as I pick a star</label>
      </div>
      <div className="flex gap-3">
        <Button className="flex-1" onClick={() => onSave(stopAsking)}>
          Save
        </Button>
        <Button variant="secondary" className="flex-1" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </Dialog>
  );
}
