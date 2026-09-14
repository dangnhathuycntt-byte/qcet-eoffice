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
  scopeToWorkspaceScope,
  workspaceScopeToTaskScope,
  workspaceScopeToUrlParam,
  urlParamToWorkspaceScope,
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


/* ===== merged from tests/unified-task-hub.test.ts ===== */







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


/* ===== merged from tests/scope-unification.test.ts ===== */




test("scopeToWorkspaceScope transforms correctly", () => {
  assert.equal(scopeToWorkspaceScope("SCHOOL_TASKS"), "school");
  assert.equal(scopeToWorkspaceScope("UNIT_TASKS"), "unit");
  assert.equal(scopeToWorkspaceScope("MY_TASKS"), "my");
});

test("workspaceScopeToTaskScope transforms correctly", () => {
  assert.equal(workspaceScopeToTaskScope("school"), "SCHOOL_TASKS");
  assert.equal(workspaceScopeToTaskScope("unit"), "UNIT_TASKS");
  assert.equal(workspaceScopeToTaskScope("my"), "MY_TASKS");
});

test("workspaceScopeToUrlParam transforms correctly", () => {
  assert.equal(workspaceScopeToUrlParam("school"), "all");
  assert.equal(workspaceScopeToUrlParam("unit"), "unit");
  assert.equal(workspaceScopeToUrlParam("my"), "personal");
});

test("urlParamToWorkspaceScope parses bidirectional URL parameters", () => {
  assert.equal(urlParamToWorkspaceScope("all"), "school");
  assert.equal(urlParamToWorkspaceScope("school"), "school");
  assert.equal(urlParamToWorkspaceScope("unit"), "unit");
  assert.equal(urlParamToWorkspaceScope("my"), "my");
  assert.equal(urlParamToWorkspaceScope("personal"), "my");
  assert.equal(urlParamToWorkspaceScope(null, "school"), "school");
  assert.equal(urlParamToWorkspaceScope(undefined, "unit"), "unit");
  assert.equal(urlParamToWorkspaceScope("unknown", "my"), "my");
});
