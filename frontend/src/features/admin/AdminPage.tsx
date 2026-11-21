import { CircleAlert, CircleCheck, CircleDashed, RefreshCw } from "lucide-react";
import { type ReactNode, useId, useState } from "react";
import {
  isAdmin,
  useAdminSettings,
  useAdminStatus,
  useLibraries,
  useMe,
  useRecommenders,
  useSyncCollections,
} from "../../api/hooks";
import type { SyncResult } from "../../api/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { SettingsForm } from "./SettingsForm";

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
      <NextStep />
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

const authentikWords: Record<string, string> = {
  answering: "Answering",
  "not answering": "Not answering",
  "not set up": "Not set up",
};

const absWords: Record<string, string> = {
  reachable: "Answering",
  unreachable: "Not answering",
  "not set up": "No address set",
};

/** On a new server: what is left after the first-run setup. */
function NextStep() {
  const settings = useAdminSettings();
  if (settings.data?.serviceToken.source !== "unset") return null;
  return (
    <p
      role="status"
      className="rounded-card border border-accent/40 bg-accent-soft p-4 text-sm text-accent"
    >
      Almost done: paste an Audiobookshelf admin's API token below, then save. Until then the app
      can sign people in but can't show books.
    </p>
  );
}

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
          <dt className="text-muted">Authentik</dt>
          <dd className="flex items-center gap-1.5">
            {status.data.authentik === "not set up" ? (
              <CircleDashed aria-hidden="true" className="h-4 w-4 shrink-0 text-muted" />
            ) : (
              <StatusIcon good={status.data.authentik === "answering"} />
            )}
            {authentikWords[status.data.authentik] ?? status.data.authentik}
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
            Collections update by themselves every hour. Preview shows what would change in
            Audiobookshelf without touching it; Sync now does it straight away.
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
