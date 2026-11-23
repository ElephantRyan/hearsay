import { Link } from "@tanstack/react-router";
import { Library } from "lucide-react";
import type { ReactNode } from "react";
import { BookCover } from "./BookCover";

interface Props {
  seriesId: string;
  name: string;
  authors: string;
  /** How many books the series has. */
  books: number;
  /** Book 1, whose cover stands for the series. */
  firstItemId: string;
  /** Over the cover's top-left corner: a rank. */
  badge?: ReactNode;
  /** A line under the author: a score, a note. */
  meta?: ReactNode;
}

/**
 * A recommended series as one card: book 1's cover with two pages stacked behind it, so it reads
 * as more than one book at a glance, and "Series · 7 books" under the name. It opens the series.
 */
export function SeriesCard({ seriesId, name, authors, books, firstItemId, badge, meta }: Props) {
  return (
    <li className="relative min-w-0">
      <Link
        to="/browse"
        search={{ series: seriesId, seriesName: name }}
        aria-label={`${name}, a series of ${books} ${books === 1 ? "book" : "books"}`}
        className="group block text-text no-underline"
      >
        <div className="relative pt-2 pr-2">
          {/* The books underneath: two offset pages behind the cover. */}
          <div
            aria-hidden="true"
            className="absolute top-0 right-0 bottom-2 left-2 rounded-lg border border-border bg-surface-2 shadow-card"
          />
          <div
            aria-hidden="true"
            className="absolute top-1 right-1 bottom-1 left-1 rounded-lg border border-border bg-surface shadow-card"
          />
          <div className="relative overflow-hidden rounded-lg shadow-card transition-transform group-hover:-translate-y-0.5">
            <BookCover itemId={firstItemId} title={name} size="fill" />
          </div>
        </div>
        <p className="mt-2 line-clamp-2 break-words text-sm font-medium leading-snug">{name}</p>
        <p className="truncate text-xs text-muted">{authors || "Unknown author"}</p>
        <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-accent">
          <Library aria-hidden="true" className="h-3.5 w-3.5" />
          Series · {books} {books === 1 ? "book" : "books"}
        </p>
      </Link>
      {meta && <div className="mt-1 text-xs text-muted">{meta}</div>}
      {badge && <div className="pointer-events-none absolute top-4 left-2">{badge}</div>}
    </li>
  );
}
