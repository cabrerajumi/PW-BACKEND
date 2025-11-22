-- WARNING: This script will reset user level/points and remove all stream participants.
-- Make a backup before running. Example:
--   pg_dump -Fc -f backup_before_reset.dump "$DATABASE_URL"

BEGIN;

-- Reset global user level/points to defaults
UPDATE users SET nivel = 1, puntos = 0 WHERE true;

-- Remove all per-stream participant records (will remove puntos/level per stream)
DELETE FROM stream_participants;

COMMIT;

-- NOTE: If you prefer to only reset problematic users, edit this SQL accordingly.
