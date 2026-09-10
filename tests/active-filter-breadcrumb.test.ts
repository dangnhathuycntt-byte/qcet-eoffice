import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActiveFilterBreadcrumb,
  getActiveFilterSummary,
} from "../src/components/workspace/components/active-filter-breadcrumb";

describe("ActiveFilterBreadcrumb Component & Logic", () => {
  test("computes active filter summary correctly for various criteria", () => {
    const filters = getActiveFilterSummary({
      dept: "CNTT",
      workbox: "URGENT_OVERDUE",
      search: "nghiệm thu",
      status: "IN_PROGRESS",
      overdue: true,
      scope: "unit",
    });

    assert.equal(filters.length, 6);
    assert.ok(filters.includes("Đơn vị: CNTT"));
    assert.ok(filters.includes("Hộp việc: URGENT_OVERDUE"));
    assert.ok(filters.includes('Từ khóa: "nghiệm thu"'));
    assert.ok(filters.includes("Trạng thái: IN_PROGRESS"));
    assert.ok(filters.includes("Quá hạn"));
    assert.ok(filters.includes("Phạm vi: Đơn vị"));
  });

  test("ignores default/ALL and empty values in summary", () => {
    const filters = getActiveFilterSummary({
      dept: "ALL",
      workbox: "ALL",
      search: "   ",
      status: "ALL",
      overdue: false,
      scope: "ALL",
    });

    assert.equal(filters.length, 0);
  });

  test("renders null when no active filters are present", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        department: "ALL",
        search: "",
        workbox: "ALL",
        overdue: false,
      })
    );

    assert.equal(html, "");
  });

  test("renders active filter chips and 1-click 'Xóa lọc' button when filters are active", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        department: "Khoa CNTT",
        search: "nghiệm thu đề tài",
        status: "IN_PROGRESS",
        overdue: true,
        totalFilteredCount: 14,
        onResetFilters: () => {},
        onRemoveDepartment: () => {},
        onRemoveSearch: () => {},
        onRemoveStatus: () => {},
        onRemoveOverdue: () => {},
      })
    );

    assert.ok(html.includes('data-slot="active-filter-breadcrumb"'));
    assert.ok(html.includes("Khoa CNTT"));
    assert.ok(html.includes("nghiệm thu đề tài"));
    assert.ok(html.includes("IN_PROGRESS"));
    assert.ok(html.includes("Quá hạn"));
    assert.ok(html.includes("Xóa lọc") || html.includes("Xóa bộ lọc"));
    assert.ok(html.includes('data-slot="clear-all-filters"'));
    // Must use tabular numerals for count
    assert.ok(html.includes("tabular-nums"));
    assert.ok(html.includes("14"));
  });

  test("renders dismiss button for individual filter chips with accessible aria-label", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        department: "KHTN",
        onRemoveDepartment: () => {},
      })
    );

    assert.ok(html.includes('data-slot="filter-chip-department"'));
    assert.ok(html.includes('aria-label="Xóa lọc Đơn vị: KHTN"'));
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        department: "KHTN",
        search: "nhiệm vụ",
        status: "COMPLETED",
        overdue: true,
        totalFilteredCount: 5,
        onResetFilters: () => {},
      })
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "ActiveFilterBreadcrumb must be 100% free of emojis");
  });

  test("strictly complies with Light-Only standard (zero dark: classes)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        department: "KHTN",
        search: "nhiệm vụ",
        status: "COMPLETED",
        overdue: true,
        totalFilteredCount: 5,
        onResetFilters: () => {},
      })
    );

    assert.ok(!html.includes("dark:"), "Must not contain dark: classes");
  });
});
