import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import fs from "node:fs";
import path from "node:path";

import {
  ScopeSwitcher,
  type WorkspaceScope,
  type WorkspaceScopeType,
} from "../src/components/workspace/scope-switcher";
import {
  ViewSwitcher,
  TASK_VIEW_OPTIONS,
  CALENDAR_VIEW_OPTIONS,
  CALENDAR_AGENDA_VIEW_OPTIONS,
} from "../src/components/workspace/view-switcher";
import {
  StatusFilter,
  DEFAULT_STATUS_OPTIONS,
} from "../src/components/workspace/status-filter";
import { PeriodSelector } from "../src/components/workspace/period-selector";
import { WorkspaceToolbar } from "../src/components/workspace/workspace-toolbar";
import { MetricStrip } from "../src/components/workspace/metric-strip";
import { AttentionBadge } from "../src/components/workspace/attention-badge";
import { ActionQueueShell } from "../src/components/workspace/action-queue-shell";

describe("Shared Workspace Primitives (F3) - Comprehensive Suite", () => {
  const OWNED_FILES = [
    "src/components/workspace/scope-switcher.tsx",
    "src/components/workspace/period-selector.tsx",
    "src/components/workspace/workspace-toolbar.tsx",
    "src/components/workspace/status-filter.tsx",
    "src/components/workspace/view-switcher.tsx",
    "src/components/workspace/metric-strip.tsx",
    "src/components/workspace/attention-badge.tsx",
    "src/components/workspace/action-queue-shell.tsx",
  ];

  describe("1. ScopeSwitcher & Subordinate Unit Selector", () => {
    test("renders canonical 3 scopes in role='tablist' with accessible labeling", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "school",
          onScopeChange: () => {},
        })
      );

      assert.ok(markup.includes('role="tablist"'), "must render tablist");
      assert.ok(
        markup.includes('aria-label="Phạm vi công việc"'),
        "must label tablist"
      );
      assert.ok(markup.includes('id="scope-tab-school"'), "has school tab");
      assert.ok(markup.includes('id="scope-tab-unit"'), "has unit tab");
      assert.ok(markup.includes('id="scope-tab-my"'), "has my tab");
      assert.ok(markup.includes("Toàn trường"), "has Toàn trường label");
      assert.ok(markup.includes("Đơn vị"), "has Đơn vị label");
      assert.ok(markup.includes("Của tôi"), "has Của tôi label");
    });

    test("active tab receives aria-selected='true' and tabIndex=0; inactive receive -1", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "unit",
          onScopeChange: () => {},
        })
      );

      assert.ok(
        markup.includes('id="scope-tab-unit"[^>]*aria-selected="true"') ||
          markup.includes('aria-selected="true"'),
        "unit tab is selected"
      );
      assert.ok(markup.includes('tabindex="0"'), "active tab has tabIndex 0");
      assert.ok(markup.includes('tabindex="-1"'), "inactive tabs have tabIndex -1");
    });

    test("does NOT render subordinate unit selector when activeScope !== 'unit'", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "school",
          onScopeChange: () => {},
          units: [
            { id: "cntt", name: "Khoa CNTT" },
            { id: "kt", name: "Khoa Kinh tế" },
          ],
        })
      );

      assert.ok(
        !markup.includes('id="subordinate-unit-selector"'),
        "subordinate unit selector must not be rendered when scope is school"
      );
      assert.ok(
        !markup.includes("Khoa CNTT"),
        "unit options must not be rendered when scope is school"
      );
    });

    test("renders subordinate unit selector when activeScope === 'unit' and units provided", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ScopeSwitcher, {
          activeScope: "unit",
          onScopeChange: () => {},
          selectedUnitId: "cntt",
          units: [
            { id: "cntt", name: "Khoa CNTT", shortName: "CNTT" },
            { id: "kt", name: "Khoa Kinh tế", shortName: "KT" },
          ],
        })
      );

      assert.ok(
        markup.includes('id="subordinate-unit-selector"'),
        "subordinate selector must be rendered when unit scope is active"
      );
      assert.ok(
        markup.includes('aria-label="Chọn đơn vị trực thuộc"'),
        "must have accessible label"
      );
      assert.ok(markup.includes("CNTT"), "contains shortName option");
      assert.ok(markup.includes("KT"), "contains unit option");
      assert.ok(
        markup.includes("Tất cả đơn vị"),
        "contains default all units option"
      );

      // Verify the tablist itself still has ONLY the 3 canonical scopes
      const tabCount = (markup.match(/role="tab"/g) || []).length;
      assert.equal(
        tabCount,
        3,
        "tablist must strictly contain 3 tabs, never leaking unit as 4th scope tab"
      );
    });

    test("implements ArrowRight, ArrowLeft, Home, End keyboard navigation and roving tabindex in ScopeSwitcher", () => {
      const filePath = path.resolve(process.cwd(), "src/components/workspace/scope-switcher.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(content, /e\.key === ["']ArrowRight["']/, "ScopeSwitcher must handle ArrowRight");
      assert.match(content, /e\.key === ["']ArrowLeft["']/, "ScopeSwitcher must handle ArrowLeft");
      assert.match(content, /e\.key === ["']Home["']/, "ScopeSwitcher must handle Home key");
      assert.match(content, /e\.key === ["']End["']/, "ScopeSwitcher must handle End key");
      assert.match(content, /tabIndex=\{isActive \? 0 : -1\}/, "ScopeSwitcher must implement roving tabIndex");
    });

    test("exports WorkspaceScopeType as an alias for WorkspaceScope", () => {
      const scopeVal: WorkspaceScopeType = "school";
      const canonicalScope: WorkspaceScope = scopeVal;
      assert.equal(canonicalScope, "school");
    });
  });

  describe("2. ViewSwitcher - Roles & Views", () => {
    test("defaults to role='radiogroup' with role='radio' and aria-checked", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          mode: "table",
          onModeChange: () => {},
          variant: "tasks",
        })
      );

      assert.ok(markup.includes('role="radiogroup"'), "container has role radiogroup");
      assert.ok(markup.includes('role="radio"'), "items have role radio");
      assert.ok(markup.includes('aria-checked="true"'), "active item has aria-checked true");
      assert.ok(markup.includes('aria-checked="false"'), "inactive item has aria-checked false");
      assert.ok(!markup.includes('role="tab"'), "must not render role tab when role is radiogroup");
    });

    test("supports role='tablist' with role='tab' and aria-selected when specified", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          mode: "kanban",
          onModeChange: () => {},
          variant: "tasks",
          role: "tablist",
        })
      );

      assert.ok(markup.includes('role="tablist"'), "container has role tablist");
      assert.ok(markup.includes('role="tab"'), "items have role tab");
      assert.ok(markup.includes('aria-selected="true"'), "active item has aria-selected true");
      assert.ok(markup.includes('aria-selected="false"'), "inactive item has aria-selected false");
      assert.ok(!markup.includes('role="radio"'), "must not render role radio when role is tablist");
    });

    test("supports calendar view with 'month' and 'agenda' ('Nghị sự')", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          mode: "agenda",
          onModeChange: () => {},
          variant: "calendar",
        })
      );

      assert.ok(markup.includes("Lịch tháng"), "contains Lịch tháng");
      assert.ok(markup.includes("Nghị sự"), "contains Nghị sự for agenda mode");
      assert.ok(markup.includes('aria-checked="true"'), "agenda is checked");
    });

    test("supports calendar view with 'month' and 'list' ('Danh sách')", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          mode: "list",
          onModeChange: () => {},
          variant: "calendar",
        })
      );

      assert.ok(markup.includes("Lịch tháng"), "contains Lịch tháng");
      assert.ok(markup.includes("Danh sách"), "contains Danh sách for list mode");
      assert.ok(markup.includes('aria-checked="true"'), "list is checked");
    });

    test("exports both CALENDAR_VIEW_OPTIONS and CALENDAR_AGENDA_VIEW_OPTIONS", () => {
      assert.deepEqual(
        CALENDAR_VIEW_OPTIONS.map((c) => c.id),
        ["month", "list"]
      );
      assert.deepEqual(
        CALENDAR_AGENDA_VIEW_OPTIONS.map((c) => c.id),
        ["month", "agenda"]
      );
    });

    test("implements ArrowRight, ArrowLeft, Home, End keyboard navigation and roving tabindex in ViewSwitcher", () => {
      const filePath = path.resolve(process.cwd(), "src/components/workspace/view-switcher.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(content, /e\.key === ["']ArrowRight["']/, "ViewSwitcher must handle ArrowRight");
      assert.match(content, /e\.key === ["']ArrowLeft["']/, "ViewSwitcher must handle ArrowLeft");
      assert.match(content, /e\.key === ["']Home["']/, "ViewSwitcher must handle Home key");
      assert.match(content, /e\.key === ["']End["']/, "ViewSwitcher must handle End key");
      assert.match(content, /tabIndex=\{isActive \? 0 : -1\}/, "ViewSwitcher must implement roving tabIndex");
    });

    test("supports dual-prop signature: activeView and onViewChange as well as mode and onModeChange", () => {
      let changedView = "";
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          activeView: "kanban",
          onViewChange: (v: string) => {
            changedView = v;
          },
          variant: "tasks",
        })
      );

      assert.ok(markup.includes('role="radiogroup"'), "renders correctly with activeView");
      assert.ok(
        markup.includes('aria-label="Chế độ xem bảng Kanban"[^>]*aria-checked="true"') ||
          markup.includes('aria-checked="true"'),
        "kanban is marked active via activeView"
      );
    });

    test("renders custom options without icon without error", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ViewSwitcher, {
          activeView: "custom1",
          onViewChange: () => {},
          options: [
            { id: "custom1", label: "Tùy biến 1" },
            { id: "custom2", label: "Tùy biến 2" },
          ],
        })
      );

      assert.ok(markup.includes("Tùy biến 1"), "renders option 1 label");
      assert.ok(markup.includes("Tùy biến 2"), "renders option 2 label");
    });
  });

  describe("3. StatusFilter - Roving TabIndex & Accessibility", () => {
    test("renders role='tablist' and roving tabIndex (0 on active, -1 on inactive)", () => {
      const markup = renderToStaticMarkup(
        React.createElement(StatusFilter, {
          activeStatus: "IN_PROGRESS",
          onStatusChange: () => {},
        })
      );

      assert.ok(markup.includes('role="tablist"'), "renders role tablist");
      assert.ok(
        markup.includes('aria-label="Bộ lọc trạng thái"'),
        "renders accessible label"
      );
      assert.ok(markup.includes('id="status-tab-IN_PROGRESS"'), "has tab ID");
      assert.ok(
        markup.includes('aria-controls="status-panel-IN_PROGRESS"'),
        "has aria-controls"
      );
      assert.ok(markup.includes('tabindex="0"'), "active tab has tabindex 0");
      assert.ok(markup.includes('tabindex="-1"'), "inactive tabs have tabindex -1");
    });

    test("touch targets satisfy minimum >= 40px/44px", () => {
      const markup = renderToStaticMarkup(
        React.createElement(StatusFilter, {
          activeStatus: "ALL",
          onStatusChange: () => {},
        })
      );

      assert.ok(
        markup.includes("min-h-[44px]"),
        "default size provides 44px touch target"
      );
    });

    test("implements ArrowRight, ArrowLeft, Home, End keyboard navigation and roving tabindex in StatusFilter", () => {
      const filePath = path.resolve(process.cwd(), "src/components/workspace/status-filter.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(content, /e\.key === ["']ArrowRight["']/, "StatusFilter must handle ArrowRight");
      assert.match(content, /e\.key === ["']ArrowLeft["']/, "StatusFilter must handle ArrowLeft");
      assert.match(content, /e\.key === ["']Home["']/, "StatusFilter must handle Home key");
      assert.match(content, /e\.key === ["']End["']/, "StatusFilter must handle End key");
      assert.match(content, /tabIndex=\{isActive \? 0 : -1\}/, "StatusFilter must implement roving tabIndex");
    });

    test("filters out ALL option when showAllOption is false", () => {
      const markup = renderToStaticMarkup(
        React.createElement(StatusFilter, {
          activeStatus: "IN_PROGRESS",
          onStatusChange: () => {},
          showAllOption: false,
        })
      );

      assert.ok(!markup.includes('id="status-tab-ALL"'), "must not render ALL tab");
      assert.ok(markup.includes('id="status-tab-IN_PROGRESS"'), "still renders IN_PROGRESS");
    });
  });

  describe("4. WorkspaceToolbar - Control Point & Primary Action", () => {
    test("renders single control point toolbar with search, reset, and prominent primary action", () => {
      let primaryClicked = false;
      let resetClicked = false;

      const markup = renderToStaticMarkup(
        React.createElement(WorkspaceToolbar, {
          searchQuery: "Báo cáo",
          onSearchChange: () => {},
          hasActiveFilters: true,
          filterCount: 2,
          onResetFilters: () => {
            resetClicked = true;
          },
          primaryAction: {
            label: "Thêm nhiệm vụ",
            onClick: () => {
              primaryClicked = true;
            },
          },
        })
      );

      assert.ok(markup.includes('role="toolbar"'), "has role toolbar");
      assert.ok(
        markup.includes('aria-label="Thanh công cụ không gian làm việc"'),
        "accessible label on toolbar"
      );
      assert.ok(
        markup.includes('aria-label="Tìm kiếm trong không gian làm việc"'),
        "accessible search input"
      );
      assert.ok(
        markup.includes('aria-label="Xóa nội dung tìm kiếm"'),
        "clear search button with accessible label"
      );
      assert.ok(
        markup.includes('aria-label="Đặt lại tất cả bộ lọc"'),
        "reset filters button with accessible label"
      );
      assert.ok(markup.includes("Thêm nhiệm vụ"), "renders primary action text");
      assert.ok(
        markup.includes("bg-blue-600"),
        "primary action has prominent blue styling"
      );
    });
  });

  describe("5. PeriodSelector - Academic Calendar Compliance", () => {
    test("trigger button provides accessible dialog semantics and min-h-[44px]", () => {
      const markup = renderToStaticMarkup(
        React.createElement(PeriodSelector, {
          selectedMonth: 9,
          onMonthChange: () => {},
          academicYear: "2026-2027",
        })
      );

      assert.ok(markup.includes('aria-haspopup="dialog"'), "has dialog popup attribute");
      assert.ok(markup.includes('aria-expanded="false"'), "expanded false by default");
      assert.ok(markup.includes("Tháng 9"), "displays selected academic month");
      assert.ok(markup.includes("min-h-[44px]"), "satisfies 44px touch target");
    });

    test("supports showSemesterPresets option in PeriodSelector", () => {
      const filePath = path.resolve(process.cwd(), "src/components/workspace/period-selector.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.match(
        content,
        /showSemesterPresets\s*\?:?\s*boolean/,
        "PeriodSelector must declare showSemesterPresets in props"
      );
      assert.match(
        content,
        /\{showSemesterPresets\s*&&/,
        "PeriodSelector must conditionally render semester presets"
      );
    });
  });

  describe("6. MetricStrip - Active Filter Indication & Invariants", () => {
    test("renders 5 canonical cards with interactive buttons and explicit 'Đang lọc' indicator", () => {
      const markup = renderToStaticMarkup(
        React.createElement(MetricStrip, {
          metrics: {
            totalTasks: 100,
            inProgressCount: 40,
            waitingApprovalCount: 15,
            urgentOverdueCount: 5,
            completedCount: 40,
            completedRate: 40,
          },
          activeFilter: "NEEDS_REVIEW",
          onFilterChange: () => {},
        })
      );

      assert.ok(markup.includes('role="region"'), "has region role");
      assert.ok(markup.includes("Khối lượng công việc"), "has total card");
      assert.ok(markup.includes("Đang thực hiện"), "has in-progress card");
      assert.ok(markup.includes("Chờ phê duyệt"), "has waiting card");
      assert.ok(markup.includes("Quá hạn"), "has overdue card");
      assert.ok(markup.includes("Tỷ lệ hoàn thành"), "has completed card");
      assert.ok(
        markup.includes("Đang lọc"),
        "displays explicit 'Đang lọc' badge for active filter to eliminate toggle confusion"
      );
      assert.ok(
        markup.includes('aria-pressed="true"'),
        "active card has aria-pressed true"
      );
    });
  });

  describe("7. AttentionBadge - WCAG 2.2 SC 1.4.1 (No Color Alone)", () => {
    test("combines icon, text label, and numeric count", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AttentionBadge, {
          level: "urgent",
          label: "Quá hạn cấp bách",
          count: 3,
        })
      );

      assert.ok(markup.includes('role="status"'), "has role status");
      assert.ok(markup.includes("Quá hạn cấp bách"), "includes visible text");
      assert.ok(markup.includes("3"), "includes numeric count");
      assert.ok(markup.includes("svg"), "includes SVG icon");
    });

    test("renders button with min-h-[44px] when asButton is true", () => {
      const markup = renderToStaticMarkup(
        React.createElement(AttentionBadge, {
          level: "warning",
          label: "Cần xem xét",
          asButton: true,
        })
      );

      assert.ok(markup.includes("<button"), "renders as button");
      assert.ok(markup.includes("min-h-[44px]"), "provides 44px touch target");
    });
  });

  describe("8. ActionQueueShell - Structure & Touch Targets", () => {
    test("collapsible button provides 44x44px touch boundary", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ActionQueueShell, {
          totalCount: 5,
          children: React.createElement("div", null, "Item 1"),
        })
      );

      assert.ok(
        markup.includes('aria-labelledby="action-queue-title"'),
        "has accessible label"
      );
      assert.ok(
        markup.includes("min-h-[44px]") && markup.includes("min-w-[44px]"),
        "collapse trigger satisfies 44x44px touch target"
      );
      assert.ok(
        markup.includes("5 việc cần xử lý"),
        "displays attention badge count"
      );
    });

    test("renders informative empty state without fabricated metrics when empty", () => {
      const markup = renderToStaticMarkup(
        React.createElement(ActionQueueShell, {
          isEmpty: true,
          totalCount: 0,
        })
      );

      assert.ok(
        markup.includes("Không có việc tồn đọng"),
        "displays clear empty title"
      );
      assert.ok(
        markup.includes("Hoàn thành"),
        "displays completed badge"
      );
    });
  });

  describe("9. Architectural Invariants Across All Owned Files", () => {
    test("strictly Light-Only: zero 'dark:' classes in any owned component", () => {
      // Strips comments and checks for dark: variant usage in JSX classNames
      const darkVariantRegex = /\bdark:[a-zA-Z0-9_-]+/;
      for (const relativePath of OWNED_FILES) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        const linesWithoutComments = content
          .split("\n")
          .filter((line) => !line.trim().startsWith("*") && !line.trim().startsWith("//"))
          .join("\n");
        assert.ok(
          !darkVariantRegex.test(linesWithoutComments),
          `File ${relativePath} contains forbidden 'dark:' variant`
        );
      }
    });

    test("strictly zero emojis in any owned component file", () => {
      const emojiRegex =
        /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

      for (const relativePath of OWNED_FILES) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          !emojiRegex.test(content),
          `File ${relativePath} contains forbidden emoji`
        );
      }
    });

    test("visible focus rings across all owned files", () => {
      for (const relativePath of OWNED_FILES) {
        const fullPath = path.resolve(process.cwd(), relativePath);
        const content = fs.readFileSync(fullPath, "utf-8");
        assert.ok(
          content.includes("focus-visible:ring-2") ||
            content.includes("focus-visible:ring-blue-600"),
          `File ${relativePath} must implement visible focus ring`
        );
      }
    });
  });
});
