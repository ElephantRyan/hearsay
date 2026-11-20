-- rating_row without its AS list: columns keep the tables' names, and fiig
-- fills RatingRow's camelCase fields from them (ADR 0094).
DROP VIEW rating_row;

CREATE VIEW rating_row AS
SELECT r.user_id, u.username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;
