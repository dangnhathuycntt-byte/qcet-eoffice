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
-- EXECUTION: Run as a DBA outside Prisma (not via prisma migrate deploy).
-- After success: npx prisma migrate resolve --applied 20260923000001_drop_task_assignee
--
-- DO NOT run this while any active writer uses task_assignees.
-- DO NOT run unless all prerequisites above are confirmed.
--
-- Operator must confirm each prerequisite by setting the vars below to 'yes'.
\set backfill_verified 'no'
\set stage_b_active 'no'
\set stage_c_complete 'no'
\set old_app_retired 'no'

DO $$
BEGIN
  IF current_setting('backfill_verified') <> 'yes' THEN
    RAISE EXCEPTION 'STOP: Set \backfill_verified = yes after verifying backfill PASS.';
  END IF;
  IF current_setting('stage_b_active') <> 'yes' THEN
    RAISE EXCEPTION 'STOP: Set \stage_b_active = yes after Tracker 174 Stage B confirmed active.';
  END IF;
  IF current_setting('stage_c_complete') <> 'yes' THEN
    RAISE EXCEPTION 'STOP: Set \stage_c_complete = yes after Stage C observation window complete.';
  END IF;
  IF current_setting('old_app_retired') <> 'yes' THEN
    RAISE EXCEPTION 'STOP: Set \old_app_retired = yes after old app retired or dual-write confirmed.';
  END IF;
END $$;

-- Correct parity guard with canonical role mapping
DO $$
DECLARE
  legacy_rows    integer;
  unmigrated     integer;
  sample_task_id text;
BEGIN
  IF to_regclass('public.task_assignees') IS NULL THEN
    RAISE NOTICE 'task_assignees does not exist — skip guard.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO legacy_rows FROM "task_assignees";

  -- Correct mapping: PRIMARY_OWNER -> DRI, COLLABORATOR -> COLLABORATOR
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
        ELSE ta."role_in_task"::text  -- unknown roles: identity mapping (will likely still mismatch)
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
      'Cannot drop task_assignees: % / % records not yet migrated to task_actors (sample task_id=%). '
      'Complete ReBAC backfill before running this script.',
      unmigrated, legacy_rows, sample_task_id;
  END IF;

  RAISE NOTICE 'Parity task_assignees -> task_actors verified (% rows).', legacy_rows;
END $$;

DROP TABLE IF EXISTS "task_assignees" CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssigneeRole') THEN
    DROP TYPE "AssigneeRole";
  END IF;
END $$;
