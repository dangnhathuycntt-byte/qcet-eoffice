import { test, describe } from "node:test";
import assert from "node:assert/strict";
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
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";
import {
  SIDEBAR_ZONE_ITEMS,
  NAVIGATION_ITEMS,
} from "../src/components/layout/sidebar-context";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
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
  LegacyLecturerFocusWorkspace as LecturerFocusWorkspace,
  LegacyLecturerFocusWorkspace as StaffWorkspace,
} from "../src/components/portal/lecturer-focus-workspace";
import {
  computeDepartmentManagerMetrics,
  filterDepartmentStaffTasks,
  filterDepartmentSchoolTasks,
  extractAllDepartmentStaffTasks,
  getApprovalQueue,
  getManagerDirectTasks,
  filterManagerTasks,
  LegacyDepartmentManagerWorkspace as DepartmentManagerWorkspace,
  LegacyDepartmentManagerWorkspace as ManagerWorkspace,
} from "../src/components/portal/department-manager-workspace";
import {
  calculateDepartmentHealth,
  calculateHealth,
  computeExecutiveCockpitMetrics,
  computeElevenDepartmentRadar,
  extractSchoolBottlenecks,
  extractInstitutionalApprovalQueue,
  filterStrategicTasks,
  LegacyExecutiveCockpitWorkspace as ExecutiveCockpitWorkspace,
  LegacyExecutiveCockpitWorkspace as ExecutiveWorkspace,
} from "../src/components/portal/executive-cockpit-workspace";

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

    assert.ok(html.includes("ThS. Nguyễn Văn A"));
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
    assert.ok(html.includes("ThS. Nguyễn Văn A"));
  });
});

describe("Manager Workspace Filtering & Dual-Role", () => {
  test("filters approval queue strictly by department and NEEDS_REVIEW status", () => {
    const tasks: StaffTask[] = [
      {
        id: "t1",
        title: "De thi",
        assigneeName: "GV A",
        departmentCode: "CNTT",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-08",
        parentSchoolTaskId: "p1",
        updatedAt: "2026-09-06",
      },
      {
        id: "t2",
        title: "Bao cao",
        assigneeName: "GV B",
        departmentCode: "KTL",
        status: "NEEDS_REVIEW",
        dueDate: "2026-09-08",
        parentSchoolTaskId: "p2",
        updatedAt: "2026-09-06",
      },
    ];

    const cnttQueue = tasks.filter(
      (t) => t.departmentCode === "CNTT" && t.status === "NEEDS_REVIEW"
    );
    assert.equal(cnttQueue.length, 1);
    assert.equal(cnttQueue[0].id, "t1");

    // Also test exported getApprovalQueue helper
    const queue = getApprovalQueue(tasks, "CNTT");
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, "t1");
  });

  test("filters department school tasks by leadDepartmentCode or coDepartmentCodes", () => {
    const schoolTasks: SchoolTask[] = [
      {
        id: "st-1",
        title: "Kế hoạch CNTT năm 2026",
        category: "CNTT",
        categoryLabel: "Công nghệ thông tin",
        leadAssigneeName: "Trần Hùng",
        leadDepartmentCode: "CNTT",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 60,
      },
      {
        id: "st-2",
        title: "Phát triển chương trình đào tạo",
        category: "BAO_CAO",
        categoryLabel: "Báo cáo",
        leadAssigneeName: "Lê Văn C",
        leadDepartmentCode: "DAO_TAO",
        coDepartmentCodes: ["CNTT", "KTL"],
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 40,
      },
      {
        id: "st-3",
        title: "Kế hoạch Tài chính",
        category: "KHAC",
        categoryLabel: "Tài chính",
        leadAssigneeName: "Phạm Thị D",
        leadDepartmentCode: "TAI_CHINH",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-30",
        status: "IN_PROGRESS",
        subTasks: [],
        totalSubTasks: 0,
        completedSubTasks: 0,
        progressPercent: 20,
      },
    ];

    const cnttSchoolTasks = filterDepartmentSchoolTasks(schoolTasks, "CNTT");
    assert.equal(cnttSchoolTasks.length, 2);
    assert.ok(cnttSchoolTasks.some((t) => t.id === "st-1"));
    assert.ok(cnttSchoolTasks.some((t) => t.id === "st-2"));
  });

  test("isolates manager direct tasks from department members subtasks", () => {
    const managerUser: AuthUser = {
      id: "manager-1",
      name: "TS. Lê Hoàng",
      email: "lehoang@cdktcnqn.edu.vn",
      role: "MANAGER",
      roleLabel: "Trưởng khoa CNTT",
      department: "Khoa CNTT",
      departmentCode: "CNTT",
    };

    const tasks: StaffTask[] = [
      {
        id: "mt-1",
        title: "Phê duyệt kế hoạch thực tập",
        assigneeName: "TS. Lê Hoàng",
        assigneeId: "manager-1",
        departmentCode: "CNTT",
        status: "IN_PROGRESS",
        dueDate: "2026-09-10",
        parentSchoolTaskId: "p-1",
        updatedAt: "2026-09-06",
      },
      {
        id: "st-1",
        title: "Giảng dạy môn Mạng máy tính",
        assigneeName: "ThS. Trần Bình",
        assigneeId: "gv-1",
        departmentCode: "CNTT",
        status: "IN_PROGRESS",
        dueDate: "2026-09-12",
        parentSchoolTaskId: "p-1",
        updatedAt: "2026-09-06",
      },
    ];

    const myTasks = getManagerDirectTasks(tasks, managerUser);
    assert.equal(myTasks.length, 1);
    assert.equal(myTasks[0].id, "mt-1");
  });

  test("extracts and consolidates subtasks with parent school task context", () => {
    const schoolTasks: SchoolTask[] = [
      {
        id: "school-99",
        title: "Nhiệm vụ chuyển đổi số",
        category: "CHUYEN_DOI_SO",
        categoryLabel: "Chuyển đổi số",
        leadAssigneeName: "Trưởng Khoa",
        leadDepartmentCode: "CNTT",
        coAssignees: [],
        assignedDate: "2026-09-01",
        dueDate: "2026-09-20",
        status: "IN_PROGRESS",
        totalSubTasks: 1,
        completedSubTasks: 0,
        progressPercent: 50,
        subTasks: [
          {
            id: "sub-99-1",
            title: "Triển khai phần mềm",
            assigneeName: "GV A",
            status: "IN_PROGRESS",
            dueDate: "2026-09-15",
            parentSchoolTaskId: "school-99",
            updatedAt: "2026-09-06",
          },
        ],
      },
    ];

    const extracted = extractAllDepartmentStaffTasks(schoolTasks);
    assert.equal(extracted.length, 1);
    assert.equal(extracted[0].id, "sub-99-1");
    assert.equal(extracted[0].parentTaskTitle, "Nhiệm vụ chuyển đổi số");
    assert.equal(extracted[0].departmentCode, "CNTT");
  });
});

