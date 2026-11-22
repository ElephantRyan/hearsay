-- Settings saved in the app move to the table fiig's runtime keeps them in
-- (ADR 0140 §2), where the config wires read them. The two CREATE TABLEs and
-- the version row are the runtime's own, so it finds them already there.
CREATE TABLE IF NOT EXISTS fiig_settings (package TEXT NOT NULL, name TEXT NOT NULL, value TEXT NOT NULL, updated_at TEXT NOT NULL, updated_by TEXT NOT NULL, PRIMARY KEY (package, name));
CREATE TABLE IF NOT EXISTS fiig_settings_version (id INTEGER PRIMARY KEY, version INTEGER NOT NULL);
INSERT INTO fiig_settings_version (id, version) VALUES (1, 0) ON CONFLICT (id) DO NOTHING;
INSERT INTO fiig_settings (package, name, value, updated_at, updated_by)
    SELECT 'hearsay.settings', name, value, strftime('%Y-%m-%dT%H:%M:%SZ', updated_at / 1000, 'unixepoch'), updated_by FROM setting
    WHERE true ON CONFLICT (package, name) DO NOTHING;
UPDATE fiig_settings_version SET version = version + 1 WHERE id = 1;
DROP TABLE setting;
