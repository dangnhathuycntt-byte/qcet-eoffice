-- Trợ lý nâng cấp (ADR-012): hướng dẫn riêng, ghi nhớ, kỹ năng, hành động chờ duyệt, bản tin sáng. Chỉ thêm bảng.
-- Đã bỏ các DROP INDEX trgm do `migrate diff` sinh nhầm (chỉ mục tạo bằng SQL thô, xem 20260928093000).

-- CreateTable
CREATE TABLE "assistant_preferences" (
    "user_id" TEXT NOT NULL,
    "instructions" VARCHAR(2000) NOT NULL DEFAULT '',
    "briefing_enabled" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_preferences_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "assistant_memories" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "content" VARCHAR(300) NOT NULL,
    "source" VARCHAR(16) NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_skills" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" VARCHAR(60) NOT NULL,
    "prompt" VARCHAR(4000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "assistant_skills_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_actions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "conversation_id" TEXT NOT NULL,
    "message_id" TEXT,
    "kind" VARCHAR(32) NOT NULL,
    "payload" JSONB NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
    "result" JSONB,
    "error" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),

    CONSTRAINT "assistant_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assistant_briefings" (
    "user_id" TEXT NOT NULL,
    "day" VARCHAR(10) NOT NULL,
    "notification_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_briefings_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateIndex
CREATE INDEX "assistant_memories_user_id_created_at_idx" ON "assistant_memories"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "assistant_skills_user_id_name_key" ON "assistant_skills"("user_id", "name");

-- CreateIndex
CREATE INDEX "assistant_actions_message_id_idx" ON "assistant_actions"("message_id");

-- CreateIndex
CREATE INDEX "assistant_actions_user_id_status_idx" ON "assistant_actions"("user_id", "status");

-- CreateIndex
CREATE INDEX "assistant_actions_conversation_id_idx" ON "assistant_actions"("conversation_id");

-- AddForeignKey
ALTER TABLE "assistant_preferences" ADD CONSTRAINT "assistant_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_memories" ADD CONSTRAINT "assistant_memories_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_skills" ADD CONSTRAINT "assistant_skills_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "assistant_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_actions" ADD CONSTRAINT "assistant_actions_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "assistant_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assistant_briefings" ADD CONSTRAINT "assistant_briefings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
