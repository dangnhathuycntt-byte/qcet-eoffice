import { describe, it, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveMetricStrip } from "../src/components/workspace/components/adaptive-metric-strip";
import {
  isTaskWaitingApproval,
  isActiveTaskStatus,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskAssignedToUser,
  isTaskAssignedToUserOrUnit,
  computeSmartWorkboxCounts,
  computeWorkspaceTabCounts,
} from "../src/lib/workspace-metrics-aggregator";
import {
  deriveAdaptiveWorkspaceData,
  type WorkspaceMetrics,
} from "../src/components/workspace/hooks/use-adaptive-workspace-data";
import { getSystemReferenceDate, isTaskPastDue } from "../src/lib/academic-calendar";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import type { AuthUser } from "../src/types/auth";

describe("WorkspaceMetrics Contract & Denominator Separation (P0-1 & P0-5)", () => {
  const mockUser: AuthUser = {
    id: "user-admin-1",
    name: "Ban Giám Hiệu",
    role: "ADMIN",
    roleLabel: "Ban Giám Hiệu",
    email: "bgh@qcet.edu.vn",
    department: "Ban Giám Hiệu",
    departmentCode: "BGH",
  };

  it("denominator separation: correctly counts totalParentTasks, totalSubtasks, and totalWorkItems", () => {
    const parentTask1: SchoolTask = {
      id: "parent-1",
      title: "Kế hoạch năm học",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "COMPLETED",
      dueDate: "2026-09-30",
      progressPercent: 100,
      totalSubTasks: 2,
      completedSubTasks: 2,
      leadAssigneeName: "Nguyễn Văn A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "sub-1-1",
          title: "Dự thảo phần 1",
          assigneeName: "Trần B",
          status: "COMPLETED",
          dueDate: "2026-09-15",
          updatedAt: "2026-09-10",
        },
        {
          id: "sub-1-2",
          title: "Dự thảo phần 2",
          assigneeName: "Lê C",
          status: "COMPLETED",
          dueDate: "2026-09-20",
          updatedAt: "2026-09-18",
        },
      ],
    };

    const parentTask2: SchoolTask = {
      id: "parent-2",
      title: "Triển khai khảo sát",
      category: "KHAC",
      categoryLabel: "Chuyên môn",
      status: "IN_PROGRESS",
      dueDate: "2026-10-15",
      progressPercent: 33,
      totalSubTasks: 3,
      completedSubTasks: 1,
      leadAssigneeName: "Phạm D",
      coAssignees: [],
      assignedDate: "2026-09-05",
      subTasks: [
        {
          id: "sub-2-1",
          title: "Biên soạn phiếu",
          assigneeName: "Trần B",
          status: "COMPLETED",
          dueDate: "2026-09-25",
          updatedAt: "2026-09-22",
        },
        {
          id: "sub-2-2",
          title: "Gửi phiếu khảo sát",
          assigneeName: "Vũ E",
          status: "IN_PROGRESS",
          dueDate: "2026-10-01",
          updatedAt: "2026-09-26",
        },
        {
          id: "sub-2-3",
          title: "Tổng hợp kết quả",
          assigneeName: "Đỗ F",
          status: "NOT_STARTED",
          dueDate: "2026-10-10",
          updatedAt: "2026-09-26",
        },
      ],
    };

    const result = deriveAdaptiveWorkspaceData({
      tasks: [parentTask1, parentTask2],
      user: mockUser,
      scope: "school",
    });

    const metrics = result.metrics as WorkspaceMetrics;

    assert.equal(metrics.totalParentTasks, 2, "totalParentTasks must count only parent tasks");
    assert.equal(metrics.completedParentTasks, 1, "completedParentTasks must count only completed parent tasks");
    assert.equal(metrics.totalSubtasks, 5, "totalSubtasks must sum all subtasks across scoped tasks");
    assert.equal(metrics.completedSubtasks, 3, "completedSubtasks must count all completed subtasks");
    assert.equal(metrics.totalWorkItems, 7, "totalWorkItems must equal totalParentTasks + totalSubtasks");

    // Backwards compatibility checks
    assert.equal(metrics.totalTasks, 2, "totalTasks must equal totalParentTasks");
    assert.equal(metrics.completedCount, 1, "completedCount must equal completedParentTasks");
  });

  it("parentCompletionRate is calculated strictly on parent tasks (or 0 when empty)", () => {
    // 2 parent tasks: 1 COMPLETED, 1 IN_PROGRESS => parent rate = 50%
    // Even though 5 out of 5 subtasks are COMPLETED, parent rate must not blend them (50%, not (1+5)/(2+5) = 86%)
    const parent1: SchoolTask = {
      id: "parent-p1",
      title: "Nhiệm vụ 1",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "COMPLETED",
      dueDate: "2026-09-30",
      progressPercent: 100,
      totalSubTasks: 2,
      completedSubTasks: 2,
      leadAssigneeName: "Nguyễn A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        { id: "s-1", title: "Việc con 1", assigneeName: "B", status: "COMPLETED", dueDate: "2026-09-10", updatedAt: "2026-09-09" },
        { id: "s-2", title: "Việc con 2", assigneeName: "C", status: "COMPLETED", dueDate: "2026-09-10", updatedAt: "2026-09-09" },
      ],
    };

    const parent2: SchoolTask = {
      id: "parent-p2",
      title: "Nhiệm vụ 2",
      category: "KHAC",
      categoryLabel: "Chuyên môn",
      status: "IN_PROGRESS",
      dueDate: "2026-09-30",
      progressPercent: 100,
      totalSubTasks: 3,
      completedSubTasks: 3,
      leadAssigneeName: "Nguyễn A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        { id: "s-3", title: "Việc con 3", assigneeName: "D", status: "COMPLETED", dueDate: "2026-09-10", updatedAt: "2026-09-09" },
        { id: "s-4", title: "Việc con 4", assigneeName: "E", status: "COMPLETED", dueDate: "2026-09-10", updatedAt: "2026-09-09" },
        { id: "s-5", title: "Việc con 5", assigneeName: "F", status: "COMPLETED", dueDate: "2026-09-10", updatedAt: "2026-09-09" },
      ],
    };

    const result = deriveAdaptiveWorkspaceData({
      tasks: [parent1, parent2],
      user: mockUser,
      scope: "school",
    });

    const metrics = result.metrics as WorkspaceMetrics;
    assert.equal(metrics.parentCompletionRate, 50, "parentCompletionRate must be 50% (1/2 parent tasks)");
    assert.equal(metrics.completedRate, 50, "backwards compat completedRate must equal parentCompletionRate");

    // Empty tasks edge case
    const emptyResult = deriveAdaptiveWorkspaceData({
      tasks: [],
      user: mockUser,
      scope: "school",
    });
    const emptyMetrics = emptyResult.metrics as WorkspaceMetrics;
    assert.equal(emptyMetrics.parentCompletionRate, 0, "parentCompletionRate must be 0 when no tasks exist");
    assert.equal(emptyMetrics.completedRate, 0, "completedRate must be 0 when no tasks exist");
  });

  it("urgentOverdueCount evaluates using isTaskPastDue from academic calendar rather than local system clock", () => {
    const refDate = "2026-09-09";
    assert.ok(refDate, "system reference date must exist");

    // Verification of isTaskPastDue canonical behavior
    assert.equal(isTaskPastDue("2026-09-08", refDate), true, "2026-09-08 is past due relative to 2026-09-09");
    assert.equal(isTaskPastDue("2026-09-09", refDate), false, "2026-09-09 is today, NOT past due");
    assert.equal(isTaskPastDue("2026-09-10", refDate), false, "2026-09-10 is future, NOT past due");

    const overdueParent: SchoolTask = {
      id: "p-overdue",
      title: "Hạn hôm qua",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "IN_PROGRESS",
      dueDate: "2026-09-08", // past due
      progressPercent: 50,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    };

    const todayParent: SchoolTask = {
      id: "p-today",
      title: "Hạn hôm nay",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "IN_PROGRESS",
      dueDate: "2026-09-09", // due today - not overdue
      progressPercent: 50,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    };

    const completedYesterdayParent: SchoolTask = {
      id: "p-completed-yesterday",
      title: "Đã hoàn thành hôm qua",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "COMPLETED",
      dueDate: "2026-09-08", // past due date but COMPLETED
      progressPercent: 100,
      totalSubTasks: 0,
      completedSubTasks: 0,
      leadAssigneeName: "A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [],
    };

    const result = deriveAdaptiveWorkspaceData({
      tasks: [overdueParent, todayParent, completedYesterdayParent],
      user: mockUser,
      scope: "school",
      referenceDate: refDate,
    });

    const metrics = result.metrics as WorkspaceMetrics;
    assert.equal(metrics.urgentOverdueCount, 1, "Only overdueParent should be counted as urgentOverdue");
  });

  it("subtasks waiting approval and overdue are tracked with explicit subtask metrics", () => {
    const parent: SchoolTask = {
      id: "parent-mixed",
      title: "Nhiệm vụ cha",
      category: "KHAC",
      categoryLabel: "Công tác chung",
      status: "IN_PROGRESS",
      dueDate: "2026-09-30", // not overdue, not waiting approval
      progressPercent: 40,
      totalSubTasks: 4,
      completedSubTasks: 1,
      leadAssigneeName: "A",
      coAssignees: [],
      assignedDate: "2026-09-01",
      subTasks: [
        {
          id: "st-1",
          title: "Chờ duyệt",
          assigneeName: "B",
          status: "WAITING_APPROVAL",
          dueDate: "2026-09-20", // future, waiting approval
          updatedAt: "2026-09-05",
        },
        {
          id: "st-2",
          title: "Cần rà soát và quá hạn",
          assigneeName: "C",
          status: "NEEDS_REVIEW",
          dueDate: "2026-09-08", // past due AND waiting approval
          updatedAt: "2026-09-07",
        },
        {
          id: "st-3",
          title: "Đang làm nhưng quá hạn",
          assigneeName: "D",
          status: "IN_PROGRESS",
          dueDate: "2026-09-07", // past due
          updatedAt: "2026-09-06",
        },
        {
          id: "st-4",
          title: "Đã hoàn thành",
          assigneeName: "E",
          status: "COMPLETED",
          dueDate: "2026-09-01", // past due date but COMPLETED => not overdue
          updatedAt: "2026-09-01",
        },
      ],
    };

    const result = deriveAdaptiveWorkspaceData({
      tasks: [parent],
      user: mockUser,
      scope: "school",
    });

    const metrics = result.metrics as WorkspaceMetrics;

    assert.equal(metrics.totalParentTasks, 1);
    assert.equal(metrics.totalSubtasks, 4);
    assert.equal(metrics.completedSubtasks, 1);

    // Explicit breakdown metrics
    assert.equal(metrics.subtasksWaitingApprovalCount, 2, "st-1 (WAITING_APPROVAL) + st-2 (NEEDS_REVIEW)");
    assert.equal(metrics.subtasksUrgentOverdueCount, 2, "st-2 (2026-09-08) + st-3 (2026-09-07)");
    assert.equal(metrics.parentWaitingApprovalCount, 0);
    assert.equal(metrics.parentUrgentOverdueCount, 0);

    // Combined counts
    assert.equal(metrics.waitingApprovalCount, 2);
    assert.equal(metrics.urgentOverdueCount, 2);
  });
});


