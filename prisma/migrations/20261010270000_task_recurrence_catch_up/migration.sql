-- Bù các kỳ đã qua khi bật lịch lặp lại muộn (T-09): số tháng trước tháng hiện tại còn được sinh nhiệm vụ.
ALTER TABLE "task_recurrences" ADD COLUMN "catch_up_periods" INTEGER NOT NULL DEFAULT 0;
