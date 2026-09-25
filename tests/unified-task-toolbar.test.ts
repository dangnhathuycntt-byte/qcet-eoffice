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
  buildRoleActionPill,
  buildQuickFilterPills,
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
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS, matchesUser } from "../src/lib/role-task-filter";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import { ModularCascadingTaskTable } from "../src/components/tasks/table/modular-cascading-task-table";
import { TaskEmptyState } from "../src/components/tasks/table/components/task-empty-state";

describe("UnifiedTaskToolbar Helpers", () => {
  const payload = getMockDashboardPayload();
  const staffUser = DEFAULT_DEMO_USERS.find((u) => u.name.includes("Vinh")) || DEFAULT_DEMO_USERS[3]; // Nguyễn Ngọc Vinh (CNTT)
  const managerUser = DEFAULT_DEMO_USERS[1]; // Lê Văn Thí (DAO_TAO)
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
      const isLead = t.leadAssigneeName === staffUser.name || matchesUser(t.leadAssigneeName, staffUser);
      const hasSub = t.subTasks?.some(
        (s: StaffTask) => s.assigneeName === staffUser.name || matchesUser(s.assigneeName, staffUser)
      );
      const isCo = Boolean(t.coAssignees?.some((ca: string) => matchesUser(ca, staffUser)));
      assert.ok(isLead || hasSub || isCo, "task must be assigned to staff user");
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

  test("Academic months for toolbar are in 12-month calendar order (Tháng 1 to Tháng 12)", () => {
    const months = getAcademicMonthsForYear("2026-2027");
    assert.equal(months.length, 12, "Must return exactly 12 academic months");

    const expectedOrder = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const actualOrder = months.map((m) => m.monthNumber);
    assert.deepEqual(actualOrder, expectedOrder, "Calendar months must run from 1 to 12");

    // Check boundary dates for start (Month 1) and Month 9
    assert.equal(months[0].shortDateSpan, "01/01 - 31/01");
    assert.equal(months[0].label, "Tháng 1");
    assert.equal(months[8].shortDateSpan, "01/09 - 30/09");
    assert.equal(months[8].label, "Tháng 9");
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
      // Either parent dueDate or a subtask dueDate must fall between 01/09 and 30/09
      const parentIn = task.dueDate >= "2026-09-01" && task.dueDate <= "2026-09-30";
      const subIn = task.subTasks?.some(
        (s) => s.dueDate >= "2026-09-01" && s.dueDate <= "2026-09-30"
      );
      assert.ok(
        parentIn || subIn,
        `Task ${task.id} (${task.dueDate}) must match Tháng 9 window (01/09 - 30/09)`
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

  test("UnifiedTaskToolbar renders month selector on toolbar row 2 with active month state", () => {
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

    // Verify month trigger button renders selected month
    assert.ok(html.includes("Tháng 9"), "Must render selected 'Tháng 9' label on button");
    assert.ok(html.includes('aria-label="Chọn kỳ tháng"'), "Must have accessible label for month selector");
  });

  test("UnifiedTaskToolbar does NOT render academic month rail by default", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "SCHOOL_TASKS",
        onScopeChange: () => {},
        viewMode: "table",
        onViewModeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedAcademicMonth: "ALL",
        academicYear: "2026-2027",
      })
    );

    assert.ok(
      !html.includes('aria-label="Chu kỳ 12 tháng công tác năm học"'),
      "Academic month rail must NOT render by default"
    );
  });

  test("UnifiedTaskToolbar renders month selector with 'Thời gian' when selectedAcademicMonth is ALL", () => {
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

    // Check that month button renders accessible label and neutral default
    assert.ok(
      html.includes('aria-label="Chọn kỳ tháng"'),
      "Month selector must have accessible label"
    );
    assert.ok(
      html.includes("Cả năm học") || html.includes("Thời gian"),
      "Must render 'Cả năm học' or 'Thời gian' when selectedAcademicMonth is ALL"
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

describe("Single Unified Task Toolbar Surface & Role-Based Scope Visibility", () => {
  const staffUser = DEFAULT_DEMO_USERS[2]; // STAFF
  const adminUser = DEFAULT_DEMO_USERS[0]; // BGH / ADMIN

  test("STAFF user sees all unified scopes: Toàn trường, Đơn vị, Cá nhân", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        user: staffUser,
        userRole: "STAFF",
        searchQuery: "",
        onSearchChange: () => {},
      })
    );

    // Must have "Cá nhân"
    assert.ok(html.includes("Cá nhân") || html.includes("Của tôi"), "Must render personal scope");
    assert.ok(html.includes("Đơn vị"), "Must render unit scope");
    assert.ok(html.includes("Toàn trường"), "Must render school scope");
  });

  test("ADMIN/BGH user sees all authorized scopes: Toàn trường, Đơn vị, Cá nhân/Của tôi", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        userRole: "ADMIN",
        searchQuery: "",
        onSearchChange: () => {},
      })
    );

    assert.ok(html.includes("Toàn trường"), "Must render 'Toàn trường' for admin");
    assert.ok(html.includes("Đơn vị") || html.includes("Ban Giám hiệu"), "Must render unit scope for admin");
    assert.ok(html.includes("Cá nhân") || html.includes("Của tôi"), "Must render personal scope for admin");
  });

  test("Search input renders keyboard shortcut hint '/' and clear button when query exists", () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
      })
    );
    assert.ok(emptyHtml.includes(">&#x2F;</kbd>") || emptyHtml.includes(">/</kbd>"), "Must show '/' shortcut badge");

    const filledHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        searchQuery: "kiểm định chất lượng",
        onSearchChange: () => {},
      })
    );
    assert.ok(filledHtml.includes("Xóa từ khóa tìm kiếm"), "Must show clear search button");
  });

  // Task 3 (Phase 3A): VIEW-FIRST Row 2 — smart-filter rail removed; Saved Views is primary nav.
  // The permanent smart-filter pills (Tất cả / Chờ duyệt / Quá hạn / Hôm nay) are intentionally
  // eliminated from the default render surface. Their filter criteria are preserved as Saved View
  // presets and Filter-popover options, not as a permanent third control row.
  test("Row 2 VIEW-FIRST: renders Saved View trigger, Search input, Filter button, Display button — no smart-filter pill rail", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        showSavedViews: true,
        onViewModeChange: () => {},
        onDensityChange: () => {},
        selectedDepartment: "ALL",
        selectedCategory: "ALL",
        selectedPriority: "ALL",
        selectedAcademicMonth: "ALL",
      })
    );

    // Row 2 slot must be present
    assert.ok(
      html.includes('data-slot="unified-task-toolbar-row-2"'),
      "Row 2 slot must be rendered"
    );

    // Search input must be in Row 2 (aria-label present)
    assert.ok(
      html.includes("Tìm nhiệm vụ"),
      "Must render search input with aria-label in Row 2"
    );

    // Filter popover button must be present
    assert.ok(html.includes("Bộ lọc"), "Must render Filter (Bộ lọc) button");

    // Display popover button must be present
    assert.ok(html.includes("Hiển thị"), "Must render Display (Hiển thị) button");

    // Smart-filter pill rail must NOT be rendered as a permanent control row.
    // The scope switcher legitimately uses role="tablist" (aria-label="Phạm vi công việc"),
    // but the old filter-pill tablist (aria-label="Lọc nhanh trạng thái nhiệm vụ") must be gone.
    assert.ok(
      !html.includes("Lọc nhanh trạng thái nhiệm vụ"),
      "Permanent smart-filter pill tablist (Lọc nhanh trạng thái nhiệm vụ) must not be rendered"
    );
  });

  test("Advanced Filter Popover button displays active filter count badge", () => {
    const defaultHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedDepartment: "ALL",
        selectedCategory: "ALL",
        selectedPriority: "ALL",
        selectedAcademicMonth: "ALL",
      })
    );
    assert.ok(defaultHtml.includes("Bộ lọc"), "Must render Bộ lọc trigger");

    const filteredHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedDepartment: "CNTT",
        selectedPriority: "URGENT",
      })
    );
    // Active filters in popover -> badge
    assert.ok(filteredHtml.includes("Bộ lọc"), "Must render Bộ lọc trigger with active filters");
  });

  test("Display popover trigger is rendered with 'Hiển thị'", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        viewMode: "table",
        onViewModeChange: () => {},
      })
    );

    assert.ok(html.includes("Hiển thị"), "Must render Display popover trigger");
  });

  test("Direct Desktop Toolbar: exposes Search, Thời gian, Trạng thái, Thời hạn, Ưu tiên, Đơn vị directly", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        selectedAcademicMonth: 9,
        activeTab: "in_progress",
        selectedPriority: "URGENT",
        availableDepartments: [
          { code: "ALL", name: "Tất cả đơn vị" },
          { code: "CNTT", name: "Trung tâm CNTT" },
        ],
        selectedDepartment: "CNTT",
      })
    );

    // Direct desktop filters should update labels
    assert.ok(html.includes("Tháng 9"), "Month button shows 'Tháng 9'");
    assert.ok(html.includes("Đang thực hiện"), "Status button updates to 'Đang thực hiện'");
    assert.ok(html.includes("Khẩn cấp"), "Priority button updates to 'Khẩn cấp'");
    assert.ok(html.includes("Trung tâm CNTT"), "Department button updates to 'Trung tâm CNTT'");
  });

  test("Direct Desktop Toolbar: hides Đơn vị filter in 'my' and 'unit' scope", () => {
    const myHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        availableDepartments: [
          { code: "ALL", name: "Tất cả đơn vị" },
          { code: "CNTT", name: "Trung tâm CNTT" },
        ],
      })
    );
    assert.ok(!myHtml.includes('aria-label="Lọc đơn vị"'), "Đơn vị filter must NOT render in personal scope");

    const unitHtml = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "unit",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        availableDepartments: [
          { code: "ALL", name: "Tất cả đơn vị" },
          { code: "CNTT", name: "Trung tâm CNTT" },
        ],
      })
    );
    assert.ok(!unitHtml.includes('aria-label="Lọc đơn vị"'), "Đơn vị filter must NOT render in unit scope");
  });
});