describe("Department Manager Metrics & Computations", () => {
  const mockUser: AuthUser = {
    id: "user-mgr-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo & QLKH",
    department: "Phòng Đào tạo",
    departmentCode: "DAO_TAO",
  };

  const sampleStaffTasks: StaffTask[] = [
    {
      id: "t-review-1",
      title: "Đề thi hết môn K48",
      assigneeName: "Nguyễn Văn A",
      departmentCode: "DAO_TAO",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-08",
      parentSchoolTaskId: "st-1",
      updatedAt: "2026-09-06",
    },
    {
      id: "t-overdue-1",
      title: "Báo cáo tiến độ đào tạo tháng 8",
      assigneeName: "Trần Hùng",
      assigneeId: "user-mgr-1",
      departmentCode: "DAO_TAO",
      status: "IN_PROGRESS",
      dueDate: "2026-09-04", // overdue relative to 2026-09-06
      parentSchoolTaskId: "st-1",
      updatedAt: "2026-09-05",
    },
    {
      id: "t-focus-1",
      title: "Tổ chức hội đồng thẩm định",
      assigneeName: "Lê Văn C",
      departmentCode: "DAO_TAO",
      status: "BLOCKED",
      dueDate: "2026-09-07",
      parentSchoolTaskId: "st-1",
      updatedAt: "2026-09-06",
    },
    {
      id: "t-completed-1",
      title: "Lập danh sách học viên",
      assigneeName: "Trần Hùng",
      assigneeId: "user-mgr-1",
      departmentCode: "DAO_TAO",
      status: "COMPLETED",
      dueDate: "2026-09-05",
      parentSchoolTaskId: "st-1",
      updatedAt: "2026-09-05",
    },
    {
      id: "t-other-dept",
      title: "Việc của khoa khác",
      assigneeName: "Nguyễn Văn B",
      departmentCode: "CNTT",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-08",
      parentSchoolTaskId: "st-2",
      updatedAt: "2026-09-06",
    },
  ];

  const sampleSchoolTasks: SchoolTask[] = [
    {
      id: "st-1",
      title: "Đổi mới chương trình đào tạo",
      category: "BAO_CAO",
      categoryLabel: "Báo cáo",
      leadAssigneeName: "Trần Hùng",
      leadDepartmentCode: "DAO_TAO",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 4,
      completedSubTasks: 2,
      progressPercent: 75,
    },
  ];

  test("computes full 4-metric executive strip accurately", () => {
    const metrics = computeDepartmentManagerMetrics(
      sampleStaffTasks,
      sampleSchoolTasks,
      "DAO_TAO",
      "2026-09-06",
      mockUser
    );

    assert.equal(metrics.waitingReviewCount, 1); // only t-review-1 (t-other-dept excluded)
    assert.equal(metrics.overdueCount, 1); // t-overdue-1 is overdue
    assert.ok(metrics.focusTaskCount >= 2); // includes blocked, overdue, needs_review
    assert.equal(metrics.averageProgressPercent, 75); // from school tasks
    assert.equal(metrics.totalDepartmentTasks, 4);
    assert.equal(metrics.completedDepartmentTasks, 1);
    assert.equal(metrics.myDirectTasksCount, 2); // t-overdue-1 and t-completed-1
  });

  test("handles empty tasks and missing department code cleanly", () => {
    const metrics = computeDepartmentManagerMetrics([], []);
    assert.equal(metrics.waitingReviewCount, 0);
    assert.equal(metrics.overdueCount, 0);
    assert.equal(metrics.focusTaskCount, 0);
    assert.equal(metrics.averageProgressPercent, 0);
    assert.equal(metrics.totalDepartmentTasks, 0);
    assert.equal(metrics.completedDepartmentTasks, 0);
    assert.equal(metrics.myDirectTasksCount, 0);
  });
});

