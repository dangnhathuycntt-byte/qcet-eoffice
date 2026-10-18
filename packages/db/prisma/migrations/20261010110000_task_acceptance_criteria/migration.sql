-- CreateTable
CREATE TABLE "task_acceptance_criteria" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "checked_by_id" TEXT,
    "checked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_acceptance_criteria_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_acceptance_criteria_task_id_position_idx" ON "task_acceptance_criteria"("task_id", "position");

-- AddForeignKey
ALTER TABLE "task_acceptance_criteria" ADD CONSTRAINT "task_acceptance_criteria_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_acceptance_criteria" ADD CONSTRAINT "task_acceptance_criteria_checked_by_id_fkey" FOREIGN KEY ("checked_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

