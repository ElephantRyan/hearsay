import { useId } from "react";
import type { Library } from "../../api/types";

interface Props {
  libraries: Library[];
  value: string;
  onChange: (libraryId: string) => void;
}

/** Shown only when ABS has more than one library; with one there is nothing to pick. */
export function LibraryPicker({ libraries, value, onChange }: Props) {
  const id = useId();
  if (libraries.length < 2) return null;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        Library
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
      >
        {libraries.map((library) => (
          <option key={library.id} value={library.id}>
            {library.name}
          </option>
        ))}
      </select>
    </div>
  );
}
