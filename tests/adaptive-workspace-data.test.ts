import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  deriveAdaptiveWorkspaceData,
  type WorkspaceScope,
} from "../src/components/workspace/hooks/use-adaptive-workspace-data";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Adaptive Workspace Data Derivation", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0]; // role: ADMIN
  const managerUser = DEFAULT_DEMO_USERS[1]; // role: MANAGER, dept: K_CNTT
  const staffUser = DEFAULT_DEMO_USERS[2]; // role: STAFF, dept: K_CNTT

  test("derives metrics and task list for school scope (ADMIN)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: adminUser,
      scope: "school",
    });

    assert.equal(data.activeScope, "school");
    assert.equal(data.scopedTasks.length, tasks.length);
    assert.ok(data.metrics.totalTasks >= 0);
    assert.ok(typeof data.metrics.completedRate === "number");
    assert.equal(data.metrics.labelScope, "Toàn trường");
  });

  test("derives metrics and task list for unit scope (MANAGER)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: managerUser,
      scope: "unit",
      selectedDepartment: "K_CNTT",
    });

    assert.equal(data.activeScope, "unit");
    // All scoped tasks must relate to K_CNTT
    data.scopedTasks.forEach((task) => {
      const isDeptRelated =
        task.departmentCode === "K_CNTT" ||
        task.department === "Khoa CNTT" ||
        task.subTasks?.some((st) => st.departmentCode === "K_CNTT" || st.department === "Khoa CNTT");
      assert.ok(isDeptRelated);
    });
  });

  test("filters unit tasks when matching departmentCode is present", () => {
    const customTasks = [
      ...tasks.slice(0, 5),
      {
        ...tasks[0],
        id: "task-kcntt-test",
        departmentCode: "K_CNTT",
      },
    ];
    const data = deriveAdaptiveWorkspaceData({
      tasks: customTasks,
      user: managerUser,
      scope: "unit",
      selectedDepartment: "K_CNTT",
    });
    assert.ok(data.scopedTasks.some((t) => t.id === "task-kcntt-test"));
  });

  test("derives metrics and actionable queue for my scope (STAFF)", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks,
      user: staffUser,
      scope: "my",
    });

    assert.equal(data.activeScope, "my");
    assert.ok(data.actionQueue.myPendingSubmissions !== undefined);
  });

  test("safely handles null user and empty tasks", () => {
    const data = deriveAdaptiveWorkspaceData({
      tasks: [],
      user: null,
      scope: "my",
    });

    assert.equal(data.scopedTasks.length, 0);
    assert.equal(data.metrics.totalTasks, 0);
    assert.equal(data.metrics.completedRate, 0);
  });
});
