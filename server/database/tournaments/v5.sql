BEGIN;
-------------------------------------------------------------------------------

PRAGMA user_version = 5;

CREATE TABLE games (
    gid     INTEGER PRIMARY KEY NOT NULL,
    fname   TEXT NOT NULL,
    started INTEGER NOT NULL,
    players TEXT NOT NULL,
    score   TEXT,
    tid     INTEGER
);

COMMIT;
