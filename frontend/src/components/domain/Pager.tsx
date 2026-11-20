import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../ui/Button";

interface Props {
  /** Zero-based, as the API counts. */
  page: number;
  pageCount: number;
  onPage: (page: number) => void;
}

/** Previous / next with "Page 3 of 47". Pages show from 1; the API's start at 0. */
export function Pager({ page, pageCount, onPage }: Props) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3">
      <Button variant="secondary" disabled={page <= 0} onClick={() => onPage(page - 1)}>
        <ChevronLeft aria-hidden="true" className="h-4 w-4" />
        Previous
      </Button>
      <p className="text-sm text-muted" aria-live="polite">
        Page {page + 1} of {pageCount}
      </p>
      <Button variant="secondary" disabled={page >= pageCount - 1} onClick={() => onPage(page + 1)}>
        Next
        <ChevronRight aria-hidden="true" className="h-4 w-4" />
      </Button>
    </nav>
  );
}
