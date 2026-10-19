-- AlterTable
ALTER TABLE "document_approval_workflows" ADD COLUMN     "return_request_note" VARCHAR(1000),
ADD COLUMN     "return_requested_at" TIMESTAMP(3);
