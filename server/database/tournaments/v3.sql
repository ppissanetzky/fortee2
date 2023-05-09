BEGIN;
-------------------------------------------------------------------------------

PRAGMA user_version = 3;

ALTER TABLE users ADD COLUMN email TEXT;
ALTER TABLE users ADD COLUMN source TEXT;
ALTER TABLE users ADD COLUMN type TEXT;

COMMIT;
