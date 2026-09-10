import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import {
  DashboardDataContext,
  DashboardActionsContext,
  DashboardModalContext,
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
    );
  }

  test("TasksFocusLanding renders UnifiedAdaptiveWorkspace as single source of truth for admin user", () => {
    const html = renderLandingWithContext({ user: adminUser });

    assert.ok(html.includes('data-slot="role-workspace-landing"'));
    assert.ok(html.includes('id="tour-tasks-landing"'));
    assert.ok(html.includes('data-slot="unified-adaptive-workspace"'));
    assert.ok(html.includes('data-slot="adaptive-scope-header"'));
    assert.ok(html.includes('data-slot="adaptive-metric-strip"'));
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

  test("Source code verification: removed old 3-way hard branching and no dark: classes", () => {
    const filePath = path.resolve(
      process.cwd(),
      "src/components/dashboard/zones/tasks-focus-landing.tsx"
    );
    const content = fs.readFileSync(filePath, "utf-8");

    assert.ok(
      content.includes("UnifiedAdaptiveWorkspace"),
      "Must import UnifiedAdaptiveWorkspace"
    );
    assert.ok(
      !content.includes("ExecutiveCockpitWorkspace"),
      "Must not import legacy ExecutiveCockpitWorkspace"
    );
    assert.ok(
      !content.includes("DepartmentManagerWorkspace"),
      "Must not import legacy DepartmentManagerWorkspace"
    );
    assert.ok(
      !content.includes("LecturerFocusWorkspace"),
      "Must not import legacy LecturerFocusWorkspace"
    );
    assert.ok(
      content.includes('id="tour-tasks-landing"'),
      "Must preserve tour-tasks-landing ID"
    );
    assert.ok(
      content.includes('data-slot="role-workspace-landing"'),
      "Must preserve data-slot='role-workspace-landing'"
    );
    assert.ok(
      content.includes("ActionableEmptyState"),
      "Must preserve ActionableEmptyState"
    );

    // Light-only standard
    assert.ok(!content.includes("dark:"), "Must not contain dark: classes");
    assert.ok(!content.includes("dark "), "Must not contain dark variant");

    // Zero emojis check in source
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(content), "Source code must be 100% free of emojis");
  });

  test("Zero emojis in rendered HTML output", () => {
    const html = renderLandingWithContext({ user: adminUser });
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Rendered HTML must be 100% free of emojis");
  });

  test("'Của tôi' only exists in ScopeSwitcher and is completely purged from status/filter pill row", () => {
    const html = renderLandingWithContext({ user: adminUser });

    // Assert ScopeSwitcher has 'Của tôi'
    assert.ok(
      html.includes('data-slot="adaptive-scope-header"'),
      "ScopeSwitcher header must be rendered"
    );
    assert.ok(
      html.includes('data-scope="my"'),
      "ScopeSwitcher must contain data-scope='my' tab"
    );

    // Assert Row 2 filter pills do NOT contain 'Của tôi'
    assert.ok(
      html.includes('data-slot="unified-task-toolbar-row-2"'),
      "Toolbar row 2 must be rendered"
    );
    const row2StartIndex = html.indexOf('data-slot="unified-task-toolbar-row-2"');
    const row2Substring = html.substring(row2StartIndex, row2StartIndex + 2500);
    assert.ok(
      !row2Substring.includes("Của tôi"),
      "'Của tôi' must be completely purged from status/filter pill row"
    );
  });

  test("Exactly one primary page-level CTA (+ Giao việc) is rendered on the Tasks page across all roles", () => {
    for (const testUser of [adminUser, managerUser, staffUser]) {
      const html = renderLandingWithContext({ user: testUser });

      const matches = html.match(/\+ Giao việc/g);
      assert.ok(matches, `CTA '+ Giao việc' must be present for ${testUser.role}`);
      assert.equal(
        matches.length,
        1,
        `Exactly one primary CTA (+ Giao việc) must be rendered for ${testUser.role}, got ${matches.length}`
      );
      assert.ok(
        !html.includes("+ Tạo nhiệm vụ"),
        `Legacy '+ Tạo nhiệm vụ' must not be rendered for ${testUser.role}`
      );
    }
  });
});
