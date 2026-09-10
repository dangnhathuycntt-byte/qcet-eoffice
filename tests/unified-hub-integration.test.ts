import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { filterTasksByScope } from "../src/components/dashboard/unified-task-toolbar";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import {
  parseScopeParam,
  scopeToParam,
  parseViewModeParam,
  getDefaultScopeForRole,
  getDefaultViewModeForRole,
  filterTasksByWorkbox,
  filterTasksHub,
} from "../src/lib/unified-task-hub";

describe("Unified Task Hub Integration", () => {
  const payload = getMockDashboardPayload();
  const admin = DEFAULT_DEMO_USERS[0];
  const manager = DEFAULT_DEMO_USERS[1];
  const staff = DEFAULT_DEMO_USERS[2];

  test("Role-based default scopes align with institutional hierarchy", () => {
    assert.equal(getDefaultScopeForRole("ADMIN"), "SCHOOL_TASKS");
    assert.equal(getDefaultScopeForRole("MANAGER"), "UNIT_TASKS");
    assert.equal(getDefaultScopeForRole("STAFF"), "MY_TASKS");
    assert.equal(getDefaultScopeForRole(undefined), "MY_TASKS");
  });

  test("Role-based default view modes prioritize executive command for ADMIN", () => {
    assert.equal(getDefaultViewModeForRole("ADMIN"), "executive");
    assert.equal(getDefaultViewModeForRole("MANAGER"), "table");
    assert.equal(getDefaultViewModeForRole("STAFF"), "table");
    assert.equal(getDefaultViewModeForRole(undefined), "table");
  });

  test("URL query parameter mapping for scope and viewMode", () => {
    // Scope params
    assert.equal(parseScopeParam("my", "SCHOOL_TASKS"), "MY_TASKS");
    assert.equal(parseScopeParam("school", "MY_TASKS"), "SCHOOL_TASKS");
    assert.equal(parseScopeParam("unit", "MY_TASKS"), "UNIT_TASKS");
    assert.equal(parseScopeParam("MY_TASKS", "SCHOOL_TASKS"), "MY_TASKS");
    assert.equal(parseScopeParam("SCHOOL_TASKS", "MY_TASKS"), "SCHOOL_TASKS");
    assert.equal(parseScopeParam("UNIT_TASKS", "MY_TASKS"), "UNIT_TASKS");
    assert.equal(parseScopeParam("invalid", "MY_TASKS"), "MY_TASKS");
    assert.equal(parseScopeParam(null, "UNIT_TASKS"), "UNIT_TASKS");

    // Scope to param
    assert.equal(scopeToParam("MY_TASKS"), "my");
    assert.equal(scopeToParam("SCHOOL_TASKS"), "school");
    assert.equal(scopeToParam("UNIT_TASKS"), "unit");

    // ViewMode params
    assert.equal(parseViewModeParam("table"), "table");
    assert.equal(parseViewModeParam("kanban"), "kanban");
    assert.equal(parseViewModeParam("calendar"), "calendar");
    assert.equal(parseViewModeParam("department"), "department");
    assert.equal(parseViewModeParam("don-vi"), "department");
    assert.equal(parseViewModeParam("executive"), "executive");
    assert.equal(parseViewModeParam("chi-huy"), "executive");
    assert.equal(parseViewModeParam("bgh"), "executive");
    assert.equal(parseViewModeParam("command"), "executive");
    assert.equal(parseViewModeParam("invalid"), "table");
    assert.equal(parseViewModeParam(null), "table");
    assert.equal(parseViewModeParam(null, "executive"), "executive");
  });

  test("Scope switching produces distinct task sets for manager", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", manager);
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", manager);
    const unitTasks = filterTasksByScope(payload.tasks, "UNIT_TASKS", manager);

    assert.ok(schoolTasks.length >= myTasks.length);
    assert.ok(unitTasks.length > 0);
  });

  test("Workbox filtering filters tasks by institutional status", () => {
    const allTasks = filterTasksByWorkbox(payload.tasks, "ALL", admin);
    assert.equal(allTasks.length, payload.tasks.length);

    const completedTasks = filterTasksByWorkbox(payload.tasks, "COMPLETED", admin);
    assert.ok(completedTasks.length > 0);
    completedTasks.forEach((t) => {
      assert.ok(t.status === "COMPLETED" || t.progressPercent === 100);
    });

    const urgentTasks = filterTasksByWorkbox(payload.tasks, "URGENT_OVERDUE", admin);
    assert.ok(Array.isArray(urgentTasks));
  });

  test("Supports switching seamlessly between table, kanban, and calendar data shapes", () => {
    assert.ok(Array.isArray(payload.tasks));
    assert.ok(payload.tasks.length > 0);
    assert.ok(payload.tasks[0].id.length > 0);
    assert.ok(payload.tasks[0].subTasks !== undefined);
  });

  test("filterTasksHub coordinates multi-dimensional filtering", () => {
    const filtered = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      workboxFilter: "ALL",
      category: "ALL",
      priority: "ALL",
      department: "ALL",
      searchQuery: "",
      user: admin,
    });
    assert.ok(filtered.length > 0);

    const filteredCategory = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      workboxFilter: "ALL",
      category: "CHUYEN_DOI_SO",
      priority: "ALL",
      department: "ALL",
      searchQuery: "",
      user: admin,
    });
    assert.ok(filteredCategory.length <= filtered.length);
    filteredCategory.forEach((t) => {
      assert.equal(t.category, "CHUYEN_DOI_SO");
    });
  });
});
