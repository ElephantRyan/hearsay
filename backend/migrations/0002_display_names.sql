-- Everyone else sees a person's display name, which they choose on the account
-- page (it starts as their username). rating_row and shared_rating give it as
-- username, the column every list, linked server and ABS collection reads.
DROP VIEW rating_row;
DROP VIEW shared_rating;

CREATE VIEW rating_row AS
SELECT r.user_id, u.display_name AS username, r.item_id, b.library_id, b.title, b.authors,
       r.score, r.note, r.recommended, r.created_at, r.updated_at,
       NULL AS via, NULL AS matched_by
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id;

CREATE VIEW shared_rating AS
SELECT r.user_id, u.display_name AS username, b.title, b.authors,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       r.score, r.note, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id
LEFT JOIN library_index li ON li.item_id = r.item_id
WHERE r.recommended = 1;
