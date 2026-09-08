import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("UnifiedAdaptiveWorkspace Entrypoint Component", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0];
  const staffUser = DEFAULT_DEMO_USERS[2];

  test("renders unified canvas with scope header and metric strip", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("data-slot=\"unified-adaptive-workspace\""));
    assert.ok(html.includes("data-slot=\"adaptive-scope-header\""));
    assert.ok(html.includes("data-slot=\"adaptive-metric-strip\""));
  });

  test("defaults to 'my' scope for staff users", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: staffUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("data-active-scope=\"my\""));
  });

  test("respects forcedScope and initialScope when specified", () => {
    const htmlForced = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: staffUser,
        tasks,
        forcedScope: "school",
        onSelectTask: () => {},
      })
    );
    assert.ok(htmlForced.includes("data-active-scope=\"school\""));

    const htmlInitial = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        initialScope: "unit",
        onSelectTask: () => {},
      })
    );
    assert.ok(htmlInitial.includes("data-active-scope=\"unit\""));
  });

  test("renders contextual banner when contextTitle and contextBadge are provided", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        contextTitle: "Khoang chỉ huy điều hành",
        contextBadge: "Ban Giám Hiệu (BGH)",
        onSelectTask: () => {},
      })
    );

    assert.ok(html.includes("data-slot=\"workspace-context-banner\""));
    assert.ok(html.includes("Khoang chỉ huy điều hành"));
    assert.ok(html.includes("Ban Giám Hiệu (BGH)"));
  });

  test("zero emojis in rendered markup", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );
    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be 100% free of emojis");
  });
});
