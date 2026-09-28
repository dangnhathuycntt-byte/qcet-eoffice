/**
 * Test: Batch Document Request Contract Validation
 *
 * Verifies BatchDocumentRequestSchema boundary conditions
 * for the POST /api/documents/batch endpoint.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { BatchDocumentRequestSchema } from "@/contracts/documents";

describe("BatchDocumentRequestSchema validation", () => {
  test("accepts valid MARK_RESOLVED batch", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: ["doc-1", "doc-2"],
      resolutionSummary: "Đã xử lý xong",
    });
    assert.ok(result.success);
  });

  test("accepts valid ASSIGN_LEAD_UNIT batch with required leadUnitId", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "ASSIGN_LEAD_UNIT",
      documentIds: ["doc-1"],
      leadUnitId: "unit-cntt",
      instruction: "Xử lý gấp theo chỉ đạo BGH",
    });
    assert.ok(result.success);
  });

  test("accepts valid FILE_DOCUMENTS batch", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "FILE_DOCUMENTS",
      documentIds: ["doc-1", "doc-2", "doc-3"],
      dossierId: "dossier-1",
      storageLocation: "Tủ A ngăn 3",
      filingNotes: "Nộp lưu theo kế hoạch Q3",
    });
    assert.ok(result.success);
  });

  test("rejects empty documentIds array", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: [],
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentIds exceeding 100 items", () => {
    const ids = Array.from({ length: 101 }, (_, i) => `doc-${i}`);
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: ids,
    });
    assert.strictEqual(result.success, false);
  });

  test("accepts exactly 100 documentIds", () => {
    const ids = Array.from({ length: 100 }, (_, i) => `doc-${i}`);
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: ids,
    });
    assert.ok(result.success);
  });

  test("rejects ASSIGN_LEAD_UNIT without leadUnitId (refine)", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "ASSIGN_LEAD_UNIT",
      documentIds: ["doc-1"],
    });
    assert.strictEqual(result.success, false, "ASSIGN_LEAD_UNIT requires leadUnitId");
  });

  test("rejects ASSIGN_LEAD_UNIT with empty leadUnitId", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "ASSIGN_LEAD_UNIT",
      documentIds: ["doc-1"],
      leadUnitId: "  ",
    });
    assert.strictEqual(result.success, false, "Whitespace-only leadUnitId should fail");
  });

  test("rejects invalid action value", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "DELETE_ALL",
      documentIds: ["doc-1"],
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: ["doc-1"],
      maliciousField: "injection",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentIds with empty string entries", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
      documentIds: ["doc-1", ""],
    });
    assert.strictEqual(result.success, false, "Empty string doc ID should fail");
  });

  test("rejects missing action", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      documentIds: ["doc-1"],
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing documentIds", () => {
    const result = BatchDocumentRequestSchema.safeParse({
      action: "MARK_RESOLVED",
    });
    assert.strictEqual(result.success, false);
  });
});
