import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  filterTasksByRole,
  DEFAULT_DEMO_USERS,
} from "../src/lib/role-task-filter";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";

describe("Role Pages Filtering Integration", () => {
  test("switching roles dynamically recomputes stats and task count", () => {
    const payload = getMockDashboardPayload();
    const adminTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[0]);
    const staffTasks = filterTasksByRole(payload.tasks, DEFAULT_DEMO_USERS[2]);

    assert.ok(adminTasks.length > staffTasks.length);
  });
});