/* ===== merged from tests/workspace-metrics-aggregator.test.ts ===== */






describe("Workspace Metrics Aggregator (Unified Phase 5/6)", () => {
  const staffUser = {
    id: "user-staff-1",
    email: "staff@qcet.edu.vn",
    name: "Nguyễn Văn A",
    role: "STAFF",
    roleLabel: "Chuyên viên",
    departmentCode: "KTL",
    department: "Khoa Du lịch - Khách sạn",
  } as unknown as AuthUser;

  const sampleTasks = [
    {
      id: "task-1",
      code: "NV-01",
      title: "Soạn đề cương bài giảng",
      assignedTo: "Nguyễn Văn A",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "IN_PROGRESS",
      priority: "HIGH",
      dueDate: "2026-10-15",
      progressPercent: 40,
    },
    {
      id: "task-2",
      code: "NV-02",
      title: "Báo cáo thực tập sinh viên",
      leadAssigneeName: "Nguyễn Văn A",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "WAITING_APPROVAL",
      priority: "NORMAL",
      dueDate: "2026-10-20",
      progressPercent: 100,
    },
    {
      id: "task-3",
      code: "NV-03",
      title: "Kế hoạch hội thảo khoa học",
      assignedTo: "Trần Thị B",
      departmentCode: "KTL",
      department: "Khoa Du lịch - Khách sạn",
      status: "IN_PROGRESS",
      priority: "URGENT",
      dueDate: "2026-09-01", // Overdue relative to 2026-09-10
      progressPercent: 10,
    },
    {
      id: "task-4",
      code: "NV-04",
      title: "Đề án nâng cấp phòng Lab",
      assignedTo: "Lê Văn C",
      departmentCode: "CNTT",
      department: "Khoa Công nghệ Thông tin",
      status: "COMPLETED",
      priority: "LOW",
      dueDate: "2026-08-30",
      progressPercent: 100,
    },
  ] as unknown as SchoolTask[];

  test("isTaskAssignedToUser matches correctly by name and ID", () => {
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[0], staffUser), true);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[1], staffUser), true);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[2], staffUser), false);
    assert.strictEqual(isTaskAssignedToUser(sampleTasks[3], staffUser), false);
  });

  test("isTaskAssignedToUserOrUnit matches department code and name", () => {
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[0], staffUser), true);
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[1], staffUser), true);
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[2], staffUser), true); // Same dept
    assert.strictEqual(isTaskAssignedToUserOrUnit(sampleTasks[3], staffUser), false); // Other dept
  });

  test("computeSmartWorkboxCounts matches expectations for Staff", () => {
    const counts = computeSmartWorkboxCounts({
      tasks: sampleTasks,
      user: staffUser,
      roleScope: "my",
      referenceDate: "2026-09-10",
    });

    // 2 tasks assigned to user (task-1 active, task-2 waiting approval)
    assert.strictEqual(counts.myCount, 2);
    assert.strictEqual(counts.waitingApprovalCount, 1);
    assert.strictEqual(counts.pendingSubmissionCount, 1);
    assert.strictEqual(counts.overdueCount, 0);
  });

  test("computeSmartWorkboxCounts matches expectations for Unit scope", () => {
    const counts = computeSmartWorkboxCounts({
      tasks: sampleTasks,
      user: staffUser,
      roleScope: "unit",
      referenceDate: "2026-09-10",
    });

    // 3 tasks in KTL dept (excluding completed task-4)
    assert.strictEqual(counts.myCount, 3);
    assert.strictEqual(counts.waitingApprovalCount, 1);
    assert.strictEqual(counts.pendingSubmissionCount, 2);
    assert.strictEqual(counts.overdueCount, 1); // task-3 is overdue
  });

  test("computeWorkspaceTabCounts produces consistent tab counts", () => {
    const tabCounts = computeWorkspaceTabCounts({
      scopedTasks: sampleTasks,
      user: staffUser,
      referenceDate: "2026-09-10",
    });

    assert.strictEqual(tabCounts.all, 4);
    assert.strictEqual(tabCounts.my, 2);
    assert.strictEqual(tabCounts.waiting_approval, 1);
    assert.strictEqual(tabCounts.overdue, 1);
  });
});


