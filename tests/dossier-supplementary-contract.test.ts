/**
 * Test: Dossier Supplementary Schema Validation
 *
 * Covers FinalizeArchiveSchema, DossierNotesActionSchema,
 * and DossierItemIdSchema — schemas not covered by
 * dossier-contract-validation.test.ts.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  FinalizeArchiveSchema,
  DossierNotesActionSchema,
  DossierItemIdSchema,
} from "@/contracts/dossiers";

// ---------------------------------------------------------------------------
// FinalizeArchiveSchema
// ---------------------------------------------------------------------------
describe("FinalizeArchiveSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = FinalizeArchiveSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with storageLocation and notes", () => {
    const result = FinalizeArchiveSchema.safeParse({
      storageLocation: "Kho lưu trữ tầng 2, tủ B",
      notes: "Nộp lưu theo kế hoạch năm 2026",
    });
    assert.ok(result.success);
  });

  test("rejects storageLocation exceeding 255 chars", () => {
    const result = FinalizeArchiveSchema.safeParse({
      storageLocation: "X".repeat(256),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = FinalizeArchiveSchema.safeParse({
      notes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = FinalizeArchiveSchema.safeParse({
      storageLocation: "Tủ A",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false, "Strict mode rejects unknown fields");
  });
});

// ---------------------------------------------------------------------------
// DossierNotesActionSchema
// ---------------------------------------------------------------------------
describe("DossierNotesActionSchema validation", () => {
  test("accepts empty body (notes optional)", () => {
    const result = DossierNotesActionSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with notes", () => {
    const result = DossierNotesActionSchema.safeParse({
      notes: "Ghi chú bổ sung cho hồ sơ",
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = DossierNotesActionSchema.safeParse({
      notes: "Z".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = DossierNotesActionSchema.safeParse({
      notes: "OK",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false, "Strict mode rejects unknown fields");
  });
});

// ---------------------------------------------------------------------------
// DossierItemIdSchema
// ---------------------------------------------------------------------------
describe("DossierItemIdSchema validation", () => {
  test("accepts valid item ID", () => {
    const result = DossierItemIdSchema.safeParse("item-abc-123");
    assert.ok(result.success);
  });

  test("rejects empty string", () => {
    const result = DossierItemIdSchema.safeParse("");
    assert.strictEqual(result.success, false);
  });

  test("rejects whitespace-only string", () => {
    const result = DossierItemIdSchema.safeParse("   ");
    assert.strictEqual(result.success, false, "Trim makes it empty → min(1) fails");
  });

  test("rejects string exceeding 128 chars", () => {
    const result = DossierItemIdSchema.safeParse("X".repeat(129));
    assert.strictEqual(result.success, false);
  });

  test("accepts exactly 128 chars", () => {
    const result = DossierItemIdSchema.safeParse("A".repeat(128));
    assert.ok(result.success);
  });
});
