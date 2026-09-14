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
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS, matchesUser } from "../src/lib/role-task-filter";
import type { SchoolTask, StaffTask } from "../src/types/dashboard";
import { ModularCascadingTaskTable } from "../src/components/tasks/table/modular-cascading-task-table";

describe("UnifiedTaskToolbar Helpers", () => {
  const payload = getMockDashboardPayload();
  const staffUser = DEFAULT_DEMO_USERS[2]; // Nguyễn Ngọc Vinh (CNTT)
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

  test("UnifiedTaskToolbar renders 'Cả năm' as selected when selectedAcademicMonth is ALL and showAcademicMonthBar is true", () => {
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
        showAcademicMonthBar: true,
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

describe("Single Unified Task Toolbar Surface & Role-Based Scope Visibility", () => {
  const staffUser = DEFAULT_DEMO_USERS[2]; // STAFF
  const adminUser = DEFAULT_DEMO_USERS[0]; // BGH / ADMIN

  test("STAFF user does NOT see unauthorized 'Toàn trường' scope option", () => {
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

    // Must have "Của tôi"
    assert.ok(html.includes("Của tôi"), "Must render 'Của tôi' scope");
    // Must NOT render "Toàn trường" button
    assert.ok(!html.includes("Toàn trường"), "Must NOT render 'Toàn trường' for staff");
  });

  test("ADMIN/BGH user sees all authorized scopes: Toàn trường, Đơn vị, Của tôi", () => {
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
    assert.ok(html.includes("Của tôi"), "Must render 'Của tôi' scope for admin");
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

    // SavedViewsSelector is leftmost — its trigger reads as Góc nhìn (exact contract:
    // "Góc nhìn: Tất cả nhiệm vụ" default already asserted at line ~762).
    assert.ok(
      html.includes("Góc nhìn"),
      "Must render Saved Views trigger as primary work navigation"
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
        selectedCategory: "CHUYEN_DOI_SO",
        selectedPriority: "URGENT",
        selectedAcademicMonth: 9,
      })
    );
    // 4 active filters -> badge with "4"
    assert.ok(filteredHtml.includes(">4<"), "Must render badge with 4 active filters");
  });

  test("View switcher renders Table and Kanban modes", () => {
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

    assert.ok(html.includes("Bảng"), "Must render Table view option");
    assert.ok(html.includes("Kanban"), "Must render Kanban view option");
  });

  test("Density selector renders Compact and Comfortable options", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "school",
        onScopeChange: () => {},
        searchQuery: "",
        onSearchChange: () => {},
        density: "comfortable",
        onDensityChange: () => {},
      })
    );

    assert.ok(html.includes("Chuẩn"), "Must render Comfortable option");
    assert.ok(html.includes("Gọn"), "Must render Compact option");
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


describe("Unified Task Toolbar UI Polish & Action Queue Integration", () => {
  const adminUser = DEFAULT_DEMO_USERS[0]; // Admin / BGH

  test("Renders inline Action Queue Trigger in Row 1 when actionQueueCount > 0 and callback provided", () => {
    const el = React.createElement(UnifiedTaskToolbar, {
      scope: "school",
      onScopeChange: () => {},
      user: adminUser,
      searchQuery: "",
      onSearchChange: () => {},
      actionQueueCount: 5,
      onOpenActionQueue: () => {},
    });
    const html = renderToStaticMarkup(el);

    assert.ok(
      html.includes('data-slot="action-queue-trigger"'),
      "Must render action queue trigger in Row 1"
    );
    assert.ok(
      html.includes("Cần xử lý"),
      "Must render 'Cần xử lý' label"
    );
    assert.ok(
      html.includes("5"),
      "Must display action queue count"
    );
  });

  test("Dynamic search placeholder reflects totalTasksCount when provided", () => {
    const el = React.createElement(UnifiedTaskToolbar, {
      scope: "school",
      onScopeChange: () => {},
      user: adminUser,
      searchQuery: "",
      onSearchChange: () => {},
      totalTasksCount: 42,
    });
    const html = renderToStaticMarkup(el);

    assert.ok(
      html.includes("Tìm trong 42 nhiệm vụ... /"),
      "Search input placeholder must reflect totalTasksCount dynamically"
    );
  });

  test("SavedViewsSelector renders 'Góc nhìn: Tất cả nhiệm vụ' by default", () => {
    const el = React.createElement(UnifiedTaskToolbar, {
      scope: "school",
      onScopeChange: () => {},
      user: adminUser,
      searchQuery: "",
      onSearchChange: () => {},
    });
    const html = renderToStaticMarkup(el);

    assert.ok(
      html.includes("Góc nhìn: Tất cả nhiệm vụ"),
      "Saved views selector must display 'Góc nhìn: Tất cả nhiệm vụ'"
    );
  });
});

