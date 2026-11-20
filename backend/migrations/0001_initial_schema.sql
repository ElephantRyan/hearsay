CREATE TABLE rating (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    score INTEGER NOT NULL CHECK (score BETWEEN 1 AND 10),
    note TEXT NOT NULL,
    recommended INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
);

CREATE INDEX rating_by_item ON rating (item_id);

CREATE TABLE book (
    item_id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
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

CREATE VIEW rating_row AS
SELECT r.user_id AS userId, u.username AS username, r.item_id AS itemId, b.library_id AS libraryId,
       b.title AS title, b.authors AS authors, r.score AS score, r.note AS note,
       r.recommended AS recommended, r.created_at AS createdAt, r.updated_at AS updatedAt
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;
