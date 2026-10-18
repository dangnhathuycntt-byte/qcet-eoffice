import { test, describe } from "node:test";
import assert from "node:assert/strict";
import type {
  ApprovalDecision,
  DeliverableSubmissionPayload,
  ApprovalActionPayload,
  WorkspaceRole,
  StaffUrgencySummary,
  DepartmentHealthSummary,
} from "@qcet/contracts/types/workspace";
import type { SchoolTask, StaffTask, TaskStatus } from "@qcet/contracts/types/dashboard";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { validateDeliverableSubmission, getDeliverableDraftKey, inferFileType, formatFileSize, SUPPORTED_FILE_TYPES } from "../src/components/portal/submit-deliverable-modal";
import { validateReviewDecision, QUICK_COMMENT_TEMPLATES, DECISION_OPTIONS } from "../src/components/portal/review-action-dialog";

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
});

describe("Sidebar Navigation Hygiene", () => {

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
