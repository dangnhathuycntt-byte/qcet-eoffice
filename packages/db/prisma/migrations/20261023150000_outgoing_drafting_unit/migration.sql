-- Đơn vị soạn của văn bản đi: để trưởng/phó đơn vị soạn đọc và duyệt dự thảo của nhân viên mình.
-- `documents` không có cột đơn vị (Phase 9). Chỉ thêm.

-- AlterTable
ALTER TABLE "document_outgoing_workflows" ADD COLUMN "drafting_unit_id" TEXT;

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_drafting_unit_id_idx" ON "document_outgoing_workflows"("drafting_unit_id");

-- AddForeignKey
ALTER TABLE "document_outgoing_workflows" ADD CONSTRAINT "document_outgoing_workflows_drafting_unit_id_fkey" FOREIGN KEY ("drafting_unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Điền cho văn bản đi đã có: đơn vị của chức vụ đang hiệu lực (ưu tiên chức vụ chính) của người đăng ký.
UPDATE "document_outgoing_workflows" w
SET "drafting_unit_id" = sub.unit_id
FROM (
  SELECT DISTINCT ON (d.id) d.id AS doc_id, pa.unit_id AS unit_id
  FROM "documents" d
  JOIN "position_assignments" pa ON pa.user_id = d.registered_by_id AND pa.status = 'ACTIVE'
  ORDER BY d.id, (pa.type = 'PRIMARY') DESC, pa.created_at ASC
) sub
WHERE w.document_id = sub.doc_id AND w.drafting_unit_id IS NULL;
