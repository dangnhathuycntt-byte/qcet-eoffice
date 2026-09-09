import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveScopeHeader, syncScopeToUrl } from "../src/components/workspace/components/adaptive-scope-header";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("AdaptiveScopeHeader Component", () => {
  const adminUser = DEFAULT_DEMO_USERS[0];
  const managerUser = DEFAULT_DEMO_USERS[1];
  const staffUser = DEFAULT_DEMO_USERS[2];

  test("renders 3 segmented scopes for ADMIN user", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
      })
    );

    assert.ok(html.includes("Toàn trường"), "Should display Toàn trường option");
    assert.ok(html.includes("Của tôi"), "Should display Của tôi option");
    assert.ok(html.includes("data-slot=\"adaptive-scope-header\""));
  });

  test("hides or disables school scope for non-executive staff", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: staffUser,
        activeScope: "my",
        onScopeChange: () => {},
      })
    );

    // Non-executive staff should not see school scope button
    assert.ok(!html.includes("data-scope=\"school\""), "Staff must not have school scope option");
    assert.ok(html.includes("data-scope=\"my\""), "Staff must have my scope option");
  });

  test("renders unit and my scopes for MANAGER user, but not school scope", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: managerUser,
        activeScope: "unit",
        onScopeChange: () => {},
      })
    );

    assert.ok(!html.includes("data-scope=\"school\""), "Manager must not have school scope option");
    assert.ok(html.includes("data-scope=\"unit\""), "Manager must have unit scope option");
    assert.ok(html.includes("data-scope=\"my\""), "Manager must have my scope option");
  });

  test("renders badge counts with font-mono and tabular-nums when count > 0", () => {
    const htmlWithBadges = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
        badgeCounts: {
          school: 12,
          unit: 0,
          my: 5,
        },
      })
    );

    assert.ok(htmlWithBadges.includes("data-slot=\"scope-badge\""), "Should render badge pill");
    assert.ok(htmlWithBadges.includes("font-mono"), "Badge should have font-mono styling");
    assert.ok(htmlWithBadges.includes("tabular-nums"), "Badge should have tabular-nums styling");
    assert.ok(htmlWithBadges.includes(">12<"), "Should render school badge count 12");
    assert.ok(htmlWithBadges.includes(">5<"), "Should render my badge count 5");
    assert.ok(!htmlWithBadges.includes(">0<"), "Should not render 0 count badge");
  });

  test("applies contextual tint accents for each active scope", () => {
    const htmlSchool = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
      })
    );
    assert.ok(htmlSchool.includes("border-amber-300"), "School active tab should have amber border tint");
    assert.ok(htmlSchool.includes("text-amber-700"), "School active tab should have amber text");

    const htmlUnit = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "unit",
        onScopeChange: () => {},
      })
    );
    assert.ok(htmlUnit.includes("border-blue-300"), "Unit active tab should have blue border tint");
    assert.ok(htmlUnit.includes("text-blue-700"), "Unit active tab should have blue text");

    const htmlMy = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "my",
        onScopeChange: () => {},
      })
    );
    assert.ok(htmlMy.includes("border-emerald-300"), "My active tab should have emerald border tint");
    assert.ok(htmlMy.includes("text-emerald-700"), "My active tab should have emerald text");
  });

  test("syncScopeToUrl updates browser search params", () => {
    let replacedUrl = "";
    const originalWindow = globalThis.window;

    try {
      (globalThis as unknown as { window: unknown }).window = {
        location: {
          href: "https://eoffice.qcet.edu.vn/workspace?tab=active&filter=all",
        },
        history: {
          state: null,
          replaceState: (_state: unknown, _title: string, url: string) => {
            replacedUrl = url;
          },
        },
      };

      syncScopeToUrl("unit");
      assert.ok(replacedUrl.includes("scope=unit"), "URL should be updated with scope=unit");
      assert.ok(replacedUrl.includes("tab=active"), "Existing query params should be preserved");
    } finally {
      (globalThis as unknown as { window: unknown }).window = originalWindow;
    }
  });

  test("renders refresh and create task buttons when handlers are provided", () => {
    const htmlWithActions = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
        onRefresh: () => {},
        onCreateTask: () => {},
      })
    );

    assert.ok(htmlWithActions.includes("Làm mới"), "Should display refresh button label");
    assert.ok(htmlWithActions.includes("Giao nhiệm vụ"), "Should display create task button label");

    const htmlWithoutActions = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
      })
    );

    assert.ok(!htmlWithoutActions.includes("Làm mới"), "Should omit refresh button when not provided");
    assert.ok(!htmlWithoutActions.includes("Giao nhiệm vụ"), "Should omit create task button when not provided");
  });

  test("disables refresh button when isRefreshing is true", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
        onRefresh: () => {},
        isRefreshing: true,
      })
    );

    assert.ok(html.includes("disabled"), "Refresh button should have disabled attribute");
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
        onRefresh: () => {},
        onCreateTask: () => {},
        badgeCounts: { school: 3, unit: 2, my: 1 },
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });

  test("accessibility roles and attributes on scope navigation tabs", () => {
    const html = renderToStaticMarkup(
      React.createElement(AdaptiveScopeHeader, {
        user: adminUser,
        activeScope: "school",
        onScopeChange: () => {},
        badgeCounts: { school: 3, unit: 2, my: 1 },
      })
    );

    assert.ok(html.includes('role="tablist"'), "Should have role=tablist for scope tabs container");
    assert.ok(html.includes('role="tab"'), "Each tab should have role=tab");
    assert.ok(html.includes('aria-selected="true"'), "Active tab must have aria-selected=true");
    assert.ok(html.includes('aria-selected="false"'), "Inactive tab must have aria-selected=false");
    assert.ok(html.includes('aria-label="Phạm vi công việc"'), "Tablist must have informative aria-label");
  });
});
