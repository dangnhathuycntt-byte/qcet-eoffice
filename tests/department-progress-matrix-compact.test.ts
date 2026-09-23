import { test } from "node:test";
import assert from "node:assert/strict";
import type { DepartmentHealthSummary } from "../src/lib/executive-matrix-aggregator";
import { sortDepartmentsByOverdue } from "../src/components/dashboard/department-progress-matrix";

test("sorts departments by overdue count descending", () => {
  const depts: DepartmentHealthSummary[] = [
    {
      departmentId: "dept-cntt",
      code: "CNTT",
      departmentName: "Khoa CNTT",
      leadName: "Nguyễn A",
      totalTasksCount: 10,
      completedTasksCount: 8,
      inProgressTasksCount: 2,
      overdueTasksCount: 0,
      blockedTasksCount: 0,
      averageProgressPercent: 80,
      totalTasks: 10,
      completedTasks: 8,
      inProgressTasks: 2,
      overdueTasks: 0,
      completionRate: 80,
      status: "good",
    },
    {
      departmentId: "dept-dien",
      code: "DIEN",
      departmentName: "Khoa Điện",
      leadName: "Trần B",
      totalTasksCount: 10,
      completedTasksCount: 5,
      inProgressTasksCount: 5,
      overdueTasksCount: 3,
      blockedTasksCount: 0,
      averageProgressPercent: 50,
      totalTasks: 10,
      completedTasks: 5,
      inProgressTasks: 5,
      overdueTasks: 3,
      completionRate: 50,
      status: "critical",
    },
  ];

  // Raw inline sort assertion from plan brief
  const sortedRaw = [...depts].sort(
    (a, b) => (b.overdueTasks ?? b.overdueTasksCount) - (a.overdueTasks ?? a.overdueTasksCount)
  );
  assert.equal(sortedRaw[0].code, "DIEN", "Department with highest overdue must be first");
  assert.equal(sortedRaw[1].code, "CNTT");

  // Component export sort helper assertion
  const sortedHelper = sortDepartmentsByOverdue(depts);
  assert.equal(sortedHelper[0].code, "DIEN", "Department with highest overdue must be first via helper");
  assert.equal(sortedHelper[1].code, "CNTT");
});
