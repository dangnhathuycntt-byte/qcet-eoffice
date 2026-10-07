-- Forward-correction script for 20260923000001_drop_task_assignee guard bug.
--
-- Context: migration.sql guard uses raw text comparison (act."role"::text = ta."role_in_task"::text)
-- which compares 'DRI' = 'PRIMARY_OWNER' — always FALSE. 145+ rows always fail parity check.
--
-- This script implements the CORRECT parity guard (with canonical role mapping),
-- then drops task_assignees and AssigneeRole enum — identical effect to the original migration.
--
-- PREREQUISITES (all must be verified before running):
--   1. Backfill APPLIED and verified: task_actors populated, parity=0, idempotency PASS
--   2. Tracker 174 Stage B: dual-write active and confirmed
--   3. Tracker 174 Stage C: observation window completed
--   4. Old app retired OR dual-write confirmed production-safe
--
-- EXECUTION: Run as a DBA OUTSIDE Prisma (not via prisma migrate deploy):
--   psql -v ON_ERROR_STOP=1 \
--        -v backfill_verified=yes \
--        -v stage_b_active=yes \
--        -v stage_c_complete=yes \
--        -v old_app_retired=yes \
--        -f forward_drop_task_assignee.sql
-- After success: npx prisma migrate resolve --applied 20260923000001_drop_task_assignee
--
-- IMPORTANT: \set backfill_verified 'yes' sets a psql client variable, NOT a PostgreSQL GUC
-- parameter. current_setting('backfill_verified') reads the GUC namespace and raises
-- "unrecognized configuration parameter" for any psql \set variable. The correct mechanism
-- is psql variable interpolation: :'varname' expands the variable as a quoted SQL literal,
-- allowing a DO block to compare it as a string. With -v ON_ERROR_STOP=1 on the psql command
-- line, any unset variable causes psql to exit 1 immediately (fail-closed). The \set defaults
-- to 'no' here are documentation only — they are overridden by -v on the command line.
-- Without -v ON_ERROR_STOP=1, psql continues after errors — NEVER run without it.
--
-- DO NOT run this while any active writer uses task_assignees.
-- DO NOT run unless all prerequisites above are confirmed with -v vars set to 'yes'.
-- DO NOT mark migration applied before running this script (no fake resolve).

-- Default to 'no' so running without -v vars causes gate failure (fail-closed).
-- Operator MUST pass -v backfill_verified=yes etc. on the psql command line.
\set backfill_verified 'no'
\set stage_b_active    'no'
\set stage_c_complete  'no'
\set old_app_retired   'no'

-- ── Prerequisite gates ──────────────────────────────────────────────────────
-- Uses psql variable interpolation: :'varname' expands to a quoted SQL string literal.
-- ON_ERROR_STOP=1 (from -v on CLI) causes psql to exit 1 if any statement raises an error.
-- This DO block raises EXCEPTION for any 'no' gate — psql exits immediately, DROP never runs.
DO $$
BEGIN
  -- :'backfill_verified' expands to the psql variable value as a quoted string.
  -- If the variable is unset, psql exits with error before reaching this point (ON_ERROR_STOP=1).
  IF :'backfill_verified' <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: backfill_verified=%. '
      'Run the backfill workflow (confirm=backfill), verify idempotency PASS, parity=0, '
      'then re-run with -v backfill_verified=yes.',
      :'backfill_verified';
  END IF;
  IF :'stage_b_active' <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: stage_b_active=%. '
      'Tracker 174 Stage B (dual-write active + confirmed) must be complete. '
      'Re-run with -v stage_b_active=yes when confirmed.',
      :'stage_b_active';
  END IF;
  IF :'stage_c_complete' <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: stage_c_complete=%. '
      'Tracker 174 Stage C (observation window) must be complete. '
      'Re-run with -v stage_c_complete=yes when confirmed.',
      :'stage_c_complete';
  END IF;
  IF :'old_app_retired' <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: old_app_retired=%. '
      'Old app must be retired or dual-write confirmed production-safe with no writers on task_assignees. '
      'Re-run with -v old_app_retired=yes when confirmed.',
      :'old_app_retired';
  END IF;
  RAISE NOTICE 'All prerequisite gates PASSED. Proceeding with parity check and DROP.';
END $$;

