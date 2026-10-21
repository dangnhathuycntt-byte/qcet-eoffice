import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ActiveFilterBar, ActiveFilterBreadcrumb, countActiveFilters } from "../src/components/workspace/components/active-filter-breadcrumb";

describe("ActiveFilterBreadcrumb Component & Logic", () => {

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
    assert.ok(html.includes("Trễ hạn"));
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

  test("Thời hạn Trễ hạn chỉ hiện một chip (không kèm Hộp việc/Trạng thái Trễ hạn)", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        workbox: "overdue",
        overdue: true,
        deadline: "overdue",
        onRemoveFilter: () => {},
      })
    );
    assert.ok(html.includes('data-slot="filter-chip-deadline"'));
    assert.ok(!html.includes('data-slot="filter-chip-workbox"'));
    assert.ok(!html.includes('data-slot="filter-chip-overdue"'));
  });

  test("countActiveFilters khớp số chip hiện ra (Thời hạn Trễ hạn gộp Hộp việc/Trạng thái Trễ hạn thành một)", () => {
    assert.equal(countActiveFilters({ status: "WAITING_APPROVAL" }), 1);
    assert.equal(countActiveFilters({ status: "ALL", department: "ALL", search: "  " }), 0);
    assert.equal(countActiveFilters({ workbox: "overdue", overdue: true, deadline: "overdue" }), 1);
    assert.equal(countActiveFilters({ status: "IN_PROGRESS", priority: "HIGH", lead: "Nguyễn Văn A" }), 3);
  });

  test("hàng bộ lọc: chip viền mảnh cao 24px, nút ✕ rộng 24px, số kết quả \"x/y kết quả\" chữ thường đọc cho trình đọc màn hình", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActiveFilterBreadcrumb, {
        status: "WAITING_APPROVAL",
        totalFilteredCount: 0,
        totalCount: 2,
        onResetFilters: () => {},
        onRemoveStatus: () => {},
      })
    );
    assert.ok(html.includes("h-6") && html.includes("border-border") && html.includes("divide-x"));
    assert.ok(/aria-label="Xóa lọc Trạng thái: WAITING_APPROVAL"[^>]*class="[^"]*\bw-6\b/.test(html) || /class="[^"]*\bw-6\b[^"]*"[^>]*aria-label="Xóa lọc Trạng thái/.test(html));
    assert.ok(html.includes("0/2 kết quả"));
    assert.ok(html.includes('role="status"') && html.includes('aria-live="polite"'));
    assert.ok(!html.includes("font-mono"));
  });

  test("ActiveFilterBar không có totalCount thì chỉ ghi số kết quả", () => {
    const html = renderToStaticMarkup(React.createElement(ActiveFilterBar, { filteredCount: 4, children: null }));
    assert.ok(html.includes(">4 kết quả<"));
  });
});
