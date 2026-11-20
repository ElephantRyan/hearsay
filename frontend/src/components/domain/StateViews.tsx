import { CircleAlert, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { ApiError } from "../../api/errors";
import { Button } from "../ui/Button";

const PLACEHOLDERS = ["first", "second", "third", "fourth", "fifth", "sixth"];

/** Skeleton rows rather than a lone spinner (FRONTEND.md section 7). */
export function LoadingState({ rows = 4, label = "Loading" }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-3">
      {PLACEHOLDERS.slice(0, rows).map((name) => (
        <div
          key={name}
          className="flex animate-pulse gap-3 rounded-card border border-border bg-surface p-3"
        >
          <div className="h-14 w-14 rounded-lg bg-surface-2" />
          <div className="flex-1 space-y-2 py-1">
            <div className="h-4 w-2/3 rounded bg-surface-2" />
            <div className="h-3 w-1/3 rounded bg-surface-2" />
          </div>
        </div>
      ))}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-card border border-dashed border-border px-6 py-12 text-center">
      <Inbox aria-hidden="true" className="mb-3 h-8 w-8 text-muted" />
      <h2 className="text-base font-semibold">{title}</h2>
      {children && <p className="mt-1 max-w-sm text-sm text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Maps a failure to words a person can act on. */
export function messageFor(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 503) return `${error.message}. Try again in a moment.`;
    return error.message;
  }
  return "Something went wrong reaching the server. Check your connection and try again.";
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-center rounded-card border border-danger/40 bg-surface px-6 py-10 text-center"
    >
      <CircleAlert aria-hidden="true" className="mb-3 h-8 w-8 text-danger" />
      <p className="max-w-sm text-sm">{messageFor(error)}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
