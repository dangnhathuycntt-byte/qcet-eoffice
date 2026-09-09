import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { filterTasksHub } from "../src/lib/unified-task-hub";
import type { SchoolTask } from "../src/types/dashboard";

const mockTasks: SchoolTask[] = [
  {
    id: "task-1",
    title: "Nhiệm vụ CNTT Đang Làm",
    departmentId: "CNTT",
    leadDepartmentId: "CNTT",
    departmentCode: "CNTT",
    status: "IN_PROGRESS",
    dueDate: "2026-09-15",
    progressPercent: 50,
    totalSubTasks: 0,
    completedSubTasks: 0,
    priority: "HIGH",
    category: "CNTT",
    categoryLabel: "CNTT",
    leadAssigneeName: "Nguyễn Văn A",
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
  },
  {
    id: "task-2",
    title: "Nhiệm vụ Quá Hạn",
    departmentId: "DIEN",
    leadDepartmentId: "DIEN",
    departmentCode: "DIEN",
    status: "IN_PROGRESS",
    dueDate: "2026-09-02",
    progressPercent: 20,
    totalSubTasks: 0,
    completedSubTasks: 0,
    priority: "URGENT",
    category: "CNTT",
    categoryLabel: "CNTT",
    leadAssigneeName: "Trần Văn B",
    coAssignees: [],
    assignedDate: "2026-09-01",
    subTasks: [],
  },
];

test("filterTasksHub filters by department and workbox correctly", () => {
  const cnttTasks = filterTasksHub(mockTasks, {
    scope: "SCHOOL_TASKS",
    department: "CNTT",
    workbox: "ALL",
  });
  assert.equal(cnttTasks.length, 1);
  assert.equal(cnttTasks[0].id, "task-1");

  const overdueTasks = filterTasksHub(mockTasks, {
    scope: "SCHOOL_TASKS",
    department: "ALL",
    workbox: "URGENT_OVERDUE",
  });
  assert.equal(overdueTasks.length, 1);
  assert.equal(overdueTasks[0].id, "task-2");
});

test("DashboardZone source eliminates filterDashboardReactiveTasks and consumes filteredTasks", () => {
  const zonePath = path.join(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );
  const content = fs.readFileSync(zonePath, "utf-8");
  assert.equal(
    content.includes("filterDashboardReactiveTasks"),
    false,
    "DashboardZone must not declare or use divergent filterDashboardReactiveTasks"
  );
  assert.ok(
    content.includes("filteredTasks"),
    "DashboardZone must consume filteredTasks from useDashboardData"
  );
});
