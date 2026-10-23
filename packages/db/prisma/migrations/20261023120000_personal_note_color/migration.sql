-- Màu nền của ghi chú cá nhân (người dùng yêu cầu 23/10/2026). Null là màu mặc định. Chỉ thêm cột.

-- AlterTable
ALTER TABLE "personal_notes" ADD COLUMN "color" VARCHAR(16);
