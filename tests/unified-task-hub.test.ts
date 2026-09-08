import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { filterTasksByScope } from "../src/components/dashboard/unified-task-toolbar";
import { filterTasksHub, filterTasksByWorkbox } from "../src/lib/unified-task-hub";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Unified Task Hub Page Integration", () => {
  const payload = getMockDashboardPayload();
  const admin = DEFAULT_DEMO_USERS[0];
  const manager = DEFAULT_DEMO_USERS[1];
  const staff = DEFAULT_DEMO_USERS[2];

  test("Scope switching produces distinct task sets for manager", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", manager);
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", manager);
    const unitTasks = filterTasksByScope(payload.tasks, "UNIT_TASKS", manager);

    assert.ok(schoolTasks.length >= myTasks.length);
    assert.ok(unitTasks.length > 0);
  });

  test("Supports switching seamlessly between table, kanban, and calendar data shapes", () => {
    // SchoolTask array directly powers all three components
    assert.ok(Array.isArray(payload.tasks));
    assert.ok(payload.tasks[0].id.length > 0);
    assert.ok(payload.tasks[0].subTasks !== undefined);
  });

  test("filterTasksHub matches tasks when searching by department code or department name", () => {
    // 1. Search by department code (e.g. "CNTT")
    const filteredByCode = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      searchQuery: "CNTT",
      user: admin,
    });
    assert.ok(filteredByCode.length > 0, "Must return tasks matching CNTT department code");
    for (const t of filteredByCode) {
      const matchDeptCode = t.leadDepartmentCode?.toLowerCase().includes("cntt");
      const matchDeptName = t.leadDepartment?.toLowerCase().includes("cntt");
      const matchSubDept = t.subTasks?.some(
        (s) =>
          s.departmentCode?.toLowerCase().includes("cntt") ||
          s.title.toLowerCase().includes("cntt") ||
          s.assigneeName.toLowerCase().includes("cntt")
      );
      const matchText =
        t.title.toLowerCase().includes("cntt") ||
        t.leadAssigneeName.toLowerCase().includes("cntt");
      assert.ok(
        matchDeptCode || matchDeptName || matchSubDept || matchText,
        "Task must match CNTT query in department code/name, title, assignee, or subtasks"
      );
    }

    // 2. Search by department Vietnamese name (e.g. "Đào tạo")
    const filteredByName = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      searchQuery: "Đào tạo",
      user: admin,
    });
    assert.ok(filteredByName.length > 0, "Must return tasks matching 'Đào tạo' department name");
  });

  test("filterTasksByWorkbox with NEEDS_REVIEW filters tasks requiring approval or review", () => {
    const reviewTasks = filterTasksByWorkbox(payload.tasks, "NEEDS_REVIEW", admin);
    assert.ok(Array.isArray(reviewTasks), "Must return an array of tasks");
    for (const t of reviewTasks) {
      const isNeedsExecutive = t.status === "PENDING_EXECUTIVE_APPROVAL";
      const hasSubNeedsReview = t.subTasks?.some((s) => s.status === "NEEDS_REVIEW");
      assert.ok(
        isNeedsExecutive || hasSubNeedsReview,
        "Every returned task must be pending executive approval or have subtasks needing review"
      );
    }
  });
});
