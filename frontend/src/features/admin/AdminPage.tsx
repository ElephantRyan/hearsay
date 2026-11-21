import { CircleAlert, CircleCheck, CircleDashed, RefreshCw } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import {
  isAdmin,
  useAdminSettings,
  useAdminStatus,
  useLibraries,
  useMe,
  useRecommenders,
  useResetSetting,
  useSaveSettings,
  useSyncCollections,
} from "../../api/hooks";
import type {
  AdminSettings,
  SettingName,
  SettingsChange,
  SettingValue,
  SyncResult,
} from "../../api/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";

/**
 * The admin screen: whether Audiobookshelf answers, the settings this server runs with, and
 * the collections it writes into ABS. For Audiobookshelf admins only; the server refuses
 * everyone else too.
 */
export function AdminPage() {
  const me = useMe();
  if (!isAdmin(me.data?.userType)) {
    return (
      <EmptyState title="Only an admin can see this page">
        Settings are for Audiobookshelf admins. Ask the person who runs your server.
      </EmptyState>
    );
  }
  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>
      <StatusCard />
      <SettingsCard />
      <CollectionsCard />
    </div>
  );
}

function Card({
  title,
  id,
  action,
  children,
}: {
  title: string;
  id: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="rounded-card border border-border bg-surface p-4 shadow-card"
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={id} className="text-base font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

const absWords: Record<string, string> = {
  reachable: "Answering",
  unreachable: "Not answering",
  "not set up": "No address set",
};

function StatusCard() {
  const status = useAdminStatus();
  const id = useId();
  return (
    <Card
      title="Audiobookshelf"
      id={id}
      action={
        <Button
          variant="ghost"
          onClick={() => status.refetch()}
          disabled={status.isFetching}
          aria-label="Check again"
        >
          <RefreshCw
            aria-hidden="true"
            className={`h-4 w-4 ${status.isFetching ? "animate-spin" : ""}`}
          />
          <span className="hidden sm:inline">Check again</span>
        </Button>
      }
    >
      {status.isPending && <LoadingState rows={1} label="Checking Audiobookshelf" />}
      {status.isError && <ErrorState error={status.error} onRetry={() => status.refetch()} />}
      {status.data && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-muted">Server</dt>
          <dd className="flex items-center gap-1.5">
            <StatusIcon good={status.data.abs === "reachable"} />
            {absWords[status.data.abs] ?? status.data.abs}
          </dd>
          <dt className="text-muted">This app's account</dt>
          <dd className="flex min-w-0 items-center gap-1.5">
            <StatusIcon good={status.data.serviceAccount != null} />
            <span className="min-w-0 break-words">
              {status.data.serviceAccount
                ? `${status.data.serviceAccount} (${status.data.serviceAccountType})`
                : status.data.problem}
            </span>
          </dd>
        </dl>
      )}
      {status.data?.serviceAccount && !isAdmin(status.data.serviceAccountType ?? undefined) && (
        <p role="alert" className="mt-3 text-sm text-danger">
          This account isn't an Audiobookshelf admin, so the app can't read listening progress or
          match Authentik sign-ins. Use an admin account's token.
        </p>
      )}
    </Card>
  );
}

function StatusIcon({ good }: { good: boolean }) {
  return good ? (
    <CircleCheck aria-hidden="true" className="h-4 w-4 shrink-0 text-success" />
  ) : (
    <CircleAlert aria-hidden="true" className="h-4 w-4 shrink-0 text-danger" />
  );
}

function SettingsCard() {
  const settings = useAdminSettings();
  const id = useId();
  return (
    <Card title="Server settings" id={id}>
      {settings.isPending && <LoadingState rows={3} label="Loading settings" />}
      {settings.isError && <ErrorState error={settings.error} onRetry={() => settings.refetch()} />}
      {settings.data && <SettingsForm settings={settings.data} />}
    </Card>
  );
}

/** Saves only what changed. The token is never shown, so its box starts empty. */
function SettingsForm({ settings }: { settings: AdminSettings }) {
  const save = useSaveSettings();
  const urlId = useId();
  const tokenId = useId();
  const mirrorId = useId();
  const [url, setUrl] = useState(settings.absUrl.value ?? "");
  const [token, setToken] = useState("");
  const [mirror, setMirror] = useState(settings.mirrorEnabled.value === "true");
  const [notice, setNotice] = useState<string | null>(null);

  function changes(): SettingsChange {
    const change: SettingsChange = {};
    if (url.trim() !== (settings.absUrl.value ?? "")) change.absUrl = url;
    if (token.trim() !== "") change.serviceToken = token;
    if (mirror !== (settings.mirrorEnabled.value === "true")) change.mirrorEnabled = mirror;
    return change;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const change = changes();
    if (Object.keys(change).length === 0) {
      setNotice("Nothing has changed.");
      return;
    }
    setNotice(null);
    save.mutate(change, {
      onSuccess: (saved) => {
        setUrl(saved.absUrl.value ?? "");
        setToken("");
        setNotice("Saved.");
      },
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <div>
        <label htmlFor={urlId} className="mb-1 block text-sm font-medium">
          Audiobookshelf address
        </label>
        <input
          id={urlId}
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="https://audiobooks.example.com"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
        />
        <Source name="absUrl" setting={settings.absUrl} variable="ABS_URL" />
      </div>

      <div>
        <label htmlFor={tokenId} className="mb-1 block text-sm font-medium">
          Audiobookshelf token
        </label>
        <input
          id={tokenId}
          type="password"
          autoComplete="off"
          placeholder={
            settings.serviceToken.source === "unset" ? "Paste a token" : "Leave empty to keep it"
          }
          value={token}
          onChange={(event) => setToken(event.target.value)}
          className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
        />
        <p className="mt-1 text-xs text-muted">
          An API token of an Audiobookshelf admin account. The app uses it to look up books, read
          listening progress, and write collections. It is never shown again once saved.
        </p>
        <Source name="serviceToken" setting={settings.serviceToken} variable="ABS_SERVICE_TOKEN" />
      </div>

      <div>
        <div className="flex items-start gap-3">
          <input
            id={mirrorId}
            type="checkbox"
            checked={mirror}
            onChange={(event) => setMirror(event.target.checked)}
            className="mt-1 h-5 w-5 shrink-0 accent-[var(--color-accent)]"
          />
          <label htmlFor={mirrorId} className="text-sm">
            <span className="font-medium">
              Write recommendation collections into Audiobookshelf
            </span>
            <span className="block text-muted">
              Each person's recommended books become a collection there. The app only ever creates,
              changes and removes its own collections.
            </span>
          </label>
        </div>
        <Source name="mirrorEnabled" setting={settings.mirrorEnabled} variable="MIRROR_ENABLED" />
      </div>

      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(save.error)}
        </p>
      )}
      {notice && (
        <p role="status" className="text-sm text-muted">
          {notice}
        </p>
      )}
      <Button type="submit" className="w-full sm:w-auto" disabled={save.isPending}>
        {save.isPending ? "Saving…" : "Save settings"}
      </Button>
    </form>
  );
}

