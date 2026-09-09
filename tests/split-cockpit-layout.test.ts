import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("UnifiedAdaptiveWorkspace Split-Cockpit Layout & ActiveFilterBreadcrumb Integration", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0];

  test("renders responsive split-cockpit layout structure on desktop", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    // Split-cockpit container
    assert.ok(html.includes('data-slot="split-cockpit-layout"'), "Must render split-cockpit-layout container");
    assert.ok(html.includes("lg:grid-cols-12"), "Must use responsive 12-column grid for desktop split cockpit");

    // Primary work table panel
    assert.ok(html.includes('data-slot="split-cockpit-primary"'), "Must render primary work table panel");
    assert.ok(
      html.includes("lg:col-span-7") || html.includes("lg:col-span-8"),
      "Primary work panel must occupy 7 or 8 columns on desktop (approx 58-66%)"
    );

    // Contextual side panel
    assert.ok(html.includes('data-slot="split-cockpit-side-panel"'), "Must render contextual side panel");
    assert.ok(
      html.includes("lg:col-span-5") || html.includes("lg:col-span-4"),
      "Contextual side panel must occupy 4 or 5 columns on desktop (approx 33-42%)"
    );
  });

  test("contextual side panel houses UniversalActionQueue and AdaptiveMetricStrip", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    // Both UniversalActionQueue and AdaptiveMetricStrip should be present in markup
    assert.ok(html.includes('data-slot="universal-action-queue"'));
    assert.ok(html.includes('data-slot="adaptive-metric-strip"'));

    // Check that side panel section houses them
    const sidePanelIndex = html.indexOf('data-slot="split-cockpit-side-panel"');
    const primaryIndex = html.indexOf('data-slot="split-cockpit-primary"');
    const metricIndex = html.indexOf('data-slot="adaptive-metric-strip"');
    const queueIndex = html.indexOf('data-slot="universal-action-queue"');

    assert.ok(sidePanelIndex !== -1, "Must render side panel");
    assert.ok(primaryIndex !== -1, "Must render primary panel");
    assert.ok(metricIndex > sidePanelIndex, "AdaptiveMetricStrip must be housed in side panel");
    assert.ok(queueIndex > sidePanelIndex, "UniversalActionQueue must be housed in side panel");
  });

  test("integrates ActiveFilterBreadcrumb inside primary panel when filters are active", () => {
    const htmlWithFilter = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        selectedDepartment: "CNTT",
        onSelectTask: () => {},
      })
    );

    assert.ok(
      htmlWithFilter.includes('data-slot="active-filter-breadcrumb"'),
      "ActiveFilterBreadcrumb must be rendered when department filter is active"
    );
    assert.ok(htmlWithFilter.includes("CNTT"), "Active department filter must be displayed in breadcrumb");
  });

  test("hides ActiveFilterBreadcrumb when no filter is active", () => {
    const htmlNoFilter = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        selectedDepartment: "ALL",
        onSelectTask: () => {},
      })
    );

    assert.ok(
      !htmlNoFilter.includes('data-slot="active-filter-breadcrumb"'),
      "ActiveFilterBreadcrumb must be hidden when all filters are default/ALL"
    );
  });

  test("zero emojis and light-only compliance", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        selectedDepartment: "CNTT",
        onSelectTask: () => {},
      })
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Split cockpit markup must be 100% free of emojis");
    assert.ok(!html.includes("dark:"), "Must not introduce dark: variant classes");
  });
});
