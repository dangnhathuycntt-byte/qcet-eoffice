-- Đánh dấu văn bản theo từng người dùng.
CREATE TABLE "document_marks" (
    "document_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_marks_pkey" PRIMARY KEY ("document_id","user_id")
);

CREATE INDEX "document_marks_user_id_created_at_idx" ON "document_marks"("user_id", "created_at" DESC);

ALTER TABLE "document_marks" ADD CONSTRAINT "document_marks_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "document_marks" ADD CONSTRAINT "document_marks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
