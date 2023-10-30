PRAGMA journal_mode = wal;

BEGIN;

PRAGMA user_version = 1;

CREATE TABLE chat (
    t       INTEGER NOT NULL PRIMARY KEY,
    channel TEXT NOT NULL,
    userId  TEXT NOT NULL,
    name    TEXT NOT NULL,
    title   TEXT,
    text    TEXT NOT NULL,
    extra   TEXT
);

CREATE INDEX chat_channel ON chat(channel);

CREATE TABLE read (
    userId  TEXT NOT NULL,
    channel TEXT NOT NULL,
    t       INTEGER NOT NULL,

    PRIMARY KEY (userId, channel)
);

CREATE VIEW latest (channel, t)
AS SELECT channel, max(t) FROM read GROUP BY channel;

COMMIT;