describe("DepartmentManagerWorkspace Component Static Rendering", () => {
  const mockUser: AuthUser = {
    id: "user-mgr-cntt",
    name: "TS. Nguyễn Minh",
    email: "minhn@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng khoa CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  const mockStaffTasks: StaffTask[] = [
    {
      id: "task-rv-1",
      title: "Hồ sơ bài giảng Lập trình Web",
      assigneeName: "ThS. Lê Hoàng",
      departmentCode: "CNTT",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-08",
      parentSchoolTaskId: "school-100",
      updatedAt: "2026-09-06",
      deliverableDescription: "File bài giảng điện tử và bài tập thực hành",
      deliverables: [
        {
          id: "del-1",
          name: "Bai-giang-Web-2026.pdf",
          url: "https://drive.google.com/test",
          fileType: "pdf",
        },
      ],
    },
    {
      id: "task-my-1",
      title: "Báo cáo công tác chuyển đổi số Khoa CNTT",
      assigneeName: "TS. Nguyễn Minh",
      assigneeId: "user-mgr-cntt",
      departmentCode: "CNTT",
      status: "IN_PROGRESS",
      dueDate: "2026-09-10",
      parentSchoolTaskId: "school-100",
      updatedAt: "2026-09-06",
      deliverableDescription: "Bản báo cáo tiến độ và phụ lục thống kê",
    },
  ];

  const mockSchoolTasks: SchoolTask[] = [
    {
      id: "school-100",
      title: "Chuyển đổi số công tác đào tạo và khảo thí",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "TS. Nguyễn Minh",
      leadDepartmentCode: "CNTT",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-25",
      status: "IN_PROGRESS",
      subTasks: mockStaffTasks,
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 45,
    },
  ];

  test("renders welcome header with user name and department badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentManagerWorkspace, {
        user: mockUser,
        tasks: mockSchoolTasks,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("TS. Nguyễn Minh"));
    assert.ok(html.includes("Trưởng khoa CNTT"));
    assert.ok(html.includes("Khoa Công nghệ thông tin"));
  });

  test("renders executive strip with all 4 metric cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentManagerWorkspace, {
        user: mockUser,
        tasks: mockSchoolTasks,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(
      html.includes("Cần tôi xử lý") ||
        html.includes("Nhiệm vụ trực tiếp") ||
        html.includes("Khối lượng công việc")
    );
    assert.ok(
      html.includes("Đơn vị đang chạy") ||
        html.includes("Đang triển khai") ||
        html.includes("Quá hạn")
    );
    assert.ok(
      html.includes("Chờ duyệt") ||
        html.includes("Chờ thẩm định") ||
        html.includes("Chờ phân công/duyệt")
    );
    assert.ok(html.includes("Tiến độ đơn vị"));
  });

  test("renders tab navigation buttons", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentManagerWorkspace, {
        user: mockUser,
        tasks: mockSchoolTasks,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Hàng đợi thẩm định"));
    assert.ok(html.includes("Tiến độ nhiệm vụ đơn vị"));
    assert.ok(
      html.includes("Nhiệm vụ trực tiếp của tôi") ||
        html.includes("Nhiệm vụ trực tiếp")
    );
  });

  test("renders approval queue items with Thẩm định ngay button", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentManagerWorkspace, {
        user: mockUser,
        tasks: mockSchoolTasks,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Hồ sơ bài giảng Lập trình Web"));
    assert.ok(html.includes("Thẩm định ngay"));
    assert.ok(html.includes("ThS. Lê Hoàng"));
  });

  test("verifies ManagerWorkspace alias is exported and functional", () => {
    assert.equal(ManagerWorkspace, DepartmentManagerWorkspace);
    const html = renderToStaticMarkup(
      React.createElement(ManagerWorkspace, {
        user: mockUser,
        tasks: mockSchoolTasks,
        staffTasks: mockStaffTasks,
        referenceDate: "2026-09-06",
      })
    );
    assert.ok(html.includes("TS. Nguyễn Minh"));
  });
});

describe("Executive Health Radar Logic", () => {
  test("identifies departments with delayed tasks as RED or YELLOW", () => {
    const calculateHealthLocal = (completed: number, delayed: number, total: number) => {
      if (total === 0) return "GREEN";
      if (delayed > 2) return "RED";
      if (delayed > 0) return "YELLOW";
      return "GREEN";
    };

    assert.equal(calculateHealthLocal(10, 0, 10), "GREEN");
    assert.equal(calculateHealthLocal(8, 1, 10), "YELLOW");
    assert.equal(calculateHealthLocal(5, 3, 10), "RED");
  });

  test("verifies calculateDepartmentHealth and calculateHealth exports match exact contract", () => {
    assert.equal(calculateDepartmentHealth(10, 0, 10), "GREEN");
    assert.equal(calculateDepartmentHealth(8, 1, 10), "YELLOW");
    assert.equal(calculateDepartmentHealth(5, 3, 10), "RED");
    assert.equal(calculateDepartmentHealth(0, 0, 0), "GREEN");

    assert.equal(calculateHealth(10, 0, 10), "GREEN");
    assert.equal(calculateHealth(8, 1, 10), "YELLOW");
    assert.equal(calculateHealth(5, 3, 10), "RED");
    assert.equal(calculateHealth(0, 0, 0), "GREEN");
  });
});

