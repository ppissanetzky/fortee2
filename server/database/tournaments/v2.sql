BEGIN;
-------------------------------------------------------------------------------

PRAGMA user_version = 2;

ALTER TABLE users ADD COLUMN roles TEXT;

CREATE VIEW counts AS
    SELECT tournaments.id AS id, COUNT(DISTINCT(signups.user)) AS count
    FROM tournaments
    LEFT OUTER JOIN signups ON tournaments.id = signups.id
    WHERE tournaments.recurring = 0
    GROUP BY tournaments.id;

COMMIT;
