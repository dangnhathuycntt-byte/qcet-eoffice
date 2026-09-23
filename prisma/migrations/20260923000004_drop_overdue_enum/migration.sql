-- Phase 9 WI-9.4: Remove OVERDUE value from TaskStatus enum
-- Prerequisite: All tasks remediated to canonical statuses (auditTaskStatusOverdue() = 0 rows)
-- SAFE: state-machine already blocks new OVERDUE writes since Stage B

-- PostgreSQL does not support DROP VALUE from enum directly.
-- Rename current enum, create new enum without OVERDUE, update column, drop old enum.

ALTER TYPE "TaskStatus" RENAME TO "TaskStatus_old";

CREATE TYPE "TaskStatus" AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'COMPLETED',
  'CANCELLED'
);

ALTER TABLE "tasks"
  ALTER COLUMN "status" TYPE "TaskStatus"
  USING "status"::text::"TaskStatus";

DROP TYPE "TaskStatus_old";