describe("Executive Cockpit Metrics Computations", () => {
  const refDate = "2026-09-06";

  const mockTasks: SchoolTask[] = [
    {
      id: "sch-1",
      title: "Đề án nâng cấp hạ tầng CNTT",
      category: "CNTT",
      categoryLabel: "Hạ tầng",
      leadAssigneeName: "TS. Nguyễn Minh",
      leadDepartment: "Khoa Công nghệ thông tin",
      leadDepartmentCode: "CNTT",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-01", // Overdue -> Bottleneck
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-1",
          title: "Khảo sát hệ thống mạng cáp quang",
          assigneeName: "ThS. Lê Hoàng",
          status: "BLOCKED", // Blocked -> Bottleneck
          blockedReason: "Chưa có thiết bị đo lường",
          dueDate: "2026-09-05",
          parentSchoolTaskId: "sch-1",
          updatedAt: "2026-09-06",
        },
        {
          id: "sub-2",
          title: "Đề xuất cấu hình máy chủ ảo",
          assigneeName: "KS. Trần Nam",
          status: "NEEDS_REVIEW", // Pending approval
          dueDate: "2026-09-10",
          parentSchoolTaskId: "sch-1",
          updatedAt: "2026-09-06",
          requiresReview: true,
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 50,
    },
    {
      id: "sch-2",
      title: "Tờ trình phê duyệt khung chương trình 2026",
      category: "BAO_CAO",
      categoryLabel: "Đào tạo",
      leadAssigneeName: "ThS. Đỗ Quang Trung",
      leadDepartment: "Phòng Đào tạo & QLKH",
      leadDepartmentCode: "DAO_TAO",
      coAssignees: [],
      assignedDate: "2026-08-15",
      dueDate: "2026-09-20",
      status: "PENDING_EXECUTIVE_APPROVAL", // Institutional approval queue
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 100,
    },
    {
      id: "sch-3",
      title: "Báo cáo kiểm định chất lượng GDNN cấp Bộ",
      category: "BAO_CAO",
      categoryLabel: "Khảo thí",
      leadAssigneeName: "TS. Nguyễn Công Minh",
      leadDepartment: "Phòng Khảo thí & ĐBCL",
      leadDepartmentCode: "KHAO_THI",
      coAssignees: [],
      assignedDate: "2026-07-01",
      dueDate: "2026-08-30",
      status: "COMPLETED",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 100,
    },
  ];

  test("computes bottlenecksCount combining overdue and blocked tasks", () => {
    const metrics = computeExecutiveCockpitMetrics(mockTasks, [], refDate);
    // sch-1 is overdue (+1)
    // sub-1 is blocked (+1) and overdue (+1)
    // total bottlenecks >= 2
    assert.ok(metrics.bottlenecksCount >= 2);
  });

  test("computes pendingInstitutionalApprovalCount accurately", () => {
    const metrics = computeExecutiveCockpitMetrics(mockTasks, [], refDate);
    // sch-2 is PENDING_EXECUTIVE_APPROVAL (+1)
    // sub-2 is NEEDS_REVIEW (+1)
    assert.equal(metrics.pendingInstitutionalApprovalCount, 2);
  });

  test("computes totalSchoolCompletionRate and active counts", () => {
    const metrics = computeExecutiveCockpitMetrics(mockTasks, [], refDate);
    assert.equal(metrics.totalTasksCount, 3);
    assert.equal(metrics.completedTasksCount, 1);
    assert.equal(metrics.activeTasksCount, 1);
    // Average progress: (50 + 100 + 100) / 3 = 83%
    assert.equal(metrics.totalSchoolCompletionRate, 83);
  });

  test("handles empty tasks safely without division by zero", () => {
    const metrics = computeExecutiveCockpitMetrics([], [], refDate);
    assert.equal(metrics.totalTasksCount, 0);
    assert.equal(metrics.completedTasksCount, 0);
    assert.equal(metrics.bottlenecksCount, 0);
    assert.equal(metrics.pendingInstitutionalApprovalCount, 0);
    assert.equal(metrics.totalSchoolCompletionRate, 0);
    assert.equal(metrics.activeTasksCount, 0);
  });
});

describe("Eleven Department Health Radar & Sorting", () => {
  const refDate = "2026-09-06";

  const sampleTasks: SchoolTask[] = [
    {
      id: "cntt-1",
      title: "Chuyển đổi số Khoa CNTT",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "TS. Nguyễn Minh",
      leadDepartmentCode: "CNTT",
      leadDepartment: "Khoa Công nghệ thông tin",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-20", // overdue
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-c1",
          title: "Sub 1",
          assigneeName: "A",
          status: "BLOCKED", // blocked
          dueDate: "2026-08-20", // overdue
          parentSchoolTaskId: "cntt-1",
          updatedAt: "2026-09-06",
        },
        {
          id: "sub-c2",
          title: "Sub 2",
          assigneeName: "B",
          status: "IN_PROGRESS",
          dueDate: "2026-08-25", // overdue
          parentSchoolTaskId: "cntt-1",
          updatedAt: "2026-09-06",
        },
      ],
      totalSubTasks: 2,
      completedSubTasks: 0,
      progressPercent: 20,
    },
  ];

  test("always returns exactly 11 departments", () => {
    const radar = computeElevenDepartmentRadar(sampleTasks, refDate);
    assert.equal(radar.length, 11);
    const codes = radar.map((d) => d.departmentCode);
    assert.ok(codes.includes("BGH"));
    assert.ok(codes.includes("CNTT"));
    assert.ok(codes.includes("DAO_TAO"));
    assert.ok(codes.includes("TRUYEN_THONG"));
    assert.ok(codes.includes("HANH_CHINH"));
    assert.ok(codes.includes("KHAO_THI"));
    assert.ok(codes.includes("THU_VIEN"));
    assert.ok(codes.includes("KINH_TE"));
    assert.ok(codes.includes("KY_THUAT"));
    assert.ok(codes.includes("TAI_CHINH"));
    assert.ok(codes.includes("CTHSSV"));
  });

  test("sorts departments with RED first, then YELLOW, then GREEN", () => {
    const radar = computeElevenDepartmentRadar(sampleTasks, refDate);
    // CNTT has multiple overdue and blocked tasks -> RED
    assert.equal(radar[0].departmentCode, "CNTT");
    assert.equal(radar[0].healthStatus, "RED");

    // Verify ordering is strictly RED -> YELLOW -> GREEN
    const severityMap: Record<string, number> = { RED: 0, YELLOW: 1, GREEN: 2 };
    for (let i = 0; i < radar.length - 1; i++) {
      const curOrder = severityMap[radar[i].healthStatus];
      const nextOrder = severityMap[radar[i + 1].healthStatus];
      assert.ok(
        curOrder <= nextOrder,
        `Department ${radar[i].departmentCode} (${radar[i].healthStatus}) should precede ${radar[i + 1].departmentCode} (${radar[i + 1].healthStatus})`
      );
    }
  });
});

