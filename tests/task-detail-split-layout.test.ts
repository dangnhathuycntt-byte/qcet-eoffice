import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskDetailSplitLayout } from "../src/components/tasks/detail/task-detail-split-layout";

test("inspector receives percentage sizing rather than a 28px strip", () => {
  const html = renderToStaticMarkup(React.createElement(TaskDetailSplitLayout, {
    inspectorOpen: true,
    onToggleInspector: () => {},
    children: "Main content",
    inspector: "Properties",
  }));
  assert.match(html, /id="main"[^>]*style="[^"]*flex-basis:72%/);
  assert.match(html, /id="inspector"[^>]*style="[^"]*flex-basis:28%/);
  assert.match(html, /role="separator"/);
});

test("closed inspector leaves the full width for content", () => {
  const html = renderToStaticMarkup(React.createElement(TaskDetailSplitLayout, {
    inspectorOpen: false,
    onToggleInspector: () => {},
    children: "Main content",
    inspector: "Properties",
  }));
  assert.match(html, /id="main"[^>]*style="[^"]*flex-basis:100%/);
  assert.doesNotMatch(html, /id="inspector"|role="separator"/);
});
