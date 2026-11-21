-- Book identifiers for linked servers (LINKED.md section 3): the ASIN and ISBN
-- as ABS has them, cached with each book, and an index of the whole local
-- library by ASIN, ISBN and a normalised title + first author, rebuilt from
-- ABS's listing. Rows cached before this have no ASIN or ISBN until refetched.
ALTER TABLE book ADD COLUMN asin TEXT;
ALTER TABLE book ADD COLUMN isbn TEXT;

CREATE TABLE library_index (
    item_id TEXT PRIMARY KEY,
    library_id TEXT NOT NULL,
    asin TEXT,
    isbn TEXT,
    title_key TEXT NOT NULL,
    indexed_at INTEGER NOT NULL
);
CREATE INDEX library_index_asin ON library_index (asin);
CREATE INDEX library_index_isbn ON library_index (isbn);
CREATE INDEX library_index_title_key ON library_index (title_key);
