import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  canUserReviewTask,
  canUserSubmitDeliverable,
  canUserCloseSchoolTask,
  isSchoolTask,
  getTaskLevelBadge,
  getDetailStatusConfig,
  formatDetailDate,
  getTaskAuditTimeline,
  TASK_STATUS_CONFIG,
  TASK_LEVEL_CONFIG,
  TaskDetailSideSheet,
  deriveTaskDetailCapabilities,
  resolveTaskAssigneeId,
  isTaskCompletedLifecycle,
} from "../src/components/dashboard/task-detail-side-sheet";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { AuthUser } from "../src/types/auth";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("TaskDetailSideSheet Type Guard and Helpers", () => {
  test("distinguishes SchoolTask from StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Test School",
      category: "CNTT",
      categoryLabel: "CNTT",
      leadAssigneeName: "Hùng",
      coAssignees: [],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [],
      totalSubTasks: 0,
      completedSubTasks: 0,
      progressPercent: 0,
    };

    const staffTask: StaffTask = {
      id: "st1",
      title: "Test Staff",
      assigneeName: "Tuấn",
      status: "NEW",
      dueDate: "2026-09-15",
      parentSchoolTaskId: "s1",
      updatedAt: "2026-09-02",
    };

    assert.equal(isSchoolTask(schoolTask), true);
    assert.equal(isSchoolTask(staffTask), false);
    assert.equal(isSchoolTask(null), false);
    assert.equal(isSchoolTask(undefined), false);
  });

  test("provides correct Task Level badge labels", () => {
    const schoolLevel = getTaskLevelBadge(true);
    assert.equal(schoolLevel.label, "Nhiệm vụ cấp Trường");

    const staffLevel = getTaskLevelBadge(false);
    assert.equal(staffLevel.label, "Công việc Đơn vị");
  });

  test("provides status configuration for quick selector and badge", () => {
    const newConfig = getDetailStatusConfig("NEW");
    assert.equal(newConfig.label, "Mới");

    const inProgressConfig = getDetailStatusConfig("IN_PROGRESS");
    assert.equal(inProgressConfig.label, "Đang thực hiện");

    const needsReviewConfig = getDetailStatusConfig("NEEDS_REVIEW");
    assert.equal(needsReviewConfig.label, "Cần chỉnh sửa");

    const completedConfig = getDetailStatusConfig("COMPLETED");
    assert.equal(completedConfig.label, "Hoàn thành");
  });

  test("formats detail dates safely", () => {
    assert.equal(formatDetailDate("2026-09-20"), "20/09/2026");
    assert.equal(formatDetailDate(""), "Chưa đặt");
    assert.equal(formatDetailDate(undefined), "Chưa đặt");
  });

  test("computes structured audit timeline for SchoolTask and StaffTask", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Nâng cấp bảo mật hạ tầng mạng",
      category: "ATTT",
      categoryLabel: "An toàn thông tin",
      leadAssigneeName: "Trần Hùng",
      coAssignees: ["Nguyễn Ngọc Vinh"],
      assignedDate: "2026-09-01",
      dueDate: "2026-09-20",
      status: "IN_PROGRESS",
      subTasks: [
        {
          id: "st1",
          title: "Kiểm tra switch mạng",
          assigneeName: "Trần Hùng",
          status: "COMPLETED",
          dueDate: "2026-09-10",
          parentSchoolTaskId: "s1",
          updatedAt: "2026-09-02",
        },
      ],
      totalSubTasks: 1,
      completedSubTasks: 1,
      progressPercent: 100,
    };

    const timeline = getTaskAuditTimeline(schoolTask);
    assert.ok(Array.isArray(timeline));
    assert.ok(timeline.length >= 2, "Expected at least 2 timeline events");
    assert.equal(timeline[0].type, "assigned");
    assert.ok(timeline[0].timestamp.includes("01/09/2026"));

    const staffTask: StaffTask = {
      id: "st1",
      title: "Viết báo cáo đánh giá an toàn thông tin",
      assigneeName: "Trần Hùng",
      status: "NEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "2026-09-03",
    };

    const staffTimeline = getTaskAuditTimeline(staffTask);
    assert.ok(Array.isArray(staffTimeline));
    assert.ok(staffTimeline.length >= 2);
  });

  test("Anti-slop: zero emojis in task detail side sheet source and configs", () => {
    const hasEmoji = (str: string) =>
      /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F1E0}-\u{1F1FF}\u{1F680}-\u{1F6C5}\u{1F6CB}-\u{1F6D0}\u{1F6E0}-\u{1F6E5}\u{1F6F0}-\u{1F6F3}]/u.test(str);

    // Check status config labels
    for (const status of Object.values(TASK_STATUS_CONFIG)) {
      assert.equal(hasEmoji(status.label), false, `Emoji found in status: ${status.label}`);
    }

    // Check level config labels
    for (const level of Object.values(TASK_LEVEL_CONFIG)) {
      assert.equal(hasEmoji(level.label), false, `Emoji found in level: ${level.label}`);
    }

  });

});

