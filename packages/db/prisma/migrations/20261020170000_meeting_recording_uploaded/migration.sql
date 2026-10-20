-- Bản ghi âm tải xong chờ người dùng bấm "Tạo biên bản" (UPLOADED) mới gửi tới dịch vụ AI; xác nhận đồng ý chuyển sang lúc
-- đó nên consent_at để trống được tới khi bấm. Sóng âm (độ lớn theo từng khoảng, 0–100) để vẽ trên giao diện. Chỉ thêm.

-- AlterEnum
ALTER TYPE "MeetingRecordingStatus" ADD VALUE 'UPLOADED' AFTER 'UPLOADING';

-- AlterTable
ALTER TABLE "meeting_recordings" ALTER COLUMN "consent_at" DROP NOT NULL;
ALTER TABLE "meeting_recordings" ADD COLUMN "waveform" JSONB;