-- ── Transaction with timeouts and table locks ────────────────────────────────
-- Wrapped in explicit BEGIN/COMMIT: if parity check raises EXCEPTION, DROP never runs.
-- lock_timeout=10s: if another session holds a lock on task_assignees, abort rather than waiting.
-- statement_timeout=60s: hard ceiling; the guard SELECT and DROP should complete in seconds.
-- LOCK TABLE task_assignees, task_actors IN ACCESS EXCLUSIVE MODE:
--   blocks all readers and writers for the duration; ensures parity check is a consistent snapshot.
BEGIN;

SET LOCAL lock_timeout = '10s';
SET LOCAL statement_timeout = '60s';

LOCK TABLE task_assignees IN ACCESS EXCLUSIVE MODE;
LOCK TABLE task_actors    IN ACCESS EXCLUSIVE MODE;

-- ── Parity guard: correct canonical role mapping ────────────────────────────
DO $$
DECLARE
  legacy_rows    integer;
  unmigrated     integer;
  sample_task_id text;
BEGIN
  IF to_regclass('public.task_assignees') IS NULL THEN
    RAISE NOTICE 'task_assignees does not exist — skip guard (already dropped).';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO legacy_rows FROM "task_assignees";

  -- Correct mapping: PRIMARY_OWNER -> DRI, COLLABORATOR -> COLLABORATOR.
  -- Original migration.sql used act."role"::text = ta."role_in_task"::text which compares
  -- 'DRI' = 'PRIMARY_OWNER' — always FALSE, causing all 145 PRIMARY_OWNER rows to fail.
  SELECT COUNT(*) INTO unmigrated
  FROM "task_assignees" ta
  WHERE NOT EXISTS (
    SELECT 1
    FROM "task_actors" act
    WHERE act."task_id" = ta."task_id"
      AND act."user_id" IS NOT DISTINCT FROM ta."user_id"
      AND act."role"::text = CASE ta."role_in_task"::text
        WHEN 'PRIMARY_OWNER' THEN 'DRI'
        WHEN 'COLLABORATOR'  THEN 'COLLABORATOR'
        ELSE ta."role_in_task"::text
      END
  );

  IF unmigrated > 0 THEN
    SELECT ta."task_id" INTO sample_task_id
    FROM "task_assignees" ta
    WHERE NOT EXISTS (
      SELECT 1 FROM "task_actors" act
      WHERE act."task_id" = ta."task_id"
        AND act."user_id" IS NOT DISTINCT FROM ta."user_id"
        AND act."role"::text = CASE ta."role_in_task"::text
          WHEN 'PRIMARY_OWNER' THEN 'DRI'
          WHEN 'COLLABORATOR'  THEN 'COLLABORATOR'
          ELSE ta."role_in_task"::text
        END
    ) LIMIT 1;

    RAISE EXCEPTION
      'STOP: Cannot drop task_assignees — % / % records not yet migrated to task_actors '
      '(sample task_id=%). Run backfill workflow and verify parity=0 before retrying.',
      unmigrated, legacy_rows, sample_task_id;
  END IF;

  RAISE NOTICE 'Parity verified: all % task_assignees rows have a matching task_actors row.', legacy_rows;

  -- Unknown roles audit: log any roles that are not PRIMARY_OWNER or COLLABORATOR
  DECLARE
    unknown_count integer;
  BEGIN
    SELECT COUNT(*) INTO unknown_count
    FROM "task_assignees"
    WHERE "role_in_task"::text NOT IN ('PRIMARY_OWNER', 'COLLABORATOR');
    IF unknown_count > 0 THEN
      RAISE NOTICE 'AUDIT: % task_assignees rows have unknown roles (not PRIMARY_OWNER/COLLABORATOR). '
                   'These were included in parity check via identity mapping — verify manually.',
                   unknown_count;
    END IF;
  END;
END $$;

-- ── DROP (only reached if all gates and parity check passed) ─────────────────
DROP TABLE IF EXISTS "task_assignees" CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssigneeRole') THEN
    DROP TYPE "AssigneeRole";
    RAISE NOTICE 'Dropped AssigneeRole enum type.';
  ELSE
    RAISE NOTICE 'AssigneeRole enum type not found — already dropped.';
  END IF;
END $$;

COMMIT;

-- After this script completes successfully with exit 0, run:
--   npx prisma migrate resolve --applied 20260923000001_drop_task_assignee
-- This marks the migration as applied in _prisma_migrations WITHOUT rewriting migration.sql
-- or its checksum. This unblocks 20260923000002 and later migrations.
--
-- NEVER run prisma migrate resolve --applied before this script succeeds.
-- NEVER run prisma migrate resolve --rolled-back on this migration.
