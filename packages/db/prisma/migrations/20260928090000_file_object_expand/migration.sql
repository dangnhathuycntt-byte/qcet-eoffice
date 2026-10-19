CREATE TYPE "FileScanStatus" AS ENUM ('PENDING', 'CLEAN', 'INFECTED', 'FAILED');
CREATE TYPE "StorageProvider" AS ENUM ('LOCAL_DISK', 'S3_COMPATIBLE', 'MINIO');
CREATE TYPE "FileClassification" AS ENUM ('PUBLIC', 'INTERNAL', 'RESTRICTED', 'CONFIDENTIAL');

CREATE TABLE "file_objects" (
    "id" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "storage_provider" "StorageProvider" NOT NULL DEFAULT 'LOCAL_DISK',
    "original_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "extension" VARCHAR(20) NOT NULL,
    "byte_size" BIGINT NOT NULL,
    "content_hash" VARCHAR(64) NOT NULL,
    "classification" "FileClassification" NOT NULL DEFAULT 'INTERNAL',
    "scan_status" "FileScanStatus" NOT NULL DEFAULT 'PENDING',
    "scan_result" TEXT,
    "reference_count" INTEGER NOT NULL DEFAULT 1,
    "uploaded_by_id" TEXT NOT NULL,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "file_objects_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "task_deliverables" ADD COLUMN "file_object_id" TEXT;
ALTER TABLE "document_attachments" ADD COLUMN "file_object_id" TEXT;
ALTER TABLE "dossier_items" ADD COLUMN "file_object_id" TEXT;
ALTER TABLE "meetings" ADD COLUMN "materials_file_object_id" TEXT;

CREATE UNIQUE INDEX "file_objects_storage_key_key" ON "file_objects"("storage_key");
CREATE INDEX "file_objects_content_hash_idx" ON "file_objects"("content_hash");
CREATE INDEX "file_objects_uploaded_by_id_idx" ON "file_objects"("uploaded_by_id");
CREATE INDEX "file_objects_mime_type_idx" ON "file_objects"("mime_type");
CREATE INDEX "file_objects_classification_idx" ON "file_objects"("classification");
CREATE INDEX "file_objects_scan_status_idx" ON "file_objects"("scan_status");
CREATE INDEX "task_deliverables_file_object_id_idx" ON "task_deliverables"("file_object_id");
CREATE INDEX "document_attachments_file_object_id_idx" ON "document_attachments"("file_object_id");
CREATE INDEX "dossier_items_file_object_id_idx" ON "dossier_items"("file_object_id");
CREATE INDEX "meetings_materials_file_object_id_idx" ON "meetings"("materials_file_object_id");

ALTER TABLE "file_objects"
    ADD CONSTRAINT "file_objects_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "task_deliverables"
    ADD CONSTRAINT "task_deliverables_file_object_id_fkey"
    FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "document_attachments"
    ADD CONSTRAINT "document_attachments_file_object_id_fkey"
    FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "dossier_items"
    ADD CONSTRAINT "dossier_items_file_object_id_fkey"
    FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "meetings"
    ADD CONSTRAINT "meetings_materials_file_object_id_fkey"
    FOREIGN KEY ("materials_file_object_id") REFERENCES "file_objects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
