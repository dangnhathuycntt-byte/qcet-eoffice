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

