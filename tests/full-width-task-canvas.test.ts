import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { UnifiedAdaptiveWorkspace } from "../src/components/workspace/unified-adaptive-workspace";
import { TaskDetailSideSheet } from "../src/components/dashboard/task-detail-side-sheet";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { DEFAULT_DEMO_USERS } from "../src/lib/role-task-filter";

describe("Task 4: Full-Width Task Canvas & Progressive Disclosure Detail Surface", () => {
  const payload = getMockDashboardPayload();
  const tasks = payload.tasks;
  const adminUser = DEFAULT_DEMO_USERS[0];
  const staffUser = DEFAULT_DEMO_USERS[2];

  test("full-width task canvas renders at 100% width by default without rigid right-side column", () => {
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        onSelectTask: () => {},
      })
    );

    // Default view has 100% canvas container
    assert.ok(
      html.includes('data-slot="task-workspace-canvas"'),
      "Workspace must render 100% full-width canvas by default"
    );
    assert.ok(
      html.includes("w-full"),
      "Canvas container must have w-full styling"
    );

    // Rigid permanent split cockpit is NOT rendered by default
    assert.ok(
      !html.includes('data-slot="split-cockpit-layout"'),
      "Workspace must not render rigid split-cockpit column by default"
    );
  });

  test("TaskDetailSideSheet renders responsive side sheet with backdrop and close button", () => {
    const task = tasks[0];
    const html = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: adminUser,
        isOpen: true,
        onClose: () => {},
        onStatusChange: () => {},
      })
    );

    // Check container data-slot
    assert.ok(
      html.includes('data-slot="task-detail-side-sheet"'),
      "TaskDetailSideSheet must render data-slot='task-detail-side-sheet'"
    );

    // Backdrop
    assert.ok(
      html.includes('data-slot="side-sheet-backdrop"'),
      "Must render backdrop with overlay"
    );

    // Responsive dimensions (520-560px on desktop/tablet, full-width on mobile)
    assert.ok(
      html.includes("max-w-[560px]") || html.includes("w-[560px]") || html.includes("max-w-[520px]"),
      "Must use 520-560px width on desktop"
    );
    assert.ok(
      html.includes("w-full"),
      "Must use full width on mobile"
    );

    // Header and Close button
    assert.ok(
      html.includes('aria-label="Đóng bảng chi tiết"') || html.includes('aria-label="Đóng chi tiết nhiệm vụ"'),
      "Must include close button with accessible label"
    );

    // Task metadata
    assert.ok(
      html.includes(task.code ?? ""),
      "Must display task code"
    );
    assert.ok(
      html.includes(task.title),
      "Must display task title"
    );
  });

  test("TaskDetailSideSheet returns null when isOpen is false", () => {
    const task = tasks[0];
    const html = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: adminUser,
        isOpen: false,
        onClose: () => {},
      })
    );

    assert.equal(html, "", "Must render nothing when isOpen is false");
  });

  test("UnifiedAdaptiveWorkspace renders TaskDetail container when task is selected", () => {
    const selectedTask = tasks[0];
    const html = renderToStaticMarkup(
      React.createElement(UnifiedAdaptiveWorkspace, {
        user: adminUser,
        tasks,
        selectedTaskId: selectedTask.id,
        onSelectTask: () => {},
      })
    );

    assert.ok(
      html.includes('data-slot="in-canvas-task-detail"') || html.includes('data-slot="task-detail-side-sheet"'),
      "Must render TaskDetail container when selectedTaskId is provided"
    );
  });

  test("anti-slop and light-only compliance in task detail sheet", () => {
    const task = tasks[0];
    const html = renderToStaticMarkup(
      React.createElement(TaskDetailSideSheet, {
        task,
        currentUser: staffUser,
        isOpen: true,
        onClose: () => {},
      })
    );

    const emojiRegex = /[\u{1F300}-\u{1F9FF}]/u;
    assert.ok(!emojiRegex.test(html), "Markup must be free of decorative emojis");
    assert.ok(!html.includes("dark:"), "Markup must not contain dark: classes");
    assert.ok(html.includes("tabular-nums"), "Metrics/dates must use tabular-nums");
  });
});