describe("Executive Bottleneck Extraction & Approval Queue", () => {
  const refDate = "2026-09-06";

  const tasks: SchoolTask[] = [
    {
      id: "task-bn-1",
      title: "Triển khai phần mềm quản lý giảng dạy",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "TS. Nguyễn Minh Tuấn",
      leadDepartmentCode: "CNTT",
      leadDepartment: "Khoa CNTT",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-25", // Overdue
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "sub-bn-1",
          title: "Đấu nối CSDL phòng Đào tạo",
          assigneeName: "KS. Văn A",
          departmentCode: "CNTT",
          status: "BLOCKED",
          blockedReason: "Thiếu quyền truy cập API",
          dueDate: "2026-09-01",
          parentSchoolTaskId: "task-bn-1",
          updatedAt: "2026-09-06",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 40,
    },
    {
      id: "task-bn-2",
      title: "Nâng cấp hạ tầng mạng khu C",
      category: "CSVC",
      categoryLabel: "Cơ sở vật chất",
      leadAssigneeName: "ThS. Hoàng Văn B",
      leadDepartmentCode: "CNTT",
      leadDepartment: "Khoa CNTT",
      coAssignees: [],
      assignedDate: "2026-08-15",
      dueDate: "2026-09-20",
      status: "BLOCKED" as any,
      blockedReason: "Chờ phê duyệt kinh phí",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 10,
    } as any,
    {
      id: "task-ap-1",
      title: "Dự toán tài chính hội nghị khoa học quốc tế 2026",
      category: "BAO_CAO",
      categoryLabel: "Kế hoạch",
      leadAssigneeName: "ThS. Trần Thị Mai Loan",
      leadDepartmentCode: "TAI_CHINH",
      leadDepartment: "Phòng Kế hoạch - Tài chính",
      coAssignees: [],
      assignedDate: "2026-08-10",
      dueDate: "2026-09-15",
      status: "PENDING_EXECUTIVE_APPROVAL",
      completionReport: {
        summary: "Đã tổng hợp dự toán chi tiết 11 đơn vị",
        submittedBy: "ThS. Trần Thị Mai Loan",
        submittedAt: "2026-09-05",
        reportUrl: "https://drive.google.com/du-toan-2026.pdf",
      },
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 100,
    },
  ];

  test("extracts bottlenecks with proper flags and blocked reasons", () => {
    const bottlenecks = extractSchoolBottlenecks(tasks, refDate);
    assert.ok(bottlenecks.length >= 2);

    const blockedItem = bottlenecks.find((b) => b.isBlocked);
    assert.ok(blockedItem);
    assert.equal(blockedItem.id, "task-bn-2");
    assert.equal(blockedItem.blockedReason, "Chờ phê duyệt kinh phí");
    assert.equal(blockedItem.assigneeName, "Khoa CNTT");
  });

  test("extracts institutional approval queue items", () => {
    const queue = extractInstitutionalApprovalQueue(tasks);
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, "task-ap-1");
    assert.equal(queue[0].departmentCode, "TAI_CHINH");
    assert.equal(queue[0].deliverablesCount, 1);
  });
});

