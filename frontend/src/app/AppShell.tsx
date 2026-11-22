import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { Home, Library, LogOut, Search, Settings, Star, UserRound, Users } from "lucide-react";
import type { ReactNode } from "react";
import { isAdmin, useAccount, useMe, useSignOut } from "../api/hooks";

interface Tab {
  key: string;
  label: string;
  icon: ReactNode;
  /** A typed link to the tab's page; each route has its own search params, so each tab renders its own. */
  link: (className: string, content: ReactNode) => ReactNode;
}

const exactHome = { exact: true } as const;

const tabs: Tab[] = [
  {
    key: "home",
    label: "Home",
    icon: <Home aria-hidden="true" className="h-5 w-5" />,
    link: (className, content) => (
      <Link to="/" activeOptions={exactHome} className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: "browse",
    label: "Browse",
    icon: <Search aria-hidden="true" className="h-5 w-5" />,
    link: (className, content) => (
      <Link to="/browse" search={{ sort: "title" }} className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: "rate",
    label: "Rate",
    icon: <Star aria-hidden="true" className="h-5 w-5" />,
    link: (className, content) => (
      <Link to="/rate" className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: "all",
    label: "All",
    icon: <Users aria-hidden="true" className="h-5 w-5" />,
    link: (className, content) => (
      <Link to="/recommendations" search={{}} className={className}>
        {content}
      </Link>
    ),
  },
  {
    key: "mine",
    label: "Mine",
    icon: <Library aria-hidden="true" className="h-5 w-5" />,
    link: (className, content) => (
      <Link to="/me/books" search={{ shelf: "listening" }} className={className}>
        {content}
      </Link>
    ),
  },
];

/** Top nav on wide screens, a bottom tab bar on phones (FRONTEND.md section 5). */
export function AppShell() {
  const me = useMe();
  const account = useAccount();
  const signOut = useSignOut();
  const navigate = useNavigate();

  async function onSignOut() {
    await signOut.mutateAsync();
    await navigate({ to: "/sign-in", search: {} });
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-6xl flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-surface focus:p-3"
      >
        Skip to content
      </a>
      <header className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <Link to="/" className="text-lg font-semibold text-text no-underline">
          Hearsay
        </Link>
        <nav aria-label="Main" className="hidden gap-1 sm:flex">
          {tabs.map((tab) => (
            <span key={tab.key}>
              {tab.link(
                "block rounded-lg px-3 py-2 text-sm text-muted no-underline hover:bg-surface-2 [&.active]:bg-accent-soft [&.active]:text-accent",
                tab.label,
              )}
            </span>
          ))}
        </nav>
        <div className="flex items-center gap-2 text-sm">
          <Link
            to="/me/account"
            aria-label="Account"
            className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2 text-muted no-underline hover:bg-surface-2 [&.active]:text-accent"
          >
            <UserRound aria-hidden="true" className="h-5 w-5" />
            <span className="hidden sm:inline">
              {account.data?.displayName ?? me.data?.username}
            </span>
          </Link>
          {isAdmin(me.data?.userType) && (
            <Link
              to="/admin"
              aria-label="Settings"
              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted no-underline hover:bg-surface-2 [&.active]:text-accent"
            >
              <Settings aria-hidden="true" className="h-5 w-5" />
            </Link>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-muted hover:bg-surface-2"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            <span className="sr-only sm:not-sr-only">Sign out</span>
          </button>
        </div>
      </header>

      <main id="main" className="flex-1 px-4 pt-4 pb-28 sm:pt-6 sm:pb-6">
        <Outlet />
      </main>

      <nav
        aria-label="Main"
        className="safe-bottom fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-border bg-surface pt-1 sm:hidden"
      >
        {tabs.map((tab) => (
          <span key={tab.key} className="flex">
            <TabButton tab={tab} />
          </span>
        ))}
      </nav>
    </div>
  );
}

/** A phone tab: icon over label, from the same link the desktop nav uses. */
function TabButton({ tab }: { tab: Tab }) {
  return (
    <>
      {tab.link(
        "flex min-h-12 min-w-16 flex-col items-center justify-center gap-0.5 rounded-lg px-3 text-xs text-muted no-underline [&.active]:text-accent",
        <>
          {tab.icon}
          {tab.label}
        </>,
      )}
    </>
  );
}
