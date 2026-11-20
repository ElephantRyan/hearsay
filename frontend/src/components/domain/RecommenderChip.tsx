import { Link } from "@tanstack/react-router";
import { initialsOf } from "../../lib/format";

interface Props {
  userId: string;
  username: string;
  count?: number;
}

export function RecommenderChip({ userId, username, count }: Props) {
  return (
    <Link
      to="/recommendations/users/$userId"
      params={{ userId }}
      className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border bg-surface py-1 pr-3 pl-1 text-sm no-underline hover:bg-surface-2"
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
      >
        {initialsOf(username)}
      </span>
      <span className="font-medium">{username}</span>
      {count !== undefined && <span className="text-muted">{count}</span>}
    </Link>
  );
}
