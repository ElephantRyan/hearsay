CREATE TABLE sync_state (
    user_id TEXT NOT NULL,
    library_id TEXT NOT NULL,
    collection_id TEXT NOT NULL,
    last_synced_at INTEGER NOT NULL,
    last_error TEXT,
    PRIMARY KEY (user_id, library_id)
);
