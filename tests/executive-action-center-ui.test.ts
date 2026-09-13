import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveActionCenter } from "../src/components/dashboard/executive-action-center";
import {
  extractExecutiveActionItems,
  type ExecutiveActionItem,
  type ExecutiveActionStats,
} from "../src/lib/executive-matrix-aggregator";
import {
  buildLargeFixture,
  FIXTURE_REFERENCE_DATE,
} from "./fixtures/workbench-queue-fixture";

const EMPTY_STATS: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 0,
  blockedTasksCount: 0,
  overdueTasksCount: 0,
  strategicActiveCount: 0,
};

function item(n: number): ExecutiveActionItem {
  return {
    id: `act-${n}`,
    taskId: `task-${n}`,
    title: `Nhiệm vụ số ${n} cần xử lý`,
    dueDate: `2026-09-1${n % 10}`,
    filterType: "BLOCKED_OVERDUE",
    reasons: ["OVERDUE"],
    primaryReason: "OVERDUE",
    actionLabel: "Xem chi tiết",
  };
}

const renderCenter = (over: Partial<Parameters<typeof ExecutiveActionCenter>[0]> = {}) =>
  renderToStaticMarkup(
    React.createElement(ExecutiveActionCenter, {
      stats: EMPTY_STATS,
      activeFilter: "ALL",
      onFilterChange: () => {},
      items: [],
      ...over,
    })
  );

describe("ExecutiveActionCenter UI & Empty State Suite", () => {
  const actionCenterPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-action-center.tsx"
  );
  const dashboardZonePath = path.join(
    process.cwd(),
    "src/components/dashboard/zones/dashboard-zone.tsx"
  );
  const useTaskFiltersPath = path.join(
    process.cwd(),
    "src/hooks/use-task-filters.ts"
  );

  test("ExecutiveActionCenter contains zero hardcoded DEFAULT_ACTION_ITEMS", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS ="),
      false,
      "executive-action-center.tsx must not define DEFAULT_ACTION_ITEMS"
    );
    assert.equal(
      content.includes("DEFAULT_ACTION_ITEMS"),
      false,
      "executive-action-center.tsx must not reference DEFAULT_ACTION_ITEMS anywhere"
    );
    assert.equal(
      content.includes("action-pending-1"),
      false,
      "Mock action items must be completely removed"
    );
  });

  // Requirement (plan T10.2 / F13): the empty-state contract is unified and asserted
  // against the RENDERED output, not a source-string grep. An empty queue must say it
  // is empty and must never claim health.
  test("ExecutiveActionCenter renders an honest empty state (no false healthy claim)", () => {
    const html = renderCenter({ items: [] });
    assert.ok(
      html.includes("Không có nhiệm vụ cần xử lý"),
      "must render the honest empty heading"
    );
    for (const claim of ["Verified Clear", "thông suốt", "Operational Clear", "ổn định"]) {
      assert.equal(html.includes(claim), false, `must not claim "${claim}"`);
    }
  });

  test("ExecutiveActionCenter adheres to Light-Only standard (no dark: variants)", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    const darkVariantRegex = /\bdark:/;
    assert.equal(
      darkVariantRegex.test(content),
      false,
      "executive-action-center.tsx must not contain any dark: Tailwind classes"
    );
  });

  test("ExecutiveActionCenter contains zero emojis", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      assert.ok(
        !emojiRegex.test(lines[i]),
        `Emoji found at line ${i + 1} in executive-action-center.tsx: ${lines[i].trim()}`
      );
    }
  });

  test("DashboardZone wires real executiveActionItems and onAction to ExecutiveActionCenter", () => {
    const content = fs.readFileSync(dashboardZonePath, "utf8");
    assert.ok(
      /items=\{executiveActionItems(\s*\?\?\s*\[\])?\}/.test(content),
      "DashboardZone must pass executiveActionItems to ExecutiveActionCenter"
    );
    assert.ok(
      content.includes("onAction={"),
      "DashboardZone must connect onAction; the queue opens the row by id, it does not approve"
    );
  });

  test("use-task-filters derives executiveActionItems directly from real tasks", () => {
    const content = fs.readFileSync(useTaskFiltersPath, "utf8");
    assert.ok(
      content.includes("extractExecutiveActionItems"),
      "use-task-filters must use extractExecutiveActionItems"
    );
    assert.ok(
      content.includes("executiveActionItems"),
      "use-task-filters must export executiveActionItems"
    );
  });

  // Requirement (plan T10.3 / T06.5): replace class-string assertions (max-h, expand
  // labels) with what the user actually sees — a 5-row preview, full counts, a working
  // drill-down, and NO expand-all control.
  test("ExecutiveActionCenter shows a 5-row preview with full counts and a working drill-down", () => {
    // Scale case: the 311-row fixture must render exactly 5 preview rows.
    const large = buildLargeFixture();
    const items = extractExecutiveActionItems(large.tasks, FIXTURE_REFERENCE_DATE);
    const html = renderCenter({ items });

    const rowCount = (html.match(/data-slot="action-item-row"/g) || []).length;
    assert.equal(rowCount, 5, `preview must render exactly 5 rows (got ${rowCount})`);

    // The total count is the full filtered set, not the preview length.
    assert.ok(html.includes("311 nhiệm vụ"), "header must show the full count");
    assert.ok(html.includes("Xem tất cả 311 nhiệm vụ"), "drill-down must name the full count");

    // The drill-down target is a query key the /tasks parser really consumes.
    const href = html.match(/href="([^"]*\/tasks\?[^"]*)"/)?.[1] ?? "";
    assert.ok(href.startsWith("/tasks?"), `drill-down must target /tasks (got "${href}")`);
    assert.equal(/[?&]filter=/.test(href), false, "must not use the dead `filter` key");

    // No expand-all control and no nested scroll region.
    assert.equal(html.includes("Xem thêm"), false, "no expand-all control");
    assert.equal(html.includes("Thu gọn danh sách"), false, "no expand-all control");
    assert.equal(html.includes("max-h-[460px]"), false, "no nested scroll region");
  });

  test("ExecutiveActionCenter keeps anti-slop and touch-target guarantees", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    assert.equal(content.includes("activeTopBar"), false, "Top accent lines must be removed");
    assert.equal(
      content.includes("size-7 rounded-md bg-muted/60"),
      false,
      "Icon box wrapper must be removed"
    );
    assert.equal(
      content.includes("uppercase tracking-wider"),
      false,
      "Heading must be sentence case"
    );
    assert.ok(content.includes("INITIAL_LIMIT"), "must define the 5-row preview limit");
    assert.ok(
      content.includes("min-h-[44px] sm:min-h-[36px]"),
      "Action buttons must meet the touch target"
    );
    const html = renderCenter({ items: [item(1)] });
    assert.ok(html.includes('type="button"'), "lens filters must be real buttons");
  });

  test("ExecutiveActionCenter defaults hideCards=true to purge redundant secondary action cards", () => {
    const content = fs.readFileSync(actionCenterPath, "utf8");
    assert.ok(
      content.includes("hideCards = true"),
      "ExecutiveActionCenter must set hideCards = true as default parameter"
    );
    // The queue heading must describe the real set it shows, without a vague
    // "trọng tâm" framing that implied health/priority it cannot prove.
    const html = renderCenter();
    assert.ok(
      html.includes("Hàng đợi điều hành"),
      "Action queue must carry a clear operational heading"
    );
  });
});
