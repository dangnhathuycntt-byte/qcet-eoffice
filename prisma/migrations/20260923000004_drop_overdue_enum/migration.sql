-- Phase 9 WI-9.4: Remove OVERDUE value from TaskStatus enum
-- SAFE: state-machine already blocks new OVERDUE writes since Stage B.
--
-- Guard thực thi: OVERDUE là giá trị hợp lệ của enum cũ, nên nếu còn bản ghi nào
-- đang mang giá trị này thì bước cast bên dưới sẽ thất bại với lỗi enum khó truy
-- vết. Đếm trước và dừng sớm với thông báo rõ ràng.
DO $$
DECLARE
  overdue_rows integer;
BEGIN
  IF to_regtype('"TaskStatus"') IS NULL THEN
    RAISE NOTICE 'Enum TaskStatus không tồn tại — bỏ qua guard OVERDUE.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'TaskStatus' AND e.enumlabel = 'OVERDUE'
  ) THEN
    RAISE NOTICE 'TaskStatus không còn giá trị OVERDUE — bỏ qua guard.';
    RETURN;
  END IF;

  EXECUTE 'SELECT COUNT(*) FROM "tasks" WHERE "status"::text = ''OVERDUE'''
    INTO overdue_rows;

  IF overdue_rows > 0 THEN
    RAISE EXCEPTION
      'Không thể loại bỏ OVERDUE khỏi TaskStatus: còn % nhiệm vụ đang mang trạng thái này. Chạy remediation về trạng thái canonical trước khi migrate.',
      overdue_rows;
  END IF;
END $$;

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
