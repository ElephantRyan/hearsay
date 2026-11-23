import { ApiError } from "../../api/errors";
import { useMe, useSeries } from "../../api/hooks";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { RecommenderChip } from "../../components/domain/RecommenderChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { formatDate } from "../../lib/format";
import { RatingFormPanel } from "../rating/RatingFormPanel";

/**
 * The top of a series' own list: how many recommend it and their average, my rating of the series
 * as a whole (recommending it puts its book 1 in my collection, in place of its other books), and
 * what others said of it.
 */
export function SeriesPanel({ seriesId, onDone }: { seriesId: string; onDone?: () => void }) {
  const series = useSeries(seriesId);
  const me = useMe();

  if (series.isPending) return <LoadingState rows={1} label="Loading the series" />;
  if (series.isError) {
    if (series.error instanceof ApiError && series.error.status === 404) {
      return (
        <EmptyState title="This series isn't in Audiobookshelf any more">
          It was removed there, so Hearsay has removed it too, with its ratings.
        </EmptyState>
      );
    }
    return <ErrorState error={series.error} onRetry={() => series.refetch()} />;
  }

  const { count, average, ratings } = series.data;
  const mine = ratings.find((row) => row.userId === me.data?.userId);
  const others = ratings.filter((row) => row.userId !== me.data?.userId);

  return (
    <div className="space-y-4">
      <div>
        {count > 0 ? (
          <RatingBadge score={average} count={count} />
        ) : (
          <p className="text-sm text-muted">Nobody has recommended this series yet.</p>
        )}
      </div>

      <section
        aria-labelledby="series-rating-heading"
        className="rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 id="series-rating-heading" className="mb-1 text-base font-semibold">
          {mine ? "Your rating of the series" : "Rate this series"}
        </h2>
        <p className="mb-4 text-sm text-muted">
          For the series as a whole. Recommending it lists it as one, starting at book 1, in place
          of any of its books you recommended.
        </p>
        <RatingFormPanel
          key={mine ? `${mine.updatedAt}` : "new"}
          itemId={seriesId}
          series
          onDone={onDone}
          existing={
            mine && {
              score: mine.score ?? null,
              note: mine.note,
              recommended: mine.recommended,
              noteShared: mine.noteShared,
            }
          }
        />
      </section>

      {others.length > 0 && (
        <section aria-labelledby="series-others-heading">
          <h2 id="series-others-heading" className="mb-3 text-base font-semibold">
            What others said of the series
          </h2>
          <ul className="space-y-3">
            {others.map((row) => (
              <li
                key={row.userId}
                className="rounded-card border border-border bg-surface p-3 shadow-card"
              >
                <div className="flex items-center justify-between gap-3">
                  <RecommenderChip userId={row.userId} username={row.username} />
                  {row.recommended && <RatingBadge score={row.score} />}
                </div>
                {row.note && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm">{row.note}</p>
                )}
                <p className="mt-2 text-xs text-muted">{formatDate(row.updatedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
