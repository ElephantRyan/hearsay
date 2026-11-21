-- Linked servers, L3 (LINKED.md section 5). shared_rating is what this server
-- shows a linked one: recommended ratings only, with the book's ASIN and ISBN
-- from its cached copy or, for a book cached before 0005, the library index.
-- linked_rating is what was fetched from each linked server, with the local
-- book it was matched to (none if this library hasn't it). A fetch replaces
-- all of one server's rows; unlinking deletes them.
CREATE VIEW shared_rating AS
SELECT r.user_id, u.username, b.title, b.authors,
       COALESCE(b.asin, li.asin) AS asin, COALESCE(b.isbn, li.isbn) AS isbn,
       r.score, r.note, r.updated_at
FROM rating r
JOIN app_user u ON u.user_id = r.user_id
JOIN book b ON b.item_id = r.item_id
LEFT JOIN library_index li ON li.item_id = r.item_id
WHERE r.recommended = 1;

CREATE TABLE linked_rating (
    link_id TEXT NOT NULL,
    person_id TEXT NOT NULL,
    username TEXT NOT NULL,
    asin TEXT,
    isbn TEXT,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    score INTEGER NOT NULL,
    note TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    item_id TEXT,
    library_id TEXT,
    matched_by TEXT
);
CREATE INDEX linked_rating_link ON linked_rating (link_id);
CREATE INDEX linked_rating_item ON linked_rating (item_id);

-- The last fetch: when it worked, how many ratings came and how many matched;
-- while a server doesn't answer, since when and why.
ALTER TABLE linked_server ADD COLUMN last_fetched_at INTEGER;
ALTER TABLE linked_server ADD COLUMN ratings INTEGER;
ALTER TABLE linked_server ADD COLUMN matched INTEGER;
ALTER TABLE linked_server ADD COLUMN not_answering_since INTEGER;
ALTER TABLE linked_server ADD COLUMN problem TEXT;
