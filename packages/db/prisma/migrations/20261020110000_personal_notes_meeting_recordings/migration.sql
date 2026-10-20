-- Ghi chú cá nhân (riêng tư theo chủ nhân) và bản ghi âm cuộc họp (chép lời, biên bản đề xuất bằng Gemini). Chỉ thêm.

-- CreateEnum
CREATE TYPE "MeetingRecordingStatus" AS ENUM ('UPLOADING', 'QUEUED', 'PROCESSING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "meeting_recordings" (
    "id" TEXT NOT NULL,
    "meeting_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "source" VARCHAR(8) NOT NULL,
    "status" "MeetingRecordingStatus" NOT NULL DEFAULT 'UPLOADING',
    "mime_type" VARCHAR(64) NOT NULL,
    "part_count" INTEGER NOT NULL DEFAULT 0,
    "byte_size" BIGINT NOT NULL DEFAULT 0,
    "duration_sec" INTEGER,
    "file_object_id" TEXT,
    "consent_at" TIMESTAMP(3) NOT NULL,
    "windows" JSONB,
    "transcript" TEXT,
    "minutes_draft" TEXT,
    "decisions" JSONB,
    "action_items" JSONB,
    "model" VARCHAR(64),
    "error" VARCHAR(500),
    "processed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meeting_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personal_notes" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" VARCHAR(200) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL DEFAULT '',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "entity_type" VARCHAR(16),
    "entity_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personal_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "meeting_recordings_meeting_id_created_at_idx" ON "meeting_recordings"("meeting_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "meeting_recordings_status_updated_at_idx" ON "meeting_recordings"("status", "updated_at");

-- CreateIndex
CREATE INDEX "meeting_recordings_created_by_id_idx" ON "meeting_recordings"("created_by_id");

-- CreateIndex
CREATE INDEX "meeting_recordings_file_object_id_idx" ON "meeting_recordings"("file_object_id");

-- CreateIndex
CREATE INDEX "personal_notes_user_id_pinned_updated_at_idx" ON "personal_notes"("user_id", "pinned", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "personal_notes_user_id_entity_type_entity_id_idx" ON "personal_notes"("user_id", "entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meeting_recordings" ADD CONSTRAINT "meeting_recordings_file_object_id_fkey" FOREIGN KEY ("file_object_id") REFERENCES "file_objects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personal_notes" ADD CONSTRAINT "personal_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

