import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type {
  ApprovalDecision,
  DeliverableSubmissionPayload,
  ApprovalActionPayload,
  WorkspaceRole,
  StaffUrgencySummary,
  DepartmentHealthSummary,
} from "../src/types/workspace";
import {
  validateDeliverableSubmission,
  isValidSubmission,
  getDeliverableDraftKey,
  inferFileType,
  formatFileSize,
  SUPPORTED_FILE_TYPES,
} from "../src/components/portal/submit-deliverable-modal";
import {
  canSubmitDecision,
  validateReviewDecision,
  QUICK_COMMENT_TEMPLATES,
  DECISION_OPTIONS,
} from "../src/components/portal/review-action-dialog";

const EMOJI_REGEX = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E6}-\u{1F1FF}]/u;

describe("Workspace Type Definitions & Validators", () => {
  test("validates ApprovalDecision union values", () => {
    const validDecisions: ApprovalDecision[] = [
      "approved",
      "revision_requested",
      "rejected",
    ];
    assert.equal(validDecisions.length, 3);
  });

  test("validates DeliverableSubmissionPayload structure", () => {
    const payload: DeliverableSubmissionPayload = {
      taskId: "task-1",
      deliverableName: "De thi K48.pdf",
      url: "https://drive.google.com/test",
      fileType: "pdf",
      note: "Đã hoàn thành theo mẫu 2",
    };
    assert.equal(payload.taskId, "task-1");
    assert.equal(payload.deliverableName, "De thi K48.pdf");
    assert.equal(payload.url, "https://drive.google.com/test");
    assert.equal(payload.fileType, "pdf");
    assert.equal(payload.note, "Đã hoàn thành theo mẫu 2");
  });

  test("validates ApprovalActionPayload structure", () => {
    const action: ApprovalActionPayload = {
      taskId: "task-1",
      decision: "approved",
      comment: "Đạt yêu cầu nghiệm thu",
      reviewedByRole: "MANAGER",
      reviewedByName: "Trưởng bộ môn CNTT",
    };
    assert.equal(action.taskId, "task-1");
    assert.equal(action.decision, "approved");
    assert.equal(action.reviewedByRole, "MANAGER");
    assert.equal(action.reviewedByName, "Trưởng bộ môn CNTT");
  });

  test("validates StaffUrgencySummary structure", () => {
    const summary: StaffUrgencySummary = {
      todayCount: 2,
      thisWeekCount: 5,
      waitingApprovalCount: 1,
      revisionRequestedCount: 0,
      completedCount: 10,
    };
    assert.equal(summary.todayCount, 2);
    assert.equal(summary.thisWeekCount, 5);
    assert.equal(summary.waitingApprovalCount, 1);
    assert.equal(summary.revisionRequestedCount, 0);
    assert.equal(summary.completedCount, 10);
  });

  test("validates DepartmentHealthSummary structure", () => {
    const health: DepartmentHealthSummary = {
      departmentCode: "CNTT",
      departmentName: "Khoa Công Nghệ Thông Tin",
      totalTasks: 20,
      completedTasks: 18,
      delayedTasks: 2,
      completionRate: 90,
      healthStatus: "GREEN",
    };
    assert.equal(health.departmentCode, "CNTT");
    assert.equal(health.departmentName, "Khoa Công Nghệ Thông Tin");
    assert.equal(health.totalTasks, 20);
    assert.equal(health.completedTasks, 18);
    assert.equal(health.delayedTasks, 2);
    assert.equal(health.completionRate, 90);
    assert.equal(health.healthStatus, "GREEN");
  });

  test("validates WorkspaceRole matches UserRole", () => {
    const roles: WorkspaceRole[] = ["ADMIN", "MANAGER", "STAFF"];
    assert.equal(roles.length, 3);
  });
});

