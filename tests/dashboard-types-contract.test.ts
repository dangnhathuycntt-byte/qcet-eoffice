import test from "node:test";
import assert from "node:assert/strict";
import type { TaskStatus, SchoolTask, DashboardStats } from "../src/types/dashboard";

test("TaskStatus supports full Prisma and UI states", () => {
  const statuses: TaskStatus[] = [
    "NOT_STARTED",
    "IN_PROGRESS",
    "WAITING_APPROVAL",
    "PENDING_EXECUTIVE_APPROVAL",
    "NEEDS_REVIEW",
    "BLOCKED",
    "COMPLETED",
    "OVERDUE",
    "CANCELLED",
  ];
  assert.equal(statuses.length, 9);
});

test("DashboardStats contract includes granular breakdown fields", () => {
  const stats: DashboardStats = {
    totalSchoolTasks: 130,
    schoolTasksInProgress: 85,
    schoolTasksCompleted: 11,
    schoolTasksNotStarted: 30,
    schoolTasksWaitingApproval: 3,
    schoolTasksOverdue: 1,
    totalStaffTasks: 0,
    staffTasksInProgress: 0,
    staffTasksCompleted: 0,
    staffTasksNotStarted: 0,
    staffTasksWaitingApproval: 0,
    staffTasksOverdue: 0,
    needsReviewTasksCount: 3,
    overdueTasksCount: 1,
    averageSchoolProgressPercent: 44,
    completionRate: 8,
    totalTasks: 130,
    inProgressTasks: 85,
    completedTasks: 11,
    overdueTasks: 1,
    pendingApprovals: 3,
  };
  assert.equal(stats.totalSchoolTasks, 130);
  assert.equal(
    stats.schoolTasksInProgress +
      stats.schoolTasksNotStarted! +
      stats.schoolTasksWaitingApproval! +
      stats.schoolTasksOverdue! +
      stats.schoolTasksCompleted,
    130
  );
});

test("SchoolTask accepts unified TaskStatus and optional fields", () => {
  const schoolTask: SchoolTask = {
    id: "task-test-1",
    title: "Nhiệm vụ kiểm thử",
    category: "CHUYEN_DOI_SO",
    categoryLabel: "Chuyển đổi số",
    leadAssigneeName: "Trần Văn A",
    coAssignees: [],
    assignedDate: "2026-09-01",
    dueDate: "2026-09-30",
    status: "NOT_STARTED",
    subTasks: [],
    totalSubTasks: 0,
    completedSubTasks: 0,
    progressPercent: 0,
    priority: "URGENT",
    academicMonth: 9,
    academicYear: "2026-2027",
    description: "Mô tả nhiệm vụ",
  };
  assert.equal(schoolTask.status, "NOT_STARTED");
  assert.equal(schoolTask.priority, "URGENT");
});
