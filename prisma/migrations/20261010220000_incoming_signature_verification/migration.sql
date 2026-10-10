-- AlterTable
ALTER TABLE "document_incoming_workflows" ADD COLUMN     "signature_checked_at" TIMESTAMP(3),
ADD COLUMN     "signature_detail" VARCHAR(300),
ADD COLUMN     "signature_status" "SignatureVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED';
