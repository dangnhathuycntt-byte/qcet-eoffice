import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getActiveFilterSummary } from "../src/components/workspace/components/active-filter-breadcrumb";
import {
  filterTasksHub,
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
} from "../src/lib/unified-task-hub";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import type { SchoolTask } from "../src/types/dashboard";

const mockTasks: SchoolTask[] = [
  {
    id: "task-1",
    title: "Nhiệm vụ CNTT Đang Làm",

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

describe("Dashboard Zone Filters & Scope Helpers", () => {
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

  test("filterTasksHub isolates department and scope for a unit-scoped user", () => {
    const payload = getMockDashboardPayload();
    const managerUser = DEFAULT_DEMO_USERS[1];

    const unitTasks = filterTasksHub({
      tasks: payload.tasks,
      scope: "UNIT_TASKS",
      workboxFilter: "ALL",
      category: "ALL",
      priority: "ALL",
      department: "K_CNTT",
      searchQuery: "",
      user: managerUser,
      academicMonth: "ALL",
      academicYear: "2026-2027",
    });

    assert.ok(Array.isArray(unitTasks));
    assert.ok(unitTasks.length > 0);
  });

  test("URL parameter mapping handles edge cases cleanly", () => {
    assert.equal(parseScopeParam(null, "UNIT_TASKS"), "UNIT_TASKS");
    assert.equal(parseScopeParam("my", "SCHOOL_TASKS"), "MY_TASKS");
    assert.equal(scopeToParam("MY_TASKS"), "my");
    assert.equal(parseViewModeParam(null, "table"), "table");
    assert.equal(parseViewModeParam("kanban", "table"), "kanban");
  });
});

describe("Dashboard Zone & Split-Cockpit Filter Helper", () => {
  test("computes active filter summary correctly", () => {
    const filters = getActiveFilterSummary({
      dept: "CNTT",
      workbox: "URGENT_OVERDUE",
      search: "nghiệm thu",
    });
    assert.equal(filters.length, 3);
    assert.equal(filters[0], "Đơn vị: CNTT");
    assert.equal(filters[1], "Hộp việc: URGENT_OVERDUE");
    assert.equal(filters[2], 'Từ khóa: "nghiệm thu"');
  });

  test("computes empty array when all filters are default", () => {
    const filters = getActiveFilterSummary({
      dept: "ALL",
      workbox: "ALL",
      search: "",
    });
    assert.equal(filters.length, 0);
  });
});