// ---------------------------------------------------------------------------
// Merged from task-detail-side-sheet.test.ts — role-permission checks
// ---------------------------------------------------------------------------
describe("Task Detail Side Sheet Role Permissions", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffUser: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  test("canUserSubmitDeliverable allows only assignee when task is IN_PROGRESS or BLOCKED", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserSubmitDeliverable(task, staffUser), true);
    assert.equal(canUserSubmitDeliverable(task, managerUser), false);

    const completedTask: StaffTask = { ...task, status: "COMPLETED" };
    assert.equal(canUserSubmitDeliverable(completedTask, staffUser), false);

    const blockedTask: StaffTask = { ...task, status: "BLOCKED" };
    assert.equal(canUserSubmitDeliverable(blockedTask, staffUser), true);
    assert.equal(canUserSubmitDeliverable(blockedTask, managerUser), false);

    const newTask: StaffTask = { ...task, status: "NEW" };
    assert.equal(canUserSubmitDeliverable(newTask, staffUser), false);

    const needsReviewTask: StaffTask = { ...task, status: "NEEDS_REVIEW" };
    assert.equal(canUserSubmitDeliverable(needsReviewTask, staffUser), false);

    assert.equal(canUserSubmitDeliverable(task, null), false);
    assert.equal(canUserSubmitDeliverable(task, undefined), false);
  });

  test("canUserReviewTask allows manager and admin when status is NEEDS_REVIEW", () => {
    const task: StaffTask = {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      status: "NEEDS_REVIEW",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      updatedAt: "",
    };

    assert.equal(canUserReviewTask(task, managerUser), true);
    assert.equal(canUserReviewTask(task, adminUser), true);
    assert.equal(canUserReviewTask(task, staffUser), false);

    const inProgressTask: StaffTask = { ...task, status: "IN_PROGRESS" };
    assert.equal(canUserReviewTask(inProgressTask, managerUser), false);
    assert.equal(canUserReviewTask(inProgressTask, adminUser), false);

    const completedTask: StaffTask = { ...task, status: "COMPLETED" };
    assert.equal(canUserReviewTask(completedTask, managerUser), false);

    assert.equal(canUserReviewTask(task, null), false);
    assert.equal(canUserReviewTask(task, undefined), false);
  });

  test("canUserCloseSchoolTask allows only ADMIN when status is PENDING_EXECUTIVE_APPROVAL", () => {
    const schoolTask: SchoolTask = {
      id: "s1",
      title: "Tuyển sinh 2026",
      category: "CHUYEN_DOI_SO",
      categoryLabel: "Chuyển đổi số",
      leadAssigneeName: "Trần Hùng",
      coAssignees: [],
      assignedDate: "",
      dueDate: "",
      status: "PENDING_EXECUTIVE_APPROVAL",
      subTasks: [],
      totalSubTasks: 2,
      completedSubTasks: 2,
      progressPercent: 100,
    };

    assert.equal(canUserCloseSchoolTask(schoolTask, adminUser), true);
    assert.equal(canUserCloseSchoolTask(schoolTask, managerUser), false);
    assert.equal(canUserCloseSchoolTask(schoolTask, staffUser), false);

    const inProgressSchoolTask: SchoolTask = {
      ...schoolTask,
      status: "IN_PROGRESS",
    };
    assert.equal(canUserCloseSchoolTask(inProgressSchoolTask, adminUser), false);

    const completedSchoolTask: SchoolTask = {
      ...schoolTask,
      status: "COMPLETED",
    };
    assert.equal(canUserCloseSchoolTask(completedSchoolTask, adminUser), false);

    assert.equal(canUserCloseSchoolTask(schoolTask, null), false);
    assert.equal(canUserCloseSchoolTask(schoolTask, undefined), false);
  });
});

