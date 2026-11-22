import { CircleAlert, CircleCheck, CircleDashed, RefreshCw } from "lucide-react";
import { type FormEvent, type ReactNode, useId, useState } from "react";
import {
  isAdmin,
  useAdminSettings,
  useAdminStatus,
  useInviteServer,
  useLibraries,
  useLinkedServers,
  useLinkServer,
  useMe,
  useRecommenders,
  useRefreshLink,
  useSyncCollections,
  useUnlinkServer,
} from "../../api/hooks";
import type { LinkedServer, SyncResult } from "../../api/types";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  messageFor,
} from "../../components/domain/StateViews";
import { Button } from "../../components/ui/Button";
import { Collapsible } from "../../components/ui/Collapsible";
import { SettingsForm } from "./SettingsForm";

/**
 * The admin screen: whether Audiobookshelf answers, the settings this server runs with, the
 * collections it writes into ABS, and the servers linked to this one. For Audiobookshelf admins only; the server refuses
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
      <LinksCard />
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
      className="rounded-card border border-border bg-surface px-4 py-2 shadow-card"
    >
      <Collapsible
        title={
          <h2 id={id} className="text-base font-semibold">
            {title}
          </h2>
        }
        action={action}
        className="pb-2"
      >
        {children}
      </Collapsible>
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
  "would-recreate": "Would remake (to list after the top collections)",
  "would-remove": "Would remove",
  created: "Created",
  updated: "Updated",
  recreated: "Remade (to list after the top collections)",
  removed: "Removed",
  failed: "Failed",
};

/** The server-wide collections, as the sync names them (backend/src/sync/TopList.fiig). */
const topNames: Record<string, string> = {
  "top-recommended": "Top 25 Recommended",
  "top-rated": "Top 25 Rated",
};

function SyncResults({ results, applied }: { results: SyncResult[]; applied: boolean }) {
  const people = useRecommenders();
  const libraries = useLibraries();
  const nameOf = (userId: string) =>
    topNames[userId] ?? people.data?.find((person) => person.userId === userId)?.username ?? userId;
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

const dateOf = (millis: number) =>
  new Date(millis).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Linking two servers (LINKED.md section 4): one admin invites, the other pastes the code.
 * Both need a name first, and each must reach the other's /api/federation/.
 */
function LinksCard() {
  const settings = useAdminSettings();
  const links = useLinkedServers();
  const id = useId();
  const named = settings.data !== undefined && settings.data.serverName.value != null;
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <Card title="Linked servers" id={id}>
      <div className="space-y-5">
        <p className="text-sm text-muted">
          A linked server's recommendations show here as if they were made on this one, and this
          server's show there. Both servers must be able to reach each other, and a login in front
          of either must let /api/federation/ through.
        </p>
        {settings.data && !named && (
          <p role="status" className="text-sm text-accent">
            Give this server a name under Server settings first. Linked servers show it beside its
            people.
          </p>
        )}
        {links.isPending && <LoadingState rows={1} label="Loading linked servers" />}
        {links.isError && <ErrorState error={links.error} onRetry={() => links.refetch()} />}
        {links.data &&
          (links.data.length === 0 ? (
            <p className="text-sm text-muted">No servers are linked yet.</p>
          ) : (
            <ul aria-label="Linked servers" className="space-y-2">
              {links.data.map((link) => (
                <LinkRow key={link.id} link={link} onUnlinked={setNotice} />
              ))}
            </ul>
          ))}
        {notice && (
          <p role="status" className="text-sm text-muted">
            {notice}
          </p>
        )}
        <InviteServer disabled={!named} />
        <LinkServerForm disabled={!named} />
      </div>
    </Card>
  );
}