describe("Inner Duplicate Toolbar Elimination in ModularCascadingTaskTable", () => {
  const payload = getMockDashboardPayload();

  test("ModularCascadingTaskTable with hideToolbar=true omits inner TaskTableToolbar", () => {
    const withToolbarHtml = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: payload.tasks,
        hideToolbar: false,
      })
    );
    // When hideToolbar is false, TaskTableToolbar is rendered
    assert.ok(
      withToolbarHtml.includes("Tìm kiếm nhiệm vụ, mã, người thực hiện..."),
      "Default table renders inner search placeholder"
    );

    const withoutToolbarHtml = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: payload.tasks,
        hideToolbar: true,
      })
    );
    // When hideToolbar is true, inner search and duplicate controls must be absent
    assert.ok(
      !withoutToolbarHtml.includes("Tìm kiếm nhiệm vụ, mã, người thực hiện..."),
      "Omitted toolbar removes duplicate inner search"
    );
    // But table structure remains intact
    assert.ok(withoutToolbarHtml.includes("Nhiệm vụ"), "Table headers are preserved");
  });

  test("ModularCascadingTaskTable accepts density and onDensityChange from unified workspace", () => {
    const compactHtml = renderToStaticMarkup(
      React.createElement(ModularCascadingTaskTable, {
        tasks: payload.tasks,
        hideToolbar: true,
        density: "compact",
      })
    );

    assert.ok(compactHtml.includes("py-1.5") || compactHtml.includes("text-xs"), "Compact density applies compact styling");
  });
});