describe("Deliverable Submission Validation", () => {
  test("requires deliverableName or url before submission", () => {
    const isValidSubmissionFn = (name: string, url: string) => {
      return name.trim().length > 0 || url.trim().length > 0;
    };
    assert.equal(isValidSubmissionFn("", ""), false);
    assert.equal(isValidSubmissionFn("Bao cao.docx", ""), true);
    assert.equal(isValidSubmissionFn("", "https://link.com"), true);
  });

  test("validates exported isValidSubmission helper", () => {
    assert.equal(isValidSubmission("", ""), false);
    assert.equal(isValidSubmission("   ", "  "), false);
    assert.equal(isValidSubmission("Bao cao nghiem thu.docx"), true);
    assert.equal(isValidSubmission("", "https://drive.google.com/xyz"), true);
  });

  test("validateDeliverableSubmission validates name and URL formats", () => {
    // Empty name
    const emptyResult = validateDeliverableSubmission("");
    assert.equal(emptyResult.isValid, false);
    assert.ok(emptyResult.error?.includes("nhập tên minh chứng"));

    // Valid name only
    const validNameResult = validateDeliverableSubmission("Bao cao DACUM.pdf");
    assert.equal(validNameResult.isValid, true);
    assert.equal(validNameResult.error, undefined);

    // Valid name and valid URL
    const validWithUrl = validateDeliverableSubmission(
      "Slide bao cao",
      "https://drive.google.com/file/d/123"
    );
    assert.equal(validWithUrl.isValid, true);

    // Valid name but invalid URL
    const invalidUrlResult = validateDeliverableSubmission(
      "Slide bao cao",
      "invalid-url-without-domain"
    );
    assert.equal(invalidUrlResult.isValid, false);
    assert.ok(invalidUrlResult.error?.includes("không đúng định dạng"));
  });

  test("getDeliverableDraftKey returns namespaced key", () => {
    assert.equal(
      getDeliverableDraftKey("task-123"),
      "qcet_deliverable_draft_task-123"
    );
  });

  test("inferFileType correctly detects file extensions and URLs", () => {
    assert.equal(inferFileType("tai_lieu.pdf"), "PDF");
    assert.equal(inferFileType("tai_lieu.PDF"), "PDF");
    assert.equal(inferFileType("hop_dong.docx"), "DOCX");
    assert.equal(inferFileType("van_ban.doc"), "DOCX");
    assert.equal(inferFileType("bang_tinh.xlsx"), "XLSX");
    assert.equal(inferFileType("so_lieu.csv"), "XLSX");
    assert.equal(inferFileType("ho_so.zip"), "ZIP");
    assert.equal(inferFileType("archive.rar"), "ZIP");
    assert.equal(inferFileType("https://drive.google.com/test"), "LINK");
    assert.equal(inferFileType("http://onedrive.live.com/test"), "LINK");
    assert.equal(inferFileType("hinh_anh.png"), "KHAC");
  });

  test("formatFileSize formats bytes cleanly", () => {
    assert.equal(formatFileSize(500), "500 B");
    assert.equal(formatFileSize(1536), "1.5 KB");
    assert.equal(formatFileSize(2097152), "2.0 MB");
  });

  test("verifies supported file types list completeness", () => {
    const ids = SUPPORTED_FILE_TYPES.map((t) => t.id);
    assert.ok(ids.includes("PDF"));
    assert.ok(ids.includes("DOCX"));
    assert.ok(ids.includes("XLSX"));
    assert.ok(ids.includes("ZIP"));
    assert.ok(ids.includes("LINK"));
    assert.ok(ids.includes("KHAC"));
  });

  test("Zero-Emoji Strict Anti-Slop Audit on submit-deliverable-modal", () => {
    const modalFiles = [
      "src/components/portal/submit-deliverable-modal.tsx",
      "src/components/workspace/submit-deliverable-modal.tsx",
    ];

    modalFiles.forEach((relPath) => {
      const fullPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File phai ton tai: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      const violations: string[] = [];

      lines.forEach((line, idx) => {
        if (EMOJI_REGEX.test(line)) {
          violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
        }
      });

      assert.equal(
        violations.length,
        0,
        `Phat hien emoji tai:\n${violations.join("\n")}`
      );
    });
  });
});

