-- Settings an admin saves in the app (the admin screen). A saved value wins over
-- the environment variable of the same setting; no row means "use the
-- environment". Secrets are stored as given and read back as a Secret.
CREATE TABLE setting (
    name TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at INTEGER NOT NULL,
    updated_by TEXT NOT NULL
);
