/**
 * Test: Document Query Contract Validation
 *
 * Verifies DocumentQuerySchema boundary conditions for document listing endpoints.
 * Covers pagination defaults, type enum values, coercion, field length limits,
 * year boundaries, and non-strict passthrough behavior.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DocumentQuerySchema } from "@/contracts/documents";

describe("DocumentQuerySchema validation", () => {
  // ── 1. Empty query defaults ───────────────────────────────────────────

  test("empty query defaults page=1 and pageSize=20", () => {
    const result = DocumentQuerySchema.safeParse({});
    assert.ok(result.success);
    assert.strictEqual(result.data.page, 1);
    assert.strictEqual(result.data.pageSize, 20);
  });

  // ── 2. All valid type enum values ─────────────────────────────────────

  const validTypes = [
    "INCOMING",
    "OUTGOING",
    "INTERNAL",
    "VAN_BAN_DEN",
    "VAN_BAN_DI",
    "TO_TRINH_NOI_BO",
    "inbox",
    "outbox",
    "all",
  ] as const;

  for (const type of validTypes) {
    test(`accepts type="${type}"`, () => {
      const result = DocumentQuerySchema.safeParse({ type });
      assert.ok(result.success, `type="${type}" should be accepted`);
      assert.strictEqual(result.data.type, type);
    });
  }

  test("rejects invalid type value", () => {
    const result = DocumentQuerySchema.safeParse({ type: "UNKNOWN" });
    assert.strictEqual(result.success, false);
  });

  // ── 3. Full query with all optional fields ────────────────────────────

  test("accepts full query with all optional fields populated", () => {
    const result = DocumentQuerySchema.safeParse({
      page: 2,
      pageSize: 50,
      cursor: "cursor-abc",
      limit: 25,
      type: "INCOMING",
      status: "DANG_XU_LY",
      leadUnitId: "unit-cntt",
      departmentId: "dept-01",
      search: "văn bản cần tìm",
      q: "tìm kiếm",
      urgency: "KHAN",
      securityLevel: "MAT",
      documentYear: 2025,
      year: 2024,
      scope: "school",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data.page, 2);
    assert.strictEqual(result.data.pageSize, 50);
    assert.strictEqual(result.data.cursor, "cursor-abc");
    assert.strictEqual(result.data.limit, 25);
    assert.strictEqual(result.data.type, "INCOMING");
    assert.strictEqual(result.data.status, "DANG_XU_LY");
    assert.strictEqual(result.data.leadUnitId, "unit-cntt");
    assert.strictEqual(result.data.departmentId, "dept-01");
    assert.strictEqual(result.data.search, "văn bản cần tìm");
    assert.strictEqual(result.data.q, "tìm kiếm");
    assert.strictEqual(result.data.urgency, "KHAN");
    assert.strictEqual(result.data.securityLevel, "MAT");
    assert.strictEqual(result.data.documentYear, 2025);
    assert.strictEqual(result.data.year, 2024);
    assert.strictEqual(result.data.scope, "school");
  });

  // ── 4. Coercion of string values to numbers ──────────────────────────

  test("coerces string page/pageSize to numbers", () => {
    const result = DocumentQuerySchema.safeParse({
      page: "3",
      pageSize: "50",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data.page, 3);
    assert.strictEqual(result.data.pageSize, 50);
  });

  test("coerces string year and documentYear to numbers", () => {
    const result = DocumentQuerySchema.safeParse({
      year: "2025",
      documentYear: "2024",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data.year, 2025);
    assert.strictEqual(result.data.documentYear, 2024);
  });

  test("coerces string limit to number", () => {
    const result = DocumentQuerySchema.safeParse({ limit: "10" });
    assert.ok(result.success);
    assert.strictEqual(result.data.limit, 10);
  });

  // ── 5. limit boundaries ──────────────────────────────────────────────

  test("accepts limit=1 (minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ limit: 1 });
    assert.ok(result.success);
    assert.strictEqual(result.data.limit, 1);
  });

  test("accepts limit=100 (maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ limit: 100 });
    assert.ok(result.success);
    assert.strictEqual(result.data.limit, 100);
  });

  test("rejects limit=0 (below minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ limit: 0 });
    assert.strictEqual(result.success, false);
  });

  test("rejects limit=101 (above maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ limit: 101 });
    assert.strictEqual(result.success, false);
  });

  // ── 6. page boundaries ───────────────────────────────────────────────

  test("accepts page=1 (minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ page: 1 });
    assert.ok(result.success);
    assert.strictEqual(result.data.page, 1);
  });

  test("rejects page=0 (below minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ page: 0 });
    assert.strictEqual(result.success, false);
  });

  // ── 7. pageSize boundaries ───────────────────────────────────────────

  test("accepts pageSize=1 (minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ pageSize: 1 });
    assert.ok(result.success);
    assert.strictEqual(result.data.pageSize, 1);
  });

  test("accepts pageSize=100 (maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ pageSize: 100 });
    assert.ok(result.success);
    assert.strictEqual(result.data.pageSize, 100);
  });

  test("rejects pageSize=0 (below minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ pageSize: 0 });
    assert.strictEqual(result.success, false);
  });

  test("rejects pageSize=101 (above maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ pageSize: 101 });
    assert.strictEqual(result.success, false);
  });

  // ── 8. year/documentYear boundaries ──────────────────────────────────

  test("accepts year=2000 (minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ year: 2000 });
    assert.ok(result.success);
    assert.strictEqual(result.data.year, 2000);
  });

  test("accepts year=2100 (maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ year: 2100 });
    assert.ok(result.success);
    assert.strictEqual(result.data.year, 2100);
  });

  test("rejects year=1999 (below minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ year: 1999 });
    assert.strictEqual(result.success, false);
  });

  test("rejects year=2101 (above maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ year: 2101 });
    assert.strictEqual(result.success, false);
  });

  test("accepts documentYear=2000 (minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ documentYear: 2000 });
    assert.ok(result.success);
    assert.strictEqual(result.data.documentYear, 2000);
  });

  test("accepts documentYear=2100 (maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ documentYear: 2100 });
    assert.ok(result.success);
    assert.strictEqual(result.data.documentYear, 2100);
  });

  test("rejects documentYear=1999 (below minimum)", () => {
    const result = DocumentQuerySchema.safeParse({ documentYear: 1999 });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentYear=2101 (above maximum)", () => {
    const result = DocumentQuerySchema.safeParse({ documentYear: 2101 });
    assert.strictEqual(result.success, false);
  });

  // ── 9. search/q max length ───────────────────────────────────────────

  test("accepts search at exactly 200 characters", () => {
    const result = DocumentQuerySchema.safeParse({ search: "a".repeat(200) });
    assert.ok(result.success);
  });

  test("rejects search exceeding 200 characters", () => {
    const result = DocumentQuerySchema.safeParse({ search: "a".repeat(201) });
    assert.strictEqual(result.success, false);
  });

  test("accepts q at exactly 200 characters", () => {
    const result = DocumentQuerySchema.safeParse({ q: "a".repeat(200) });
    assert.ok(result.success);
  });

  test("rejects q exceeding 200 characters", () => {
    const result = DocumentQuerySchema.safeParse({ q: "a".repeat(201) });
    assert.strictEqual(result.success, false);
  });

  // ── 10. leadUnitId/departmentId max length ────────────────────────────

  test("accepts leadUnitId at exactly 64 characters", () => {
    const result = DocumentQuerySchema.safeParse({ leadUnitId: "x".repeat(64) });
    assert.ok(result.success);
  });

  test("rejects leadUnitId exceeding 64 characters", () => {
    const result = DocumentQuerySchema.safeParse({ leadUnitId: "x".repeat(65) });
    assert.strictEqual(result.success, false);
  });

  test("accepts departmentId at exactly 64 characters", () => {
    const result = DocumentQuerySchema.safeParse({ departmentId: "y".repeat(64) });
    assert.ok(result.success);
  });

  test("rejects departmentId exceeding 64 characters", () => {
    const result = DocumentQuerySchema.safeParse({ departmentId: "y".repeat(65) });
    assert.strictEqual(result.success, false);
  });

  // ── 11. NOT strict — extra fields pass through ────────────────────────

  test("allows extra fields to pass through (not strict)", () => {
    const result = DocumentQuerySchema.safeParse({
      page: 1,
      customField: "hello",
      anotherExtra: 42,
    });
    assert.ok(result.success);
  });

  // ── 12. cursor max length ─────────────────────────────────────────────

  test("accepts cursor at exactly 100 characters", () => {
    const result = DocumentQuerySchema.safeParse({ cursor: "c".repeat(100) });
    assert.ok(result.success);
  });

  test("rejects cursor exceeding 100 characters", () => {
    const result = DocumentQuerySchema.safeParse({ cursor: "c".repeat(101) });
    assert.strictEqual(result.success, false);
  });

  // ── Status enum coverage ──────────────────────────────────────────────

  const validStatuses = [
    "CHO_PHAN_CONG",
    "DANG_XU_LY",
    "CHO_PHE_DUYET",
    "DA_HOAN_THANH",
    "LUU_THEO_DOI",
    "pending_assignment",
    "processing",
    "delegated",
    "approved",
    "completed",
  ] as const;

  for (const status of validStatuses) {
    test(`accepts status="${status}"`, () => {
      const result = DocumentQuerySchema.safeParse({ status });
      assert.ok(result.success, `status="${status}" should be accepted`);
      assert.strictEqual(result.data.status, status);
    });
  }

  test("rejects invalid status value", () => {
    const result = DocumentQuerySchema.safeParse({ status: "INVALID_STATUS" });
    assert.strictEqual(result.success, false);
  });

  // ── Trimming behavior ─────────────────────────────────────────────────

  test("trims whitespace from string fields", () => {
    const result = DocumentQuerySchema.safeParse({
      search: "  tìm kiếm  ",
      q: "  query  ",
      leadUnitId: "  unit-01  ",
      departmentId: "  dept-01  ",
      cursor: "  cursor-abc  ",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data.search, "tìm kiếm");
    assert.strictEqual(result.data.q, "query");
    assert.strictEqual(result.data.leadUnitId, "unit-01");
    assert.strictEqual(result.data.departmentId, "dept-01");
    assert.strictEqual(result.data.cursor, "cursor-abc");
  });
});