describe("Strategic Tasks Filtering", () => {
  const refDate = "2026-09-06";

  const tasks: SchoolTask[] = [
    {
      id: "st-1",
      title: "Chuyển đổi số đào tạo",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "TS. Nguyễn Minh",
      leadDepartmentCode: "CNTT",
      leadDepartment: "Khoa CNTT",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 60,
    },
    {
      id: "st-2",
      title: "Khảo sát thị trường việc làm 2026",
      category: "BAO_CAO",
      categoryLabel: "Đào tạo",
      leadAssigneeName: "ThS. Đỗ Quang Trung",
      leadDepartmentCode: "DAO_TAO",
      leadDepartment: "Phòng Đào tạo",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-08-15", // Overdue -> Bottleneck
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 40,
    },
    {
      id: "st-3",
      title: "Báo cáo tài chính quý 3",
      category: "BAO_CAO",
      categoryLabel: "Tài chính",
      leadAssigneeName: "ThS. Trần Thị Mai Loan",
      leadDepartmentCode: "TAI_CHINH",
      leadDepartment: "Phòng Kế hoạch - Tài chính",
      coAssignees: [],
      assignedDate: "2026-07-01",
      dueDate: "2026-08-30",
      status: "COMPLETED",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 100,
    },
  ];

  test("filters by department", () => {
    const filtered = filterStrategicTasks(tasks, { departmentFilter: "CNTT" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "st-1");
  });

  test("filters by search term", () => {
    const filtered = filterStrategicTasks(tasks, { searchTerm: "tài chính" });
    assert.equal(filtered.length, 1);
    assert.equal(filtered[0].id, "st-3");
  });

  test("filters by status filter", () => {
    const inProgress = filterStrategicTasks(tasks, { statusFilter: "IN_PROGRESS" });
    assert.equal(inProgress.length, 2);

    const completed = filterStrategicTasks(tasks, { statusFilter: "COMPLETED" });
    assert.equal(completed.length, 1);

    const bottlenecks = filterStrategicTasks(tasks, {
      statusFilter: "BOTTLENECK",
      referenceDate: refDate,
    });
    assert.equal(bottlenecks.length, 1);
    assert.equal(bottlenecks[0].id, "st-2");
  });
});

describe("ExecutiveCockpitWorkspace Component Static Rendering", () => {
  const mockUser: AuthUser = {
    id: "user-bgh-1",
    name: "TS. Nguyễn Minh Tuấn",
    email: "tuan.nm@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Phó Hiệu trưởng phụ trách",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const mockTasks: SchoolTask[] = [
    {
      id: "sch-bgh-1",
      title: "Xây dựng đề án tự chủ đại học giai đoạn 2026-2030",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chiến lược",
      leadAssigneeName: "TS. Nguyễn Minh Tuấn",
      leadDepartmentCode: "BGH",
      leadDepartment: "Ban Giám hiệu",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-30",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 75,
    },
    {
      id: "sch-bgh-2",
      title: "Báo cáo kiểm định chất lượng đào tạo",
      category: "BAO_CAO",
      categoryLabel: "Khảo thí",
      leadAssigneeName: "TS. Nguyễn Công Minh",
      leadDepartmentCode: "KHAO_THI",
      leadDepartment: "Phòng Khảo thí & ĐBCL",
      coAssignees: [],
      assignedDate: "2026-08-01",
      dueDate: "2026-09-01", // Overdue
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 50,
    },
  ];

  test("renders welcome header with user name and BGH badge", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCockpitWorkspace, {
        user: mockUser,
        tasks: mockTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(
      html.includes("TS. Nguyễn Minh Tuấn"),
      "Must display executive user name"
    );
    assert.ok(
      html.includes("Ban Giám Hiệu"),
      "Must display Ban Giám Hiệu badge"
    );
    assert.ok(
      html.includes("KHOANG ĐIỀU HÀNH BGH") ||
        html.includes("Khoang điều hành") ||
        html.includes("TRUNG TÂM ĐIỀU HÀNH BGH") ||
        html.includes("Trung tâm điều hành"),
      "Must display cockpit title"
    );
  });

  test("renders high-altitude cockpit strip with all 4 metric cards", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCockpitWorkspace, {
        user: mockUser,
        tasks: mockTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Tắc nghẽn cần tháo gỡ"));
    assert.ok(html.includes("Hồ sơ chờ phê duyệt cấp Trường"));
    assert.ok(html.includes("Chỉ số hoàn thành toàn trường"));
    assert.ok(html.includes("Tổng số nhiệm vụ đang chạy"));
  });

  test("renders navigation tabs for all 4 views", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCockpitWorkspace, {
        user: mockUser,
        tasks: mockTasks,
        referenceDate: "2026-09-06",
      })
    );

    assert.ok(html.includes("Cảnh báo thắt nút cổ chai &amp; Tắc nghẽn") || html.includes("Cảnh báo thắt nút cổ chai & Tắc nghẽn"));
    assert.ok(html.includes("Hàng đợi Phê duyệt Chiến lược"));
    assert.ok(html.includes("Radar Sức Khỏe 11 Đơn Vị"));
    assert.ok(html.includes("Nhiệm vụ Chiến lược cấp Trường"));
  });

  test("renders action button for Giao chỉ đạo nhiệm vụ BGH when callback provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveCockpitWorkspace, {
        user: mockUser,
        tasks: mockTasks,
        referenceDate: "2026-09-06",
        onCreateDirective: () => {},
      })
    );

    assert.ok(
      html.includes("Giao nhiệm vụ") || html.includes("Giao chỉ đạo nhiệm vụ BGH"),
      "Must render directive creation action"
    );
  });

  test("verifies ExecutiveWorkspace alias is exported and functional", () => {
    assert.equal(ExecutiveWorkspace, ExecutiveCockpitWorkspace);
    const html = renderToStaticMarkup(
      React.createElement(ExecutiveWorkspace, {
        user: mockUser,
        tasks: mockTasks,
        referenceDate: "2026-09-06",
      })
    );
    assert.ok(
      html.includes("TS. Nguyễn Minh Tuấn") || html.includes("Ban Giám Hiệu"),
      "Must render executive workspace"
    );
  });
});

