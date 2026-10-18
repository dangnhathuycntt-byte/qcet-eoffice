-- CreateEnum
CREATE TYPE "ExtensionRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COUNTERED', 'ACCEPTED', 'DECLINED');

-- CreateTable
CREATE TABLE "task_extension_requests" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "previous_due_date" TIMESTAMP(3) NOT NULL,
    "requested_due_date" TIMESTAMP(3) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "ExtensionRequestStatus" NOT NULL DEFAULT 'PENDING',
    "counter_due_date" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "responded_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_extension_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_extension_requests_task_id_status_idx" ON "task_extension_requests"("task_id", "status");

-- CreateIndex
CREATE INDEX "task_extension_requests_requested_by_id_idx" ON "task_extension_requests"("requested_by_id");

-- AddForeignKey
ALTER TABLE "task_extension_requests" ADD CONSTRAINT "task_extension_requests_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_extension_requests" ADD CONSTRAINT "task_extension_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_extension_requests" ADD CONSTRAINT "task_extension_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

