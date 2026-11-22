-- Hearsay's schema. fiig's runtime keeps the settings an admin saves in the app
-- in its own fiig_settings tables (ADR 0140 §2), so they aren't here.

-- One person's rating of one ABS book. A recommendation may go without a score;
-- anything else has one from 1 to 10.
CREATE TABLE rating (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    score INTEGER CHECK ((score IS NULL AND recommended = 1) OR (score IS NOT NULL AND score BETWEEN 1 AND 10)),
    note TEXT NOT NULL,
    recommended INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
);
CREATE INDEX rating_by_item ON rating (item_id);

-- Our cached copy of each rated book, so lists need no ABS call per card. The
-- ASIN and ISBN are as ABS has them, to recognise the same book on a linked
-- server (LINKED.md section 3).
CREATE TABLE book (
    item_id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    fetched_at INTEGER NOT NULL,
    asin TEXT,
    isbn TEXT
);

CREATE TABLE session (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    user_type TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE app_user (
    user_id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    last_seen_at INTEGER NOT NULL
);

-- Each person's "<name> Recommends" collection in each ABS library.
CREATE TABLE sync_state (
    user_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    last_synced_at INTEGER NOT NULL,
    last_error TEXT,
    PRIMARY KEY (user_id, library_id)
);

-- The whole local library by ASIN, ISBN and a normalised title + first author,
-- rebuilt from ABS's listing, to match a linked server's books here.
CREATE TABLE library_index (
    item_id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    asin TEXT,
    isbn TEXT,
    title_key TEXT NOT NULL,
    indexed_at INTEGER NOT NULL
);
CREATE INDEX library_index_asin ON library_index (asin);
CREATE INDEX library_index_isbn ON library_index (isbn);
CREATE INDEX library_index_title_key ON library_index (title_key);

-- Linked servers (LINKED.md section 4). An invite is kept only as the SHA-256
-- of its secret and is deleted when used, so it works once. A linked server
-- holds the key this server calls it with (read back as a Secret) and only the
-- SHA-256 of the key it calls this server with, as sessions are kept. The last
-- fetch: when it worked, how many ratings came and how many matched; while a
-- server doesn't answer, since when and why.
CREATE TABLE link_invite (
    secret_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
);

CREATE TABLE linked_server (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL UNIQUE,
    key_out TEXT NOT NULL,
    key_in_hash TEXT NOT NULL UNIQUE,
    linked_at INTEGER NOT NULL,
    linked_by TEXT NOT NULL,
    last_fetched_at INTEGER,
    ratings INTEGER,
    matched INTEGER,
    not_answering_since INTEGER,
    problem TEXT
);

-- What was fetched from each linked server (LINKED.md section 5), with the
-- local book it was matched to (none if this library hasn't it). A fetch
-- replaces all of one server's rows; unlinking deletes them. A recommendation
-- may come without a score.
CREATE TABLE linked_rating (
    link_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    username TEXT NOT NULL,
    asin TEXT,
    isbn TEXT,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    score INTEGER,
    note TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    item_id TEXT,
    library_id TEXT,
    matched_by TEXT
);
CREATE INDEX linked_rating_link ON linked_rating (link_id);
CREATE INDEX linked_rating_item ON linked_rating (item_id);

-- A rating with who made it and the book it is about. Columns keep the tables'
-- names, and fiig fills RatingRow's camelCase fields from them (ADR 0094). via
-- (which linked server a rating came from) and matched_by (how its book was
-- recognised) are NULL for this server's own ratings.
CREATE VIEW rating_row AS
SELECT r.user_id, u.username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at,
       NULL AS via, NULL AS matched_by
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;

-- What this server shows a linked one: recommended ratings only, with the
-- book's ASIN and ISBN from its cached copy or else the library index.
CREATE VIEW shared_rating AS
SELECT r.user_id, u.username, b.title, b.authors,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       r.score, r.note, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id
LEFT JOIN library_index li ON li.item_id = r.item_id
WHERE r.recommended = 1;

-- The ratings fetched from linked servers in rating_row's shape: a person's
-- user_id is linked-<link id>-<person id>, so it can't collide with an ABS user
-- id, and only books matched to this library appear.
CREATE VIEW linked_rating_row AS
SELECT 'linked-' || lr.link_id || '-' || lr.person_id AS user_id, lr.username,
       lr.item_id, lr.library_id, lr.title, lr.authors, lr.score, lr.note,
       1 AS recommended, lr.updated_at AS created_at, lr.updated_at,
       ls.name AS via, lr.matched_by
FROM linked_rating lr
JOIN linked_server ls ON ls.id = lr.link_id
WHERE lr.item_id IS NOT NULL;
