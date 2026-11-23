-- Linked servers, for series. shared_series is what this server shows a linked
-- one: recommended series, each with its book 1's title, ASIN and ISBN (from
-- the book cache or else the library index) for the other side to recognise
-- it, and the note only when shared. linked_series_rating is what was fetched
-- from each linked server, with the local series its book 1 was matched to (none
-- if this library hasn't it). series_rating_row gains via, NULL for this
-- server's own ratings; linked_series_rating_row gives the fetched ones in the
-- same shape.
DROP VIEW series_rating_row;

CREATE VIEW series_rating_row AS
SELECT sr.user_id, u.display_name AS username, sr.series_id, s.library_id, s.name, s.authors,
       (SELECT COUNT(*) FROM series_book sb WHERE sb.series_id = sr.series_id) AS books,
       (SELECT sb.item_id FROM series_book sb WHERE sb.series_id = sr.series_id ORDER BY sb.position LIMIT 1) AS first_item_id,
       sr.score, sr.note, sr.recommended, sr.created_at, sr.updated_at, sr.note_shared,
       NULL AS via
FROM series_rating sr
JOIN app_user u ON u.user_id = sr.user_id
JOIN series s ON s.series_id = sr.series_id;

CREATE VIEW shared_series AS
SELECT sr.user_id, u.display_name AS username, s.name AS series_name, s.authors,
       COALESCE(b.title, '') AS first_title,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       sr.score, CASE WHEN sr.note_shared = 1 THEN sr.note ELSE '' END AS note, sr.updated_at
FROM series_rating sr
JOIN app_user u ON u.user_id = sr.user_id
JOIN series s ON s.series_id = sr.series_id
LEFT JOIN series_book sb ON sb.series_id = sr.series_id AND sb.position = 0
LEFT JOIN book b ON b.item_id = sb.item_id
LEFT JOIN library_index li ON li.item_id = sb.item_id
WHERE sr.recommended = 1;

CREATE TABLE linked_series_rating (
    link_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    username TEXT NOT NULL,
    series_name TEXT NOT NULL,
    authors TEXT NOT NULL,
    first_title TEXT NOT NULL,
    asin TEXT,
    isbn TEXT,
    score INTEGER,
    note TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    series_id TEXT,
    matched_by TEXT
);
CREATE INDEX linked_series_rating_link ON linked_series_rating (link_id);

CREATE VIEW linked_series_rating_row AS
SELECT 'linked-' || lsr.link_id || '-' || lsr.person_id AS user_id, lsr.username, lsr.series_id,
       s.library_id, s.name, s.authors,
       (SELECT COUNT(*) FROM series_book sb WHERE sb.series_id = lsr.series_id) AS books,
       (SELECT sb.item_id FROM series_book sb WHERE sb.series_id = lsr.series_id ORDER BY sb.position LIMIT 1) AS first_item_id,
       lsr.score, lsr.note, 1 AS recommended, lsr.updated_at AS created_at, lsr.updated_at,
       1 AS note_shared, ls.name AS via
FROM linked_series_rating lsr
JOIN linked_server ls ON ls.id = lsr.link_id
JOIN series s ON s.series_id = lsr.series_id
WHERE lsr.series_id IS NOT NULL;