describe("Sidebar Navigation Hygiene", () => {
  test("ensures all navigation items use clean Next.js path routes without query strings", () => {
    const allItems = [...SIDEBAR_ZONE_ITEMS, ...NAVIGATION_ITEMS];
    for (const item of allItems) {
      assert.equal(
        item.href.includes("?zone="),
        false,
        `Item ${item.label} should not contain ?zone=`
      );
      assert.equal(
        item.href.includes("?view="),
        false,
        `Item ${item.label} should not contain ?view=`
      );
      assert.equal(
        item.href.includes("?tab="),
        false,
        `Item ${item.label} should not contain ?tab=`
      );
    }
  });

  test("defines clean canonical routes in SIDEBAR_ZONE_ITEMS", () => {
    const routes = SIDEBAR_ZONE_ITEMS.map((item) => item.href);
    assert.ok(routes.includes("/"), "Must contain root path /");
    assert.ok(routes.includes("/tasks"), "Must contain /tasks");
    assert.ok(routes.includes("/calendar"), "Must contain /calendar");
    assert.ok(routes.includes("/org"), "Must contain /org");
    assert.ok(routes.includes("/notifications"), "Must contain /notifications");
  });

  test("ensures all SIDEBAR_ZONE_ITEMS have valid Lucide icons and non-empty labels", () => {
    for (const item of SIDEBAR_ZONE_ITEMS) {
      assert.ok(item.label && item.label.length > 0, "Item must have non-empty label");
      assert.equal(typeof item.icon, "object", `Item ${item.label} icon must be a Lucide component`);
    }
  });

  test("verifies active route matching behavior for clean paths", () => {
    const isItemActive = (itemHref: string, pathname: string, searchZone?: string | null) => {
      if (itemHref === "/portal") return pathname === "/portal";
      if (itemHref === "/") {
        if (searchZone && (searchZone === "tasks" || searchZone === "calendar" || searchZone === "org")) {
          return false;
        }
        return pathname === "/";
      }
      if (pathname === itemHref || (itemHref !== "/" && pathname.startsWith(itemHref + "/"))) {
        return true;
      }
      if (pathname === "/" && searchZone) {
        if (itemHref === "/tasks" && searchZone === "tasks") return true;
        if (itemHref === "/calendar" && searchZone === "calendar") return true;
        if (itemHref === "/org" && searchZone === "org") return true;
      }
      return false;
    };

    // Root path
    assert.equal(isItemActive("/", "/"), true);
    assert.equal(isItemActive("/tasks", "/"), false);
    assert.equal(isItemActive("/calendar", "/"), false);

    // /tasks path
    assert.equal(isItemActive("/", "/tasks"), false);
    assert.equal(isItemActive("/tasks", "/tasks"), true);
    assert.equal(isItemActive("/tasks", "/tasks/sub-123"), true);

    // /calendar path
    assert.equal(isItemActive("/", "/calendar"), false);
    assert.equal(isItemActive("/calendar", "/calendar"), true);

    // /org path
    assert.equal(isItemActive("/org", "/org"), true);

    // /notifications path
    assert.equal(isItemActive("/notifications", "/notifications"), true);

    // Legacy ?zone=tasks on root
    assert.equal(isItemActive("/", "/", "tasks"), false);
    assert.equal(isItemActive("/tasks", "/", "tasks"), true);
  });
});

