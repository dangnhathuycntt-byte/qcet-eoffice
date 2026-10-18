-- CreateEnum
CREATE TYPE "TaskUnitRequestStatus" AS ENUM ('PENDING', 'ASSIGNED', 'DECLINED', 'CANCELLED');

-- CreateTable
CREATE TABLE "task_unit_requests" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "target_unit_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "note" VARCHAR(1000),
    "status" "TaskUnitRequestStatus" NOT NULL DEFAULT 'PENDING',
    "assignee_user_id" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_unit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_unit_requests_task_id_status_idx" ON "task_unit_requests"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_unit_requests_target_unit_id_status_idx" ON "task_unit_requests"("target_unit_id", "status");

-- AddForeignKey
ALTER TABLE "task_unit_requests" ADD CONSTRAINT "task_unit_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_unit_requests" ADD CONSTRAINT "task_unit_requests_target_unit_id_fkey" FOREIGN KEY ("target_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_unit_requests" ADD CONSTRAINT "task_unit_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_unit_requests" ADD CONSTRAINT "task_unit_requests_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_unit_requests" ADD CONSTRAINT "task_unit_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
