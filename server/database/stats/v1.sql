PRAGMA journal_mode = wal;

BEGIN;

PRAGMA user_version = 1;

CREATE TABLE stats (
    type    TEXT NOT NULL,
    time    INTEGER NOT NULL,
    key     TEXT,
    value   REAL
);

COMMIT;
