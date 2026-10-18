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
-- VARIABLE INTERPOLATION DESIGN:
--   psql interpolates :'varname' at the OUTER SQL parse level — before sending to the server.
--   Inside a DO $$ ... $$ dollar-quoted body, the content is a string to the SQL parser:
--   psql does NOT substitute :'var' inside dollar-quoted strings. Writing
--   IF :'backfill_verified' <> 'yes' THEN inside a DO block is a PL/pgSQL syntax error.
--
--   Correct approach (used here):
--     1. SET myapp.backfill_verified = :'backfill_verified';  -- at SQL level (interpolated)
--        This writes the CLI value into a PostgreSQL custom session parameter.
--     2. current_setting('myapp.backfill_verified')           -- inside DO block
--        Reads the session parameter; works inside dollar-quoted PL/pgSQL bodies.
--
--   \set vs -v ORDERING:
--     CLI -v var=value sets the psql variable BEFORE the script runs.
--     \set var value in the script body runs AFTER -v and OVERWRITES it.
--     Therefore: DO NOT use \set defaults in this script. Without \set, if the operator
--     omits a required -v variable and it is unset, psql exits with "undefined variable"
--     error at the SET myapp.* = :'var' line (fail-closed, correct behaviour).
--
-- DO NOT run this while any active writer uses task_assignees.
-- DO NOT run unless all prerequisites above are confirmed with -v vars set to 'yes'.
-- DO NOT mark migration applied before running this script (no fake resolve).

-- ── Script-level error stop ──────────────────────────────────────────────────
-- Redundant with -v ON_ERROR_STOP=1 on CLI, but defensive: ensures any statement
-- error (including undefined variable at SET lines below) halts psql immediately.
\set ON_ERROR_STOP on

-- ── Publish CLI variables into PostgreSQL session parameters ─────────────────
-- :'varname' interpolation happens at the outer SQL parse level (before server).
-- If any variable is unset (operator forgot -v), psql exits here with "undefined variable".
-- The SET writes the value into custom GUC namespace myapp.* so DO blocks can read it.
SET myapp.backfill_verified = :'backfill_verified';
SET myapp.stage_b_active    = :'stage_b_active';
SET myapp.stage_c_complete  = :'stage_c_complete';
SET myapp.old_app_retired   = :'old_app_retired';

-- ── Prerequisite gates ──────────────────────────────────────────────────────
-- current_setting() reads PostgreSQL session parameters — works inside dollar-quoted bodies.
-- RAISE EXCEPTION causes psql to exit 1 (ON_ERROR_STOP=on). DROP never runs on gate failure.
DO $$
BEGIN
  IF current_setting('myapp.backfill_verified') <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: backfill_verified=%. '
      'Run the backfill workflow (confirm=backfill), verify idempotency PASS, parity=0, '
      'then re-run with -v backfill_verified=yes.',
      current_setting('myapp.backfill_verified');
  END IF;
  IF current_setting('myapp.stage_b_active') <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: stage_b_active=%. '
      'Tracker 174 Stage B (dual-write active + confirmed) must be complete. '
      'Re-run with -v stage_b_active=yes when confirmed.',
      current_setting('myapp.stage_b_active');
  END IF;
  IF current_setting('myapp.stage_c_complete') <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: stage_c_complete=%. '
      'Tracker 174 Stage C (observation window) must be complete. '
      'Re-run with -v stage_c_complete=yes when confirmed.',
      current_setting('myapp.stage_c_complete');
  END IF;
  IF current_setting('myapp.old_app_retired') <> 'yes' THEN
    RAISE EXCEPTION
      'STOP: old_app_retired=%. '
      'Old app must be retired or dual-write confirmed production-safe with no writers on task_assignees. '
      'Re-run with -v old_app_retired=yes when confirmed.',
      current_setting('myapp.old_app_retired');
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
