# Hearsay

Hearsay is a sidecar for [Audiobookshelf](https://www.audiobookshelf.org/) (ABS). Each person on
your server rates books 1-10 and publishes a personal "Recommends" list that everyone else on the
server can browse. It can also mirror each person's list into a native ABS collection, so it shows
up in ABS's own web UI and apps.

- Sign in with your existing ABS account (or Authentik/OIDC). No second account system.
- Rate any book 1-10 with an optional short note, and mark the ones you recommend.
- Browse everyone's recommendations, ranked by average score, filtered by recommender or library.
- Nothing in ABS is changed or forked: Hearsay keeps only IDs and ratings in its own SQLite database
  and looks titles and covers up from ABS.

## Written in fiig

**The backend is written in [fiig](https://github.com/ElephantRyan/fiig-lang)**, a young
programming language for application services, where models, business rules, external calls and
how they compose are part of the language and the compiler rejects whole classes of bugs
(unhandled errors, undeclared effects, invalid transactions).

Hearsay is also fiig's first real application, so it doubles as a test of the language. fiig is
alpha: syntax and behavior can still change, and Hearsay is kept building against it.

If you haven't seen fiig before, a taste of this codebase (`backend/src/ratings/CreateRating.fiig`):

```fiig
rule createRating(userId: string, itemId: string, input: RatingInput, now: int) -> Result<Rating, RatingError> {
    note = input.note or ""
    if input.score < 1 or input.score > 10 {
        return Err(RatingError.Invalid("score", "must be from 1 to 10"))
    }
    ...
}
```

The backend is one file per declaration, and each folder under `backend/src/` is a package (a
domain: `ratings/`, `library/`, `sync/`, ...).

## Layout

| Path | What it is |
|---|---|
| `backend/` | The fiig application: JSON API, SQLite, the hourly collections sync |
| `frontend/` | A React + TypeScript single-page app that talks only to the JSON API |

## Running it

You need the `fiig` toolchain, and Node for the frontend.

Install fiig (see the [fiig README](https://github.com/ElephantRyan/fiig-lang#install)):

```sh
# macOS / Linux
curl -fsSL https://raw.githubusercontent.com/ElephantRyan/fiig-lang/main/install.sh | sh
# Windows (PowerShell)
irm https://raw.githubusercontent.com/ElephantRyan/fiig-lang/main/install.ps1 | iex
```

Backend (from `backend/`):

```sh
# configure it: .env holds ABS_URL, ABS_SERVICE_TOKEN, AUTH_MODE, ...
fiig check .                                          # type-check
fiig test  .                                          # run the tests
fiig serve -caps caps.json -env-file .env . web       # the API on :8080
fiig serve -caps caps.json -env-file .env . worker    # the hourly collections sync
```

`ABS_SERVICE_TOKEN` must be a token that can read items and list users in ABS. Set `AUTH_MODE=abs`
until you have an Authentik application; the `OIDC_*` settings are only needed otherwise.

Frontend (from `frontend/`):

```sh
npm install
npm run dev
npm run api:types   # regenerate the API types after the backend's routes change
```

The API is described in `backend/openapi.json`, produced by `fiig openapi . web`.

## Status

Both Hearsay and fiig are alpha, so expect rough edges.
