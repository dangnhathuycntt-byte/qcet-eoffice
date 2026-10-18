-- CreateTable
CREATE TABLE "task_decline_notices" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_decline_notices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_decline_notices_task_id_created_at_idx" ON "task_decline_notices"("task_id", "created_at");

-- AddForeignKey
ALTER TABLE "task_decline_notices" ADD CONSTRAINT "task_decline_notices_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_decline_notices" ADD CONSTRAINT "task_decline_notices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

