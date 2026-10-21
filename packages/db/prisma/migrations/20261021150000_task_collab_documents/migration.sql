-- Trạng thái Yjs của mô tả nhiệm vụ khi nhiều người cùng sửa trực tiếp (ADR-014). Chỉ thêm.

-- CreateTable
CREATE TABLE "task_collab_documents" (
    "task_id" TEXT NOT NULL,
    "state" BYTEA NOT NULL,
    "updated_by_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "task_collab_documents_pkey" PRIMARY KEY ("task_id")
);

-- AddForeignKey
ALTER TABLE "task_collab_documents" ADD CONSTRAINT "task_collab_documents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_collab_documents" ADD CONSTRAINT "task_collab_documents_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