/** Where a setting's value comes from, with a way back to the environment's. */
function Source({
  name,
  setting,
  variable,
}: {
  name: SettingName;
  setting: SettingValue;
  variable: string;
}) {
  const reset = useResetSetting();
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted">
      {setting.source === "saved" && (
        <>
          <span>Saved in this app.</span>
          <button
            type="button"
            onClick={() => reset.mutate(name)}
            disabled={reset.isPending}
            className="min-h-11 underline hover:text-text sm:min-h-0"
          >
            Use {variable} instead
          </button>
        </>
      )}
      {setting.source === "environment" && <span>From {variable} on the server.</span>}
      {setting.source === "unset" && <span>Not set.</span>}
      {reset.isError && (
        <span role="alert" className="text-danger">
          {messageFor(reset.error)}
        </span>
      )}
    </div>
  );
}

function CollectionsCard() {
  const settings = useAdminSettings();
  const sync = useSyncCollections();
  const id = useId();
  const [applied, setApplied] = useState(false);
  const on = settings.data?.mirrorEnabled.value === "true";

  function run(dryRun: boolean) {
    setApplied(!dryRun);
    sync.mutate({ dryRun });
  }

  return (
    <Card title="Collections" id={id}>
      {!on ? (
        <p className="text-sm text-muted">
          Writing collections is off. Turn it on above to sync recommendations into Audiobookshelf.
        </p>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted">
            Preview shows what would change in Audiobookshelf without touching it.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => run(true)} disabled={sync.isPending}>
              Preview
            </Button>
            <Button onClick={() => run(false)} disabled={sync.isPending}>
              {sync.isPending && applied ? "Syncing…" : "Sync now"}
            </Button>
          </div>
          {sync.isError && (
            <p role="alert" className="text-sm text-danger">
              {messageFor(sync.error)}
            </p>
          )}
          {sync.data && <SyncResults results={sync.data} applied={applied} />}
        </div>
      )}
    </Card>
  );
}

const actionWords: Record<string, string> = {
  "would-create": "Would create",
  "would-update": "Would update",
  "would-remove": "Would remove",
  created: "Created",
  updated: "Updated",
  removed: "Removed",
  failed: "Failed",
};

function SyncResults({ results, applied }: { results: SyncResult[]; applied: boolean }) {
  const people = useRecommenders();
  const libraries = useLibraries();
  const nameOf = (userId: string) =>
    people.data?.find((person) => person.userId === userId)?.username ?? userId;
  const libraryOf = (libraryId: string) =>
    libraries.data?.find((library) => library.id === libraryId)?.name ?? libraryId;

  if (results.length === 0) {
    return (
      <p role="status" className="text-sm text-muted">
        {applied ? "Nothing needed changing." : "Nothing would change."}
      </p>
    );
  }
  return (
    <ul aria-label={applied ? "What changed" : "What would change"} className="space-y-2">
      {results.map((result) => (
        <li
          key={`${result.userId}-${result.libraryId}`}
          className="flex items-start gap-2 rounded-lg border border-border px-3 py-2 text-sm"
        >
          {result.error ? (
            <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          ) : (
            <CircleDashed aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
          )}
          <div className="min-w-0">
            <p className="font-medium break-words">
              {nameOf(result.userId)} · {libraryOf(result.libraryId)}
            </p>
            <p className="text-muted">
              {actionWords[result.action] ?? result.action}, {result.books}{" "}
              {result.books === 1 ? "book" : "books"}
              {result.error ? `: ${result.error}` : ""}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
