import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AdaptiveScopeHeader } from "../src/components/workspace/components/adaptive-scope-header";
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
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
