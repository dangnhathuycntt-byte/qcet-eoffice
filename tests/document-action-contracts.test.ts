/**
 * Test: Document Action Contract Validation
 *
 * Verifies CreateDirectiveSchema, ResolveDocumentSchema,
 * RejectContentDocumentSchema, DeliverOutgoingDocumentSchema,
 * and CreateOutgoingDraftSchema boundary conditions.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CreateDirectiveSchema,
  ResolveDocumentSchema,
  RejectContentDocumentSchema,
  DeliverOutgoingDocumentSchema,
  CreateOutgoingDraftSchema,
  PresentDocumentSchema,
} from "@/contracts/documents";

describe("CreateDirectiveSchema validation", () => {
  test("accepts valid directive with instruction + leadUnitId", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "Giao phòng CNTT xử lý theo quy trình",
      leadUnitId: "unit-cntt",
    });
    assert.ok(result.success);
  });

  test("accepts directive with content instead of instruction", () => {
    const result = CreateDirectiveSchema.safeParse({
      content: "Phê duyệt theo đề xuất của phòng Đào tạo",
      leadUnitId: "unit-dt",
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateDirectiveSchema.safeParse({
      title: "Chỉ đạo xử lý văn bản 123",
      instruction: "Xử lý gấp",
      content: "Nội dung chi tiết",
      leaderId: "user-bgh-1",
      leadUnitId: "unit-cntt",
      deadline: "2026-10-15T00:00:00.000Z",
      collaboratorIds: ["user-1", "user-2"],
    });
    assert.ok(result.success);
  });

  test("accepts collaboratorIds as comma-separated string", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "Phối hợp xử lý",
      leadUnitId: "unit-dt",
      collaboratorIds: "user-1,user-2,user-3",
    });
    assert.ok(result.success);
  });

  test("rejects missing instruction AND content (refine)", () => {
    const result = CreateDirectiveSchema.safeParse({
      leadUnitId: "unit-cntt",
    });
    assert.strictEqual(result.success, false, "Requires instruction or content");
  });

  test("rejects empty instruction with no content", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "  ",
      leadUnitId: "unit-cntt",
    });
    assert.strictEqual(result.success, false, "Whitespace-only instruction should fail");
  });

  test("rejects missing leadUnitId (refine)", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "Xử lý theo quy trình",
    });
    assert.strictEqual(result.success, false, "leadUnitId is required");
  });

  test("rejects empty leadUnitId", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "Xử lý theo quy trình",
      leadUnitId: "  ",
    });
    assert.strictEqual(result.success, false, "Whitespace-only leadUnitId should fail");
  });

  test("rejects instruction exceeding 5000 chars", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "X".repeat(5001),
      leadUnitId: "unit-cntt",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = CreateDirectiveSchema.safeParse({
      instruction: "Xử lý gấp",
      leadUnitId: "unit-cntt",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false, "Strict mode rejects unknown fields");
  });
});

describe("ResolveDocumentSchema validation", () => {
  test("accepts valid resolution", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "Đã xử lý xong theo chỉ đạo",
    });
    assert.ok(result.success);
  });

  test("accepts resolution with all fields", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "Đã triển khai hoàn tất",
      resolutionDocUrl: "/uploads/result.pdf",
      notes: "Kèm biên bản",
    });
    assert.ok(result.success);
  });

  test("rejects empty resolutionSummary", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "",
    });
    assert.strictEqual(result.success, false, "Empty resolution summary should fail");
  });

  test("rejects missing resolutionSummary", () => {
    const result = ResolveDocumentSchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test("rejects resolutionSummary exceeding 5000 chars", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "Y".repeat(5001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "Đã xử lý",
      notes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = ResolveDocumentSchema.safeParse({
      resolutionSummary: "Đã xử lý",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("RejectContentDocumentSchema validation", () => {
  test("accepts empty body (notes optional)", () => {
    const result = RejectContentDocumentSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with notes", () => {
    const result = RejectContentDocumentSchema.safeParse({
      notes: "Nội dung chưa đúng mẫu, cần chỉnh sửa lại",
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = RejectContentDocumentSchema.safeParse({
      notes: "Z".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = RejectContentDocumentSchema.safeParse({
      notes: "OK",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("DeliverOutgoingDocumentSchema validation", () => {
  test("accepts empty body", () => {
    const result = DeliverOutgoingDocumentSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts with delivery notes", () => {
    const result = DeliverOutgoingDocumentSchema.safeParse({
      deliveryNotes: "Đã gửi qua bưu điện ngày 28/09",
    });
    assert.ok(result.success);
  });

  test("rejects deliveryNotes exceeding 2000 chars", () => {
    const result = DeliverOutgoingDocumentSchema.safeParse({
      deliveryNotes: "D".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = DeliverOutgoingDocumentSchema.safeParse({
      deliveryNotes: "OK",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("CreateOutgoingDraftSchema validation", () => {
  test("accepts valid minimal draft", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn về việc triển khai kế hoạch",
    });
    assert.ok(result.success);
  });

  test("accepts full draft with all optional fields", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn gửi Sở GD&ĐT",
      summary: "Báo cáo kết quả triển khai đề án",
      category: "Công văn",
      securityLevel: "THUONG",
      urgency: "KHAN",
      documentType: "VAN_BAN_DI",
      draftingDeptId: "unit-cntt",
      authorizedSignerId: "user-bgh-1",
      recipientList: "Sở GD&ĐT, UBND Tỉnh",
      fileUrl: "/uploads/draft.pdf",
      fileName: "congvan-draft.pdf",
      fileSize: 1024 * 512,
      fileType: "application/pdf",
      notes: "Dự thảo lần 1",
    });
    assert.ok(result.success);
  });

  test("rejects title shorter than 3 chars", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "AB",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "T".repeat(256),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing title", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      summary: "Nội dung",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid securityLevel", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn hợp lệ",
      securityLevel: "TOP_SECRET",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects invalid urgency", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn hợp lệ",
      urgency: "SUPER_URGENT",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects fileSize exceeding 100MB", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn hợp lệ",
      fileSize: 101 * 1024 * 1024,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = CreateOutgoingDraftSchema.safeParse({
      title: "Công văn hợp lệ",
      extraField: "inject",
    });
    assert.strictEqual(result.success, false);
  });
});

describe("PresentDocumentSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = PresentDocumentSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts full input", () => {
    const result = PresentDocumentSchema.safeParse({
      presenterNotes: "Văn bản quan trọng, cần xử lý gấp",
      clerkNotes: "Đã kiểm tra thể thức",
      suggestedLeaderId: "user-bgh-1",
    });
    assert.ok(result.success);
  });

  test("rejects presenterNotes exceeding 2000 chars", () => {
    const result = PresentDocumentSchema.safeParse({
      presenterNotes: "P".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = PresentDocumentSchema.safeParse({
      extraField: "inject",
    });
    assert.strictEqual(result.success, false);
  });
});