function LinkRow({
  link,
  onUnlinked,
}: {
  link: LinkedServer;
  onUnlinked: (notice: string) => void;
}) {
  const unlink = useUnlinkServer();
  const refresh = useRefreshLink();
  const [confirming, setConfirming] = useState(false);
  return (
    <li className="rounded-lg border border-border px-3 py-2 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-medium break-words">{link.name}</p>
          <p className="break-all text-muted">{link.address}</p>
          <p className="text-muted">Linked {dateOf(link.linkedAt)}</p>
          <FetchState link={link} />
        </div>
        {confirming ? (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Keep
            </Button>
            <Button
              onClick={() =>
                unlink.mutate(link.id, {
                  onSuccess: (done) =>
                    onUnlinked(
                      done.told
                        ? `Unlinked ${done.name}. It was told, and has unlinked this server too.`
                        : `Unlinked ${done.name} here, but it didn't answer. Its admin should unlink this server there too.`,
                    ),
                })
              }
              disabled={unlink.isPending}
            >
              {unlink.isPending ? "Unlinking…" : `Unlink ${link.name}`}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => refresh.mutate(link.id)}
              disabled={refresh.isPending}
            >
              {refresh.isPending ? "Fetching…" : "Refresh now"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Unlink
            </Button>
          </div>
        )}
      </div>
      {refresh.isError && (
        <p role="alert" className="mt-2 text-danger">
          {messageFor(refresh.error)}
        </p>
      )}
      {confirming && !unlink.isPending && (
        <p className="mt-2 text-muted">
          Its recommendations leave this server, and this server's leave it.
        </p>
      )}
      {unlink.isError && (
        <p role="alert" className="mt-2 text-danger">
          {messageFor(unlink.error)}
        </p>
      )}
    </li>
  );
}

/** The last fetch from a linked server: how many of its recommendations are books here, or why it failed. */
function FetchState({ link }: { link: LinkedServer }) {
  return (
    <>
      {link.lastFetchedAt == null ? (
        <p className="text-muted">
          Not fetched yet. It is fetched every hour, or now with Refresh now.
        </p>
      ) : (
        <p className="text-muted">
          {link.matched} of {link.ratings}{" "}
          {link.ratings === 1 ? "recommendation is a book" : "recommendations are books"} here ·
          fetched {dateOf(link.lastFetchedAt)}
        </p>
      )}
      {link.notAnsweringSince != null && (
        <p className="flex items-start gap-1.5 text-danger">
          <CircleAlert aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Not answering since {dateOf(link.notAnsweringSince)}: {link.problem}
          </span>
        </p>
      )}
    </>
  );
}

function InviteServer({ disabled }: { disabled: boolean }) {
  const invite = useInviteServer();
  const id = useId();
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold">Invite a server</h3>
      <p className="text-sm text-muted">
        Makes a link code for the other server's admin to paste into theirs. It works once, for 24
        hours, and carries this app's address from Sign-in settings. The first one takes a few
        seconds: this server's library is indexed so linked servers' books can be matched.
      </p>
      <Button
        variant="secondary"
        onClick={() => invite.mutate()}
        disabled={disabled || invite.isPending}
      >
        {invite.isPending ? "Making a code…" : "Make a link code"}
      </Button>
      {invite.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(invite.error)}
        </p>
      )}
      {invite.data && (
        <div>
          <label htmlFor={id} className="mb-1 block text-sm font-medium">
            Link code
          </label>
          <input
            id={id}
            readOnly
            value={invite.data.code}
            onFocus={(event) => event.target.select()}
            className="min-h-11 w-full rounded-lg border border-border bg-surface px-3 font-mono text-xs"
          />
          <p className="mt-1 text-xs text-muted">
            Good until {dateOf(invite.data.expiresAt)}. Send it privately: anyone with it can link a
            server to this one.
          </p>
        </div>
      )}
    </div>
  );
}

function LinkServerForm({ disabled }: { disabled: boolean }) {
  const link = useLinkServer();
  const id = useId();
  const [code, setCode] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (code.trim() === "") return;
    link.mutate(code, { onSuccess: () => setCode("") });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-2">
      <h3 className="text-sm font-semibold">Link a server</h3>
      <label htmlFor={id} className="block text-sm text-muted">
        Paste the link code the other server's admin made. Both servers then show each other's
        recommendations straight away.
      </label>
      <input
        id={id}
        value={code}
        onChange={(event) => setCode(event.target.value)}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        placeholder="https://their-server.example.com#…"
        className="min-h-11 w-full rounded-lg border border-border bg-surface px-3"
      />
      <Button type="submit" disabled={disabled || link.isPending || code.trim() === ""}>
        {link.isPending ? "Linking…" : "Link"}
      </Button>
      {link.isError && (
        <p role="alert" className="text-sm text-danger">
          {messageFor(link.error)}
        </p>
      )}
      {link.data && (
        <p role="status" className="text-sm text-muted">
          Linked to {link.data.name}.{" "}
          {link.data.lastFetchedAt == null
            ? "Its recommendations will show after the next hourly fetch."
            : `${link.data.matched} of ${link.data.ratings} of its recommendations are books here.`}
        </p>
      )}
    </form>
  );
}
