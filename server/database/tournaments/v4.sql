BEGIN;
-------------------------------------------------------------------------------

PRAGMA user_version = 4;

ALTER TABLE users ADD COLUMN displayName TEXT;
ALTER TABLE users ADD COLUMN notes TEXT;
ALTER TABLE users ADD COLUMN ourName TEXT;
ALTER TABLE users ADD COLUMN lastLogin TEXT;

-- Move displayName from prefs into its own column
UPDATE users SET displayName = json_extract(prefs, '$.displayName');

-- Remove it from prefs
UPDATE users SET prefs = json_remove(prefs, '$.displayName');

DROP VIEW counts;

COMMIT;
