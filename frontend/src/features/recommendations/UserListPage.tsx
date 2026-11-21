import { useParams } from "@tanstack/react-router";
import { usePicks } from "../../api/hooks";
import { BookCard } from "../../components/domain/BookCard";
import { BookGrid } from "../../components/domain/BookGrid";
import { RatingBadge } from "../../components/domain/RatingBadge";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";
import { listTitle } from "../../lib/format";
import { RateButton } from "../rating/RateButton";

/** One person's list: "Ryan recommends", best first, with their notes. */
export function UserListPage() {
  const { userId } = useParams({ from: "/app/recommendations/users/$userId" });
  const picks = usePicks(userId);
  const name = picks.data?.[0]?.username;

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">{name ? listTitle(name) : "Recommendations"}</h1>
      {picks.isPending && <LoadingState />}
      {picks.isError && <ErrorState error={picks.error} onRetry={() => picks.refetch()} />}
      {picks.data && picks.data.length === 0 && (
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
    </div>
  );
}