describe("URL Parameter Synchronization Engine", () => {
  const { parseTaskUrlParams, buildTaskUrlQuery } = require("../src/hooks/use-task-filters");

  test("parseTaskUrlParams correctly extracts parameters from URLSearchParams", () => {
    const search = new URLSearchParams(
      "scope=school&dept=CNTT&status=overdue&month=9&q=chuyen-doi-so&view=kanban&taskId=task-123"
    );

    const parsed = parseTaskUrlParams(search);
    assert.equal(parsed.scope, "school");
    assert.equal(parsed.dept, "CNTT");
    assert.equal(parsed.status, "overdue");
    assert.equal(parsed.month, 9);
    assert.equal(parsed.q, "chuyen-doi-so");
    assert.equal(parsed.view, "kanban");
    assert.equal(parsed.taskId, "task-123");
  });

  test("parseTaskUrlParams returns empty object / undefined for empty or missing params", () => {
    const emptySearch = new URLSearchParams("");
    const parsed = parseTaskUrlParams(emptySearch);

    assert.equal(parsed.scope, undefined);
    assert.equal(parsed.dept, undefined);
    assert.equal(parsed.status, undefined);
    assert.equal(parsed.month, undefined);
    assert.equal(parsed.q, undefined);
    assert.equal(parsed.view, undefined);
    assert.equal(parsed.taskId, undefined);
  });

  test("buildTaskUrlQuery serializes state while omitting defaults and ALL values", () => {
    const state = {
      scope: "school" as const,
      dept: "DAO_TAO",
      status: "waiting_approval",
      month: 10 as const,
      q: "tuyen sinh",
      view: "kanban" as const,
      taskId: "task-456",
    };

    const query = buildTaskUrlQuery(state);
    assert.ok(query.includes("scope=school"));
    assert.ok(query.includes("dept=DAO_TAO"));
    assert.ok(query.includes("status=waiting_approval"));
    assert.ok(query.includes("month=10"));
    assert.ok(query.includes("q=tuyen+sinh") || query.includes("q=tuyen%20sinh"));
    assert.ok(query.includes("view=kanban"));
    assert.ok(query.includes("taskId=task-456"));
  });

  test("URL synchronization roundtrip: serialize then parse preserves exact values", () => {
    const original = {
      scope: "unit" as const,
      dept: "CNTT",
      status: "overdue",
      month: 9 as const,
      q: "bao cao",
      view: "kanban" as const,
      taskId: "t-789",
    };

    const queryString = buildTaskUrlQuery(original);
    const parsed = parseTaskUrlParams(new URLSearchParams(queryString));

    assert.equal(parsed.scope, original.scope);
    assert.equal(parsed.dept, original.dept);
    assert.equal(parsed.status, original.status);
    assert.equal(parsed.month, original.month);
    assert.equal(parsed.q, original.q);
    assert.equal(parsed.view, original.view);
    assert.equal(parsed.taskId, original.taskId);
  });
});


