-- A rating may now be just a note: a private line about a book, with no score
-- and no recommendation. Anything else still needs a score (1 to 10) or a
-- recommendation. SQLite can't change a CHECK, so rating is rebuilt with every
-- row kept, and the views over it (0004) are made again unchanged.
DROP VIEW rating_row;
DROP VIEW shared_rating;

CREATE TABLE rating_new (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    score INTEGER CHECK ((score IS NOT NULL AND score BETWEEN 1 AND 10) OR (score IS NULL AND (recommended = 1 OR note <> ''))),
    note TEXT NOT NULL,
    recommended INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    note_shared INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, item_id)
);
INSERT INTO rating_new (user_id, item_id, score, note, recommended, created_at, updated_at, note_shared)
SELECT user_id, item_id, score, note, recommended, created_at, updated_at, note_shared FROM rating;
DROP TABLE rating;
ALTER TABLE rating_new RENAME TO rating;
CREATE INDEX rating_by_item ON rating (item_id);

CREATE VIEW rating_row AS
SELECT r.user_id, u.display_name AS username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at,
       NULL AS via, NULL AS matched_by, r.note_shared
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;

CREATE VIEW shared_rating AS
SELECT r.user_id, u.display_name AS username, b.title, b.authors,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       r.score, CASE WHEN r.note_shared = 1 THEN r.note ELSE '' END AS note, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id
LEFT JOIN library_index li ON li.item_id = r.item_id
WHERE r.recommended = 1;
