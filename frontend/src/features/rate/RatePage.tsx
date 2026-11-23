import { Link } from "@tanstack/react-router";
import { Check, Library, SkipForward } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAccount, useMyListening, useRateItem, useRateSeries, useSeries } from "../../api/hooks";
import type { ListenedBook } from "../../api/types";
import { BookCover } from "../../components/domain/BookCover";
import { RecommendButton } from "../../components/domain/RecommendButton";
import { ScoreSlider } from "../../components/domain/ScoreSlider";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { Sheet } from "../../components/ui/Sheet";
import { SeriesPanel } from "../series/SeriesPanel";

type ListenedSeries = NonNullable<ListenedBook["series"]>;

/** What the tab goes through: books one at a time, or the series of books I've listened to. */
type Mode = "books" | "series";

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

/** The Rate tab: books, or the series they're in, under one switch. */
export function RatePage() {
  const [mode, setMode] = useState<Mode>("books");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="sr-only text-xl font-semibold sm:not-sr-only">Rate</h1>
        <fieldset className="inline-flex rounded-full border border-border bg-surface p-0.5 text-sm">
          <legend className="sr-only">What to rate</legend>
          {(["books", "series"] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => setMode(m)}
              className={`min-h-9 rounded-full px-4 font-medium ${mode === m ? "bg-accent text-accent-text" : "text-muted"}`}
            >
              {m === "books" ? "Books" : "Series"}
            </button>
          ))}
        </fieldset>
      </div>
      {mode === "books" ? <BookQueue /> : <SeriesQueue />}
    </div>
  );
}

/**
 * The books I've listened to and not rated, one card at a time, most recently
 * listened first; the ones I'm still listening to come after all of those. Picking a score or
 * turning the thumbs up on turns Skip into Submit, which saves and moves on; Skip sends the book to
 * the back. Once every book left has been skipped, a closing card offers to go through the skipped
 * ones again. When none are left, the books I recommended without a score can be gone through the
 * same way. With "skip books from series I've rated" on, a book whose series I've rated or
 * recommended is left out, at once if I rate its series from the card.
 */
function BookQueue() {
  const listening = useMyListening();
  const account = useAccount();
  const skipRated = account.data?.skipRatedSeriesBooks ?? false;
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
  const remaining = queue.filter((id) => {
    const listened = byId.get(id);
    return listened !== undefined && !(skipRated && listened.series?.rated);
  });
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
    <div className="space-y-4">
      {toGo > 0 && (
        <p className="text-right text-sm text-muted">
          {toGo} {toGo === 1 ? "book" : "books"} to go
        </p>
      )}

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
      {
        itemId: book.itemId,
        score: score ?? null,
        // A book recommended earlier may already have a note: keep it, and whether it's shared.
        note: book.myNote,
        recommended,
        noteShared: book.myNoteShared,
      },
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
        {book.series && <SeriesLine series={book.series} />}
      </div>

      <div className="mt-3 space-y-2">
        <ScoreSlider value={score} onChange={setScore} disabled={rate.isPending} />
        {score !== undefined && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => setScore(undefined)} disabled={rate.isPending}>
              Clear score
            </Button>
          </div>
        )}
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

/** How my rating of a series reads: its score, that I recommend it, or both. */
function seriesRatingText(series: ListenedSeries): string {
  if (!series.rated) return "Series not rated yet";
  if (series.myScore != null)
    return `You gave the series ${series.myScore}/10${series.recommended ? " and recommend it" : ""}`;
  return "You recommend the series";
}

/**
 * Which series a book is in, its number there, and my rating of the series, with a way to rate the
 * series in a sheet without leaving the queue.
 */
function SeriesLine({ series }: { series: ListenedSeries }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
      <p className="inline-flex items-center gap-1 font-medium">
        <Library aria-hidden="true" className="h-4 w-4 text-accent" />
        Series: {series.name}
        {series.sequence && <span className="text-muted"> · Book {series.sequence}</span>}
      </p>
      <p className="text-xs text-muted">
        {seriesRatingText(series)} ·{" "}
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => setOpen(true)}
          className="font-medium text-accent underline-offset-2 hover:underline"
        >
          {series.rated ? "Change" : "Rate the series"}
        </button>
      </p>
      {open && (
        <Sheet title={series.name} onClose={() => setOpen(false)}>
          <SeriesPanel seriesId={series.seriesId} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </div>
  );
}

/** A series of books I've listened to, as the Series queue shows it. */
interface StartedSeries {
  seriesId: string;
  name: string;
  authors: string;
  /** The earliest book in it I've listened to: the cover until ABS says which is book 1. */
  firstItemId: string;
  listened: number;
}

/** The series of books I've listened to that I haven't rated, most recently listened first. */
function startedSeries(books: ListenedBook[]): StartedSeries[] {
  const found = new Map<string, StartedSeries & { first: number }>();
  for (const book of books) {
    const series = book.series;
    if (!series || series.rated) continue;
    const place = Number.parseFloat(series.sequence ?? "");
    const order = Number.isNaN(place) ? Number.POSITIVE_INFINITY : place;
    const seen = found.get(series.seriesId);
    if (!seen) {
      found.set(series.seriesId, {
        seriesId: series.seriesId,
        name: series.name,
        authors: book.authors,
        firstItemId: book.itemId,
        listened: 1,
        first: order,
      });
    } else {
      seen.listened += 1;
      if (order < seen.first) {
        seen.first = order;
        seen.firstItemId = book.itemId;
      }
    }
  }
  return [...found.values()];
}

