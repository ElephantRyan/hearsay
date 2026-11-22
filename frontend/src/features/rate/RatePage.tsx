import { Link } from "@tanstack/react-router";
import { Check, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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

/** The books the tab goes through: ones I haven't rated, or ones I recommended without a score. */
type Pile = "unrated" | "unscored";

/** A pile in queue order: the server sends most recent first, and finished books lead. */
function queueOf(books: ListenedBook[], pile: Pile): string[] {
  const chosen = books.filter(
    (book) => book.myScore == null && book.recommended === (pile === "unscored"),
  );
  return [
    ...chosen.filter((book) => book.finished),
    ...chosen.filter((book) => !book.finished),
  ].map((book) => book.itemId);
}

/**
 * The Rate tab: the books I've listened to and not rated, one card at a time, most recently
 * listened first; the ones I'm still listening to come after all of those. Picking a score or
 * turning the thumbs up on turns Skip into Submit, which saves and moves on; Skip sends the book to
 * the back. Once every book left has been skipped, a closing card offers to go through the skipped
 * ones again. When none are left, the books I recommended without a score can be gone through the
 * same way.
 */
export function RatePage() {
  const listening = useMyListening();
  const [pile, setPile] = useState<Pile>("unrated");
  const [queue, setQueue] = useState<string[] | undefined>(undefined);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());
  const [ratedHere, setRatedHere] = useState(0);

  // The queue is fixed when the list first arrives, so a refetch after each save doesn't reshuffle it.
  useEffect(() => {
    if (queue === undefined && listening.data) setQueue(queueOf(listening.data, "unrated"));
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
  // "To go" is what this pass hasn't shown yet: a skip counts down like a save does.
  const toGo = remaining.filter((id) => !skipped.has(id)).length;
  const unscored = queueOf(listening.data, "unscored");

  function goThroughUnscored() {
    setPile("unscored");
    setQueue(unscored);
    setSkipped(new Set());
    setRatedHere(0);
  }

  function skip(itemId: string) {
    setQueue((q) => [...(q ?? []).filter((id) => id !== itemId), itemId]);
    setSkipped((s) => new Set(s).add(itemId));
  }

  function rated(itemId: string) {
    setQueue((q) => (q ?? []).filter((id) => id !== itemId));
    setRatedHere((n) => n + 1);
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <h1 className="sr-only text-xl font-semibold sm:not-sr-only">Rate</h1>
        {toGo > 0 && (
          <p className="text-sm text-muted">
            {toGo} {toGo === 1 ? "book" : "books"} to go
          </p>
        )}
      </div>

      {remaining.length === 0 && pile === "unrated" && (
        <EmptyState
          title={ratedHere > 0 ? "All rated" : "Nothing to rate"}
          action={
            <div className="flex flex-col items-center gap-3">
              {unscored.length > 0 && (
                <Button onClick={goThroughUnscored}>
                  Score the {unscored.length} you recommended without one
                </Button>
              )}
              <Link to="/me/ratings" search={{ sort: "newest" }} className="text-sm">
                See your ratings
              </Link>
            </div>
          }
        >
          Every book you've started or finished in Audiobookshelf has a score or a recommendation.
          New ones show up here as you listen.
          {unscored.length > 0 &&
            ` ${unscored.length === 1 ? "One you recommended has" : `${unscored.length} you recommended have`} no score; you can give ${unscored.length === 1 ? "it" : "them"} one if you like.`}
        </EmptyState>
      )}

      {remaining.length === 0 && pile === "unscored" && (
        <EmptyState
          title={unscored.length === 0 ? "All scored" : "That's all of them"}
          action={
            <Link to="/me/ratings" search={{ sort: "newest" }} className="text-sm">
              See your ratings
            </Link>
          }
        >
          {unscored.length === 0
            ? "Every book you recommended has a score now."
            : "The rest stay recommended without a score. You can score them any time from your ratings."}
        </EmptyState>
      )}

      {allSkipped && (
        <EmptyState
          title={
            pile === "unrated" ? "That's everything unrated" : "That's every one without a score"
          }
          action={
            <Button onClick={() => setSkipped(new Set())}>
              Go through the {remaining.length} skipped {remaining.length === 1 ? "book" : "books"}
            </Button>
          }
        >
          {pile === "unrated"
            ? "You've seen every book you've listened to that you haven't rated yet."
            : "You've seen every book you recommended without a score."}{" "}
          You skipped {remaining.length === 1 ? "one" : remaining.length}. Want another look?
        </EmptyState>
      )}

      {book && !allSkipped && (
        <RateCard
          key={book.itemId}
          book={book}
          onSkip={() => skip(book.itemId)}
          onRated={() => rated(book.itemId)}
        />
      )}
    </div>
  );
}

interface CardProps {
  book: ListenedBook;
  onSkip: () => void;
  onRated: () => void;
}

/**
 * One book: cover, title and author, a thumbs up, ten stars, and Skip. Swipe left to skip too.
 * Picking a score, or turning the thumbs up on for a book not already recommended, makes Skip a
 * Submit: nothing is saved, and the card stays, until Submit is pressed.
 */
function RateCard({ book, onSkip, onRated }: CardProps) {
  const rate = useRateItem();
  const [recommended, setRecommended] = useState(book.recommended);
  const [score, setScore] = useState<number | undefined>(undefined);
  const submits = score !== undefined || (recommended && !book.recommended);
  const [dragX, setDragX] = useState(0);
  const start = useRef<number | undefined>(undefined);

  function submit() {
    rate.mutate(
      { itemId: book.itemId, score: score ?? null, note: "", recommended },
      { onSuccess: onRated },
    );
  }

  return (
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
        // Once something is picked, a swipe would throw it away; Submit or undo it first.
        if (swiped && !submits) onSkip();
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
        {/* Tapping the picked star again takes the score back. */}
        <StarRating
          value={score}
          onPick={(picked) => setScore(picked === score ? undefined : picked)}
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
            <span className="text-sm text-muted">{recommended ? "Recommended" : "Recommend?"}</span>
          </div>
          {submits ? (
            <Button onClick={submit} disabled={rate.isPending}>
              <Check aria-hidden="true" className="h-4 w-4" />
              {rate.isPending ? "Saving…" : "Submit"}
            </Button>
          ) : (
            <Button variant="ghost" onClick={onSkip} disabled={rate.isPending}>
              <SkipForward aria-hidden="true" className="h-4 w-4" />
              Skip
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}
