import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  computeSchoolTaskRollup,
  computeDashboardStats,
  filterSchoolTasks,
} from "../src/lib/dashboard-aggregator";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

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
});
