/**
 * Test: ExportDocumentQuerySchema Contract Validation
 *
 * Verifies ExportDocumentQuerySchema boundary conditions
 * for the GET /api/documents/download endpoint.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { ExportDocumentQuerySchema } from "@/contracts/documents";

describe("ExportDocumentQuerySchema validation", () => {
  test("accepts valid VAN_BAN_DEN type", () => {
    const result = ExportDocumentQuerySchema.safeParse({ type: "VAN_BAN_DEN" });
    assert.ok(result.success);
  });

  test("accepts valid VAN_BAN_DI type", () => {
    const result = ExportDocumentQuerySchema.safeParse({ type: "VAN_BAN_DI" });
    assert.ok(result.success);
  });

  test("accepts valid inbox alias", () => {
    const result = ExportDocumentQuerySchema.safeParse({ type: "inbox" });
    assert.ok(result.success);
  });

  test("accepts valid outbox alias", () => {
    const result = ExportDocumentQuerySchema.safeParse({ type: "outbox" });
    assert.ok(result.success);
  });

  test("accepts type with year", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DEN",
      year: 2026,
    });
    assert.ok(result.success);
  });

  test("accepts type with documentYear", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DI",
      documentYear: 2025,
    });
    assert.ok(result.success);
  });

  test("accepts type with both year and documentYear", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "inbox",
      year: 2026,
      documentYear: 2025,
    });
    assert.ok(result.success);
  });

  test("coerces string year to number", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DEN",
      year: "2026",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data.year, 2026);
  });

  test("rejects missing type (required)", () => {
    const result = ExportDocumentQuerySchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid type value", () => {
    const result = ExportDocumentQuerySchema.safeParse({ type: "INTERNAL" });
    assert.strictEqual(result.success, false);
  });

  test("rejects year below 2000", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DEN",
      year: 1999,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects year above 2100", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DEN",
      year: 2101,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentYear below 2000", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DI",
      documentYear: 1999,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentYear above 2100", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DI",
      documentYear: 2101,
    });
    assert.strictEqual(result.success, false);
  });

  test("does NOT reject unknown extra fields (not strict)", () => {
    const result = ExportDocumentQuerySchema.safeParse({
      type: "VAN_BAN_DEN",
      extraField: "inject",
    });
    assert.ok(result.success, "Schema is not strict — extra fields pass through");
  });
});
