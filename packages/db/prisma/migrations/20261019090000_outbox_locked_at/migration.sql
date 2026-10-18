-- Lease của outbox: thời điểm worker nhận sự kiện (PROCESSING). Sự kiện kẹt quá OUTBOX_LEASE_MS được trả về PENDING.
-- Chỉ cộng thêm, cho phép null: bản trước đó (chọn cột tường minh) bỏ qua cột này khi quay lại.

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN "locked_at" TIMESTAMPTZ(3);
