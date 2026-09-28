/**
 * Test: Document Creation & Revision Contract Validation
 *
 * Verifies CreateDocumentSchema, RegisterIncomingDocumentSchema,
 * CreateDocumentRevisionSchema, SignDocumentSchema,
 * SubmitContentReviewSchema, and SubmitFormatCheckSchema boundary conditions.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CreateDocumentSchema,
  RegisterIncomingDocumentSchema,
  CreateDocumentRevisionSchema,
  SignDocumentSchema,
  SubmitContentReviewSchema,
  SubmitFormatCheckSchema,
} from "@/contracts/documents";

// ---------------------------------------------------------------------------
// CreateDocumentSchema
// ---------------------------------------------------------------------------
describe("CreateDocumentSchema validation", () => {
  const validBase = {
    type: "INCOMING" as const,
    title: "Quyết định số 123/QĐ-UBND",
    documentNumber: "123/QĐ-UBND",
  };

  test("accepts valid minimal document (title + documentNumber + type)", () => {
    const result = CreateDocumentSchema.safeParse(validBase);
    assert.ok(result.success);
  });

  test("accepts document with summary instead of title", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      summary: "Về việc phê duyệt kế hoạch",
      originalNumber: "ABC-001",
    });
    assert.ok(result.success);
  });

  test("accepts document with originalNumber instead of documentNumber", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      title: "Công văn hợp lệ",
      originalNumber: "CV-2026-001",
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateDocumentSchema.safeParse({
      ...validBase,
      summary: "Trích yếu nội dung",
      originalNumber: "ABC-001",
      leadUnitId: "unit-cntt",
      departmentId: "dept-1",
      leadUserId: "user-1",
      fileUrl: "/uploads/doc.pdf",
      urgency: "KHAN",
      securityLevel: "THUONG",
      issuedDate: "2026-09-28T00:00:00.000Z",
      registeredDate: "2026-09-28T00:00:00.000Z",
      dueDate: "2026-10-15T00:00:00.000Z",
      issuingAuthority: "UBND Tỉnh",
      category: "Công văn",
      documentYear: 2026,
      registrationNumber: 1,
      signerName: "Nguyễn Văn A",
      signerTitle: "Giám đốc",
      recipientList: "Phòng CNTT, Phòng Đào tạo",
      distributedCopies: 5,
      notes: "Ghi chú bổ sung",
      authorizedSignerId: "user-signer",
      attachments: [
        { fileName: "phuluc.pdf", fileUrl: "/uploads/phuluc.pdf" },
      ],
    });
    assert.ok(result.success);
  });

  test("rejects missing both title AND summary (refine 1)", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      documentNumber: "123/QĐ",
    });
    assert.strictEqual(result.success, false, "Requires title or summary");
  });

  test("rejects missing both documentNumber AND originalNumber (refine 2)", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      title: "Tiêu đề hợp lệ",
    });
    assert.strictEqual(result.success, false, "Requires documentNumber or originalNumber");
  });

  test("rejects title shorter than 3 chars", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      title: "AB",
      documentNumber: "123",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      title: "T".repeat(256),
      documentNumber: "123",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects summary exceeding 2000 chars", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INCOMING",
      title: "Tiêu đề OK",
      summary: "S".repeat(2001),
      documentNumber: "123",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid document type", () => {
    const result = CreateDocumentSchema.safeParse({
      type: "INVALID_TYPE",
      title: "Tiêu đề OK",
      documentNumber: "123",
    });
    assert.strictEqual(result.success, false);
  });

  test("accepts all valid document types", () => {
    for (const docType of ["INCOMING", "OUTGOING", "INTERNAL", "VAN_BAN_DEN", "VAN_BAN_DI", "TO_TRINH_NOI_BO"]) {
      const result = CreateDocumentSchema.safeParse({
        type: docType,
        title: "Văn bản " + docType,
        documentNumber: "NUM-" + docType,
      });
      assert.ok(result.success, `Type ${docType} should be valid`);
    }
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = CreateDocumentSchema.safeParse({
      ...validBase,
      registeredById: "injected-user-id",
    });
    assert.strictEqual(result.success, false, "Strict mode prevents mass-assignment");
  });

  test("rejects documentYear below 2000", () => {
    const result = CreateDocumentSchema.safeParse({
      ...validBase,
      documentYear: 1999,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects documentYear above 2100", () => {
    const result = CreateDocumentSchema.safeParse({
      ...validBase,
      documentYear: 2101,
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// RegisterIncomingDocumentSchema
// ---------------------------------------------------------------------------
describe("RegisterIncomingDocumentSchema validation", () => {
  const validBase = {
    title: "Công văn số 456/CV-STC",
    issuingAuthority: "Sở Tài chính",
  };

  test("accepts valid minimal input (title + issuingAuthority)", () => {
    const result = RegisterIncomingDocumentSchema.safeParse(validBase);
    assert.ok(result.success);
  });

  test("accepts sender instead of issuingAuthority", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      title: "Công văn hợp lệ",
      sender: "Phòng GD&ĐT",
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      registrationNumber: 42,
      documentNumber: "456/CV-STC",
      originalNumber: "456-ORIG",
      originalDocNumber: "456-ORIG-ALT",
      documentType: "Công văn",
      summary: "Về việc cấp kinh phí",
      category: "Tài chính",
      sender: "Sở TC",
      issuedDate: "2026-09-01T00:00:00.000Z",
      receivedDate: "2026-09-05T00:00:00.000Z",
      securityLevel: "THUONG",
      urgency: "KHAN",
      fileUrl: "/uploads/incoming.pdf",
      fileName: "cv-456.pdf",
      fileSize: 1024 * 500,
      fileType: "application/pdf",
      storageLocation: "Tủ A ngăn 2",
      notes: "Ghi chú bổ sung",
      metadata: { source: "email" },
    });
    assert.ok(result.success);
  });

  test("rejects title shorter than 3 chars", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      title: "AB",
      issuingAuthority: "Sở TC",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      title: "T".repeat(256),
      issuingAuthority: "Sở TC",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing both issuingAuthority AND sender (refine)", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      title: "Công văn hợp lệ",
    });
    assert.strictEqual(result.success, false, "issuingAuthority or sender required");
  });

  test("rejects invalid securityLevel enum", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      securityLevel: "TOP_SECRET",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid urgency enum", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      urgency: "SUPER_URGENT",
    });
    assert.strictEqual(result.success, false);
  });

  test("accepts all valid securityLevel values", () => {
    for (const level of ["THUONG", "MAT", "TOI_MAT", "TUYET_MAT"]) {
      const result = RegisterIncomingDocumentSchema.safeParse({
        ...validBase,
        securityLevel: level,
      });
      assert.ok(result.success, `Security level ${level} should be valid`);
    }
  });

  test("accepts all valid urgency values", () => {
    for (const urg of ["THUONG", "KHAN", "THUONG_KHAN", "HOA_TOC"]) {
      const result = RegisterIncomingDocumentSchema.safeParse({
        ...validBase,
        urgency: urg,
      });
      assert.ok(result.success, `Urgency ${urg} should be valid`);
    }
  });

  test("rejects fileSize exceeding 100MB", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      fileSize: 101 * 1024 * 1024,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      registeredById: "injected-user",
    });
    assert.strictEqual(result.success, false, "Strict mode prevents mass-assignment");
  });

  test("accepts documentNumber as integer", () => {
    const result = RegisterIncomingDocumentSchema.safeParse({
      ...validBase,
      documentNumber: 456,
    });
    assert.ok(result.success, "documentNumber union accepts number");
  });
});

// ---------------------------------------------------------------------------
// CreateDocumentRevisionSchema
// ---------------------------------------------------------------------------
describe("CreateDocumentRevisionSchema validation", () => {
  test("accepts valid minimal revision (changeReason only)", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      changeReason: "Sửa lỗi chính tả trong nội dung văn bản",
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      changeReason: "Bổ sung phụ lục theo yêu cầu BGH",
      title: "Bản sửa đổi lần 2",
      summary: "Bổ sung phụ lục A và B",
      fileUrl: "/uploads/revision-v2.pdf",
      fileName: "congvan-v2.pdf",
      fileSize: 2048,
    });
    assert.ok(result.success);
  });

  test("rejects empty changeReason", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      changeReason: "",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing changeReason", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      title: "Bản sửa đổi",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects changeReason exceeding 2000 chars", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      changeReason: "R".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = CreateDocumentRevisionSchema.safeParse({
      changeReason: "Lý do hợp lệ",
      createdById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// SignDocumentSchema
// ---------------------------------------------------------------------------
describe("SignDocumentSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = SignDocumentSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts full input with all fields", () => {
    const result = SignDocumentSchema.safeParse({
      signingCapacity: "Hiệu trưởng",
      signatureType: "PERSONAL_DIGITAL",
      certificateMetadata: { provider: "VNPT-CA", serial: "ABC123" },
      signingNotes: "Ký xác nhận nội dung đã duyệt",
    });
    assert.ok(result.success);
  });

  test("accepts all valid signatureType values", () => {
    for (const st of ["PERSONAL_DIGITAL", "ORGANIZATION_DIGITAL", "PHYSICAL"]) {
      const result = SignDocumentSchema.safeParse({ signatureType: st });
      assert.ok(result.success, `SignatureType ${st} should be valid`);
    }
  });

  test("rejects invalid signatureType", () => {
    const result = SignDocumentSchema.safeParse({
      signatureType: "ELECTRONIC",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects signingCapacity exceeding 255 chars", () => {
    const result = SignDocumentSchema.safeParse({
      signingCapacity: "C".repeat(256),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects signingNotes exceeding 2000 chars", () => {
    const result = SignDocumentSchema.safeParse({
      signingNotes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = SignDocumentSchema.safeParse({
      signedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// SubmitContentReviewSchema
// ---------------------------------------------------------------------------
describe("SubmitContentReviewSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = SubmitContentReviewSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts full input", () => {
    const result = SubmitContentReviewSchema.safeParse({
      contentReviewerId: "user-reviewer-1",
      notes: "Gửi phòng CNTT kiểm tra nội dung",
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = SubmitContentReviewSchema.safeParse({
      notes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = SubmitContentReviewSchema.safeParse({
      status: "APPROVED",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// SubmitFormatCheckSchema
// ---------------------------------------------------------------------------
describe("SubmitFormatCheckSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = SubmitFormatCheckSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts full input", () => {
    const result = SubmitFormatCheckSchema.safeParse({
      formatReviewerId: "user-vanthu-1",
      notes: "Kiểm tra thể thức theo Nghị định 30",
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = SubmitFormatCheckSchema.safeParse({
      notes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = SubmitFormatCheckSchema.safeParse({
      approved: true,
    });
    assert.strictEqual(result.success, false);
  });
});
