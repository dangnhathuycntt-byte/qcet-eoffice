-- Phase 9 WI-9.1: Drop legacy TaskAssignee table and AssigneeRole enum
-- Prerequisite: Stage B dual-write active, Stage C observe window completed.
--
-- Guard thực thi (thay cho việc viện dẫn một hàm không tồn tại): trước khi xoá
-- bảng legacy, xác nhận mọi bản ghi `task_assignees` đã có bản ghi tương ứng
-- trong `task_actors` theo (task_id, user_id, role). Nếu còn lệch, migration
-- dừng ngay với thông báo rõ thay vì xoá dữ liệu chưa được chuyển đổi.
DO $$
DECLARE
  legacy_rows    integer;
  unmigrated     integer;
  sample_task_id text;
BEGIN
  IF to_regclass('public.task_assignees') IS NULL THEN
    RAISE NOTICE 'task_assignees không tồn tại — bỏ qua guard parity.';
    RETURN;
  END IF;

  SELECT COUNT(*) INTO legacy_rows FROM "task_assignees";

  SELECT COUNT(*) INTO unmigrated
  FROM "task_assignees" ta
  WHERE NOT EXISTS (
    SELECT 1
    FROM "task_actors" act
    WHERE act."task_id" = ta."task_id"
      AND act."user_id" IS NOT DISTINCT FROM ta."user_id"
      AND act."role"::text = ta."role_in_task"::text
  );

  IF unmigrated > 0 THEN
    SELECT ta."task_id" INTO sample_task_id
    FROM "task_assignees" ta
    WHERE NOT EXISTS (
      SELECT 1
      FROM "task_actors" act
      WHERE act."task_id" = ta."task_id"
        AND act."user_id" IS NOT DISTINCT FROM ta."user_id"
        AND act."role"::text = ta."role_in_task"::text
    )
    LIMIT 1;

    RAISE EXCEPTION
      'Không thể drop task_assignees: % / % bản ghi chưa được chuyển sang task_actors (ví dụ task_id=%). Hoàn tất backfill ReBAC trước khi migrate.',
      unmigrated, legacy_rows, sample_task_id;
  END IF;

  RAISE NOTICE 'Parity task_assignees -> task_actors đạt (% bản ghi).', legacy_rows;
END $$;

DROP TABLE IF EXISTS "task_assignees" CASCADE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssigneeRole') THEN
    DROP TYPE "AssigneeRole";
  END IF;
END $$;
