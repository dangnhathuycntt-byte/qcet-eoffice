-- Lưu trữ thông báo như Notion: cột archived_at (null = còn trong Hộp thư) và chỉ mục theo người nhận. Chỉ thêm.

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN "archived_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "notifications_user_id_archived_at_idx" ON "notifications"("user_id", "archived_at");
