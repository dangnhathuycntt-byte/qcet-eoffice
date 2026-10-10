-- Hạn trả lời yêu cầu phối hợp liên đơn vị (T-12): quá hạn thì nhắc trưởng đơn vị và báo người giao.
ALTER TABLE "task_unit_requests" ADD COLUMN "respond_by" TIMESTAMP(3);

-- Yêu cầu đang chờ từ trước: mặc định 3 ngày kể từ lúc gửi.
UPDATE "task_unit_requests" SET "respond_by" = "created_at" + INTERVAL '3 days' WHERE "status" = 'PENDING';

CREATE INDEX "task_unit_requests_status_respond_by_idx" ON "task_unit_requests"("status", "respond_by");
