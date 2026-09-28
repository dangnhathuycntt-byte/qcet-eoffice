/**
 * Test: UpdateDocumentSchema Boundary Validation
 *
 * Verifies UpdateDocumentSchema boundary conditions for
 * the PATCH /api/documents/[id] endpoint.
 *
 * Schema is `.strict()` — unknown fields are rejected.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { UpdateDocumentSchema } from "@/contracts/documents";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Generate a string of exactly `n` characters. */
const chars = (n: number) => "a".repeat(n);

/* ------------------------------------------------------------------ */
/*  1. Empty body (all fields optional)                                */
/* ------------------------------------------------------------------ */

describe("UpdateDocumentSchema validation", () => {
  test("accepts empty object (all fields optional)", () => {
    const result = UpdateDocumentSchema.safeParse({});
    assert.ok(result.success);
  });

  /* ---------------------------------------------------------------- */
  /*  2. Full input with every field                                   */
  /* ---------------------------------------------------------------- */

  test("accepts full input with all fields populated", () => {
    const result = UpdateDocumentSchema.safeParse({
      title: "Công văn số 123/BGDĐT-VP",
      summary: "Về việc triển khai kế hoạch năm học mới",
      documentNumber: "123/BGDĐT-VP",
      originalNumber: "SĐ-456",
      type: "INCOMING",
      leadUnitId: "unit-cntt",
      departmentId: "dept-01",
      fileUrl: "https://storage.example.com/docs/cv-123.pdf",
      urgency: "KHAN",
      securityLevel: "THUONG",
      status: "DANG_XU_LY",
      category: "Công văn",
      issuingAuthority: "Bộ Giáo dục và Đào tạo",
      dueDate: "2025-03-15T17:00:00+07:00",
      signerName: "Nguyễn Văn A",
      signerTitle: "Vụ trưởng",
      leadUserId: "user-001",
      recipientList: "Phòng Đào tạo, Phòng CNTT, Phòng TCCB",
      distributedCopies: 3,
      notes: "Cần xử lý gấp trước 15/03",
      linkedTaskId: "task-abc-123",
    });
    assert.ok(result.success);
  });

  /* ---------------------------------------------------------------- */
  /*  3. Accepts null values (nullable fields)                         */
  /* ---------------------------------------------------------------- */

  test("accepts null for all nullable fields", () => {
    const result = UpdateDocumentSchema.safeParse({
      title: null,
      summary: null,
      documentNumber: null,
      originalNumber: null,
      leadUnitId: null,
      departmentId: null,
      fileUrl: null,
      urgency: null,
      securityLevel: null,
      status: null,
      category: null,
      issuingAuthority: null,
      dueDate: null,
      signerName: null,
      signerTitle: null,
      leadUserId: null,
      recipientList: null,
      distributedCopies: null,
      notes: null,
      linkedTaskId: null,
    });
    assert.ok(result.success);
  });

  /* ---------------------------------------------------------------- */
  /*  4. title max 500                                                 */
  /* ---------------------------------------------------------------- */

  test("accepts title at exactly 500 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ title: chars(500) });
    assert.ok(result.success);
  });

  test("rejects title exceeding 500 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ title: chars(501) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  5. summary / notes max 2000                                      */
  /* ---------------------------------------------------------------- */

  test("accepts summary at exactly 2000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ summary: chars(2000) });
    assert.ok(result.success);
  });

  test("rejects summary exceeding 2000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ summary: chars(2001) });
    assert.strictEqual(result.success, false);
  });

  test("accepts notes at exactly 2000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ notes: chars(2000) });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ notes: chars(2001) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  6. documentNumber / originalNumber max 100                       */
  /* ---------------------------------------------------------------- */

  test("accepts documentNumber at exactly 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ documentNumber: chars(100) });
    assert.ok(result.success);
  });

  test("rejects documentNumber exceeding 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ documentNumber: chars(101) });
    assert.strictEqual(result.success, false);
  });

  test("accepts originalNumber at exactly 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ originalNumber: chars(100) });
    assert.ok(result.success);
  });

  test("rejects originalNumber exceeding 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ originalNumber: chars(101) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  7. leadUnitId / departmentId / leadUserId / linkedTaskId max 64   */
  /* ---------------------------------------------------------------- */

  for (const field of ["leadUnitId", "departmentId", "leadUserId", "linkedTaskId"] as const) {
    test(`accepts ${field} at exactly 64 characters`, () => {
      const result = UpdateDocumentSchema.safeParse({ [field]: chars(64) });
      assert.ok(result.success);
    });

    test(`rejects ${field} exceeding 64 characters`, () => {
      const result = UpdateDocumentSchema.safeParse({ [field]: chars(65) });
      assert.strictEqual(result.success, false);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  8. fileUrl max 1024                                              */
  /* ---------------------------------------------------------------- */

  test("accepts fileUrl at exactly 1024 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ fileUrl: chars(1024) });
    assert.ok(result.success);
  });

  test("rejects fileUrl exceeding 1024 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ fileUrl: chars(1025) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  9. category max 100                                              */
  /* ---------------------------------------------------------------- */

  test("accepts category at exactly 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ category: chars(100) });
    assert.ok(result.success);
  });

  test("rejects category exceeding 100 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ category: chars(101) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  10. issuingAuthority / signerName / signerTitle max 255           */
  /* ---------------------------------------------------------------- */

  for (const field of ["issuingAuthority", "signerName", "signerTitle"] as const) {
    test(`accepts ${field} at exactly 255 characters`, () => {
      const result = UpdateDocumentSchema.safeParse({ [field]: chars(255) });
      assert.ok(result.success);
    });

    test(`rejects ${field} exceeding 255 characters`, () => {
      const result = UpdateDocumentSchema.safeParse({ [field]: chars(256) });
      assert.strictEqual(result.success, false);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  11. recipientList max 1000                                       */
  /* ---------------------------------------------------------------- */

  test("accepts recipientList at exactly 1000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ recipientList: chars(1000) });
    assert.ok(result.success);
  });

  test("rejects recipientList exceeding 1000 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ recipientList: chars(1001) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  12. Invalid type enum value rejected                             */
  /* ---------------------------------------------------------------- */

  test("rejects invalid type enum value", () => {
    const result = UpdateDocumentSchema.safeParse({ type: "INVALID_TYPE" });
    assert.strictEqual(result.success, false);
  });

  test("rejects type with wrong casing", () => {
    const result = UpdateDocumentSchema.safeParse({ type: "incoming" });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  13. Valid type enum values accepted (all 6)                      */
  /* ---------------------------------------------------------------- */

  for (const enumValue of [
    "INCOMING",
    "OUTGOING",
    "INTERNAL",
    "VAN_BAN_DEN",
    "VAN_BAN_DI",
    "TO_TRINH_NOI_BO",
  ] as const) {
    test(`accepts type enum value: ${enumValue}`, () => {
      const result = UpdateDocumentSchema.safeParse({ type: enumValue });
      assert.ok(result.success);
    });
  }

  /* ---------------------------------------------------------------- */
  /*  14. Strict mode rejects unknown fields (mass-assignment)         */
  /* ---------------------------------------------------------------- */

  test("rejects unknown field (strict mode — mass-assignment prevention)", () => {
    const result = UpdateDocumentSchema.safeParse({
      title: "Hợp lệ",
      __proto__hack: true,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown field 'role' (privilege escalation guard)", () => {
    const result = UpdateDocumentSchema.safeParse({
      title: "Hợp lệ",
      role: "ADMIN",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown field 'id' (immutable field guard)", () => {
    const result = UpdateDocumentSchema.safeParse({
      title: "Hợp lệ",
      id: "doc-999",
    });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  15. dueDate accepts ISO string, rejects garbage                  */
  /* ---------------------------------------------------------------- */

  test("accepts dueDate as ISO date string", () => {
    const result = UpdateDocumentSchema.safeParse({
      dueDate: "2025-06-15T09:00:00Z",
    });
    assert.ok(result.success);
  });

  test("accepts dueDate as date-only ISO string", () => {
    const result = UpdateDocumentSchema.safeParse({
      dueDate: "2025-06-15",
    });
    assert.ok(result.success);
  });

  test("accepts dueDate as Date object", () => {
    const result = UpdateDocumentSchema.safeParse({
      dueDate: new Date("2025-06-15T09:00:00Z"),
    });
    assert.ok(result.success);
  });

  test("accepts dueDate as null", () => {
    const result = UpdateDocumentSchema.safeParse({ dueDate: null });
    assert.ok(result.success);
  });

  test("accepts dueDate as arbitrary string (union fallback branch)", () => {
    // The union's third arm is z.string().trim(), which accepts any string.
    // This documents the current schema behavior.
    const result = UpdateDocumentSchema.safeParse({
      dueDate: "not-a-date",
    });
    assert.ok(result.success);
  });

  test("rejects dueDate as a number (not string or Date)", () => {
    const result = UpdateDocumentSchema.safeParse({
      dueDate: 1718438400000,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects dueDate as a boolean", () => {
    const result = UpdateDocumentSchema.safeParse({
      dueDate: true,
    });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  Bonus: urgency / securityLevel max 50                            */
  /* ---------------------------------------------------------------- */

  test("accepts urgency at exactly 50 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ urgency: chars(50) });
    assert.ok(result.success);
  });

  test("rejects urgency exceeding 50 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ urgency: chars(51) });
    assert.strictEqual(result.success, false);
  });

  test("accepts securityLevel at exactly 50 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ securityLevel: chars(50) });
    assert.ok(result.success);
  });

  test("rejects securityLevel exceeding 50 characters", () => {
    const result = UpdateDocumentSchema.safeParse({ securityLevel: chars(51) });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  Bonus: distributedCopies coercion & integer                      */
  /* ---------------------------------------------------------------- */

  test("coerces string number to integer for distributedCopies", () => {
    const result = UpdateDocumentSchema.safeParse({ distributedCopies: "5" });
    assert.ok(result.success);
    assert.strictEqual(result.data.distributedCopies, 5);
  });

  test("rejects non-integer for distributedCopies", () => {
    const result = UpdateDocumentSchema.safeParse({ distributedCopies: 3.5 });
    assert.strictEqual(result.success, false);
  });

  /* ---------------------------------------------------------------- */
  /*  Bonus: valid status enum values                                  */
  /* ---------------------------------------------------------------- */

  test("rejects invalid status enum value", () => {
    const result = UpdateDocumentSchema.safeParse({ status: "BOGUS_STATUS" });
    assert.strictEqual(result.success, false);
  });

  test("accepts valid status enum value", () => {
    const result = UpdateDocumentSchema.safeParse({ status: "DANG_XU_LY" });
    assert.ok(result.success);
  });
});