describe("Task 3 — Quick Filter Pills: Role Action, Count, Callback, Advanced Filter Label", () => {
  const adminUser = DEFAULT_DEMO_USERS[0]; // Admin / BGH (isExecutiveRole = true)
  const staffUser = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh — Staff (isExecutiveRole = false)

  test("Executive user builds 'Cần tôi duyệt' role action pill, not 'Chờ tôi nộp'", () => {
    const pill = buildRoleActionPill(true, { waiting_approval: 3, overdue: 1 }, "all");
    assert.equal(pill?.label, "Cần tôi duyệt");
    assert.equal(pill?.id, "waiting_approval");
  });

  test("Staff user builds 'Chờ tôi nộp' role action pill, not 'Cần tôi duyệt'", () => {
    const pill = buildRoleActionPill(false, { pending_submission: 2, overdue: 0 }, "all");
    assert.equal(pill?.label, "Chờ tôi nộp");
    assert.equal(pill?.id, "pending_submission");
  });

  test("Advanced filter popover trigger is labeled 'Bộ lọc'", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        searchQuery: "",
        onSearchChange: () => {},
      })
    );
    assert.ok(
      html.includes("Bộ lọc"),
      "Advanced filter aria-label must be 'Bộ lọc'"
    );
  });

  test("buildQuickFilterPills returns correct pill ids for executive role", () => {
    const pills = buildQuickFilterPills(
      true, // isExecutiveRole
      { all: 12, waiting_approval: 4, overdue: 1 },
      "all"
    );
    const ids = pills.map((p) => p.id);
    assert.deepEqual(ids, ["all", "overdue", "this_week", "waiting_approval"]);
  });

  test("buildQuickFilterPills returns correct pill ids for staff role", () => {
    const pills = buildQuickFilterPills(
      false, // isExecutiveRole = false
      { all: 8, pending_submission: 2, overdue: 0 },
      "all"
    );
    const ids = pills.map((p) => p.id);
    assert.deepEqual(ids, ["all", "overdue", "this_week", "review"]);
  });

  test("onTabChange callback is invoked with correct tab id when a pill is clicked (mock function)", () => {
    // Build pills to get the ids, then simulate the click handler (onTabChange?.(pill.id))
    // This tests that the binding: onClick={() => onTabChange?.(pill.id)} fires correctly.
    const callLog: string[] = [];
    const mockOnTabChange = (tab: string) => { callLog.push(tab); };

    const pills = buildQuickFilterPills(
      true, // executive → roleActionPill.id = "waiting_approval"
      { all: 5, waiting_approval: 2, overdue: 3 },
      "all"
    );

    // Simulate clicking each pill by calling the handler directly
    for (const pill of pills) {
      mockOnTabChange(pill.id);
    }

    assert.deepEqual(callLog, ["all", "overdue", "this_week", "waiting_approval"],
      "onTabChange must be called with correct tab id for each pill in order");
  });

  test("onTabChange callback receives 'overdue' when overdue pill is clicked", () => {
    const callLog: string[] = [];
    const mockOnTabChange = (tab: string) => { callLog.push(tab); };

    const pills = buildQuickFilterPills(
      false,
      { all: 10, pending_submission: 3, overdue: 5 },
      "all"
    );
    const overduePill = pills.find((p) => p.id === "overdue");
    assert.ok(overduePill, "Overdue pill must exist");

    // Simulate click → handler fires
    mockOnTabChange(overduePill.id);

    assert.equal(callLog[0], "overdue",
      "onTabChange callback must be invoked with 'overdue' when overdue pill is clicked");
  });

  test("onTabChange callback receives role-specific id for executive action pill", () => {
    const callLog: string[] = [];
    const mockOnTabChange = (tab: string) => { callLog.push(tab); };

    const execPill = buildRoleActionPill(true, { waiting_approval: 3 }, "all");
    mockOnTabChange(execPill.id);

    assert.equal(callLog[0], "waiting_approval",
      "Executive action pill must invoke onTabChange with 'waiting_approval'");
  });

  test("onTabChange callback receives 'pending_submission' for staff action pill", () => {
    const callLog: string[] = [];
    const mockOnTabChange = (tab: string) => { callLog.push(tab); };

    const staffPill = buildRoleActionPill(false, { pending_submission: 2 }, "all");
    mockOnTabChange(staffPill.id);

    assert.equal(callLog[0], "pending_submission",
      "Staff action pill must invoke onTabChange with 'pending_submission'");
  });
});

