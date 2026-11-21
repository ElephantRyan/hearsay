import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
  /** A ranked list is an ordered list, so a screen reader announces the positions. */
  ordered?: boolean;
  dimmed?: boolean;
}

/** Book cards in a grid: two across on a phone, up to six on a wide screen. */
export function BookGrid({ children, label, ordered, dimmed }: Props) {
  const className = `grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 ${dimmed ? "opacity-60" : ""}`;
  return ordered ? (
    <ol aria-label={label} className={className}>
      {children}
    </ol>
  ) : (
    <ul aria-label={label} className={className}>
      {children}
    </ul>
  );
}

/** Book cards in one row that scrolls sideways, as a shelf on the home screen. */
export function Shelf({ children, label }: { children: ReactNode; label: string }) {
  return (
    <ul
      aria-label={label}
      className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [&>li]:w-32 [&>li]:shrink-0 [&>li]:snap-start sm:[&>li]:w-40"
    >
      {children}
    </ul>
  );
}
