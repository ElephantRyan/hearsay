-- A series can be rated and recommended as a whole, like a book. series is our
-- copy of one ABS series (name, the first book's author line), cached when it
-- is rated; series_book its books in series order (position 0 is book 1).
-- series_rating is one person's rating of one series, under the same rules as
-- rating: a score of 1 to 10, or none when recommended or with a note; the note
-- the writer's own unless shared.
CREATE TABLE series (
    series_id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    name TEXT NOT NULL,
    authors TEXT NOT NULL,
    fetched_at INTEGER NOT NULL
);

CREATE TABLE series_book (
    series_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (series_id, item_id)
);
CREATE INDEX series_book_item ON series_book (item_id);

CREATE TABLE series_rating (
    user_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    score INTEGER CHECK ((score IS NOT NULL AND score BETWEEN 1 AND 10) OR (score IS NULL AND (recommended = 1 OR note <> ''))),
    note TEXT NOT NULL,
    note_shared INTEGER NOT NULL DEFAULT 0,
    recommended INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, series_id)
);

-- A series rating with who made it and the series it is about: the series'
-- name, author line, how many books, and book 1 (whose cover stands for it).
CREATE VIEW series_rating_row AS
SELECT sr.user_id, u.display_name AS username, sr.series_id, s.library_id, s.name, s.authors,
       (SELECT COUNT(*) FROM series_book sb WHERE sb.series_id = sr.series_id) AS books,
       (SELECT sb.item_id FROM series_book sb WHERE sb.series_id = sr.series_id ORDER BY sb.position LIMIT 1) AS first_item_id,
       sr.score, sr.note, sr.recommended, sr.created_at, sr.updated_at, sr.note_shared
FROM series_rating sr
JOIN app_user u ON u.user_id = sr.user_id
JOIN series s ON s.series_id = sr.series_id;