/* ===== merged from tests/adaptive-metric-strip.test.ts ===== */






describe("AdaptiveMetricStrip Component", () => {
  const metrics = {
    totalTasks: 24,
    urgentOverdueCount: 2,
    waitingApprovalCount: 5,
    completedRate: 68,
    labelScope: "Khoa CNTT",
  };

  test("renders all 4 metric values with font-mono tabular-nums", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("24"), "Renders total tasks");
    assert.ok(html.includes("2"), "Renders urgent overdue");
    assert.ok(html.includes("5"), "Renders waiting approval");
    assert.ok(html.includes("68%"), "Renders completion rate");
    assert.ok(html.includes("font-mono"), "Enforces font-mono for numbers");
    assert.ok(html.includes("tabular-nums"), "Enforces tabular-nums");
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });

  test("zero dark theme classes in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );
    assert.ok(!html.includes("dark:"), "Must follow light-only standard without dark: variants");
  });

  test("renders school scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
      })
    );

    assert.ok(html.includes("Tiến độ chung"), "Shows overall school progress");
    assert.ok(html.includes("Quá hạn"), "Shows school overdue");
    assert.ok(html.includes("Đang chờ duyệt"), "Shows school waiting approval");
    assert.ok(html.includes("Toàn trường") || html.includes("toàn trường"), "Shows school scope context");
  });

  test("renders unit scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("Tiến độ đơn vị") || html.includes("Tiến độ khoa"), "Shows faculty progress");
    assert.ok(html.includes("Quá hạn đơn vị"), "Shows unit overdue indicator");
    assert.ok(html.includes("Chờ phân công/duyệt"), "Shows unit triage indicator");
    assert.ok(html.includes("Đã nghiệm thu"), "Shows acceptance metric indicator");
    assert.ok(html.includes("Khoa CNTT"), "Shows department label");
  });

  test("renders my scope specific indicators", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "my",
      })
    );

    assert.ok(html.includes("Việc cần làm ngay"), "Shows personal urgent action");
    assert.ok(html.includes("Đang thực hiện"), "Shows personal in-progress indicator");
    assert.ok(html.includes("Chờ phản hồi"), "Shows personal feedback waiting indicator");
    assert.ok(html.includes("Hoàn tất kỳ này"), "Shows personal term completion indicator");
  });

  test("renders accessible button cards and filter attributes when onMetricClick is provided", () => {
    const dummyFn = () => {};
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics,
        scope: "school",
        onMetricClick: dummyFn,
      })
    );

    assert.ok(html.includes('role="button"'), "Card should have role=button when clickable");
    assert.ok(html.includes('data-metric-status="ALL"'), "Has ALL filter target");
    assert.ok(html.includes('data-metric-status="OVERDUE"'), "Has OVERDUE filter target");
    assert.ok(html.includes('data-metric-status="NEEDS_REVIEW"'), "Has NEEDS_REVIEW filter target");
    assert.ok(html.includes('data-metric-status="COMPLETED"'), "Has COMPLETED filter target");
  });

  test("handles zero overdue and waiting metrics gracefully", () => {
    const zeroMetrics = {
      totalTasks: 10,
      urgentOverdueCount: 0,
      waitingApprovalCount: 0,
      completedRate: 100,
      labelScope: "Phòng Đào tạo",
    };

    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics: zeroMetrics,
        scope: "unit",
      })
    );

    assert.ok(html.includes("Tiến độ đúng hạn"), "Shows on-schedule state when 0 overdue");
    assert.ok(html.includes("text-muted-foreground"), "Uses muted style when no pending items");
  });

  test("a11y aria-label and selectable number typography", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveMetricStrip, {
        metrics: {
          totalTasks: 15,
          urgentOverdueCount: 1,
          waitingApprovalCount: 2,
          completedRate: undefined as unknown as number,
          labelScope: "Khoa CNTT",
        },
        scope: "school",
      })
    );

    assert.ok(html.includes('role="region"'), "Card should have role=region when not interactive");
    assert.ok(html.includes('aria-label="'), "Must provide accessible aria-label on cards");
    assert.ok(html.includes("0%"), "Falls back to 0% when completedRate is undefined");
    assert.ok(html.includes("select-text"), "Number must be selectable for copy-pasting");
  });
});