// ---------------------------------------------------------------------------
// Merged from tasks/task-detail-action-capability.test.ts — decision capability
// ---------------------------------------------------------------------------
describe("Task Detail decision capability & truthful history", () => {
  const adminUser: AuthUser = {
    id: "admin-1",
    name: "Hiệu trưởng",
    email: "bgh@cdktcnqn.edu.vn",
    role: "ADMIN",
    roleLabel: "Ban Giám hiệu",
    department: "Ban Giám hiệu",
    departmentCode: "BGH",
  };

  const managerUser: AuthUser = {
    id: "manager-1",
    name: "Trần Hùng",
    email: "daotao@cdktcnqn.edu.vn",
    role: "MANAGER",
    roleLabel: "Trưởng phòng Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  const staffUser: AuthUser = {
    id: "staff-1",
    name: "Lê Văn A",
    email: "anlv@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên Đào tạo",
    department: "Phòng Đào tạo & QLKH",
    departmentCode: "DAO_TAO",
  };

  function staffTask(overrides: Partial<StaffTask> = {}): StaffTask {
    return {
      id: "t1",
      title: "Biên soạn tài liệu",
      assigneeName: "Lê Văn A",
      assigneeId: "staff-1",
      status: "IN_PROGRESS",
      dueDate: "2026-09-25",
      parentSchoolTaskId: "s1",
      departmentCode: "DAO_TAO",
      updatedAt: "",
      ...overrides,
    };
  }

  describe("Task Detail capability — T20 capability-driven review", () => {
    test("a non-assignee reviewer with authority receives review capability on a submitted task", () => {
      const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });
      const caps = deriveTaskDetailCapabilities(task, managerUser);

      assert.equal(caps.lifecycle, "WAITING_APPROVAL");
      assert.equal(caps.isTerminal, false);
      assert.equal(caps.canApprove, true, "a non-assignee unit reviewer may approve");
      assert.equal(caps.canReject, true);
    });

    test("the submitter/assignee never receives approval capability even with approval authority (SoD)", () => {
      const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: managerUser.id });
      const caps = deriveTaskDetailCapabilities(task, managerUser);

      assert.equal(caps.canApprove, false, "assignee cannot self-approve (SoD)");
      assert.equal(caps.canReject, false, "assignee cannot self-reject (SoD)");
    });

    test("a plain submitter without approval authority cannot approve", () => {
      const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: staffUser.id });
      const caps = deriveTaskDetailCapabilities(task, staffUser);

      assert.equal(caps.canApprove, false);
      assert.equal(caps.canReject, false);
    });

    test("a completed task exposes no review capability even for an authorized reviewer", () => {
      const task = staffTask({ status: "COMPLETED", assigneeId: "staff-1" });
      const caps = deriveTaskDetailCapabilities(task, managerUser);

      assert.equal(caps.lifecycle, "COMPLETED");
      assert.equal(caps.isTerminal, true);
      assert.equal(caps.canApprove, false, "completed task shows no review CTA");
      assert.equal(caps.canReject, false);
      assert.equal(isTaskCompletedLifecycle(task), true);
    });
  });

  describe("Task Detail capability — submit/edit projection", () => {
    test("the assignee may submit on an in-progress task; a non-assignee reviewer may not", () => {
      const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });

      const assigneeCaps = deriveTaskDetailCapabilities(task, staffUser);
      assert.equal(assigneeCaps.canSubmit, true);

      const reviewerCaps = deriveTaskDetailCapabilities(task, managerUser);
      assert.equal(reviewerCaps.canSubmit, false, "only the executor submits the deliverable");
    });

    test("BLOCKED maps to the in-progress lifecycle without losing submit capability", () => {
      const task = staffTask({ status: "BLOCKED", assigneeId: "staff-1" });
      const caps = deriveTaskDetailCapabilities(task, staffUser);

      assert.equal(caps.lifecycle, "IN_PROGRESS");
      assert.equal(caps.canSubmit, true);
    });

    test("OVERDUE keeps its overdue lifecycle token", () => {
      const task = staffTask({ status: "OVERDUE", assigneeId: "staff-1" });
      const caps = deriveTaskDetailCapabilities(task, staffUser);
      assert.equal(caps.lifecycle, "OVERDUE");
    });

    test("no actor yields an all-false capability matrix (fail closed)", () => {
      const task = staffTask({ status: "NEEDS_REVIEW" });
      const caps = deriveTaskDetailCapabilities(task, null);

      assert.equal(caps.canSubmit, false);
      assert.equal(caps.canApprove, false);
      assert.equal(caps.canReject, false);
      assert.equal(caps.matrix.CAN_VIEW, false);
    });
  });

  describe("Task Detail — assignee identity resolution (T24 identity by ID)", () => {
    test("prefers the stable assigneeId, never the display name", () => {
      const task = staffTask({ assigneeId: "staff-1" });
      assert.equal(resolveTaskAssigneeId(task, managerUser), "staff-1");
    });

    test("falls back to a name match only when no stable id is present", () => {
      const task = staffTask({ assigneeId: undefined, assigneeName: staffUser.name });
      assert.equal(resolveTaskAssigneeId(task, staffUser), staffUser.id);
      assert.equal(resolveTaskAssigneeId(task, managerUser), null);
    });
  });

  describe("Task Detail surface — truthful history render (T18)", () => {
    test("real server audit events render under 'Lịch sử'; derived facts under 'Mốc thông tin'", () => {
      const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: staffUser,
          isOpen: true,
          onClose: () => {},
          auditEvents: [
            {
              id: "audit-1",
              action: "TASK_CREATED",
              actorName: "Ban Giám hiệu",
              timestamp: "2026-09-01T08:00:00.000Z",
              description: "Khởi tạo nhiệm vụ",
            },
            {
              id: "audit-2",
              action: "DELIVERABLE_SUBMITTED",
              actorName: "Lê Văn A",
              timestamp: "2026-09-10T09:30:00.000Z",
            },
          ],
        })
      );

      const historyStart = html.indexOf('data-slot="detail-history"');
      const milestonesStart = html.indexOf('data-slot="detail-derived-milestones"');
      assert.ok(historyStart >= 0, "history section must render");
      assert.ok(milestonesStart > historyStart, "derived milestones must follow history");

      const historyHtml = html.slice(historyStart, milestonesStart);
      assert.ok(
        historyHtml.includes("Khởi tạo nhiệm vụ"),
        "real audit event text must render under Lịch sử"
      );
      assert.ok(
        historyHtml.includes("Ban Giám hiệu"),
        "real audit actor must render under Lịch sử"
      );
      assert.ok(
        historyHtml.includes("Nộp minh chứng"),
        "mapped audit action label must render under Lịch sử"
      );
      assert.ok(
        historyHtml.includes("2 bản ghi"),
        "history must reflect the real audit event count"
      );
      assert.ok(
        !historyHtml.includes("Chưa có bản ghi kiểm toán"),
        "no empty state may render when real events exist"
      );
    });

    test("absent audit events render a truthful empty state (no fabricated history)", () => {
      const task = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
      const html = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: staffUser,
          isOpen: true,
          onClose: () => {},
        })
      );

      const historyStart = html.indexOf('data-slot="detail-history"');
      const milestonesStart = html.indexOf('data-slot="detail-derived-milestones"');
      const historyHtml = html.slice(historyStart, milestonesStart);
      assert.ok(
        historyHtml.includes("Chưa có bản ghi kiểm toán"),
        "missing audit data must render the truthful empty state"
      );
    });
  });

  describe("Task Detail surface — capability-driven submit & review (C2/T20)", () => {
    test("the assignee sees the submit form only on an active in-progress task", () => {
      const inProgress = staffTask({ status: "IN_PROGRESS", assigneeId: "staff-1" });
      const inProgressHtml = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task: inProgress,
          currentUser: staffUser,
          isOpen: true,
          onClose: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(
        inProgressHtml.includes('id="deliverable-form"'),
        "the assignee on an active task may submit"
      );

      const awaiting = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });
      const awaitingHtml = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task: awaiting,
          currentUser: staffUser,
          isOpen: true,
          onClose: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(
        !awaitingHtml.includes('id="deliverable-form"'),
        "the submit form must not be re-offered while the task awaits review"
      );
    });

    test("a non-assignee reviewer gets the approve CTA; the submitter never does (SoD)", () => {
      const task = staffTask({ status: "NEEDS_REVIEW", assigneeId: "staff-1" });

      const reviewerHtml = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: managerUser,
          isOpen: true,
          onClose: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(
        reviewerHtml.includes("Duyệt nhanh (Đạt chuẩn)") ||
          reviewerHtml.includes("Nghiệm thu Đạt (Hoàn thành)"),
        "a non-assignee unit reviewer must see an enabled approve CTA"
      );

      const submitterHtml = renderToStaticMarkup(
        React.createElement(TaskDetailSideSheet, {
          task,
          currentUser: staffUser,
          isOpen: true,
          onClose: () => {},
          onStatusChange: () => {},
        })
      );
      assert.ok(
        !submitterHtml.includes("Nghiệm thu Đạt (Hoàn thành)") &&
          !submitterHtml.includes("Duyệt nhanh (Đạt chuẩn)"),
        "the submitter must never receive an enabled approve CTA"
      );
      assert.ok(
        submitterHtml.includes("Nghiệm thu Đạt (Vô hiệu hóa)"),
        "the submitter sees the explicit SoD-disabled review affordance"
      );
    });
  });

});
