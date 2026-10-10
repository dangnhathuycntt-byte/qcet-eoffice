-- CreateTable
CREATE TABLE "task_reminder_logs" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "due_key" VARCHAR(64) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_reminder_logs_sent_at_idx" ON "task_reminder_logs"("sent_at");

-- CreateIndex
CREATE UNIQUE INDEX "task_reminder_logs_task_id_kind_due_key_key" ON "task_reminder_logs"("task_id", "kind", "due_key");

-- AddForeignKey
ALTER TABLE "task_reminder_logs" ADD CONSTRAINT "task_reminder_logs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