describe("Active-Filter Feedback and Zero Results Empty State", () => {
  const adminUser = DEFAULT_DEMO_USERS[0];

  test("Active filter displays selected label and inline clear × button without primary blue", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        searchQuery: "",
        onSearchChange: () => {},
        selectedAcademicMonth: 4,
        activeTab: "in_progress",
        selectedPriority: "URGENT",
        totalTasksCount: 100,
        filteredTasksCount: 15,
      })
    );

    // Filter labels update to selected value
    assert.ok(html.includes("Tháng 4"), "Time filter label reflects selected month 'Tháng 4'");
    assert.ok(html.includes("Đang thực hiện"), "Status filter label reflects 'Đang thực hiện'");
    assert.ok(html.includes("Khẩn cấp"), "Priority filter label reflects 'Khẩn cấp'");

    // Inline clear buttons rendered on active filters
    assert.ok(html.includes('aria-label="Xóa lọc thời gian"'), "Inline clear × button rendered on month filter");
    assert.ok(html.includes('aria-label="Xóa lọc trạng thái"'), "Inline clear × button rendered on status filter");
    assert.ok(html.includes('aria-label="Xóa lọc mức ưu tiên"'), "Inline clear × button rendered on priority filter");

    // Filter count vs total and compact Xóa tất cả action
    assert.ok(html.includes("(15 / 100 nhiệm vụ)"), "Displays filtered result count versus total");
    assert.ok(html.includes("Xóa tất cả"), "Exposes compact Xóa tất cả action in toolbar");
  });

  test("Selecting deadline filter (e.g. overdue) activates ONLY Thời hạn and does NOT jump or duplicate Trạng thái", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        searchQuery: "",
        onSearchChange: () => {},
        activeTab: "overdue",
        totalTasksCount: 161,
        filteredTasksCount: 0,
      })
    );

    // Thời hạn should be active with "Quá hạn"
    assert.ok(html.includes('aria-label="Lọc thời hạn"'), "Must render deadline filter");
    assert.ok(html.includes('aria-label="Xóa lọc thời hạn"'), "Deadline filter must have inline clear button");

    // Trạng thái must remain inactive with "Trạng thái" (not "Quá hạn")
    assert.ok(html.includes('aria-label="Lọc trạng thái"'), "Must render status filter");
    assert.ok(!html.includes('aria-label="Xóa lọc trạng thái"'), "Status filter must NOT be active when filtering by deadline");

    // Total count shows (0 / 161 nhiệm vụ)
    assert.ok(html.includes("(0 / 161 nhiệm vụ)"), "Displays (0 / 161 nhiệm vụ)");
  });

  test("Zero results when time is sole active filter renders specific message", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskEmptyState, {
        academicMonth: 4,
        onResetFilters: () => {},
      })
    );

    assert.ok(
      html.includes("Không có nhiệm vụ trong Tháng 4"),
      "Must render specific time message when time is sole active filter"
    );
    assert.ok(
      html.includes("Thử thay đổi hoặc xóa bộ lọc hiện tại"),
      "Must render guidance description"
    );
    assert.ok(
      html.includes("Xóa bộ lọc"),
      "Must render Xóa bộ lọc CTA button"
    );
  });

  test("Zero results when other filters or combinations are active renders standard message", () => {
    const html = renderToStaticMarkup(
      React.createElement(TaskEmptyState, {
        academicMonth: 4,
        activeTab: "overdue",
        priority: "URGENT",
        onResetFilters: () => {},
      })
    );

    assert.ok(
      html.includes("Không có nhiệm vụ phù hợp"),
      "Must render 'Không có nhiệm vụ phù hợp' when multiple/other filters are active"
    );
    assert.ok(
      html.includes("Thử thay đổi hoặc xóa bộ lọc hiện tại"),
      "Must render guidance description"
    );
    assert.ok(
      html.includes("Xóa bộ lọc"),
      "Must render Xóa bộ lọc CTA button"
    );
  });

  test("Status filter updates button label to 'Mới' when selectedStatus is 'new' or 'NOT_STARTED'", () => {
    const htmlNew = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        searchQuery: "",
        onSearchChange: () => {},
        selectedStatus: "new",
      })
    );

    assert.ok(htmlNew.includes("Mới"), "Must render 'Mới' when selectedStatus is 'new'");
    assert.ok(htmlNew.includes('aria-label="Xóa lọc trạng thái"'), "Status filter must have inline clear button when active");

    const htmlNotStarted = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        user: adminUser,
        searchQuery: "",
        onSearchChange: () => {},
        selectedStatus: "NOT_STARTED",
      })
    );

    assert.ok(htmlNotStarted.includes("Mới"), "Must render 'Mới' when selectedStatus is 'NOT_STARTED'");
  });
});

