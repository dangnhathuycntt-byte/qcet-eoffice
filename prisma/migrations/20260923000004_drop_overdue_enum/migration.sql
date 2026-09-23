-- Phase 9 WI-9.4: Remove OVERDUE value from TaskStatus enum
-- Prerequisite: All tasks remediated to canonical statuses (auditTaskStatusOverdue() = 0 rows)
-- SAFE: state-machine already blocks new OVERDUE writes since Stage B

-- PostgreSQL does not support DROP VALUE from enum directly.
-- Rename current enum, create new enum without OVERDUE, update column, drop old enum.

-- Drop CHECK constraints that reference the TaskStatus column before renaming the enum type.
-- PostgreSQL stores these constraints as compiled expressions; renaming the underlying type
-- causes operator resolution errors (42883) when the old type name no longer matches the
-- enum operators available after the rename.
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "chk_tasks_completion_lifecycle";

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'COMPLETED',
  'CANCELLED'
);

-- Must drop column default before altering type (PostgreSQL error 42804 if omitted).
ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "TaskStatus"
  USING "status"::text::"TaskStatus";

-- Restore column default using new enum type.
ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED'::"TaskStatus";

DROP TYPE "TaskStatus_old";

-- Re-create CHECK constraints that were dropped before the enum rename.
-- The constraint body is identical to the original in 20260918050000_database_integrity_hardening;
-- re-creating it here makes this migration self-contained.
ALTER TABLE "tasks"
  ADD CONSTRAINT "chk_tasks_completion_lifecycle"
  CHECK (
    ("status" = 'COMPLETED' AND "progress_percent" = 100 AND "completed_at" IS NOT NULL)
    OR
    ("status" <> 'COMPLETED' AND "completed_at" IS NULL)
  ) NOT VALID;

ALTER TABLE "tasks" VALIDATE CONSTRAINT "chk_tasks_completion_lifecycle";
