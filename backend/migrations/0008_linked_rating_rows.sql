-- Linked servers, L4 (LINKED.md section 6). rating_row gains via (which linked
-- server a rating came from) and matched_by (how its book was recognised), both
-- NULL for this server's own ratings. linked_rating_row is the ratings fetched
-- from linked servers in the same shape: a person's user_id is
-- linked-<link id>-<person id>, so it can't collide with an ABS user id, and only
-- books matched to this library appear.
DROP VIEW rating_row;

CREATE VIEW rating_row AS
SELECT r.user_id, u.username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at,
       NULL AS via, NULL AS matched_by
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;

CREATE VIEW linked_rating_row AS
SELECT 'linked-' || lr.link_id || '-' || lr.person_id AS user_id, lr.username,
       lr.item_id, lr.library_id, lr.title, lr.authors, lr.score, lr.note,
       1 AS recommended, lr.updated_at AS created_at, lr.updated_at,
       ls.name AS via, lr.matched_by
FROM linked_rating lr
JOIN linked_server ls ON ls.id = lr.link_id
WHERE lr.item_id IS NOT NULL;
