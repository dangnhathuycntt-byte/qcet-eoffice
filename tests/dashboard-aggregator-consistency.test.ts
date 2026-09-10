import test from "node:test";
import assert from "node:assert/strict";
import { computeDashboardStats, computeSchoolTaskRollup } from "../src/lib/dashboard-aggregator";
import type { SchoolTask } from "../src/types/dashboard";

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
