import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type {
  ApprovalDecision,
  DeliverableSubmissionPayload,
  ApprovalActionPayload,
  WorkspaceRole,
  StaffUrgencySummary,
  DepartmentHealthSummary,
} from "../src/types/workspace";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
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
import {
  computeStaffUrgencySummary,
  filterStaffTasks,
  sortStaffTasks,
  getDaysRemaining,
  getDeadlineBadgeInfo,
  extractStaffTasksFromSchoolTasks,
  LecturerFocusWorkspace,
  StaffWorkspace,
} from "../src/components/portal/lecturer-focus-workspace";

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

describe("Staff Workspace Urgency Computation", () => {
  test("correctly categorizes staff tasks by urgency and status", () => {
    const sampleTasks: StaffTask[] = [
      {
        id: "s1",
        title: "Soan de thi",
        assigneeName: "Nguyen Van A",
        assigneeId: "user-1",
        status: "IN_PROGRESS",
        dueDate: "2026-09-06", // Hom nay
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      {
        id: "s2",
        title: "Coi thi",
        assigneeName: "Nguyen Van A",
        assigneeId: "user-1",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-10",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
    ];

    const isToday = (d: string) => d === "2026-09-06";
    const todayCount = sampleTasks.filter(
      (t) => t.status === "IN_PROGRESS" && isToday(t.dueDate)
    ).length;
    const waitingCount = sampleTasks.filter(
      (t) => t.status === "NEEDS_REVIEW"
    ).length;

    assert.equal(todayCount, 1);
    assert.equal(waitingCount, 1);

    // Verify through computeStaffUrgencySummary helper
    const summary = computeStaffUrgencySummary(sampleTasks, "2026-09-06");
    assert.equal(summary.todayCount, 1);
    assert.equal(summary.waitingApprovalCount, 1);
    assert.equal(summary.thisWeekCount, 0);
    assert.equal(summary.revisionRequestedCount, 0);
    assert.equal(summary.completedCount, 0);
  });

  test("computes full 5-metric urgency summary correctly across edge cases", () => {
    const refDate = "2026-09-06";
    const tasks: StaffTask[] = [
      // 1. Overdue task (urgent/today)
      {
        id: "t-overdue",
        title: "Kiem tra de cuong K47",
        assigneeName: "Tran Giang Vien",
        status: "IN_PROGRESS",
        dueDate: "2026-09-04",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-04",
      },
      // 2. Due today task (urgent/today)
      {
        id: "t-today",
        title: "Nop diem thi K48",
        assigneeName: "Tran Giang Vien",
        status: "IN_PROGRESS",
        dueDate: "2026-09-06",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      // 3. Blocked task (counted in todayCount as urgent)
      {
        id: "t-blocked",
        title: "Lap trinh he thong diem",
        assigneeName: "Tran Giang Vien",
        status: "BLOCKED",
        blockedReason: "Thieu API may chu",
        dueDate: "2026-09-20",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-05",
      },
      // 4. Due in 3 days (thisWeekCount)
      {
        id: "t-week-1",
        title: "Khao sat y kien sinh vien",
        assigneeName: "Tran Giang Vien",
        status: "IN_PROGRESS",
        dueDate: "2026-09-09",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-05",
      },
      // 5. Due in 7 days (thisWeekCount)
      {
        id: "t-week-2",
        title: "Hoan thien bien ban bo mon",
        assigneeName: "Tran Giang Vien",
        status: "IN_PROGRESS",
        dueDate: "2026-09-13",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-05",
      },
      // 6. Needs review (waitingApprovalCount)
      {
        id: "t-review",
        title: "De an doi moi DACUM",
        assigneeName: "Tran Giang Vien",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-15",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      // 7. Revision requested (revisionRequestedCount & in-progress)
      {
        id: "t-revision",
        title: "Giao trinh Kien truc May tinh",
        assigneeName: "Tran Giang Vien",
        status: "IN_PROGRESS",
        rejectionReason: "Vui long bo sung chuong 4 ve ARM",
        dueDate: "2026-09-08",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      // 8. Completed task (completedCount)
      {
        id: "t-done",
        title: "Tap huan giang day thang 8",
        assigneeName: "Tran Giang Vien",
        status: "COMPLETED",
        dueDate: "2026-08-30",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-08-31",
      },
    ];

    const summary = computeStaffUrgencySummary(tasks, refDate);

    // todayCount: t-overdue (due 09-04), t-today (due 09-06), t-blocked (status BLOCKED) => 3
    assert.equal(summary.todayCount, 3);
    // thisWeekCount: t-week-1 (09-09), t-week-2 (09-13), t-revision (09-08) => 3
    assert.equal(summary.thisWeekCount, 3);
    // waitingApprovalCount: t-review (NEEDS_REVIEW) => 1
    assert.equal(summary.waitingApprovalCount, 1);
    // revisionRequestedCount: t-revision => 1
    assert.equal(summary.revisionRequestedCount, 1);
    // completedCount: t-done => 1
    assert.equal(summary.completedCount, 1);
  });
});

describe("Staff Task Filtering and Sorting", () => {
  const refDate = "2026-09-06";
  const tasks = [
    {
      id: "tsk-1",
      title: "Chuan bi de thi Tot nghiep",
      assigneeName: "Nguyen Van A",
      status: "IN_PROGRESS" as const,
      dueDate: "2026-09-06",
      parentSchoolTaskId: "school-100",
      parentTaskTitle: "Ky thi Tot nghiep K48",
      updatedAt: "2026-09-06",
    },
    {
      id: "tsk-2",
      title: "Kiem tra thiet bi thuc hanh",
      assigneeName: "Nguyen Van A",
      status: "IN_PROGRESS" as const,
      dueDate: "2026-09-10",
      parentSchoolTaskId: "school-100",
      parentTaskTitle: "Ky thi Tot nghiep K48",
      updatedAt: "2026-09-06",
    },
    {
      id: "tsk-3",
      title: "Bao cao de tai NCKH",
      assigneeName: "Nguyen Van A",
      status: "NEEDS_REVIEW" as const,
      dueDate: "2026-09-12",
      parentSchoolTaskId: "school-200",
      parentTaskTitle: "Nghien cuu Khoa hoc",
      updatedAt: "2026-09-06",
    },
    {
      id: "tsk-4",
      title: "Bao cao danh gia DACUM",
      assigneeName: "Nguyen Van A",
      status: "IN_PROGRESS" as const,
      rejectionReason: "Can bo sung them ma tran nang luc",
      dueDate: "2026-09-11",
      parentSchoolTaskId: "school-300",
      parentTaskTitle: "Phat trien chuong trinh",
      updatedAt: "2026-09-06",
    },
    {
      id: "tsk-5",
      title: "Cap nhat ho so vien chuc",
      assigneeName: "Nguyen Van A",
      status: "COMPLETED" as const,
      dueDate: "2026-08-31",
      parentSchoolTaskId: "school-400",
      parentTaskTitle: "Cong tac To chuc",
      updatedAt: "2026-08-31",
    },
  ];

  test("filters tasks by TODAY filter tab", () => {
    const res = filterStaffTasks(tasks, "TODAY", "", refDate);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "tsk-1");
  });

  test("filters tasks by THIS_WEEK filter tab", () => {
    const res = filterStaffTasks(tasks, "THIS_WEEK", "", refDate);
    // tsk-2 (09-10), tsk-4 (09-11)
    assert.equal(res.length, 2);
    const ids = res.map((t) => t.id);
    assert.ok(ids.includes("tsk-2"));
    assert.ok(ids.includes("tsk-4"));
  });

  test("filters tasks by NEEDS_REVIEW filter tab", () => {
    const res = filterStaffTasks(tasks, "NEEDS_REVIEW", "", refDate);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "tsk-3");
  });

  test("filters tasks by REVISION filter tab", () => {
    const res = filterStaffTasks(tasks, "REVISION", "", refDate);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "tsk-4");
  });

  test("filters tasks by COMPLETED filter tab", () => {
    const res = filterStaffTasks(tasks, "COMPLETED", "", refDate);
    assert.equal(res.length, 1);
    assert.equal(res[0].id, "tsk-5");
  });

  test("filters tasks by search keyword across title, id, and parent title", () => {
    // Search by task title
    const search1 = filterStaffTasks(tasks, "ALL", "DACUM", refDate);
    assert.equal(search1.length, 1);
    assert.equal(search1[0].id, "tsk-4");

    // Search by task ID
    const search2 = filterStaffTasks(tasks, "ALL", "tsk-2", refDate);
    assert.equal(search2.length, 1);
    assert.equal(search2[0].id, "tsk-2");

    // Search by parent task title
    const search3 = filterStaffTasks(tasks, "ALL", "Tot nghiep", refDate);
    assert.equal(search3.length, 2);
  });

  test("sortStaffTasks prioritizes revision requested and urgent tasks before completed", () => {
    const sorted = sortStaffTasks(tasks);
    // Revision requested (tsk-4) is prioritized to top
    assert.equal(sorted[0].id, "tsk-4");
    // Completed task (tsk-5) must be at the very bottom
    assert.equal(sorted[sorted.length - 1].id, "tsk-5");
  });
});

describe("Deadline Countdown and Badge Computation", () => {
  const refDate = "2026-09-06";

  test("calculates days remaining correctly", () => {
    assert.equal(getDaysRemaining("2026-09-04", refDate), -2);
    assert.equal(getDaysRemaining("2026-09-06", refDate), 0);
    assert.equal(getDaysRemaining("2026-09-07", refDate), 1);
    assert.equal(getDaysRemaining("2026-09-10", refDate), 4);
    assert.equal(getDaysRemaining(undefined, refDate), null);
  });

  test("produces human-readable deadline badge info", () => {
    // Overdue
    const overdue = getDeadlineBadgeInfo("2026-09-04", refDate);
    assert.equal(overdue.variant, "urgent");
    assert.equal(overdue.label, "Quá hạn 2 ngày");

    // Today
    const today = getDeadlineBadgeInfo("2026-09-06", refDate);
    assert.equal(today.variant, "urgent");
    assert.equal(today.label, "Hạn chót: Hôm nay");

    // Tomorrow
    const tomorrow = getDeadlineBadgeInfo("2026-09-07", refDate);
    assert.equal(tomorrow.variant, "warning");
    assert.equal(tomorrow.label, "Hạn chót: Ngày mai");

    // Upcoming in 4 days
    const upcoming = getDeadlineBadgeInfo("2026-09-10", refDate);
    assert.equal(upcoming.variant, "warning");
    assert.equal(upcoming.label, "Hạn chót: Còn 4 ngày");

    // Far future
    const far = getDeadlineBadgeInfo("2026-09-20", refDate);
    assert.equal(far.variant, "neutral");
    assert.equal(far.label, "Còn 14 ngày");

    // Undefined
    const none = getDeadlineBadgeInfo(undefined, refDate);
    assert.equal(none.variant, "neutral");
    assert.equal(none.label, "Không có hạn");
  });
});

describe("SchoolTask Extraction for Staff User", () => {
  const user: AuthUser = {
    id: "u-vinh",
    name: "Nguyễn Ngọc Vinh",
    email: "vinhnn@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  const schoolTasks: SchoolTask[] = [
    {
      id: "school-1",
      title: "Chuyển đổi số đào tạo",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      progressPercent: 50,
      totalSubTasks: 2,
      completedSubTasks: 0,
      subTasks: [
        {
          id: "sub-1",
          title: "Cấu hình CSDL phân quyền",
          assigneeName: "Nguyễn Ngọc Vinh",
          assigneeId: "u-vinh",
          status: "IN_PROGRESS",
          dueDate: "2026-09-06",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-06",
        },
        {
          id: "sub-2",
          title: "Thiết kế giao diện",
          assigneeName: "Lê Thị Hoa",
          assigneeId: "u-hoa",
          status: "IN_PROGRESS",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "school-1",
          updatedAt: "2026-09-06",
        },
      ],
    },
  ];

  test("extracts only subtasks assigned to the user", () => {
    const extracted = extractStaffTasksFromSchoolTasks(schoolTasks, user);
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].id, "sub-1");
    assert.equal(extracted[0].parentSchoolTaskId, "school-1");
    assert.equal(extracted[0].parentTaskTitle, "Chuyển đổi số đào tạo");
  });
});

