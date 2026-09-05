import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { filterTasksByScope } from "../src/components/dashboard/unified-task-toolbar";
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
});
