-- Tên tệp gốc của bản ghi tải lên (để nhận ra bản ghi trong danh sách thay vì "Tệp tải lên"). Chỉ thêm.

-- AlterTable
ALTER TABLE "meeting_recordings" ADD COLUMN "file_name" VARCHAR(200);