describe("LecturerFocusWorkspace Component Static Rendering", () => {
  const mockUser: AuthUser = {
    id: "user-staff-1",
    name: "ThS. Nguyễn Văn A",
    email: "anv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Giảng viên Khoa CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  const mockStaffTasks: StaffTask[] = [
    {
      id: "task-101",
      title: "Soạn đề cương chi tiết môn Lập trình Web",
      assigneeName: "ThS. Nguyễn Văn A",
      assigneeId: "user-staff-1",
      status: "IN_PROGRESS",
      dueDate: "2026-09-06",
      parentSchoolTaskId: "school-task-50",
      updatedAt: "2026-09-06",
      deliverableDescription: "Yêu cầu đính kèm file đề cương chi tiết chuẩn định dạng CDIO",
    },
    {
      id: "task-102",
      title: "Nộp ngân hàng câu hỏi trắc nghiệm An toàn mạng",
      assigneeName: "ThS. Nguyễn Văn A",
      assigneeId: "user-staff-1",
      status: "IN_PROGRESS",
      rejectionReason: "Câu hỏi phần thực hành chưa đạt tỷ lệ 30% theo quy chế",
      dueDate: "2026-09-09",
      parentSchoolTaskId: "school-task-51",
      updatedAt: "2026-09-06",
    },
  ];

  test("renders welcome header with user name and department", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Xin chào, ThS. Nguyễn Văn A"));
    assert.ok(html.includes("Khoa Công nghệ thông tin"));
    assert.ok(html.includes("Giảng viên Khoa CNTT"));
  });

  test("renders executive strip with all 5 metric cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Hôm nay cần làm"));
    assert.ok(html.includes("Trong tuần này"));
    assert.ok(html.includes("Chờ lãnh đạo duyệt"));
    assert.ok(html.includes("Cần chỉnh sửa"));
    assert.ok(html.includes("Đã hoàn thành"));
  });

  test("renders revision requested banner with reviewer reason", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Yêu cầu chỉnh sửa từ Trưởng đơn vị"));
    assert.ok(html.includes("Câu hỏi phần thực hành chưa đạt tỷ lệ 30% theo quy chế"));
  });

  test("renders one-click deliverable submission button", () => {
    const html = renderToStaticMarkup(
      React.createElement(LecturerFocusWorkspace, {
        user: mockUser,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Nộp minh chứng"));
  });

  test("verifies StaffWorkspace alias is exported and functional", () => {
    assert.equal(StaffWorkspace, LecturerFocusWorkspace);
    const html = renderToStaticMarkup(
      React.createElement(StaffWorkspace, {
        user: mockUser,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );
    assert.ok(html.includes("Xin chào, ThS. Nguyễn Văn A"));
  });
});

describe("Zero-Emoji Strict Anti-Slop Audit on lecturer-focus-workspace", () => {
  const workspaceFiles = [
    "src/components/portal/lecturer-focus-workspace.tsx",
    "src/components/workspace/lecturer-focus-workspace.tsx",
    "src/components/workspace/staff-workspace.tsx",
    "src/components/portal/staff-workspace.tsx",
  ];

  workspaceFiles.forEach((relPath) => {
    test(`verifies ${relPath} contains zero emojis`, () => {
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



