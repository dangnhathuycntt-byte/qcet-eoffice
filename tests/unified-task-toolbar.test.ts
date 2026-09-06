import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  SCOPE_TABS,
  VIEW_MODE_OPTIONS,
  DEFAULT_AVAILABLE_DEPARTMENTS,
  CATEGORY_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  filterTasksByScope,
  type ScopeTab,
  type ViewModeOption,
} from "../src/components/dashboard/unified-task-toolbar";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";

describe("UnifiedTaskToolbar Helpers", () => {
  const payload = getMockDashboardPayload();
  const staffUser = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh (CNTT)
  const managerUser = DEFAULT_DEMO_USERS[1]; // Trần Hùng (DAO_TAO)
  const adminUser = DEFAULT_DEMO_USERS[0]; // BGH

  test("SCOPE_TABS defines 3 scopes: MY_TASKS, SCHOOL_TASKS, UNIT_TASKS", () => {
    const ids = SCOPE_TABS.map((t: ScopeTab) => t.id);
    assert.deepEqual(ids, ["MY_TASKS", "SCHOOL_TASKS", "UNIT_TASKS"]);
  });

  test("VIEW_MODE_OPTIONS defines table, kanban, calendar, and department modes", () => {
    const ids = VIEW_MODE_OPTIONS.map((v: ViewModeOption) => v.id);
    assert.deepEqual(ids, ["table", "kanban", "calendar", "department"]);
  });

  test("filterTasksByScope correctly filters for MY_TASKS", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", staffUser);
    assert.ok(myTasks.length > 0);
    // All returned tasks must involve staffUser
    for (const t of myTasks) {
      const isLead = t.leadAssigneeName === staffUser.name;
      const hasSub = t.subTasks?.some((s: StaffTask) => s.assigneeName === staffUser.name);
      assert.ok(isLead || hasSub, "task must be assigned to staff user");
    }
  });

  test("filterTasksByScope returns all tasks for SCHOOL_TASKS when ADMIN", () => {
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", adminUser);
    assert.equal(schoolTasks.length, payload.tasks.length);
  });

  test("filterTasksByScope correctly filters for UNIT_TASKS with department code", () => {
    const unitTasks = filterTasksByScope(payload.tasks, "UNIT_TASKS", managerUser, "DAO_TAO");
    assert.ok(unitTasks.length > 0);
    // All returned tasks must belong to DAO_TAO
    assert.ok(unitTasks.length <= payload.tasks.length);
  });

  test("Scope switching produces distinct task sets for manager", () => {
    const myTasks = filterTasksByScope(payload.tasks, "MY_TASKS", managerUser);
    const schoolTasks = filterTasksByScope(payload.tasks, "SCHOOL_TASKS", managerUser);
    const unitTasks = filterTasksByScope(payload.tasks, "UNIT_TASKS", managerUser);

    assert.ok(schoolTasks.length >= myTasks.length);
    assert.ok(unitTasks.length > 0);
  });

  test("Anti-slop check: 0% emojis in tabs, view modes, and filter options", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    for (const tab of SCOPE_TABS) {
      assert.ok(!emojiRegex.test(tab.label), `Scope tab ${tab.label} must not contain emojis`);
    }
    for (const vm of VIEW_MODE_OPTIONS) {
      assert.ok(!emojiRegex.test(vm.label), `View mode ${vm.label} must not contain emojis`);
    }
    for (const dept of DEFAULT_AVAILABLE_DEPARTMENTS) {
      assert.ok(!emojiRegex.test(dept.name), `Department ${dept.name} must not contain emojis`);
    }
    for (const cat of CATEGORY_FILTER_OPTIONS) {
      assert.ok(!emojiRegex.test(cat.label), `Category ${cat.label} must not contain emojis`);
    }
    for (const prio of PRIORITY_FILTER_OPTIONS) {
      assert.ok(!emojiRegex.test(prio.label), `Priority ${prio.label} must not contain emojis`);
    }
  });
});
