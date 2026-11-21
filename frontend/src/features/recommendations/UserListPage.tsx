import { useParams } from "@tanstack/react-router";
import { usePicks } from "../../api/hooks";
import { BookRow } from "../../components/domain/BookRow";
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
        <ol className="space-y-3">
          {picks.data.map((pick, index) => (
            <BookRow
              key={pick.itemId}
              position={index + 1}
              itemId={pick.itemId}
              title={pick.title}
              action={<RateButton itemId={pick.itemId} title={pick.title} />}
              authors={pick.authors}
              detail={pick.note ? <span className="line-clamp-2">{pick.note}</span> : undefined}
              aside={<RatingBadge score={pick.score} />}
            />
          ))}
        </ol>
      )}
    </div>
  );
}
