-- A person can recommend a book without scoring it: score is NULL then, and
-- only a recommendation may go without one. A linked server's recommendation
-- can come without a score too. SQLite can't change a column, so both tables
-- are rebuilt, and the views over them made again unchanged (0007, 0008).
DROP VIEW rating_row;
DROP VIEW shared_rating;
DROP VIEW linked_rating_row;

CREATE TABLE rating_new (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    score INTEGER CHECK ((score IS NULL AND recommended = 1) OR (score IS NOT NULL AND score BETWEEN 1 AND 10)),
    note TEXT NOT NULL,
    recommended INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
);
INSERT INTO rating_new SELECT user_id, item_id, score, note, recommended, created_at, updated_at FROM rating;
DROP TABLE rating;
ALTER TABLE rating_new RENAME TO rating;
CREATE INDEX rating_by_item ON rating (item_id);

CREATE TABLE linked_rating_new (
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
INSERT INTO linked_rating_new
SELECT link_id, person_id, username, asin, isbn, title, authors, score, note, updated_at,
       item_id, library_id, matched_by
FROM linked_rating;
DROP TABLE linked_rating;
ALTER TABLE linked_rating_new RENAME TO linked_rating;
CREATE INDEX linked_rating_link ON linked_rating (link_id);
CREATE INDEX linked_rating_item ON linked_rating (item_id);

CREATE VIEW rating_row AS
SELECT r.user_id, u.username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at,
       NULL AS via, NULL AS matched_by
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;

CREATE VIEW shared_rating AS
SELECT r.user_id, u.username, b.title, b.authors,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       r.score, r.note, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id
LEFT JOIN library_index li ON li.item_id = r.item_id
WHERE r.recommended = 1;

CREATE VIEW linked_rating_row AS
SELECT 'linked-' || lr.link_id || '-' || lr.person_id AS user_id, lr.username,
       lr.item_id, lr.library_id, lr.title, lr.authors, lr.score, lr.note,
       1 AS recommended, lr.updated_at AS created_at, lr.updated_at,
       ls.name AS via, lr.matched_by
FROM linked_rating lr
JOIN linked_server ls ON ls.id = lr.link_id
WHERE lr.item_id IS NOT NULL;
