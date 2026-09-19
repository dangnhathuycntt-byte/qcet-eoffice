import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskDetailSplitLayout } from "../src/components/tasks/detail/task-detail-split-layout";

test("open inspector renders fixed-width sidebar alongside main content", () => {
  const html = renderToStaticMarkup(React.createElement(TaskDetailSplitLayout, {
    inspectorOpen: true,
    onToggleInspector: () => {},
    children: "Main content",
    inspector: "Properties",
  }));
  // Inspector uses fixed w-[300px] with spacing (no vertical divider line)
  assert.ok(html.includes("Main content"), "Main content must render");
  assert.ok(html.includes("Properties"), "Properties panel must render when open");
  assert.ok(html.includes("w-[300px]"), "Inspector must use fixed 300px width");
  assert.ok(!html.includes("w-px"), "No vertical divider line between content and inspector");
  assert.ok(html.includes("pl-8"), "Inspector uses left padding for spacing");
});

test("closed inspector leaves the full width for content", () => {
  const html = renderToStaticMarkup(React.createElement(TaskDetailSplitLayout, {
    inspectorOpen: false,
    onToggleInspector: () => {},
    children: "Main content",
    inspector: "Properties",
  }));
  assert.ok(html.includes("Main content"), "Main content must render");
  assert.ok(!html.includes("Properties"), "Properties panel must not render when closed");
  assert.ok(!html.includes("w-[300px]"), "No fixed sidebar width when inspector is closed");
});