describe("Review Action Rules", () => {
  test("requires at least 5 characters comment when decision is revision_requested", () => {
    // Exact function signature from step 1 brief
    const canSubmitDecisionLocal = (decision: ApprovalDecision, comment: string) => {
      if (decision === "revision_requested") {
        return comment.trim().length >= 5;
      }
      return true;
    };
    assert.equal(canSubmitDecisionLocal("approved", ""), true);
    assert.equal(canSubmitDecisionLocal("revision_requested", ""), false);
    assert.equal(canSubmitDecisionLocal("revision_requested", "abc"), false);
    assert.equal(canSubmitDecisionLocal("revision_requested", "Thiếu phụ lục 2"), true);

    // Also test exported canSubmitDecision helper
    assert.equal(canSubmitDecision("approved", ""), true);
    assert.equal(canSubmitDecision("revision_requested", ""), false);
    assert.equal(canSubmitDecision("revision_requested", "abc"), false);
    assert.equal(canSubmitDecision("revision_requested", "Thiếu phụ lục 2"), true);
  });

  test("requires at least 5 characters comment when decision is rejected", () => {
    assert.equal(canSubmitDecision("rejected", ""), false);
    assert.equal(canSubmitDecision("rejected", "   "), false);
    assert.equal(canSubmitDecision("rejected", "hỏng"), false);
    assert.equal(
      canSubmitDecision("rejected", "Không đáp ứng tiêu chuẩn hồ sơ minh chứng"),
      true
    );
  });

  test("validateReviewDecision provides localized error feedback", () => {
    // Approved: always valid, no comment needed
    const approvedResult = validateReviewDecision("approved", "");
    assert.equal(approvedResult.isValid, true);
    assert.equal(approvedResult.error, undefined);

    // Revision requested: empty comment
    const emptyRevResult = validateReviewDecision("revision_requested", "   ");
    assert.equal(emptyRevResult.isValid, false);
    assert.ok(emptyRevResult.error?.includes("nhập lý do yêu cầu chỉnh sửa"));

    // Revision requested: short comment (<5 chars)
    const shortRevResult = validateReviewDecision("revision_requested", "abc");
    assert.equal(shortRevResult.isValid, false);
    assert.ok(shortRevResult.error?.includes("ít nhất 5 ký tự"));

    // Revision requested: valid comment
    const validRevResult = validateReviewDecision(
      "revision_requested",
      "Vui lòng bổ sung thêm bảng phân tích DACUM"
    );
    assert.equal(validRevResult.isValid, true);
    assert.equal(validRevResult.error, undefined);

    // Rejected: empty comment
    const emptyRejResult = validateReviewDecision("rejected", "");
    assert.equal(emptyRejResult.isValid, false);
    assert.ok(emptyRejResult.error?.includes("nêu rõ lý do"));

    // Rejected: short comment (<5 chars)
    const shortRejResult = validateReviewDecision("rejected", "lỗi");
    assert.equal(shortRejResult.isValid, false);
    assert.ok(shortRejResult.error?.includes("ít nhất 5 ký tự"));

    // Rejected: valid comment
    const validRejResult = validateReviewDecision(
      "rejected",
      "Hồ sơ không có quyết định phê duyệt kèm theo"
    );
    assert.equal(validRejResult.isValid, true);
  });

  test("verifies all three decision options are properly configured", () => {
    assert.equal(DECISION_OPTIONS.length, 3);
    const ids = DECISION_OPTIONS.map((opt) => opt.id);
    assert.ok(ids.includes("approved"));
    assert.ok(ids.includes("revision_requested"));
    assert.ok(ids.includes("rejected"));

    const approvedOpt = DECISION_OPTIONS.find((o) => o.id === "approved");
    assert.equal(approvedOpt?.accentColor, "emerald");

    const revisionOpt = DECISION_OPTIONS.find((o) => o.id === "revision_requested");
    assert.equal(revisionOpt?.accentColor, "amber");

    const rejectedOpt = DECISION_OPTIONS.find((o) => o.id === "rejected");
    assert.equal(rejectedOpt?.accentColor, "rose");
  });

  test("contains required quick comment templates", () => {
    assert.ok(
      QUICK_COMMENT_TEMPLATES.includes("Cần bổ sung số liệu minh chứng")
    );
    assert.ok(
      QUICK_COMMENT_TEMPLATES.includes("Nội dung đạt chuẩn theo quy định")
    );
    assert.ok(
      QUICK_COMMENT_TEMPLATES.includes("Vui lòng đính kèm quyết định ban hành")
    );
  });

  test("constructs valid ApprovalActionPayload for each decision", () => {
    const buildPayload = (
      taskId: string,
      decision: ApprovalDecision,
      comment: string,
      reviewedByRole: "ADMIN" | "MANAGER" | "STAFF",
      reviewedByName: string
    ): ApprovalActionPayload => {
      const validation = validateReviewDecision(decision, comment);
      if (!validation.isValid) {
        throw new Error(validation.error);
      }
      return {
        taskId,
        decision,
        comment: comment.trim() || undefined,
        reviewedByRole,
        reviewedByName,
      };
    };

    // 1. Approved payload
    const p1 = buildPayload(
      "task-101",
      "approved",
      "",
      "MANAGER",
      "TS. Nguyễn Văn A"
    );
    assert.equal(p1.taskId, "task-101");
    assert.equal(p1.decision, "approved");
    assert.equal(p1.comment, undefined);
    assert.equal(p1.reviewedByRole, "MANAGER");

    // 2. Revision requested payload
    const p2 = buildPayload(
      "task-102",
      "revision_requested",
      "Cần bổ sung số liệu minh chứng",
      "MANAGER",
      "TS. Nguyễn Văn A"
    );
    assert.equal(p2.taskId, "task-102");
    assert.equal(p2.decision, "revision_requested");
    assert.equal(p2.comment, "Cần bổ sung số liệu minh chứng");

    // 3. Rejected payload
    const p3 = buildPayload(
      "task-103",
      "rejected",
      "Nội dung không phù hợp chuẩn quy định",
      "ADMIN",
      "Hiệu trưởng"
    );
    assert.equal(p3.taskId, "task-103");
    assert.equal(p3.decision, "rejected");
    assert.equal(p3.comment, "Nội dung không phù hợp chuẩn quy định");
    assert.equal(p3.reviewedByRole, "ADMIN");

    // 4. Expect throw on invalid revision_requested without comment
    assert.throws(
      () =>
        buildPayload(
          "task-104",
          "revision_requested",
          "",
          "MANAGER",
          "TS. Nguyễn Văn A"
        ),
      /nhập lý do yêu cầu chỉnh sửa/
    );
  });

  test("Zero-Emoji Strict Anti-Slop Audit on review-action-dialog", () => {
    const dialogFiles = [
      "src/components/portal/review-action-dialog.tsx",
      "src/components/workspace/review-action-dialog.tsx",
    ];

    dialogFiles.forEach((relPath) => {
      const fullPath = path.resolve(process.cwd(), relPath);
      assert.ok(fs.existsSync(fullPath), `File phai ton tai: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const lines = content.split("\n");
      const violations: string[] = [];

      lines.forEach((line, idx) => {
        if (EMOJI_REGEX.test(line)) {
          violations.push(`${relPath}:${idx + 1}: ${line.trim()}`);
        }
      });

      assert.equal(
        violations.length,
        0,
        `Phat hien emoji tai:\n${violations.join("\n")}`
      );
    });
  });
});


