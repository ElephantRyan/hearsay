import { BookOpen } from "lucide-react";
import { useState } from "react";
import { coverUrl } from "../../lib/format";

interface Props {
  itemId: string;
  title: string;
  size?: "sm" | "md" | "lg";
}

const sizes = { sm: "w-14", md: "w-20", lg: "w-40" } as const;

/** A fixed 1:1 cover (audiobooks are square), with placeholder art when ABS has none. */
export function BookCover({ itemId, title, size = "md" }: Props) {
  const src = coverUrl(itemId);
  const [failed, setFailed] = useState(false);
  const showImage = src !== undefined && !failed;

  return (
    <div
      className={`${sizes[size]} aspect-square shrink-0 overflow-hidden rounded-lg border border-border bg-surface-2`}
    >
      {showImage ? (
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          role="img"
          aria-label={`No cover for ${title}`}
          className="flex h-full w-full items-center justify-center text-muted"
        >
          <BookOpen aria-hidden="true" className="h-1/3 w-1/3" />
        </div>
      )}
    </div>
  );
}
