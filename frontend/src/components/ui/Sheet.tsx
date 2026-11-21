import { X } from "lucide-react";
import { type ReactNode, useEffect, useId, useRef } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A modal panel: a bottom sheet on a phone, a side panel from the right on a wider screen
 * (FRONTEND.md section 5). Built on the native `<dialog>`, which keeps focus inside, closes on
 * Escape and hides the page from assistive technology. Mounted means open; a click on the
 * backdrop closes it too.
 */
export function Sheet({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    // Closing here is unmounting, not the person closing it, so no close handler is wired to the
    // element: React mounts twice in development, and one would shut the dialog as it opened.
    return () => dialog.close();
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is on the backdrop only; Escape is its keyboard way out.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-0 mt-auto max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border bg-surface p-0 text-text shadow-card backdrop:bg-black/40 md:mt-0 md:ml-auto md:h-full md:max-h-none md:w-[28rem] md:rounded-none md:rounded-l-2xl"
    >
      <div className="sticky top-0 flex items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3">
        <h2 id={titleId} className="min-w-0 truncate text-base font-semibold">
          {title}
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-text"
        >
          <X aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
      <div className="p-4">{children}</div>
    </dialog>
  );
}
