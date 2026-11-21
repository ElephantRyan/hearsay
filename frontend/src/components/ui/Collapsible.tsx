import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

interface Props {
  /**
   * The heading, shown beside the chevron; it is also what opens and closes the section. The
   * chevron turns with its own <details> only, so a folded section inside an open one points shut.
   */
  title: ReactNode;
  defaultOpen?: boolean;
  /** Controls beside the title (a "Check again" button) that don't open or close it. */
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A section that folds away under its heading: the native <details>, so the keyboard and
 * screen readers know it already. Folding only hides; form fields inside keep their values.
 */
export function Collapsible({
  title,
  defaultOpen = true,
  action,
  className = "",
  children,
}: Props) {
  return (
    <details open={defaultOpen} className={className}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden">
        <span className="flex min-w-0 items-center gap-2">
          <ChevronRight
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-muted transition-transform [details[open]>summary>span>&]:rotate-90"
          />
          {title}
        </span>
        {action && (
          // A click on the action must not also fold the section.
          // biome-ignore lint/a11y/noStaticElementInteractions: only stops the summary's toggle; the action is its own button
          // biome-ignore lint/a11y/useKeyWithClickEvents: the action's own button handles the keyboard
          <span onClick={(event) => event.preventDefault()}>{action}</span>
        )}
      </summary>
      <div className="pt-3">{children}</div>
    </details>
  );
}
