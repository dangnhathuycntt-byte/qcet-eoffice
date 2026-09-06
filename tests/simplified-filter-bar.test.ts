import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";
import {
  SimplifiedTaskFilterBar,
  CORE_STATUS_PILLS,
  countActiveFilters,
  countActiveAdvancedFilters,
  resetAdvancedFilters,
  type SimplifiedTaskFilterBarProps,
  type SimplifiedTaskStatus,
} from "../src/components/dashboard/simplified-task-filter-bar";

const COMPONENT_FILE_PATH = path.resolve(
  process.cwd(),
  "src/components/dashboard/simplified-task-filter-bar.tsx"
);

describe("SimplifiedTaskFilterBar - Unit & Behavior Tests", () => {
  const defaultProps: SimplifiedTaskFilterBarProps = {
    searchQuery: "",
    onSearchChange: () => {},
    activeStatus: "ALL",
    onStatusChange: () => {},
    selectedDepartment: "ALL",
    onDepartmentChange: () => {},
    selectedAcademicMonth: "ALL",
    onAcademicMonthChange: () => {},
    selectedPriority: "ALL",
    onPriorityChange: () => {},
    totalCount: 42,
  };

  test("Active filter counter calculation returns 0 for default state", () => {
    const count = countActiveFilters({
      selectedDepartment: "ALL",
      selectedAcademicMonth: "ALL",
      selectedPriority: "ALL",
    });
    assert.equal(count, 0, "Default state should have 0 active filters");
  });

  test("Active filter counter counts department, month, and priority correctly", () => {
    // 1 active
    assert.equal(
      countActiveFilters({
        selectedDepartment: "CNTT",
        selectedAcademicMonth: "ALL",
        selectedPriority: "ALL",
      }),
      1
    );

    // 2 active
    assert.equal(
      countActiveFilters({
        selectedDepartment: "CNTT",
        selectedAcademicMonth: 9,
        selectedPriority: "ALL",
      }),
      2
    );

    // 3 active
    assert.equal(
      countActiveFilters({
        selectedDepartment: "CNTT",
        selectedAcademicMonth: 10,
        selectedPriority: "URGENT",
      }),
      3
    );

    // countActiveAdvancedFilters alias matches countActiveFilters
    assert.equal(
      countActiveAdvancedFilters({
        selectedDepartment: "DAO_TAO",
        selectedAcademicMonth: 1,
        selectedPriority: "HIGH",
      }),
      3
    );
  });

  test("CORE_STATUS_PILLS defines exactly 3 core pills: Tất cả, Cần làm ngay, Hoàn thành", () => {
    assert.equal(CORE_STATUS_PILLS.length, 3, "Must have exactly 3 core status pills");
    const ids = CORE_STATUS_PILLS.map((p) => p.id);
    assert.deepEqual(ids, ["ALL", "ACTION_REQUIRED", "COMPLETED"]);

    const labels = CORE_STATUS_PILLS.map((p) => p.label);
    assert.deepEqual(labels, ["Tất cả", "Cần làm ngay", "Hoàn thành"]);
  });

  test("resetAdvancedFilters invokes all reset callbacks with 'ALL'", () => {
    let deptReset = "";
    let monthReset: number | "ALL" | undefined;
    let priorityReset = "";
    let resetFiltersCalled = false;

    resetAdvancedFilters({
      onDepartmentChange: (dept) => {
        deptReset = dept;
      },
      onAcademicMonthChange: (month) => {
        monthReset = month;
      },
      onPriorityChange: (prio) => {
        priorityReset = prio;
      },
      onResetFilters: () => {
        resetFiltersCalled = true;
      },
    });

    assert.equal(deptReset, "ALL", "Department should reset to ALL");
    assert.equal(monthReset, "ALL", "Academic month should reset to ALL");
    assert.equal(priorityReset, "ALL", "Priority should reset to ALL");
    assert.equal(resetFiltersCalled, true, "onResetFilters callback should be invoked");
  });

  test("renders search input, status pills, and advanced filter toggle", () => {
    const html = renderToStaticMarkup(React.createElement(SimplifiedTaskFilterBar, defaultProps));

    // Search input
    assert.ok(html.includes("Tìm theo tên việc"), "Must render search input placeholder");

    // 3 core pills
    assert.ok(html.includes("Tất cả"), "Must render Tất cả pill");
    assert.ok(html.includes("Cần làm ngay"), "Must render Cần làm ngay pill");
    assert.ok(html.includes("Hoàn thành"), "Must render Hoàn thành pill");

    // Advanced filter toggle button
    assert.ok(html.includes("Bộ lọc nâng cao"), "Must render Bộ lọc nâng cao toggle button");

    // Total count formatted with font-mono tabular-nums
    assert.ok(html.includes("42"), "Must render total task count");
    assert.ok(html.includes("font-mono"), "Must use font-mono tabular-nums for numbers");
  });

  test("renders clear button when searchQuery is non-empty", () => {
    const htmlEmpty = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        searchQuery: "",
      })
    );
    assert.ok(!htmlEmpty.includes("aria-label=\"Xóa tìm kiếm\""), "Should not show clear button when search is empty");

    const htmlWithSearch = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        searchQuery: "Báo cáo kiểm định",
      })
    );
    assert.ok(
      htmlWithSearch.includes("aria-label=\"Xóa tìm kiếm\""),
      "Must show clear button when search query has content"
    );
  });

  test("renders active filter badge count when advanced filters are active", () => {
    const htmlNoFilters = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, defaultProps)
    );
    assert.ok(!htmlNoFilters.includes("badge-filter-count"), "No badge when 0 active filters");

    const htmlWithFilters = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        selectedDepartment: "CNTT",
        selectedPriority: "URGENT",
      })
    );
    assert.ok(
      htmlWithFilters.includes("badge-filter-count"),
      "Must show filter badge when active filters > 0"
    );
    assert.ok(htmlWithFilters.includes(">2<"), "Badge must display count of 2");
  });

  test("highlights the active status pill correctly", () => {
    const htmlActionRequired = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        activeStatus: "ACTION_REQUIRED",
      })
    );
    // Active pill should have aria-pressed="true"
    assert.match(
      htmlActionRequired,
      /aria-pressed="true"[^>]*>Cần làm ngay/,
      "Active pill Cần làm ngay must have aria-pressed='true'"
    );
  });

  test("popover content includes Department, Academic Month, and Priority filter fields", () => {
    const html = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        selectedDepartment: "DAO_TAO",
        selectedAcademicMonth: 10,
        selectedPriority: "HIGH",
      })
    );

    // Advanced fields
    assert.ok(html.includes("Đơn vị chủ trì") || html.includes("Đơn vị"), "Must include department label");
    assert.ok(html.includes("Tháng học trong năm") || html.includes("Tháng học"), "Must include month label");
    assert.ok(html.includes("Mức độ ưu tiên") || html.includes("Ưu tiên"), "Must include priority label");

    // Reset button
    assert.ok(
      html.includes("Đặt lại") || html.includes("Xóa bộ lọc"),
      "Must have a reset filters button"
    );
  });

  test("Anti-slop check: 0% emojis in source code and rendered HTML", () => {
    const emojiRegex =
      /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    // Check rendered HTML
    const html = renderToStaticMarkup(
      React.createElement(SimplifiedTaskFilterBar, {
        ...defaultProps,
        searchQuery: "Kiểm định",
        activeStatus: "ACTION_REQUIRED",
        selectedDepartment: "CNTT",
        selectedAcademicMonth: 9,
        selectedPriority: "URGENT",
      })
    );
    assert.equal(emojiRegex.test(html), false, "Rendered HTML must not contain emojis");

    // Check source code file
    assert.ok(fs.existsSync(COMPONENT_FILE_PATH), "Component source file must exist");
    const source = fs.readFileSync(COMPONENT_FILE_PATH, "utf-8");
    assert.equal(emojiRegex.test(source), false, "Component source code must not contain emojis");
  });
});
