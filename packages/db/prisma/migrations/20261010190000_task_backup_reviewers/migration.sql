-- CreateTable
CREATE TABLE "task_backup_reviewers" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "backup_user_id" TEXT NOT NULL,
    "designated_by_id" TEXT NOT NULL,
    "actor_id" TEXT,
    "activated_at" TIMESTAMP(3),
    "activated_for_since" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_backup_reviewers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_backup_reviewers_task_id_key" ON "task_backup_reviewers"("task_id");

-- CreateIndex
CREATE INDEX "task_backup_reviewers_backup_user_id_idx" ON "task_backup_reviewers"("backup_user_id");

-- AddForeignKey
ALTER TABLE "task_backup_reviewers" ADD CONSTRAINT "task_backup_reviewers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_backup_reviewers" ADD CONSTRAINT "task_backup_reviewers_backup_user_id_fkey" FOREIGN KEY ("backup_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_backup_reviewers" ADD CONSTRAINT "task_backup_reviewers_designated_by_id_fkey" FOREIGN KEY ("designated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
