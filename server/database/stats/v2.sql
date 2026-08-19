-------------------------------------------------------------------------------
-- Adds an index on stats(time) for the prune query, and switches to
-- incremental auto-vacuum so pruned rows can free up disk space without a
-- full, blocking VACUUM later. Changing auto_vacuum only takes effect once
-- VACUUM runs, which also compacts everything in one pass. VACUUM cannot
-- run inside a transaction, so this can't use the usual BEGIN/COMMIT.
-------------------------------------------------------------------------------

CREATE INDEX stats_time ON stats(time);

PRAGMA auto_vacuum = INCREMENTAL;

VACUUM;

PRAGMA user_version = 2;
