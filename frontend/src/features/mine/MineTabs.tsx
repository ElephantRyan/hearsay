import { Link } from "@tanstack/react-router";

const tab =
  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-medium text-muted no-underline hover:bg-surface-2 [&.active]:bg-accent [&.active]:text-accent-text";

/**
 * The views of my books: what's up next, what I'm listening to, what I've finished, what I've
 * rated.
 */
export function MineTabs() {
  return (
    <nav aria-label="My books" className="flex flex-wrap gap-2">
      <Link to="/me/up-next" className={tab}>
        Up next
      </Link>
      <Link
        to="/me/books"
        search={{ shelf: "listening" }}
        activeOptions={{ includeSearch: true }}
        className={tab}
      >
        Listening
      </Link>
      <Link
        to="/me/books"
        search={{ shelf: "finished" }}
        activeOptions={{ includeSearch: true }}
        className={tab}
      >
        Finished
      </Link>
      <Link
        to="/me/ratings"
        search={{ sort: "newest" }}
        activeOptions={{ includeSearch: false }}
        className={tab}
      >
        Rated
      </Link>
    </nav>
  );
}
