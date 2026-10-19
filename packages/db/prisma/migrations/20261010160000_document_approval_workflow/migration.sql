-- CreateEnum
CREATE TYPE "ApprovalWorkflowStatus" AS ENUM ('DRAFT', 'WAITING_UNIT_HEAD', 'WAITING_LEADER', 'APPROVED', 'NEEDS_REVISION', 'REJECTED');

-- CreateEnum
CREATE TYPE "ApprovalStepStage" AS ENUM ('UNIT_HEAD', 'LEADER');

-- CreateEnum
CREATE TYPE "DocumentApprovalStepStatus" AS ENUM ('PENDING', 'APPROVED', 'REVISION_REQUIRED', 'REJECTED', 'SKIPPED');

-- CreateTable
CREATE TABLE "document_approval_workflows" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "status" "ApprovalWorkflowStatus" NOT NULL DEFAULT 'DRAFT',
    "round" INTEGER NOT NULL DEFAULT 0,
    "submitted_by_id" TEXT,
    "submitted_at" TIMESTAMP(3),
    "opened_at" TIMESTAMP(3),
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_approval_workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_approval_steps" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "stage" "ApprovalStepStage" NOT NULL,
    "unit_id" TEXT,
    "approver_user_id" TEXT,
    "status" "DocumentApprovalStepStatus" NOT NULL DEFAULT 'PENDING',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "note" VARCHAR(1000),
    "opened_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_approval_steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_consultations" (
    "id" TEXT NOT NULL,
    "workflow_id" TEXT NOT NULL,
    "asked_by_id" TEXT NOT NULL,
    "consultant_id" TEXT NOT NULL,
    "question" VARCHAR(1000) NOT NULL,
    "answer" VARCHAR(2000),
    "answered_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_consultations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "document_approval_workflows_document_id_key" ON "document_approval_workflows"("document_id");

-- CreateIndex
CREATE INDEX "document_approval_workflows_status_idx" ON "document_approval_workflows"("status");

-- CreateIndex
CREATE INDEX "document_approval_steps_workflow_id_round_status_idx" ON "document_approval_steps"("workflow_id", "round", "status");

-- CreateIndex
CREATE INDEX "document_approval_steps_unit_id_status_idx" ON "document_approval_steps"("unit_id", "status");

-- CreateIndex
CREATE INDEX "document_consultations_workflow_id_created_at_idx" ON "document_consultations"("workflow_id", "created_at");

-- CreateIndex
CREATE INDEX "document_consultations_consultant_id_answered_at_idx" ON "document_consultations"("consultant_id", "answered_at");

-- AddForeignKey
ALTER TABLE "document_approval_workflows" ADD CONSTRAINT "document_approval_workflows_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_workflows" ADD CONSTRAINT "document_approval_workflows_submitted_by_id_fkey" FOREIGN KEY ("submitted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_workflows" ADD CONSTRAINT "document_approval_workflows_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_steps" ADD CONSTRAINT "document_approval_steps_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "document_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_steps" ADD CONSTRAINT "document_approval_steps_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_steps" ADD CONSTRAINT "document_approval_steps_approver_user_id_fkey" FOREIGN KEY ("approver_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_approval_steps" ADD CONSTRAINT "document_approval_steps_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_consultations" ADD CONSTRAINT "document_consultations_workflow_id_fkey" FOREIGN KEY ("workflow_id") REFERENCES "document_approval_workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_consultations" ADD CONSTRAINT "document_consultations_asked_by_id_fkey" FOREIGN KEY ("asked_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_consultations" ADD CONSTRAINT "document_consultations_consultant_id_fkey" FOREIGN KEY ("consultant_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

