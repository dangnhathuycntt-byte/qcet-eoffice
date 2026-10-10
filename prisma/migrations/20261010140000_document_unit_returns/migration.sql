-- CreateTable
CREATE TABLE "document_unit_returns" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "from_unit_id" TEXT NOT NULL,
    "returned_by_id" TEXT NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),
    "to_unit_id" TEXT,
    "rerouted_by_id" TEXT,
    "reroute_note" VARCHAR(1000),

    CONSTRAINT "document_unit_returns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_unit_returns_document_id_resolved_at_idx" ON "document_unit_returns"("document_id", "resolved_at");

-- CreateIndex
CREATE INDEX "document_unit_returns_from_unit_id_idx" ON "document_unit_returns"("from_unit_id");

-- AddForeignKey
ALTER TABLE "document_unit_returns" ADD CONSTRAINT "document_unit_returns_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_unit_returns" ADD CONSTRAINT "document_unit_returns_from_unit_id_fkey" FOREIGN KEY ("from_unit_id") REFERENCES "organizational_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_unit_returns" ADD CONSTRAINT "document_unit_returns_returned_by_id_fkey" FOREIGN KEY ("returned_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_unit_returns" ADD CONSTRAINT "document_unit_returns_to_unit_id_fkey" FOREIGN KEY ("to_unit_id") REFERENCES "organizational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_unit_returns" ADD CONSTRAINT "document_unit_returns_rerouted_by_id_fkey" FOREIGN KEY ("rerouted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

