-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "unit_id" TEXT NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "description" TEXT,
    "priority" "TaskPriority" NOT NULL DEFAULT 'NORMAL',
    "due_day" INTEGER NOT NULL DEFAULT 28,
    "criteria" JSONB NOT NULL DEFAULT '[]',
    "subtasks" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_recurrences" (
    "id" TEXT NOT NULL,
    "template_id" TEXT NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "dri_user_id" TEXT NOT NULL,
    "collaborator_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "reviewer_user_id" TEXT,
    "every_months" INTEGER NOT NULL DEFAULT 1,
    "start_period" VARCHAR(7) NOT NULL,
    "end_period" VARCHAR(7),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_recurrences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "task_recurrence_runs" (
    "id" TEXT NOT NULL,
    "recurrence_id" TEXT NOT NULL,
    "period_key" VARCHAR(7) NOT NULL,
    "task_id" TEXT,
    "claimed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "error" VARCHAR(500),

    CONSTRAINT "task_recurrence_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_unit_id_is_active_idx" ON "task_templates"("unit_id", "is_active");

-- CreateIndex
CREATE INDEX "task_recurrences_is_active_idx" ON "task_recurrences"("is_active");

-- CreateIndex
CREATE INDEX "task_recurrences_template_id_idx" ON "task_recurrences"("template_id");

-- CreateIndex
CREATE INDEX "task_recurrence_runs_task_id_idx" ON "task_recurrence_runs"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_recurrence_runs_recurrence_id_period_key_key" ON "task_recurrence_runs"("recurrence_id", "period_key");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "task_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_dri_user_id_fkey" FOREIGN KEY ("dri_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrences" ADD CONSTRAINT "task_recurrences_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrence_runs" ADD CONSTRAINT "task_recurrence_runs_recurrence_id_fkey" FOREIGN KEY ("recurrence_id") REFERENCES "task_recurrences"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_recurrence_runs" ADD CONSTRAINT "task_recurrence_runs_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
