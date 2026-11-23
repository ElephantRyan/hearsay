import { SquarePen } from "lucide-react";
import { useState } from "react";
import { useItem, useMe } from "../../api/hooks";
import { ErrorState, LoadingState } from "../../components/domain/StateViews";
import { Sheet } from "../../components/ui/Sheet";
import { RatingFormPanel } from "./RatingFormPanel";

interface Props {
  itemId: string;
  title: string;
}

/**
 * Rate a book from wherever it is listed (FRONTEND.md section 6, flow 1): opens the rating sheet,
 * which loads my current rating, and closes once it is saved or removed.
 */
export function RateButton({ itemId, title }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-label={`Rate ${title}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className="group/btn inline-flex min-h-10 min-w-10 items-center justify-center"
      >
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm group-hover/btn:bg-black/75">
          <SquarePen aria-hidden="true" className="h-4 w-4" />
        </span>
      </button>
      {open && (
        <Sheet title={title} onClose={() => setOpen(false)}>
          <RateSheetBody itemId={itemId} onDone={() => setOpen(false)} />
        </Sheet>
      )}
    </>
  );
}

function RateSheetBody({ itemId, onDone }: { itemId: string; onDone: () => void }) {
  const item = useItem(itemId);
  const me = useMe();

  if (item.isPending) return <LoadingState rows={1} label="Loading your rating" />;
  if (item.isError) return <ErrorState error={item.error} onRetry={() => item.refetch()} />;

  const mine = item.data.ratings.find((row) => row.userId === me.data?.userId);
  return (
    <RatingFormPanel
      itemId={itemId}
      existing={
        mine && {
          score: mine.score ?? null,
          note: mine.note,
          recommended: mine.recommended,
          noteShared: mine.noteShared,
        }
      }
      onDone={onDone}
    />
  );
}
