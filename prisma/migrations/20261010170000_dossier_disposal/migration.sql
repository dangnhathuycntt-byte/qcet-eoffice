-- CreateEnum
CREATE TYPE "DisposalProposalStatus" AS ENUM ('PROPOSED', 'DISPOSE', 'EXTEND');

-- AlterTable
ALTER TABLE "work_dossiers" ADD COLUMN     "disposed_at" TIMESTAMP(3),
ADD COLUMN     "disposed_by_id" TEXT,
ADD COLUMN     "retention_extra_years" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "dossier_disposal_proposals" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "proposed_by_id" TEXT NOT NULL,
    "minutes_reference" VARCHAR(100) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "DisposalProposalStatus" NOT NULL DEFAULT 'PROPOSED',
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "decision_note" VARCHAR(1000),
    "extend_years" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_disposal_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dossier_reminder_logs" (
    "id" TEXT NOT NULL,
    "dossier_id" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "due_key" VARCHAR(64) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dossier_reminder_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dossier_disposal_proposals_dossier_id_status_idx" ON "dossier_disposal_proposals"("dossier_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "dossier_reminder_logs_dossier_id_kind_due_key_key" ON "dossier_reminder_logs"("dossier_id", "kind", "due_key");

-- AddForeignKey
ALTER TABLE "work_dossiers" ADD CONSTRAINT "work_dossiers_disposed_by_id_fkey" FOREIGN KEY ("disposed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_disposal_proposals" ADD CONSTRAINT "dossier_disposal_proposals_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "work_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_disposal_proposals" ADD CONSTRAINT "dossier_disposal_proposals_proposed_by_id_fkey" FOREIGN KEY ("proposed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_disposal_proposals" ADD CONSTRAINT "dossier_disposal_proposals_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dossier_reminder_logs" ADD CONSTRAINT "dossier_reminder_logs_dossier_id_fkey" FOREIGN KEY ("dossier_id") REFERENCES "work_dossiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

