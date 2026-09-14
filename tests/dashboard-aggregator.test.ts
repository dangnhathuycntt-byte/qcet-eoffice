import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
  filterSchoolTasks,
} from "../src/lib/dashboard-aggregator";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import type { SchoolTask, StaffTask, TaskStatus } from "../src/types/dashboard";

describe("Dashboard Aggregator & Rollup Engine", () => {
  const sampleStaffTasks: StaffTask[] = [
    {
      id: "sub-1",
      title: "Kiểm tra bản sao lưu",
      assigneeName: "Trần Hùng",
      status: "COMPLETED",
      dueDate: "2026-09-24",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-03T10:00:00Z",
    },
    {
      id: "sub-2",
      title: "Cập nhật log an ninh",
      assigneeName: "Trần Hùng",
      status: "IN_PROGRESS",
      dueDate: "2026-09-24",
      parentSchoolTaskId: "school-1",
      updatedAt: "2026-09-03T11:00:00Z",
    },
  ];

  const sampleSchoolTask: SchoolTask = {
    id: "school-1",
    title: "Sao lưu, giám sát an ninh mạng",
    category: "ATTT",
    categoryLabel: "An toàn thông tin",
    leadAssigneeName: "Trần Hùng",
    coAssignees: [],
    assignedDate: "2026-09-03",
    dueDate: "2026-09-24",
    status: "IN_PROGRESS",
    subTasks: sampleStaffTasks,
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 0,
  };

  test("computeSchoolTaskRollup calculates exact completion ratio and percentage", () => {
    const computed = computeSchoolTaskRollup(sampleSchoolTask);
    assert.equal(computed.totalSubTasks, 2);
    assert.equal(computed.completedSubTasks, 1);
    assert.equal(computed.progressPercent, 50);
  });

  test("computeDashboardStats aggregates school and staff level statistics", () => {
    const computedTask = computeSchoolTaskRollup(sampleSchoolTask);
    const stats = computeDashboardStats([computedTask]);
    assert.equal(stats.totalSchoolTasks, 1);
    assert.equal(stats.schoolTasksInProgress, 1);
    assert.equal(stats.totalStaffTasks, 2);
    assert.equal(stats.staffTasksCompleted, 1);
    assert.equal(stats.staffTasksInProgress, 1);
    assert.equal(stats.averageSchoolProgressPercent, 50);
  });

  test("filterSchoolTasks filters by search query and category", () => {
    const computedTask = computeSchoolTaskRollup(sampleSchoolTask);
    const results = filterSchoolTasks([computedTask], {
      query: "sao lưu",
      category: "ATTT",
    });
    assert.equal(results.length, 1);

    const emptyResults = filterSchoolTasks([computedTask], {
      query: "không tồn tại",
    });
    assert.equal(emptyResults.length, 0);
  });

  test("computeDashboardStats strictly adheres to MECE conservation law", () => {
    const refDate = "2026-09-09";
    const tasks: SchoolTask[] = [
      // 2 In progress on track
      { id: "1", title: "Task 1", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "IN_PROGRESS", dueDate: "2026-09-20", progressPercent: 50, totalSubTasks: 0, completedSubTasks: 0 },
      { id: "2", title: "Task 2", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "IN_PROGRESS", dueDate: "2026-09-25", progressPercent: 40, totalSubTasks: 0, completedSubTasks: 0 },
      // 1 Not started
      { id: "3", title: "Task 3", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "NOT_STARTED", dueDate: "2026-09-30", progressPercent: 0, totalSubTasks: 0, completedSubTasks: 0 },
      // 1 Waiting approval past due (MUST NOT BE STOLEN BY OVERDUE)
      { id: "4", title: "Task 4", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "WAITING_APPROVAL", dueDate: "2026-09-05", progressPercent: 100, totalSubTasks: 0, completedSubTasks: 0 },
      // 1 Overdue (not waiting approval)
      { id: "5", title: "Task 5", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "IN_PROGRESS", dueDate: "2026-09-01", progressPercent: 30, totalSubTasks: 0, completedSubTasks: 0 },
      // 1 Completed
      { id: "6", title: "Task 6", category: "KHAC", categoryLabel: "Khác", leadAssigneeName: "Admin", coAssignees: [], assignedDate: "2026-09-01", subTasks: [], status: "COMPLETED", dueDate: "2026-09-05", progressPercent: 100, totalSubTasks: 0, completedSubTasks: 0 },
    ];

    const stats = computeDashboardStats(tasks, refDate);
    assert.equal(stats.totalSchoolTasks, 6);
    assert.equal(stats.schoolTasksInProgress, 2);
    assert.equal(stats.schoolTasksNotStarted, 1);
    assert.equal(stats.schoolTasksWaitingApproval, 1);
    assert.equal(stats.schoolTasksOverdue, 1);
    assert.equal(stats.schoolTasksCompleted, 1);

    // Sum of parts strictly equals total
    const sumParts =
      stats.schoolTasksInProgress +
      stats.schoolTasksNotStarted! +
      stats.schoolTasksWaitingApproval! +
      stats.schoolTasksOverdue! +
      stats.schoolTasksCompleted;
    assert.equal(sumParts, 6);

    // Completion rate is 1/6 = 17%
    assert.equal(stats.completionRate, 17);
  });

  test("computeSchoolTaskRollup preserves manual progressPercent when subtasks are empty", () => {
    const manualTask: SchoolTask = {
      id: "m1",
      title: "Manual Progress",
      category: "KHAC",
      categoryLabel: "Khác",
      leadAssigneeName: "Admin",
      coAssignees: [],
      assignedDate: "2026-09-01",
      status: "IN_PROGRESS",
      dueDate: "2026-09-20",
      progressPercent: 65,
      totalSubTasks: 0,
      completedSubTasks: 0,
      subTasks: [],
    };

    const rolled = computeSchoolTaskRollup(manualTask);
    assert.equal(rolled.progressPercent, 65);
  });

  test("Optimistic task status change updates subtask and rolls up to school task", () => {
    const payload = getMockDashboardPayload();
    const originalTask = payload.tasks[0];
    assert.ok(originalTask.subTasks.length > 0);
    const subTaskId = originalTask.subTasks[0].id;

    const updatedTasks: SchoolTask[] = payload.tasks.map((st) => {
      const updatedSubs: StaffTask[] = st.subTasks.map((sub) =>
        sub.id === subTaskId ? { ...sub, status: "COMPLETED" as TaskStatus } : sub
      );
      return computeSchoolTaskRollup({ ...st, subTasks: updatedSubs });
    });

    const targetSchoolTask = updatedTasks.find((t) => t.id === originalTask.id);
    assert.ok(targetSchoolTask);
    const targetSub = targetSchoolTask.subTasks.find((s) => s.id === subTaskId);
    assert.equal(targetSub?.status, "COMPLETED");
  });
});
