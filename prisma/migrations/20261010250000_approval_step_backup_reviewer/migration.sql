-- AlterTable
ALTER TABLE "task_approval_steps" ADD COLUMN     "backup_reviewer_user_id" TEXT;

-- CreateIndex
CREATE INDEX "task_approval_steps_backup_reviewer_user_id_idx" ON "task_approval_steps"("backup_reviewer_user_id");

-- AddForeignKey
ALTER TABLE "task_approval_steps" ADD CONSTRAINT "task_approval_steps_backup_reviewer_user_id_fkey" FOREIGN KEY ("backup_reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
