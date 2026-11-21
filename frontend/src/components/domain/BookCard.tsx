import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { BookCover } from "./BookCover";

interface Props {
  itemId: string;
  title: string;
  authors: string;
  /** Over the cover's top-left corner: a rank, a score. */
  badge?: ReactNode;
  /** Over the cover's top-right corner, outside the link (a link can't hold a button). */
  action?: ReactNode;
  /** A line under the author: a note, a score. */
  meta?: ReactNode;
  /** How far through, 0 to 100, as a bar along the cover's foot. */
  percent?: number;
}

/**
 * One book as a poster: the cover leads, title and author under it. The cover and text are the
 * link to the book's page; `action` sits over the cover beside it.
 */
export function BookCard({ itemId, title, authors, badge, action, meta, percent }: Props) {
  return (
    <li className="relative min-w-0">
      <Link to="/items/$itemId" params={{ itemId }} className="group block text-text no-underline">
        <div className="relative overflow-hidden rounded-lg shadow-card transition-transform group-hover:-translate-y-0.5">
          <BookCover itemId={itemId} title={title} size="fill" />
          {percent !== undefined && (
            <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/40">
              <div className="h-full bg-accent" style={{ width: `${Math.min(100, percent)}%` }} />
            </div>
          )}
        </div>
        <p className="mt-2 line-clamp-2 break-words text-sm font-medium leading-snug">{title}</p>
        <p className="truncate text-xs text-muted">{authors || "Unknown author"}</p>
      </Link>
      {meta && <div className="mt-1 text-xs text-muted">{meta}</div>}
      {badge && <div className="pointer-events-none absolute top-2 left-2">{badge}</div>}
      {action && <div className="absolute top-0 right-0 flex flex-col">{action}</div>}
    </li>
  );
}
