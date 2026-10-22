-- Chỉ mục cho các cột trong điều kiện lọc danh sách văn bản theo quyền (document-policy: người đăng ký, người chủ trì,
-- người trình, người duyệt bước, người hỏi ý kiến). Postgres không tự tạo chỉ mục cho khóa ngoại. Chỉ thêm.

-- CreateIndex
CREATE INDEX "document_approval_steps_approver_user_id_idx" ON "document_approval_steps"("approver_user_id");

-- CreateIndex
CREATE INDEX "document_approval_workflows_submitted_by_id_idx" ON "document_approval_workflows"("submitted_by_id");

-- CreateIndex
CREATE INDEX "document_consultations_asked_by_id_idx" ON "document_consultations"("asked_by_id");

-- CreateIndex
CREATE INDEX "documents_registered_by_id_idx" ON "documents"("registered_by_id");

-- CreateIndex
CREATE INDEX "documents_lead_user_id_idx" ON "documents"("lead_user_id");
