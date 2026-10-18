-- CreateEnum
CREATE TYPE "OutgoingRecipientKind" AS ENUM ('INTERNAL_UNIT', 'EXTERNAL');

-- AlterEnum
ALTER TYPE "OutgoingDocumentStatus" ADD VALUE 'RECALLED';

-- AlterTable
ALTER TABLE "document_outgoing_workflows" ADD COLUMN     "recall_reason" VARCHAR(1000),
ADD COLUMN     "recalled_at" TIMESTAMP(3),
ADD COLUMN     "recalled_by_id" TEXT,
ADD COLUMN     "replaces_document_id" TEXT;

-- CreateTable
CREATE TABLE "outgoing_document_recipients" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "kind" "OutgoingRecipientKind" NOT NULL,
    "unit_id" TEXT,
    "name" VARCHAR(300) NOT NULL,
    "received_at" TIMESTAMP(3),
    "received_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "outgoing_document_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "outgoing_document_recipients_document_id_idx" ON "outgoing_document_recipients"("document_id");

-- CreateIndex
CREATE INDEX "outgoing_document_recipients_unit_id_idx" ON "outgoing_document_recipients"("unit_id");

-- CreateIndex
CREATE INDEX "document_outgoing_workflows_replaces_document_id_idx" ON "document_outgoing_workflows"("replaces_document_id");

-- AddForeignKey
ALTER TABLE "outgoing_document_recipients" ADD CONSTRAINT "outgoing_document_recipients_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_document_recipients" ADD CONSTRAINT "outgoing_document_recipients_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outgoing_document_recipients" ADD CONSTRAINT "outgoing_document_recipients_received_by_id_fkey" FOREIGN KEY ("received_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
