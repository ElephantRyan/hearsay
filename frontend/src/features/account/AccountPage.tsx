import { type FormEvent, useEffect, useId, useState } from "react";
import { useAccount, useSaveAccount } from "../../api/hooks";
import { ErrorState, LoadingState, messageFor } from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";

/** The most characters a display name may have, as the server checks (CheckDisplayName.fiig). */
const MAX_NAME = 40;

/**
 * My settings: the name everyone else sees, beside my ratings, on my list, on linked servers, and
 * as my Audiobookshelf collection ("<name> Recommends"). The username I sign in with stays as ABS
 * has it.
 */
export function AccountPage() {
  const account = useAccount();
  const save = useSaveAccount();
  const nameId = useId();
  const [name, setName] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (account.data) setName(account.data.displayName);
  }, [account.data]);

  if (account.isPending) return <LoadingState rows={1} label="Loading your account" />;
  if (account.isError)
    return <ErrorState error={account.error} onRetry={() => account.refetch()} />;

  const trimmed = name.trim();
  const unchanged = trimmed === account.data.displayName;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSaved(false);
    save.mutate({ displayName: trimmed }, { onSuccess: () => setSaved(true) });
  }

  return (
    <div className="mx-auto max-w-md space-y-5">
      <h1 className="text-xl font-semibold">My settings</h1>

      <form
        onSubmit={onSubmit}
        noValidate
        className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <div>
          <label htmlFor={nameId} className="mb-1 block text-sm font-medium">
            Display name
          </label>
          <input
            id={nameId}
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            maxLength={MAX_NAME}
            autoComplete="nickname"
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 text-base"
          />
          <p className="mt-1 text-xs text-muted">
            What everyone else sees: beside your ratings, on your list, and on linked servers.
          </p>
          {trimmed !== "" && (
            <p className="mt-2 text-sm">
              Your Audiobookshelf collection:{" "}
              <span className="font-medium">{trimmed} Recommends</span>
            </p>
          )}
        </div>

        {save.isError && (
          <p role="alert" className="text-sm text-danger">
            {messageFor(save.error).replace(/^displayName /, "The display name ")}
          </p>
        )}
        {saved && (
          <p role="status" className="text-sm text-muted">
            Saved. Your collection in Audiobookshelf is renamed at the next sync, within the hour.
          </p>
        )}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={save.isPending || unchanged || trimmed === ""}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {trimmed !== account.data.username && (
            <Button variant="secondary" onClick={() => setName(account.data.username)}>
              Use my username
            </Button>
          )}
        </div>
      </form>

      <p className="text-sm text-muted">
        You sign in as <span className="font-medium text-text">{account.data.username}</span>, your
        Audiobookshelf username. That doesn't change.
      </p>

      <section
        aria-labelledby="preferences-heading"
        className="space-y-4 rounded-card border border-border bg-surface p-4 shadow-card"
      >
        <h2 id="preferences-heading" className="text-base font-semibold">
          Preferences
        </h2>
        <Preference
          label="Share my notes by default"
          hint="Ticks “Share my note with everyone” for you on each new rating. You can still untick it for any one note."
          checked={account.data.shareNotesByDefault}
          disabled={save.isPending}
          onChange={(on) => save.mutate({ shareNotesByDefault: on })}
        />
        <Preference
          label="On the Rate tab, skip books from series I've rated"
          hint="Once you've rated or recommended a series, its books stop coming up to rate one by one."
          checked={account.data.skipRatedSeriesBooks}
          disabled={save.isPending}
          onChange={(on) => save.mutate({ skipRatedSeriesBooks: on })}
        />
      </section>
    </div>
  );
}

/** One setting, saved as soon as it's ticked or unticked. */
function Preference({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled: boolean;
  onChange: (on: boolean) => void;
}) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
      />
      <label htmlFor={id} className="text-sm">
        <span className="font-medium">{label}</span>
        <span className="block text-muted">{hint}</span>
      </label>
    </div>
  );
}
