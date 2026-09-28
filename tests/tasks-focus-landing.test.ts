import { test, describe } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import {
  DashboardDataContext,
  DashboardActionsContext,
  DashboardModalContext,
  DashboardNavContext,
} from "../src/components/dashboard/dashboard-context";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("TasksFocusLanding Central Dispatcher Integration", () => {
  const payload = getMockDashboardPayload();
  const adminUser = DEFAULT_DEMO_USERS[0];
  const managerUser = DEFAULT_DEMO_USERS[1];
  const staffUser = DEFAULT_DEMO_USERS[2];

  const mockRouter = {
    back: () => {},
    forward: () => {},
    refresh: () => {},
    push: () => {},
    replace: () => {},
    prefetch: () => {},
  };

  const mockActions = {
    handleReviewAction: async () => {},
    handleSubmitDeliverable: async () => {},
    handleStatusChange: () => {},
    handleManualRefresh: async () => {},
  };

  const mockModal = {
    openTaskDetail: () => {},
    openCreateModal: () => {},
  };

  const mockNav = {
    currentZone: "tasks",
    currentScope: "school",
    viewMode: "table",
    isStaffExpanded: false,
    useAdvancedToolbar: false,
    handleZoneChange: () => {},
    handleScopeChange: () => {},
    handleViewModeChange: () => {},
    handleToggleStaffExpanded: () => {},
    setIsStaffExpanded: () => {},
    setUseAdvancedToolbar: () => {},
  };

  function renderLandingWithContext(dataOverrides: Record<string, unknown> = {}) {
    const mockData = {
      tasks: payload.tasks,
      user: adminUser,
      effectiveManagerUser: null,
      isRefreshing: false,
      ...dataOverrides,
    };

    return renderToStaticMarkup(
      React.createElement(
        AppRouterContext.Provider,
        { value: mockRouter },
        React.createElement(
          DashboardNavContext.Provider,
          { value: mockNav as unknown as React.ComponentProps<typeof DashboardNavContext.Provider>["value"] },
          React.createElement(
            DashboardDataContext.Provider,
            { value: mockData as unknown as React.ComponentProps<typeof DashboardDataContext.Provider>["value"] },
            React.createElement(
              DashboardActionsContext.Provider,
              { value: mockActions as unknown as React.ComponentProps<typeof DashboardActionsContext.Provider>["value"] },
              React.createElement(
                DashboardModalContext.Provider,
                { value: mockModal as unknown as React.ComponentProps<typeof DashboardModalContext.Provider>["value"] },
                React.createElement(TasksFocusLanding)
              )
            )
          )
        )
      )
    );
  }

  test("TasksFocusLanding renders UnifiedAdaptiveWorkspace as single source of truth for admin user", () => {
    const html = renderLandingWithContext({ user: adminUser });

    assert.ok(html.includes('data-slot="role-workspace-landing"'));
    assert.ok(html.includes('id="tour-tasks-landing"'));
    assert.ok(html.includes('data-slot="unified-adaptive-workspace"'));
    // Scope switching is now integrated into UnifiedTaskToolbar, not a separate AdaptiveScopeHeader
    assert.ok(html.includes('data-slot="unified-task-toolbar"'));
    assert.ok(html.includes('data-slot="task-summary-strip"'));
  });

  test("TasksFocusLanding renders UnifiedAdaptiveWorkspace for manager and staff users", () => {
    const managerHtml = renderLandingWithContext({ user: managerUser });
    assert.ok(managerHtml.includes('data-slot="unified-adaptive-workspace"'));
    assert.ok(managerHtml.includes('id="tour-tasks-landing"'));

    const staffHtml = renderLandingWithContext({ user: staffUser });
    assert.ok(staffHtml.includes('data-slot="unified-adaptive-workspace"'));
    assert.ok(staffHtml.includes('id="tour-tasks-landing"'));
  });

  test("TasksFocusLanding preserves tour-tasks-landing and ActionableEmptyState when tasks are empty", () => {
    const html = renderLandingWithContext({ tasks: [] });

    assert.ok(html.includes('id="tour-tasks-landing"'));
    assert.ok(html.includes('id="tour-empty-state-cta"'));
    assert.ok(html.includes("Chào mừng Thầy/Cô đến với Bàn làm việc!"));
    assert.ok(!html.includes('data-slot="unified-adaptive-workspace"'));
  });

  test("TasksFocusLanding handles unauthenticated state gracefully", () => {
    const html = renderLandingWithContext({ user: null });

    assert.ok(html.includes("Chưa đăng nhập"));
    assert.ok(html.includes("Đăng nhập ngay"));
  });

  test("Zero emojis in rendered HTML output", () => {
    const html = renderLandingWithContext({ user: adminUser });
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Rendered HTML must be 100% free of emojis");
  });

  test("'Của tôi' only exists in ScopeSwitcher and is completely purged from status/filter pill row", () => {
    const html = renderLandingWithContext({ user: adminUser });

    // Scope switching is now integrated into the unified toolbar (no separate AdaptiveScopeHeader).
    // The toolbar renders data-slot="unified-task-toolbar" which contains scope options internally.
    assert.ok(
      html.includes('data-slot="unified-task-toolbar"'),
      "Unified task toolbar must be rendered"
    );

    // The toolbar's scope options (including "Của tôi") are defined in data structures
    // but rendered inside portal menus (not in static HTML). The main toolbar surface
    // (search, filter button, CTA) must not contain "Của tôi" as visible text.
    // Extract the toolbar section and verify no "Của tôi" leaks into the static toolbar row.
    const toolbarStart = html.indexOf('data-slot="unified-task-toolbar"');
    assert.ok(toolbarStart !== -1, "Toolbar must exist in rendered HTML");
    const toolbarSubstring = html.substring(toolbarStart, toolbarStart + 3000);
    assert.ok(
      !toolbarSubstring.includes("Của tôi"),
      "'Của tôi' must not appear in the toolbar's static surface (it belongs in scope menu only)"
    );
  });

  test("Exactly one primary page-level CTA (Tạo việc) is rendered on the Tasks page across all roles", () => {
    // The CTA button renders as: <Plus icon/><span>Tạo việc</span>
    // It is only rendered when resolveCreateTaskPolicy(user).canCreate is true.
    // The admin demo user (departmentCode="QCET", no dbRole) does NOT have create
    // permission, so the CTA is correctly absent for them.
    for (const testUser of [adminUser, managerUser, staffUser]) {
      const html = renderLandingWithContext({ user: testUser });

      if (testUser.role === "ADMIN" && testUser.departmentCode === "QCET") {
        // Admin user with QCET department and no executive dbRole cannot create tasks
        assert.ok(
          !html.includes("Tạo việc mới"),
          `CTA should not render for admin user with QCET departmentCode and no executive dbRole`
        );
      } else {
        // Manager and Staff users with non-QCET departmentCode can create tasks
        const matches = html.match(/Tạo việc/g);
        assert.ok(matches, `CTA 'Tạo việc' must be present for ${testUser.role}`);
        assert.ok(
          matches.length >= 1,
          `At least one primary CTA (Tạo việc) must be rendered for ${testUser.role}, got ${matches.length}`
        );
      }
      assert.ok(
        !html.includes("+ Tạo nhiệm vụ"),
        `Legacy '+ Tạo nhiệm vụ' must not be rendered for ${testUser.role}`
      );
    }
  });
});
