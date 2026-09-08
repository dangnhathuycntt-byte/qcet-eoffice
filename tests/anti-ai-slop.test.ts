import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Task 5: Anti-AI Slop & Visual Tells Eradication", () => {
  const button = fs.readFileSync(
    path.join(process.cwd(), "src/components/ui/button.tsx"),
    "utf8"
  );
  const portalHub = fs.readFileSync(
    path.join(process.cwd(), "src/components/portal/bento-portal-hub.tsx"),
    "utf8"
  );
  const navigation = fs.readFileSync(
    path.join(process.cwd(), "src/components/navigation.tsx"),
    "utf8"
  );
  const sidebar = fs.readFileSync(
    path.join(process.cwd(), "src/components/layout/app-sidebar.tsx"),
    "utf8"
  );
  const activityFeed = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/activity-feed-widget.tsx"),
    "utf8"
  );
  const portalPage = fs.readFileSync(
    path.join(process.cwd(), "src/app/portal/page.tsx"),
    "utf8"
  );
  const dashboardCascading = fs.readFileSync(
    path.join(process.cwd(), "src/components/dashboard/cascading-task-table.tsx"),
    "utf8"
  );
  const tasksCascading = fs.readFileSync(
    path.join(process.cwd(), "src/components/tasks/cascading-task-table.tsx"),
    "utf8"
  );

  it("button.tsx eliminates purple/blue gradient from premium variant", () => {
    assert.doesNotMatch(button, /from-blue-600\s+to-indigo-600/);
    assert.match(button, /bg-primary/);
  });

  it("bento-portal-hub.tsx removes fake Enterprise v1.2 badge, Sparkles, and pulse on status dot", () => {
    assert.doesNotMatch(portalHub, /Enterprise\s+v1\.2/);
    assert.doesNotMatch(portalHub, /Sparkles/);
    assert.match(portalHub, /2025-2026/);
    assert.doesNotMatch(portalHub, /bg-emerald-500 animate-pulse/);
  });

  it("navigation.tsx removes v1.2 Enterprise badge", () => {
    assert.doesNotMatch(navigation, /v1\.2\s+Enterprise/);
    assert.match(navigation, /2025-2026/);
  });

  it("app-sidebar.tsx removes unmotivated animate-pulse on connection status dot", () => {
    assert.doesNotMatch(sidebar, /bg-emerald-500[^\n]*?animate-pulse/);
  });

  it("activity-feed-widget.tsx uses administrative History icon instead of Zap and removes animate-ping", () => {
    assert.doesNotMatch(activityFeed, /<Zap/);
    assert.doesNotMatch(activityFeed, /animate-ping/);
    assert.match(activityFeed, /History/);
  });

  it("portal/page.tsx removes status indicator animate-pulse and scale micro-interactions", () => {
    assert.doesNotMatch(portalPage, /Màn hình Điều hành BGH[\s\S]*?animate-pulse/);
    assert.doesNotMatch(portalPage, /group-hover:scale-105 active:scale-95/);
  });

  it("dashboard/cascading-task-table.tsx removes urgent pulse and scale micro-interactions", () => {
    assert.doesNotMatch(dashboardCascading, /bg-rose-500 animate-pulse/);
    assert.doesNotMatch(dashboardCascading, /hover:scale-105 active:scale-95/);
  });

  it("tasks/cascading-task-table.tsx removes urgent pulse and scale micro-interactions", () => {
    assert.doesNotMatch(tasksCascading, /bg-rose-500 animate-pulse/);
    assert.doesNotMatch(tasksCascading, /hover:scale-105 active:scale-95/);
  });
});
