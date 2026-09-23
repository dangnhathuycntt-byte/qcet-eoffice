-- ====================================================================
-- Phase 9 (WS4): Khôi phục bất biến "một DRI chính trên mỗi nhiệm vụ"
-- ở tầng database engine.
--
-- Bối cảnh: migration 20260923000001_drop_task_assignee đã bỏ bảng
-- `task_assignees` cùng partial unique index `task_one_primary_owner_idx`.
-- Quan hệ canonical thay thế là `task_actors` (role DRI + is_primary_dri),
-- nhưng schema Prisma không diễn đạt được partial unique index bằng
-- `@@unique`, nên bất biến này phải được viết tay ở đây.
--
-- Bất biến: mỗi nhiệm vụ có TỐI ĐA một DRI chính.
-- ====================================================================

-- 1. Guard: fail-fast nếu dữ liệu hiện có đã vi phạm bất biến, thay vì để
--    CREATE UNIQUE INDEX thất bại với thông báo khó truy vết.
DO $$
DECLARE
  conflicting_tasks integer;
  sample_task_id   text;
BEGIN
  SELECT COUNT(*) INTO conflicting_tasks
  FROM (
    SELECT "task_id"
    FROM "task_actors"
    WHERE "role" = 'DRI' AND "is_primary_dri" = TRUE
    GROUP BY "task_id"
    HAVING COUNT(*) > 1
  ) AS duplicated;

  IF conflicting_tasks > 0 THEN
    SELECT "task_id" INTO sample_task_id
    FROM "task_actors"
    WHERE "role" = 'DRI' AND "is_primary_dri" = TRUE
    GROUP BY "task_id"
    HAVING COUNT(*) > 1
    LIMIT 1;

    RAISE EXCEPTION
      'Không thể áp dụng bất biến một-DRI-chính: % nhiệm vụ đang có nhiều hơn một DRI chính (ví dụ task_id=%). Hãy chạy rà soát và chỉ giữ lại một bản ghi is_primary_dri = TRUE cho mỗi nhiệm vụ trước khi migrate.',
      conflicting_tasks, sample_task_id;
  END IF;
END $$;

-- 2. Partial unique index: mỗi task_id chỉ được có tối đa một DRI chính.
CREATE UNIQUE INDEX IF NOT EXISTS task_actors_one_primary_dri_idx
ON "task_actors" ("task_id")
WHERE "role" = 'DRI' AND "is_primary_dri" = TRUE;

-- 3. Bù index tổng hợp đã mất khi drop `tasks.department_id`.
-- Migration 20260923000002 đã drop `tasks_department_id_status_due_date_idx`;
-- đơn vị canonical của nhiệm vụ là `lead_unit_id` nên cần index tương đương để
-- các truy vấn bàn làm việc theo đơn vị không quét toàn bảng.
CREATE INDEX IF NOT EXISTS "tasks_lead_unit_id_status_due_date_idx"
ON "tasks" ("lead_unit_id", "status", "due_date");
