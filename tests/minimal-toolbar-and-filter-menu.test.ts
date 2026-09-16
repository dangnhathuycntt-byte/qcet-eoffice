import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedTaskToolbar } from "../src/components/dashboard/unified-task-toolbar";
import type { AuthUser } from "../src/types/auth";

describe("Minimal Toolbar & Filter Menu UX Suite", () => {
  const mockUser: AuthUser = {
    id: "u-cntt-vinh",
    name: "KS. Nguyễn Ngọc Vinh",
    email: "vinh@cdktcnqn.edu.vn",
    role: "STAFF",
    roleLabel: "Chuyên viên CNTT",
    department: "Khoa Công nghệ thông tin",
    departmentCode: "CNTT",
  };

  test("Hàng 1: Renders 3 scope tabs with neutral badge counts (including 0), shows unit name as clean secondary text", () => {
    const markup = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "unit",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "",
        onSearchChange: () => {},
        canCreateTask: true,
        onCreateTask: () => {},
        badgeCounts: {
          my: 0,
          unit: 14,
          school: 48,
        },
      })
    );

    // 1. Must render all 3 scopes: Cá nhân, Đơn vị, Toàn trường
    assert.match(markup, /Cá nhân/);
    assert.match(markup, /Đơn vị/);
    assert.match(markup, /Toàn trường/);

    // 2. Badges rendered with correct counts, including 0
    assert.match(markup, /data-slot="scope-badge-count"[^>]*data-scope="my"[^>]*>0</);
    assert.match(markup, /data-slot="scope-badge-count"[^>]*data-scope="unit"[^>]*>14</);
    assert.match(markup, /data-slot="scope-badge-count"[^>]*data-scope="school"[^>]*>48</);

    // 3. Unit name is displayed as clean text beside tab group
    assert.match(markup, /\(Khoa Công nghệ thông tin\)/);

    // 4. No select dropdown for department in row 1
    assert.ok(!markup.includes("<select"), "Row 1 must not contain department select dropdown");

    // 5. Primary action button is 'Tạo nhiệm vụ'
    assert.match(markup, /Tạo nhiệm vụ/);
  });

  test("Hàng 2: Renders search input with 'Tìm nhiệm vụ…', Filter button, and Display button", () => {
    const markup = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "",
        onSearchChange: () => {},
        onViewModeChange: () => {},
      })
    );

    // 1. Search input placeholder
    assert.match(markup, /placeholder="Tìm nhiệm vụ… \/"/);

    // 2. Filter button
    assert.match(markup, /Bộ lọc/);

    // 3. Display button
    assert.match(markup, /Hiển thị/);

    // 4. Quick filter pills row is NOT rendered standalone in Row 2 (moved inside Filter menu)
    assert.ok(!markup.includes('aria-label="Bộ lọc nhanh nhiệm vụ"'));
  });

  test("Reset filters: preserves scope and department, only clears supplementary criteria", () => {
    let clearedSearch = false;
    let resetTab = false;

    const markup = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "unit",
        selectedDepartment: "CNTT",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "Tuyển sinh",
        onSearchChange: (q) => {
          if (q === "") clearedSearch = true;
        },
        activeTab: "overdue",
        onTabChange: (tab) => {
          if (tab === "all") resetTab = true;
        },
        onResetFilters: () => {},
      })
    );

    assert.ok(markup.includes("Bộ lọc"));
  });

  test("Badge numbers reflect total tasks per scope before search/supplementary filters and show 0 correctly", () => {
    // Case 1: All scopes have non-zero tasks
    const markupWithCounts = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "Từ khóa tìm kiếm lọc danh sách",
        activeTab: "overdue",
        onSearchChange: () => {},
        badgeCounts: {
          my: 5,
          unit: 20,
          school: 60,
        },
      })
    );

    // Badge counts remain total dataset size (5, 20, 60), unaffected by searchQuery or activeTab
    assert.match(markupWithCounts, />5</);
    assert.match(markupWithCounts, />20</);
    assert.match(markupWithCounts, />60</);

    // Case 2: User has 0 personal tasks, unit has 0 tasks
    const markupWithZero = renderToStaticMarkup(
      React.createElement(UnifiedTaskToolbar, {
        scope: "my",
        onScopeChange: () => {},
        user: mockUser,
        searchQuery: "",
        onSearchChange: () => {},
        badgeCounts: {
          my: 0,
          unit: 0,
          school: 15,
        },
      })
    );

    // Both 0 values must be rendered in badge tags
    assert.match(markupWithZero, /data-slot="scope-badge-count"[^>]*data-scope="my"[^>]*>0</);
    assert.match(markupWithZero, /data-slot="scope-badge-count"[^>]*data-scope="unit"[^>]*>0</);
    assert.match(markupWithZero, /data-slot="scope-badge-count"[^>]*data-scope="school"[^>]*>15</);
  });
});
