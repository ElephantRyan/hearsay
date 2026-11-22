import { Link } from "@tanstack/react-router";
import { ListChecks, ListPlus } from "lucide-react";
import { useAddToUpNext, useUpNext } from "../../api/hooks";
import { messageFor } from "../../components/domain/StateViews";

interface Props {
  itemId: string;
  title: string;
  /** "card" is a small chip over a cover; "full" a labelled button, as on a book's page. */
  variant?: "card" | "full";
}

/**
 * Puts a book at the end of my Up next list. Once it's there, the button says so and links to the
 * list instead, so a second tap can't add it twice or take it off by accident.
 */
export function UpNextButton({ itemId, title, variant = "card" }: Props) {
  const list = useUpNext();
  const add = useAddToUpNext();
  const onList = list.data?.some((book) => book.itemId === itemId) ?? false;

  if (variant === "full") {
    const full =
      "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-border px-4 text-sm font-medium no-underline hover:bg-surface-2";
    return (
      <div>
        {onList ? (
          <Link to="/me/up-next" className={`${full} text-accent`}>
            <ListChecks aria-hidden="true" className="h-4 w-4" />
            On your Up next list
          </Link>
        ) : (
          <button
            type="button"
            className={`${full} text-text disabled:opacity-60`}
            disabled={add.isPending || list.isPending}
            onClick={() => add.mutate(itemId)}
          >
            <ListPlus aria-hidden="true" className="h-4 w-4" />
            {add.isPending ? "Adding…" : "Add to Up next"}
          </button>
        )}
        {add.isError && (
          <p role="alert" className="mt-1 text-sm text-danger">
            Couldn't add it: {messageFor(add.error)}
          </p>
        )}
      </div>
    );
  }

  const chip =
    "inline-flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm text-white";
  return onList ? (
    <Link
      to="/me/up-next"
      aria-label={`${title} is on your Up next list`}
      title="On your Up next list"
      className="group/btn inline-flex min-h-10 min-w-10 items-center justify-center no-underline"
    >
      <span className={`${chip} bg-accent text-accent-text`}>
        <ListChecks aria-hidden="true" className="h-4 w-4" />
      </span>
    </Link>
  ) : (
    <button
      type="button"
      aria-label={`Add ${title} to Up next`}
      title={add.isError ? `Couldn't add it: ${messageFor(add.error)}` : "Add to Up next"}
      disabled={add.isPending || list.isPending}
      onClick={() => add.mutate(itemId)}
      className="group/btn inline-flex min-h-10 min-w-10 items-center justify-center disabled:opacity-60"
    >
      <span className={`${chip} bg-black/55 group-hover/btn:bg-black/75`}>
        <ListPlus aria-hidden="true" className="h-4 w-4" />
      </span>
    </button>
  );
}