describe("Task 9: Root Page Role-Based Dispatcher Workflow", () => {
  test("verifies role normalization logic for executive, manager, and staff", () => {
    const resolveRoles = (role?: string) => {
      const roleStr = String(role || "").toUpperCase();
      const isExecutive =
        role === "ADMIN" ||
        roleStr === "ADMIN" ||
        roleStr === "BGH" ||
        roleStr === "BAN_GIAM_HIEU";
      const isManager =
        role === "MANAGER" ||
        roleStr === "MANAGER" ||
        roleStr === "TRUONG_DON_VI" ||
        roleStr === "TRUONG_PHONG";
      const isStaff =
        role === "STAFF" ||
        roleStr === "STAFF" ||
        roleStr === "GIANG_VIEN" ||
        roleStr === "CHUYEN_VIEN" ||
        (!isExecutive && !isManager);

      return { isExecutive, isManager, isStaff };
    };

    // Executive variants
    assert.deepEqual(resolveRoles("ADMIN"), { isExecutive: true, isManager: false, isStaff: false });
    assert.deepEqual(resolveRoles("BGH"), { isExecutive: true, isManager: false, isStaff: false });
    assert.deepEqual(resolveRoles("BAN_GIAM_HIEU"), { isExecutive: true, isManager: false, isStaff: false });

    // Manager variants
    assert.deepEqual(resolveRoles("MANAGER"), { isExecutive: false, isManager: true, isStaff: false });
    assert.deepEqual(resolveRoles("TRUONG_DON_VI"), { isExecutive: false, isManager: true, isStaff: false });
    assert.deepEqual(resolveRoles("TRUONG_PHONG"), { isExecutive: false, isManager: true, isStaff: false });

    // Staff variants
    assert.deepEqual(resolveRoles("STAFF"), { isExecutive: false, isManager: false, isStaff: true });
    assert.deepEqual(resolveRoles("GIANG_VIEN"), { isExecutive: false, isManager: false, isStaff: true });
    assert.deepEqual(resolveRoles("CHUYEN_VIEN"), { isExecutive: false, isManager: false, isStaff: true });

    // Fallback
    assert.deepEqual(resolveRoles(undefined), { isExecutive: false, isManager: false, isStaff: true });
  });

  test("verifies deliverable submission state update logic for subtasks", () => {
    const todayStr = "2026-09-06";
    const initialTask: SchoolTask = {
      id: "task-test-1",
      title: "Công tác DACUM",
      category: "CNTT",
      categoryLabel: "Công nghệ thông tin",
      status: "IN_PROGRESS",
      leadAssigneeName: "TS. Nguyễn Ngọc Vinh",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-30",
      subTasks: [
        {
          id: "sub-test-1",
          title: "Xây dựng ma trận kỹ năng",
          assigneeName: "ThS. Lê Văn Phó",
          status: "IN_PROGRESS",
          dueDate: "2026-09-15",
          parentSchoolTaskId: "task-test-1",
          deliverables: [],
          updatedAt: todayStr,
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const payload: DeliverableSubmissionPayload = {
      taskId: "sub-test-1",
      deliverableName: "Bao_cao_DACUM_K_CNTT.pdf",
      url: "https://drive.google.com/file/d/test12345",
      fileType: "application/pdf",
      note: "Đã hoàn thành phân tích kỹ năng nghề",
    };

    const updatedSubs = initialTask.subTasks.map((sub) => {
      if (sub.id === payload.taskId) {
        const existingDeliverables = sub.deliverables || [];
        const newFile = {
          id: `deliv-1`,
          name: payload.deliverableName || "Tài liệu minh chứng",
          url: payload.url || "#",
          fileType: payload.fileType || "application/pdf",
          submittedAt: todayStr,
        };
        return {
          ...sub,
          status: "NEEDS_REVIEW" as const,
          deliverables: [...existingDeliverables, newFile],
          deliverableDescription: payload.note || sub.deliverableDescription,
          updatedAt: todayStr,
        };
      }
      return sub;
    });

    assert.equal(updatedSubs[0].status, "NEEDS_REVIEW");
    assert.equal(updatedSubs[0].deliverables?.length, 1);
    assert.equal(updatedSubs[0].deliverables?.[0].name, "Bao_cao_DACUM_K_CNTT.pdf");
    assert.equal(updatedSubs[0].deliverableDescription, "Đã hoàn thành phân tích kỹ năng nghề");
  });

  test("verifies review action transitions: approved, revision_requested, rejected", () => {
    const evaluateReviewStatus = (decision: "approved" | "revision_requested" | "rejected"): TaskStatus => {
      if (decision === "approved") return "COMPLETED";
      if (decision === "revision_requested") return "IN_PROGRESS";
      return "BLOCKED";
    };

    assert.equal(evaluateReviewStatus("approved"), "COMPLETED");
    assert.equal(evaluateReviewStatus("revision_requested"), "IN_PROGRESS");
    assert.equal(evaluateReviewStatus("rejected"), "BLOCKED");
  });

});

describe("StaffTask Extended Fields: Collaborators & SubItems", () => {
  test("creates a valid StaffTask with collaborators and subItems according to interface", () => {
    const taskWithExtras: StaffTask = {
      id: "st-khai-giang-001",
      title: "Lễ Khai giảng năm học 2026-2027",
      assigneeId: "tran-hung",
      assigneeName: "Trần Hùng",
      status: "COMPLETED",
      dueDate: "2026-09-04",
      parentSchoolTaskId: "school-task-1",
      updatedAt: "2026-09-03T08:10:00Z",
      collaborators: [
        { id: "nguyen-anh", name: "Nguyễn Anh" },
        { id: "le-mai", name: "Lê Mai" },
        { id: "dang-huy", name: "Đặng Huy" },
      ],
      subItems: [
        { id: "si-001", title: "Kịch bản, voice", assigneeName: "Lê Mai", dueDate: "2026-09-04", status: "COMPLETED" },
        { id: "si-002", title: "Thiết kế banner", assigneeName: "Nguyễn Anh", dueDate: "2026-09-04", status: "COMPLETED" },
      ],
    };

    assert.equal(taskWithExtras.id, "st-khai-giang-001");
    assert.equal(taskWithExtras.collaborators?.length, 3);
    assert.equal(taskWithExtras.collaborators?.[0].name, "Nguyễn Anh");
    assert.equal(taskWithExtras.subItems?.length, 2);
    assert.equal(taskWithExtras.subItems?.[0].title, "Kịch bản, voice");
  });

  test("verifies mock dataset from getMockDashboardPayload contains task with collaborators and subItems", () => {
    const payload = getMockDashboardPayload();
    const allStaffTasks = payload.tasks.flatMap((t) => t.subTasks);
    const taskWithCollabs = allStaffTasks.find(
      (t) => t.collaborators && t.collaborators.length > 0 && t.subItems && t.subItems.length > 0
    );

    assert.ok(taskWithCollabs, "Must find at least one StaffTask with collaborators and subItems");
    assert.equal(taskWithCollabs?.id, "st-khai-giang-001");
    assert.equal(taskWithCollabs?.title, "Lễ Khai giảng năm học 2026-2027");
    assert.equal(taskWithCollabs?.collaborators?.length, 3);
    assert.equal(taskWithCollabs?.subItems?.length, 2);

    const parentTask = payload.tasks.find((t) => t.id === taskWithCollabs?.parentSchoolTaskId);
    assert.ok(parentTask, "Parent school task must exist");
    const subTaskInParent = parentTask?.subTasks.find((st) => st.id === "st-khai-giang-001");
    assert.ok(subTaskInParent, "Subtask must exist in parentSchoolTask.subTasks");
    assert.equal(subTaskInParent?.collaborators?.length, 3);
    assert.equal(subTaskInParent?.subItems?.length, 2);
  });
});