/**
 * The series of books I've listened to that I haven't rated yet, one card at a time, the same way
 * as books: a score or the thumbs up turns Skip into Submit; Skip sends it to the back.
 */
function SeriesQueue() {
  const listening = useMyListening();
  const [queue, setQueue] = useState<string[] | undefined>(undefined);
  const [skipped, setSkipped] = useState<ReadonlySet<string>>(new Set());

  // Fixed when it first arrives, so a refetch after each save doesn't reshuffle it.
  useEffect(() => {
    if (queue === undefined && listening.data)
      setQueue(startedSeries(listening.data).map((s) => s.seriesId));
  }, [queue, listening.data]);

  if (listening.isPending) return <LoadingState rows={1} label="Loading your series" />;
  if (listening.isError)
    return <ErrorState error={listening.error} onRetry={() => listening.refetch()} />;
  if (queue === undefined) return null;

  // A series rated since, here or elsewhere, drops out.
  const byId = new Map(startedSeries(listening.data).map((s) => [s.seriesId, s]));
  const remaining = queue.filter((id) => byId.has(id));
  const current = remaining[0];
  const allSkipped = current !== undefined && skipped.has(current);
  const series = current === undefined ? undefined : byId.get(current);
  const toGo = remaining.filter((id) => !skipped.has(id)).length;

  function skip(seriesId: string) {
    setQueue((q) => [...(q ?? []).filter((id) => id !== seriesId), seriesId]);
    setSkipped((s) => new Set(s).add(seriesId));
  }

  return (
    <div className="space-y-4">
      {toGo > 0 && <p className="text-right text-sm text-muted">{toGo} series to go</p>}

      {remaining.length === 0 && (
        <EmptyState
          title={queue.length > 0 ? "All series rated" : "No series to rate"}
          action={
            <Link to="/me/ratings" search={{ sort: "newest" }} className="text-sm">
              See your ratings
            </Link>
          }
        >
          Every series you've started a book of has a score or a recommendation. New ones show up
          here as you listen.
        </EmptyState>
      )}

      {allSkipped && (
        <EmptyState
          title="That's every series you've started"
          action={
            <Button onClick={() => setSkipped(new Set())}>
              Go through the {remaining.length} skipped
            </Button>
          }
        >
          You skipped {remaining.length === 1 ? "one" : remaining.length}. Want another look?
        </EmptyState>
      )}

      {series && !allSkipped && (
        <SeriesRateCard
          key={series.seriesId}
          series={series}
          onSkip={() => skip(series.seriesId)}
        />
      )}
    </div>
  );
}

/** One series: book 1's cover with pages stacked behind it, a score, a thumbs up, and Skip. */
function SeriesRateCard({ series, onSkip }: { series: StartedSeries; onSkip: () => void }) {
  const rate = useRateSeries();
  // ABS's book 1 and how many books it has; until it answers, the earliest one I've listened to.
  const detail = useSeries(series.seriesId);
  const cover = detail.data?.firstItemId ?? series.firstItemId;
  const total = detail.data?.books;
  const account = useAccount();
  const [recommended, setRecommended] = useState(false);
  const [score, setScore] = useState<number | undefined>(undefined);
  const submits = score !== undefined || recommended;

  function submit() {
    rate.mutate({
      itemId: series.seriesId,
      score: score ?? null,
      note: "",
      recommended,
      noteShared: account.data?.shareNotesByDefault ?? false,
    });
  }

  return (
    <article
      aria-label={series.name}
      className="rounded-card border border-border bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="relative mx-auto w-[min(16rem,24dvh)] pt-2 pr-2 sm:w-[min(16rem,30dvh)]">
        <div
          aria-hidden="true"
          className="absolute top-0 right-0 bottom-2 left-2 rounded-lg border border-border bg-surface-2 shadow-card"
        />
        <div
          aria-hidden="true"
          className="absolute top-1 right-1 bottom-1 left-1 rounded-lg border border-border bg-surface shadow-card"
        />
        <div className="relative overflow-hidden rounded-lg shadow-card">
          <BookCover itemId={cover} title={series.name} size="fill" />
        </div>
      </div>
      <div className="mt-3 text-center">
        <h2 className="line-clamp-2 break-words text-base font-semibold leading-snug sm:text-lg">
          {series.name}
        </h2>
        <p className="mt-0.5 text-muted">{series.authors || "Unknown author"}</p>
        <p className="mt-1 text-xs text-muted">
          Series · you've listened to {series.listened}
          {total ? ` of its ${total} books` : ` ${series.listened === 1 ? "book" : "books"} of it`}
        </p>
      </div>

      <div className="mt-3 space-y-2">
        <ScoreSlider value={score} onChange={setScore} disabled={rate.isPending} />
        {score !== undefined && (
          <div className="text-center">
            <Button variant="ghost" onClick={() => setScore(undefined)} disabled={rate.isPending}>
              Clear score
            </Button>
          </div>
        )}
        {rate.isError && (
          <p role="alert" className="text-center text-sm text-danger">
            Couldn't save that: {messageFor(rate.error)}
          </p>
        )}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <RecommendButton
              size="lg"
              on={recommended}
              onChange={setRecommended}
              label={`Recommend ${series.name}`}
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
