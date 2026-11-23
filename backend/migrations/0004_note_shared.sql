-- A note is its writer's own unless they share it: note_shared, off for every
-- rating so far, since nobody was asked. A recommendation still shows its score
-- to everyone; its note only once shared. rating_row and linked_rating_row
-- carry the flag (a linked server only ever sends shared notes, so its rows say
-- 1), and shared_rating sends a linked server the note only when shared.
ALTER TABLE rating ADD COLUMN note_shared INTEGER NOT NULL DEFAULT 0;

DROP VIEW rating_row;
DROP VIEW shared_rating;
DROP VIEW linked_rating_row;

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

CREATE VIEW linked_rating_row AS
SELECT 'linked-' || lr.link_id || '-' || lr.person_id AS user_id, lr.username,
       lr.item_id, lr.library_id, lr.title, lr.authors, lr.score, lr.note,
       1 AS recommended, lr.updated_at AS created_at, lr.updated_at,
       ls.name AS via, lr.matched_by, 1 AS note_shared
FROM linked_rating lr
JOIN linked_server ls ON ls.id = lr.link_id
WHERE lr.item_id IS NOT NULL;
