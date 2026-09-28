/**
 * Test: Task Contract Validation
 *
 * Verifies CreateTaskInputSchema, UpdateTaskMetadataSchema,
 * ChangeTaskStatusSchema, ApproveTaskInputSchema,
 * SubmitDeliverableInputSchema, ReviewDeliverableInputSchema,
 * AssignTaskSchema, and ArchiveTaskSchema boundary conditions.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  CreateTaskInputSchema,
  UpdateTaskMetadataSchema,
  ChangeTaskStatusSchema,
  ApproveTaskInputSchema,
  SubmitDeliverableInputSchema,
  ReviewDeliverableInputSchema,
  AssignTaskSchema,
  ArchiveTaskSchema,
  TaskDeliverableInputSchema,
} from "@/contracts/tasks";

// ---------------------------------------------------------------------------
// CreateTaskInputSchema
// ---------------------------------------------------------------------------
describe("CreateTaskInputSchema validation", () => {
  test("accepts valid minimal task (title + dueDate)", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Triển khai hệ thống quản lý",
      dueDate: "2026-10-15T00:00:00.000Z",
    });
    assert.ok(result.success);
    assert.strictEqual(result.data!.priority, "MEDIUM", "Default priority is MEDIUM");
  });

  test("accepts full input with all optional fields", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Xây dựng báo cáo Q3",
      description: "Mô tả chi tiết về báo cáo quý 3",
      priority: "HIGH",
      departmentId: "unit-cntt",
      leadUnitId: "unit-cntt",
      assigneeId: "user-1",
      dueDate: "2026-10-15T00:00:00.000Z",
      startDate: "2026-09-28T00:00:00.000Z",
      parentTaskId: "task-parent-1",
      scope: "SCHOOL",
      deliverables: [
        { title: "Bản báo cáo", fileUrl: "/uploads/report.pdf" },
      ],
    });
    assert.ok(result.success);
  });

  test("rejects title shorter than 3 chars", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "AB",
      dueDate: "2026-10-15T00:00:00.000Z",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "T".repeat(256),
      dueDate: "2026-10-15T00:00:00.000Z",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing title", () => {
    const result = CreateTaskInputSchema.safeParse({
      dueDate: "2026-10-15T00:00:00.000Z",
      priority: "HIGH",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing dueDate", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Task hợp lệ",
    });
    assert.strictEqual(result.success, false, "dueDate is required");
  });

  test("accepts all valid priority values", () => {
    for (const p of ["LOW", "MEDIUM", "NORMAL", "HIGH", "URGENT", "low", "medium", "normal", "high", "urgent"]) {
      const result = CreateTaskInputSchema.safeParse({
        title: "Task " + p,
        dueDate: "2026-10-15T00:00:00.000Z",
        priority: p,
      });
      assert.ok(result.success, `Priority ${p} should be valid`);
    }
  });

  test("rejects invalid priority", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Task hợp lệ",
      dueDate: "2026-10-15T00:00:00.000Z",
      priority: "CRITICAL",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Task hợp lệ",
      dueDate: "2026-10-15T00:00:00.000Z",
      status: "COMPLETED",
    });
    assert.strictEqual(result.success, false, "Strict mode prevents mass-assignment of status");
  });

  test("rejects createdById injection (strict mode)", () => {
    const result = CreateTaskInputSchema.safeParse({
      title: "Task hợp lệ",
      dueDate: "2026-10-15T00:00:00.000Z",
      createdById: "injected-user",
    });
    assert.strictEqual(result.success, false, "Strict mode prevents createdById injection");
  });
});

// ---------------------------------------------------------------------------
// UpdateTaskMetadataSchema
// ---------------------------------------------------------------------------
describe("UpdateTaskMetadataSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = UpdateTaskMetadataSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts title update only", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      title: "Tiêu đề mới cho nhiệm vụ",
    });
    assert.ok(result.success);
  });

  test("accepts full update with all fields", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      title: "Cập nhật nhiệm vụ",
      description: "Mô tả mới",
      priority: "URGENT",
      startDate: "2026-09-28T00:00:00.000Z",
      dueDate: "2026-10-15T00:00:00.000Z",
      expectedVersion: 1,
      expectedUpdatedAt: "2026-09-28T10:00:00.000Z",
      ifMatch: "etag-value",
    });
    assert.ok(result.success);
  });

  test("rejects title shorter than 3 chars", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      title: "AB",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      title: "T".repeat(256),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects startDate after dueDate (refine)", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      startDate: "2026-10-20T00:00:00.000Z",
      dueDate: "2026-10-15T00:00:00.000Z",
    });
    assert.strictEqual(result.success, false, "Start date cannot be after due date");
  });

  test("accepts startDate equal to dueDate", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      startDate: "2026-10-15T00:00:00.000Z",
      dueDate: "2026-10-15T00:00:00.000Z",
    });
    assert.ok(result.success, "Same start and due date is valid");
  });

  test("rejects negative expectedVersion", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      expectedVersion: -1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = UpdateTaskMetadataSchema.safeParse({
      status: "COMPLETED",
    });
    assert.strictEqual(result.success, false, "Strict mode prevents status injection via metadata update");
  });
});

// ---------------------------------------------------------------------------
// ChangeTaskStatusSchema
// ---------------------------------------------------------------------------
describe("ChangeTaskStatusSchema validation", () => {
  test("accepts valid status change", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      status: "IN_PROGRESS",
    });
    assert.ok(result.success);
  });

  test("accepts status change with comment", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      status: "COMPLETED",
      comment: "Đã hoàn thành theo yêu cầu",
    });
    assert.ok(result.success);
  });

  test("accepts all valid status values", () => {
    for (const s of ["NOT_STARTED", "IN_PROGRESS", "WAITING_APPROVAL", "COMPLETED", "OVERDUE", "CANCELLED",
                      "not_started", "in_progress", "waiting_approval", "completed", "overdue", "cancelled"]) {
      const result = ChangeTaskStatusSchema.safeParse({ status: s });
      assert.ok(result.success, `Status ${s} should be valid`);
    }
  });

  test("rejects invalid status", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      status: "DELETED",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing status", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      comment: "Thiếu status",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects comment exceeding 1000 chars", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      status: "IN_PROGRESS",
      comment: "C".repeat(1001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = ChangeTaskStatusSchema.safeParse({
      status: "COMPLETED",
      approvedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// ApproveTaskInputSchema
// ---------------------------------------------------------------------------
describe("ApproveTaskInputSchema validation", () => {
  test("accepts empty body (all fields optional)", () => {
    const result = ApproveTaskInputSchema.safeParse({});
    assert.ok(result.success);
  });

  test("accepts approval via boolean", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approved: true,
    });
    assert.ok(result.success);
  });

  test("accepts approval via resolution enum", () => {
    const result = ApproveTaskInputSchema.safeParse({
      resolution: "APPROVED",
    });
    assert.ok(result.success);
  });

  test("accepts all valid resolution values", () => {
    for (const r of ["APPROVED", "REJECTED", "REVISION_REQUIRED", "approved", "rejected", "revision_required"]) {
      const result = ApproveTaskInputSchema.safeParse({ resolution: r });
      assert.ok(result.success, `Resolution ${r} should be valid`);
    }
  });

  test("accepts full input with comment + note + expectedVersion", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approved: false,
      resolution: "REJECTED",
      comment: "Cần bổ sung thêm dữ liệu",
      note: "Ghi chú bổ sung",
      expectedVersion: 3,
    });
    assert.ok(result.success);
  });

  test("rejects invalid resolution value", () => {
    const result = ApproveTaskInputSchema.safeParse({
      resolution: "PENDING",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects comment exceeding 1000 chars", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approved: true,
      comment: "C".repeat(1001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects note exceeding 1000 chars", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approved: true,
      note: "N".repeat(1001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects negative expectedVersion", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approved: true,
      expectedVersion: -1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = ApproveTaskInputSchema.safeParse({
      approvedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// SubmitDeliverableInputSchema
// ---------------------------------------------------------------------------
describe("SubmitDeliverableInputSchema validation", () => {
  const validBase = {
    title: "Bản báo cáo Q3",
    fileUrl: "/uploads/report-q3.pdf",
  };

  test("accepts valid minimal deliverable (title + fileUrl)", () => {
    const result = SubmitDeliverableInputSchema.safeParse(validBase);
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      ...validBase,
      fileName: "report-q3.pdf",
      fileType: "application/pdf",
      fileSize: 1024 * 1024, // 1MB
      notes: "Báo cáo lần cuối",
      note: "Ghi chú thêm",
      uploadedById: "user-1",
      expectedVersion: 2,
    });
    assert.ok(result.success);
  });

  test("rejects empty title", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      title: "",
      fileUrl: "/uploads/file.pdf",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing title", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      fileUrl: "/uploads/file.pdf",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects empty fileUrl", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      title: "Deliverable hợp lệ",
      fileUrl: "",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing fileUrl", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      title: "Deliverable hợp lệ",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      title: "T".repeat(256),
      fileUrl: "/uploads/file.pdf",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects fileUrl exceeding 1024 chars", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      title: "Deliverable OK",
      fileUrl: "/uploads/" + "x".repeat(1020),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects fileSize exceeding 50MB", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      ...validBase,
      fileSize: 52428801, // 50MB + 1 byte
    });
    assert.strictEqual(result.success, false);
  });

  test("accepts fileSize at exactly 50MB", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      ...validBase,
      fileSize: 52428800, // exactly 50MB
    });
    assert.ok(result.success);
  });

  test("rejects notes exceeding 2000 chars", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      ...validBase,
      notes: "N".repeat(2001),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = SubmitDeliverableInputSchema.safeParse({
      ...validBase,
      approvedAt: "2026-09-28T00:00:00.000Z",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// ReviewDeliverableInputSchema
// ---------------------------------------------------------------------------
describe("ReviewDeliverableInputSchema validation", () => {
  test("accepts valid review with required fields", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "APPROVED",
      expectedVersion: 1,
    });
    assert.ok(result.success);
  });

  test("accepts full input with all optional fields", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      deliverableId: "del-1",
      reviewStatus: "REVISION_REQUIRED",
      reviewNote: "Cần sửa format bảng biểu",
      note: "Ghi chú thêm",
      comment: "Bình luận",
      expectedVersion: 2,
    });
    assert.ok(result.success);
  });

  test("accepts all valid reviewStatus values", () => {
    for (const s of ["APPROVED", "REJECTED", "REVISION_REQUIRED", "approved", "rejected", "revision_required"]) {
      const result = ReviewDeliverableInputSchema.safeParse({
        reviewStatus: s,
        expectedVersion: 0,
      });
      assert.ok(result.success, `ReviewStatus ${s} should be valid`);
    }
  });

  test("rejects invalid reviewStatus", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "PENDING",
      expectedVersion: 0,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing reviewStatus", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      expectedVersion: 0,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing expectedVersion", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "APPROVED",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects negative expectedVersion", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "APPROVED",
      expectedVersion: -1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects reviewNote exceeding 1000 chars", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "REJECTED",
      reviewNote: "R".repeat(1001),
      expectedVersion: 1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = ReviewDeliverableInputSchema.safeParse({
      reviewStatus: "APPROVED",
      expectedVersion: 1,
      reviewedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// AssignTaskSchema
// ---------------------------------------------------------------------------
describe("AssignTaskSchema validation", () => {
  test("accepts valid assignment with one assignee", () => {
    const result = AssignTaskSchema.safeParse({
      assigneeIds: ["user-1"],
    });
    assert.ok(result.success);
  });

  test("accepts assignment with multiple assignees", () => {
    const result = AssignTaskSchema.safeParse({
      assigneeIds: ["user-1", "user-2", "user-3"],
    });
    assert.ok(result.success);
  });

  test("accepts exactly 50 assignees (max boundary)", () => {
    const ids = Array.from({ length: 50 }, (_, i) => `user-${i}`);
    const result = AssignTaskSchema.safeParse({ assigneeIds: ids });
    assert.ok(result.success);
  });

  test("rejects more than 50 assignees", () => {
    const ids = Array.from({ length: 51 }, (_, i) => `user-${i}`);
    const result = AssignTaskSchema.safeParse({ assigneeIds: ids });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing assigneeIds", () => {
    const result = AssignTaskSchema.safeParse({});
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = AssignTaskSchema.safeParse({
      assigneeIds: ["user-1"],
      assignedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// ArchiveTaskSchema
// ---------------------------------------------------------------------------
describe("ArchiveTaskSchema validation", () => {
  test("accepts valid archive input", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "Nhiệm vụ đã hoàn thành và được lưu trữ",
      expectedVersion: 5,
    });
    assert.ok(result.success);
  });

  test("rejects reason shorter than 3 chars", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "AB",
      expectedVersion: 0,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects reason exceeding 1000 chars", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "R".repeat(1001),
      expectedVersion: 0,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing reason", () => {
    const result = ArchiveTaskSchema.safeParse({
      expectedVersion: 0,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects missing expectedVersion", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "Lý do lưu trữ hợp lệ",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects negative expectedVersion", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "Lý do hợp lệ",
      expectedVersion: -1,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = ArchiveTaskSchema.safeParse({
      reason: "Lý do hợp lệ",
      expectedVersion: 0,
      archivedById: "injected-user",
    });
    assert.strictEqual(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// TaskDeliverableInputSchema (embedded in CreateTaskInputSchema)
// ---------------------------------------------------------------------------
describe("TaskDeliverableInputSchema validation", () => {
  test("accepts valid deliverable with title only", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "Bản báo cáo",
    });
    assert.ok(result.success);
  });

  test("accepts full deliverable", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "Bản trình bày",
      fileUrl: "/uploads/presentation.pptx",
      fileName: "presentation.pptx",
      fileType: "application/vnd.ms-powerpoint",
      fileSize: 1024 * 1024 * 10, // 10MB
    });
    assert.ok(result.success);
  });

  test("rejects empty title", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "",
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects title exceeding 255 chars", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "T".repeat(256),
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects fileSize exceeding 50MB", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "File quá lớn",
      fileSize: 52428801,
    });
    assert.strictEqual(result.success, false);
  });

  test("rejects unknown extra fields (strict mode)", () => {
    const result = TaskDeliverableInputSchema.safeParse({
      title: "Deliverable OK",
      createdById: "injected",
    });
    assert.strictEqual(result.success, false);
  });
});
