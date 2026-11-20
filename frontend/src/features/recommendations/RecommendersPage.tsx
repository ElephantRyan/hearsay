import { useRecommenders } from "../../api/hooks";
import { RecommenderChip } from "../../components/domain/RecommenderChip";
import { EmptyState, ErrorState, LoadingState } from "../../components/domain/StateViews";

export function RecommendersPage() {
  const people = useRecommenders();
  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Recommenders</h1>
      {people.isPending && <LoadingState rows={3} />}
      {people.isError && <ErrorState error={people.error} onRetry={() => people.refetch()} />}
      {people.data && people.data.length === 0 && (
        <EmptyState title="No one has published a list yet">
          Lists appear here once someone recommends a book.
        </EmptyState>
      )}
      {people.data && people.data.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {people.data.map((person) => (
            <li key={person.userId}>
              <RecommenderChip
                userId={person.userId}
                username={person.username}
                count={person.count}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
