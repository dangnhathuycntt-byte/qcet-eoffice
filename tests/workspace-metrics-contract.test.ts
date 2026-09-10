import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
    const refDate = getSystemReferenceDate(); // "2026-09-09"
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
