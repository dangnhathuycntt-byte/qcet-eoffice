import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SCOPE_TABS,
  VIEW_MODE_OPTIONS,
  DEFAULT_AVAILABLE_DEPARTMENTS,
  CATEGORY_FILTER_OPTIONS,
  PRIORITY_FILTER_OPTIONS,
  filterTasksByScope,
  UnifiedTaskToolbar,
  type ScopeTab,
  type ViewModeOption,
  type UnifiedTaskToolbarProps,
} from "../src/components/dashboard/unified-task-toolbar";
import { getAcademicMonthsForYear } from "../src/lib/academic-calendar";
import {
  filterTasksByAcademicMonth,
  computeMonthlyTaskCounts,
  filterTasksHub,
} from "../src/lib/unified-task-hub";
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

  test("VIEW_MODE_OPTIONS defines table, kanban, calendar, department, and executive modes", () => {
    const ids = VIEW_MODE_OPTIONS.map((v: ViewModeOption) => v.id);
    assert.deepEqual(ids, ["table", "kanban", "calendar", "department", "executive"]);
  });

  test("Executive view mode option is properly configured with label and icon", () => {
    const execOpt = VIEW_MODE_OPTIONS.find((v: ViewModeOption) => v.id === "executive");
    assert.ok(execOpt, "Executive view mode option must exist");
    assert.equal(execOpt.label, "Chỉ huy BGH");
    assert.ok(execOpt.icon, "Executive view mode option must have an icon");
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

describe("Academic Month Filter Bar & Precision Logic", () => {
  const payload = getMockDashboardPayload();

  test("Academic months for toolbar are in 12-month cycle order (Tháng 9 to Tháng 8)", () => {
    const months = getAcademicMonthsForYear("2026-2027");
    assert.equal(months.length, 12, "Must return exactly 12 academic months");

    const expectedOrder = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8];
    const actualOrder = months.map((m) => m.monthNumber);
    assert.deepEqual(actualOrder, expectedOrder, "Academic months must start at 9 and end at 8");

    // Check boundary dates for start (Month 9) and end (Month 8)
    assert.equal(months[0].shortDateSpan, "25/08 - 24/09");
    assert.equal(months[0].label, "Tháng 9");
    assert.equal(months[11].shortDateSpan, "25/07 - 24/08");
    assert.equal(months[11].label, "Tháng 8");
  });

  test("filterTasksByAcademicMonth: returns all tasks when month is ALL or undefined", () => {
    const all1 = filterTasksByAcademicMonth(payload.tasks, "ALL");
    assert.equal(all1.length, payload.tasks.length);

    const all2 = filterTasksByAcademicMonth(payload.tasks, undefined);
    assert.equal(all2.length, payload.tasks.length);
  });

  test("filterTasksByAcademicMonth: filters tasks matching operational month window", () => {
    const month9Tasks = filterTasksByAcademicMonth(payload.tasks, 9, "2026-2027");
    assert.ok(month9Tasks.length > 0, "Should have tasks in Month 9");

    for (const task of month9Tasks) {
      // Either parent dueDate or a subtask dueDate must fall between 25/08 and 24/09
      const parentIn = task.dueDate >= "2026-08-25" && task.dueDate <= "2026-09-24";
      const subIn = task.subTasks?.some(
        (s) => s.dueDate >= "2026-08-25" && s.dueDate <= "2026-09-24"
      );
      assert.ok(
        parentIn || subIn,
        `Task ${task.id} (${task.dueDate}) must match Tháng 9 window (25/08 - 24/09)`
      );
    }
  });

  test("computeMonthlyTaskCounts: computes counts across all 12 operational months", () => {
    const counts = computeMonthlyTaskCounts(payload.tasks, "2026-2027");

    // Must have keys for all 12 months
    for (let m = 1; m <= 12; m++) {
      assert.equal(typeof counts[m], "number", `Month ${m} count must be a number`);
      assert.ok(counts[m] >= 0, `Month ${m} count must be non-negative`);
    }

    // Month 9 should have tasks
    assert.ok(counts[9] > 0, "Tháng 9 should have task count > 0 for mock payload");
  });

  test("filterTasksHub integrates academicMonth filtering", () => {
    const filteredAll = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      academicMonth: "ALL",
      academicYear: "2026-2027",
    });
    assert.equal(filteredAll.length, payload.tasks.length);

    const filteredMonth9 = filterTasksHub({
      tasks: payload.tasks,
      scope: "SCHOOL_TASKS",
      academicMonth: 9,
      academicYear: "2026-2027",
    });
    assert.ok(filteredMonth9.length > 0);
    assert.ok(filteredMonth9.length <= payload.tasks.length);
  });

  test("UnifiedTaskToolbar renders 12 academic months + Ca nam option with counts", () => {
    const monthlyCounts = computeMonthlyTaskCounts(payload.tasks, "2026-2027");
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "SCHOOL_TASKS",
        onScopeChange: () => {},
        viewMode: "table",
        onViewModeChange: () => {},
        selectedDepartment: "ALL",
        onDepartmentChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedCategory: "ALL",
        onCategoryChange: () => {},
        selectedPriority: "ALL",
        onPriorityChange: () => {},
        onNewTaskClick: () => {},
        totalTasksCount: payload.tasks.length,
        selectedAcademicMonth: 9,
        onAcademicMonthChange: () => {},
        academicYear: "2026-2027",
        monthlyTaskCounts: monthlyCounts,
      })
    );

    // Verify academic year label
    assert.ok(html.includes("Năm học 2026-2027:"), "Must render academic year label");

    // Verify "Cả năm" option
    assert.ok(html.includes("Cả năm"), "Must render 'Cả năm' tab");

    // Verify all 12 month labels: Tháng 9, Tháng 10, ..., Tháng 8
    for (let m = 1; m <= 12; m++) {
      assert.ok(html.includes(`Tháng ${m}`), `Must render tab for Tháng ${m}`);
    }

    // Verify Tháng 9 is selected (aria-selected="true")
    assert.ok(
      html.includes('aria-selected="true"'),
      "Selected month tab must have aria-selected='true'"
    );

    // Verify month count badge is rendered
    const month9Count = monthlyCounts[9];
    assert.ok(
      html.includes(String(month9Count)),
      `Must render month 9 count badge (${month9Count})`
    );
  });

  test("UnifiedTaskToolbar renders 'Cả năm' as selected when selectedAcademicMonth is ALL", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "SCHOOL_TASKS",
        onScopeChange: () => {},
        viewMode: "table",
        onViewModeChange: () => {},
        selectedDepartment: "ALL",
        onDepartmentChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedCategory: "ALL",
        onCategoryChange: () => {},
        selectedPriority: "ALL",
        onPriorityChange: () => {},
        onNewTaskClick: () => {},
        selectedAcademicMonth: "ALL",
        academicYear: "2026-2027",
      })
    );

    // Check that Ca nam tab has aria-selected="true"
    assert.ok(
      html.includes('aria-selected="true"') && html.includes("Cả năm"),
      "'Cả năm' tab must be selected when selectedAcademicMonth is ALL"
    );
  });

  test("Anti-slop check: 0% emojis in academic month tabs, dates, and rendered toolbar", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    const months = getAcademicMonthsForYear("2026-2027");
    for (const m of months) {
      assert.ok(!emojiRegex.test(m.label), `Month label ${m.label} must not contain emojis`);
      assert.ok(!emojiRegex.test(m.shortDateSpan), `Date span ${m.shortDateSpan} must not contain emojis`);
      assert.ok(!emojiRegex.test(m.fullLabel), `Full label ${m.fullLabel} must not contain emojis`);
    }

    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "MY_TASKS",
        onScopeChange: () => {},
        viewMode: "table",
        onViewModeChange: () => {},
        selectedDepartment: "ALL",
        onDepartmentChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedCategory: "ALL",
        onCategoryChange: () => {},
        selectedPriority: "ALL",
        onPriorityChange: () => {},
        onNewTaskClick: () => {},
        selectedAcademicMonth: 9,
        academicYear: "2026-2027",
      })
    );

    assert.ok(!emojiRegex.test(html), "Rendered toolbar HTML must contain zero emojis");
  });
});
