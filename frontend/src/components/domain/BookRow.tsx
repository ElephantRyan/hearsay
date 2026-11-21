import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BookCover } from "./BookCover";

interface Props {
  itemId: string;
  title: string;
  authors: string;
  /** Right-hand content: a badge, a position, an action. */
  aside?: ReactNode;
  /** A line under the author: a note, who recommended it. */
  detail?: ReactNode;
  position?: number;
  /** A control of its own beside the link (a link can't hold a button), and a line under both. */
  action?: ReactNode;
  footer?: ReactNode;
}

/** One book in a list. The row is the link to the book's page, except its `action`. */
export function BookRow({
  itemId,
  title,
  authors,
  aside,
  detail,
  position,
  action,
  footer,
}: Props) {
  return (
    <li className="rounded-card border border-border bg-surface shadow-card">
      <div className="flex items-center">
        <Link
          to="/items/$itemId"
          params={{ itemId }}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-card p-3 no-underline hover:bg-surface-2"
        >
          {position !== undefined && (
            <span
              aria-hidden="true"
              className="w-6 shrink-0 text-center text-sm font-semibold tabular-nums text-muted"
            >
              {position}
            </span>
          )}
          <BookCover itemId={itemId} title={title} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="line-clamp-2 break-words font-medium leading-snug">{title}</p>
            <p className="truncate text-sm text-muted">{authors}</p>
            {detail && <div className="mt-1 text-sm text-muted">{detail}</div>}
          </div>
          {aside && <div className="shrink-0">{aside}</div>}
        </Link>
        {action && <div className="shrink-0 pr-3">{action}</div>}
      </div>
      {footer && <div className="px-3 pb-3">{footer}</div>}
    </li>
  );
}
