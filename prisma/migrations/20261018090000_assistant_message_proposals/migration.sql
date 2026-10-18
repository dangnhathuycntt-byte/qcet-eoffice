-- Trợ lý: lưu thẻ đề xuất nhiệm vụ cùng tin trả lời, kèm trạng thái đã tạo / bỏ qua (ADR-010).

-- AlterTable
ALTER TABLE "assistant_messages" ADD COLUMN "proposals" JSONB;
