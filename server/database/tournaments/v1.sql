BEGIN;
-------------------------------------------------------------------------------

PRAGMA user_version = 1;

CREATE TABLE users (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    prefs TEXT
);

COMMIT;
