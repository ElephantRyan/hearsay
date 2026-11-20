import type { TextareaHTMLAttributes } from "react";
import { forwardRef, useId } from "react";
import { MAX_NOTE, noteLength } from "../../lib/ratings";

interface Props extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value"> {
  value: string;
  error?: string | undefined;
}

/** A note with a live character count that agrees with the server's. */
export const NoteField = forwardRef<HTMLTextAreaElement, Props>(function NoteField(
  { value, error, ...rest },
  ref,
) {
  const id = useId();
  const used = noteLength(value);
  const over = used > MAX_NOTE;
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-medium">
        Note <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={3}
        value={value}
        aria-invalid={error || over ? "true" : undefined}
        aria-describedby={`${id}-count`}
        className="w-full resize-y rounded-lg border border-border bg-surface p-3 text-base"
        {...rest}
      />
      <div id={`${id}-count`} className="mt-1 flex justify-between text-xs">
        <span role={error ? "alert" : undefined} className="text-danger">
          {error}
        </span>
        <span className={over ? "font-medium text-danger" : "text-muted"}>
          {used}/{MAX_NOTE}
        </span>
      </div>
    </div>
  );
});
