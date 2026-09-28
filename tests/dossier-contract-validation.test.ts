/**
 * Test: Dossier Contract Validation
 *
 * Verifies CreateDossierSchema, AddDossierItemSchema, CloseDossierSchema,
 * AcceptArchiveSchema, and RejectArchiveSchema boundary conditions.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CreateDossierSchema,
  AddDossierItemSchema,
  CloseDossierSchema,
  AcceptArchiveSchema,
  RejectArchiveSchema,
} from "@/contracts/dossiers";

describe("CreateDossierSchema validation", () => {
  test("accepts valid minimal input", () => {
    const result = CreateDossierSchema.safeParse({
      title: "Hồ sơ công việc Q4-2026",
      owningUnitId: "unit-cntt",
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateDossierSchema.safeParse({
      title: "Hồ sơ tuyển dụng",
      code: "HS-TD-2026-001",
      owningUnitId: "unit-hr",
      responsiblePersonId: "user-1",
      retentionRuleId: "rule-5y",
      classification: "INTERNAL",
      storageLocation: "Tủ A, ngăn 3",
      notes: "Hồ sơ tuyển dụng đợt 2",
    });
    assert.ok(result.success);
  });

  test("rejects empty title", () => {
    const result = CreateDossierSchema.safeParse({
      title: "",
      owningUnitId: "unit-1",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = CreateDossierSchema.safeParse({
      title: "A".repeat(256),
      owningUnitId: "unit-1",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing owningUnitId", () => {
    const result = CreateDossierSchema.safeParse({
      title: "Hồ sơ hợp lệ",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid classification value", () => {
    const result = CreateDossierSchema.safeParse({
      title: "Hồ sơ hợp lệ",
      owningUnitId: "unit-1",
      classification: "TOP_SECRET",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects extra unknown fields (strict mode)", () => {
    const result = CreateDossierSchema.safeParse({
      title: "Hồ sơ hợp lệ",
      owningUnitId: "unit-1",
      hackerField: "inject",
    });
    assert.strictEqual(result.success, false, "Strict mode rejects unknown fields");
  });

  test("accepts all valid classification values", () => {
    for (const cls of ["PUBLIC", "INTERNAL", "RESTRICTED", "PERSONAL_DATA"]) {
      const result = CreateDossierSchema.safeParse({
        title: "Hồ sơ " + cls,
        owningUnitId: "unit-1",
        classification: cls,
      });
      assert.ok(result.success, `Classification ${cls} should be valid`);
    }
  });
});

describe("AddDossierItemSchema validation", () => {
  test("accepts valid DOCUMENT item", () => {
    const result = AddDossierItemSchema.safeParse({
      itemType: "DOCUMENT",
      documentId: "doc-1",
      title: "Quyết định số 123/QĐ",
      documentNumber: "123/QĐ-CNTT",
      pageCount: 5,
    });
    assert.ok(result.success);
  });

  test("accepts valid ATTACHMENT item with file info", () => {
    const result = AddDossierItemSchema.safeParse({
      itemType: "ATTACHMENT",
      title: "Phụ lục hợp đồng",
      fileUrl: "/uploads/attachment.pdf",
      fileName: "phuluc.pdf",
      fileSize: 1024 * 1024, // 1MB
    });
    assert.ok(result.success);
  });

  test("rejects fileSize exceeding 100MB", () => {
    const result = AddDossierItemSchema.safeParse({
      itemType: "ATTACHMENT",
      title: "File quá lớn",
      fileSize: 101 * 1024 * 1024,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects negative pageCount", () => {
    const result = AddDossierItemSchema.safeParse({
      itemType: "DOCUMENT",
      title: "Tài liệu",
      pageCount: -1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid itemType", () => {
    const result = AddDossierItemSchema.safeParse({
      itemType: "MALWARE",
      title: "Injection attempt",
    });
    assert.strictEqual(result.success, false);
  });

  test("accepts all valid itemType values", () => {
    for (const type of ["DOCUMENT", "TASK", "RESULT", "DECISION", "MEETING_MINUTES", "ATTACHMENT"]) {
      const result = AddDossierItemSchema.safeParse({
        itemType: type,
        title: "Item " + type,
      });
      assert.ok(result.success, `ItemType ${type} should be valid`);
    }
  });
});

describe("CloseDossierSchema validation", () => {
  test("accepts empty body (notes optional)", () => {
    const result = CloseDossierSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with notes and requireAllTasksCompleted", () => {
    const result = CloseDossierSchema.safeParse({
      notes: "Đóng hồ sơ theo chỉ đạo BGH",
      requireAllTasksCompleted: true,
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = CloseDossierSchema.safeParse({
      notes: "X".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });
});

describe("AcceptArchiveSchema validation", () => {
  test("accepts empty body", () => {
    const result = AcceptArchiveSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with valid status ACCEPTED", () => {
    const result = AcceptArchiveSchema.safeParse({
      status: "ACCEPTED",
      storageLocation: "Kho lưu trữ tầng 2",
    });
    assert.ok(result.success);
  });

  test("rejects invalid status value", () => {
    const result = AcceptArchiveSchema.safeParse({
      status: "DELETED",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("RejectArchiveSchema validation", () => {
  test("accepts valid return reason", () => {
    const result = RejectArchiveSchema.safeParse({
      returnReason: "Thiếu biên bản họp ngày 15/09",
    });
    assert.ok(result.success);
  });

  test("rejects empty return reason", () => {
    const result = RejectArchiveSchema.safeParse({
      returnReason: "",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing return reason", () => {
    const result = RejectArchiveSchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test("rejects return reason exceeding 2000 chars", () => {
    const result = RejectArchiveSchema.safeParse({
      returnReason: "Y".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });
});
