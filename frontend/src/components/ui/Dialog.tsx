import { type ReactNode, useEffect, useId, useRef } from "react";

interface Props {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A small centred modal for a question that needs an answer, such as "save this score?". Built on
 * the native `<dialog>` like the Sheet: focus stays inside, Escape and the backdrop close it.
 * Mounted means open.
 */
export function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    dialog.showModal();
    return () => dialog.close();
  }, []);

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: the click is on the backdrop only; Escape is its keyboard way out.
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-border bg-surface p-0 text-text shadow-card backdrop:bg-black/50"
    >
      <div className="space-y-4 p-5">
        <h2 id={titleId} className="text-base font-semibold">
          {title}
        </h2>
        {children}
      </div>
    </dialog>
  );
}
