-- Linked servers (LINKED.md section 4). An invite is kept only as the SHA-256
-- of its secret and is deleted when used, so it works once. A linked server
-- holds the key this server calls it with (read back as a Secret) and only the
-- SHA-256 of the key it calls this server with, as sessions are kept.
CREATE TABLE link_invite (
    secret_hash TEXT PRIMARY KEY,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL,
    created_by TEXT NOT NULL
);

CREATE TABLE linked_server (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT NOT NULL UNIQUE,
    key_out TEXT NOT NULL,
    key_in_hash TEXT NOT NULL UNIQUE,
    linked_at INTEGER NOT NULL,
    linked_by TEXT NOT NULL
);
