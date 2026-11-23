-- Which series each cached book is in, with its number there, as ABS says when
-- the book is fetched. book.series_known says whether that was asked: a book
-- cached before this, or from a listing that doesn't carry series, is fetched
-- again before it is relied on. A book known to be in no series has no rows.
ALTER TABLE book ADD COLUMN series_known INTEGER NOT NULL DEFAULT 0;

CREATE TABLE book_series (
    item_id TEXT NOT NULL,
    series_id TEXT NOT NULL,
    name TEXT NOT NULL,
    sequence TEXT,
    PRIMARY KEY (item_id, series_id)
);
CREATE INDEX book_series_series ON book_series (series_id);

-- Each person's own settings: notes shared by default, and the Rate tab leaving
-- out books of a series they have rated.
ALTER TABLE app_user ADD COLUMN share_notes_default INTEGER NOT NULL DEFAULT 0;
ALTER TABLE app_user ADD COLUMN skip_rated_series INTEGER NOT NULL DEFAULT 0;

-- "Top 25 Recommended" and "Top 25 Rated" give way to "Top 10 Series" and
-- "Top 25 Standalones", each with its own setting. A server that had the old
-- one on starts with both new ones on; the old collections are removed from ABS
-- by the next sync.
-- The two tables are the runtime's own (ADR 0140 2); made here if a new
-- database doesn't have them yet, as the runtime itself makes them.
CREATE TABLE IF NOT EXISTS fiig_settings (package TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY (package, name));
CREATE TABLE IF NOT EXISTS fiig_settings_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
INSERT INTO fiig_settings_version (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO fiig_settings (package, name, value, updated_at, updated_by)
SELECT package, 'sync.topSeries', value, updated_at, updated_by FROM fiig_settings
WHERE package = 'hearsay.settings' AND name = 'sync.topCollections'
ON CONFLICT (package, name) DO NOTHING;
INSERT INTO fiig_settings (package, name, value, updated_at, updated_by)
SELECT package, 'sync.topStandalones', value, updated_at, updated_by FROM fiig_settings
WHERE package = 'hearsay.settings' AND name = 'sync.topCollections'
ON CONFLICT (package, name) DO NOTHING;
DELETE FROM fiig_settings WHERE package = 'hearsay.settings' AND name = 'sync.topCollections';
UPDATE fiig_settings_version SET version = version + 1 WHERE id = 1;
