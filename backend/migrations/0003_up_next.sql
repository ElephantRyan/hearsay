-- Each person's Up next list: books they mean to listen to, in the order they
-- choose (position, lowest first). Private to them; the book is cached in book
-- when added, as a rated one is.
CREATE TABLE up_next (
    user_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    position INTEGER NOT NULL,
    added_at INTEGER NOT NULL,
    PRIMARY KEY (user_id, item_id)
);
