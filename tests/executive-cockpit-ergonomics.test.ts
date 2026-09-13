import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveActionCenter } from "../src/components/dashboard/executive-action-center";

describe("Executive Cockpit Ergonomics Test", () => {
  const statStripPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-stat-strip.tsx"
  );
  const actionCenterPath = path.join(
    process.cwd(),
    "src/components/dashboard/executive-action-center.tsx"
  );

  test("ExecutiveStatStrip uses tabular-nums and >= 12px typography floors", () => {
    const content = fs.readFileSync(statStripPath, "utf-8");
    assert.match(content, /tabular-nums/, "Stat values must use tabular-nums");
    assert.match(
      content,
      /text-2xl sm:text-3xl font-bold/,
      "Stat values must be text-2xl/3xl font-bold"
    );
    assert.match(
      content,
      /text-xs sm:text-sm font-semibold text-foreground\/90/,
      "Card title must be text-xs sm:text-sm font-semibold text-foreground/90"
    );
    assert.match(
      content,
      /text-xs sm:text-\[13px\] font-medium text-muted-foreground/,
      "Subtext must be text-xs sm:text-[13px] font-medium text-muted-foreground"
    );
    assert.match(
      content,
      /text-xs font-semibold/,
      "Badge must be text-xs font-semibold"
    );
    assert.doesNotMatch(
      content,
      /text-\[8px\]|text-\[9px\]|text-\[10px\]|text-\[11px\]/,
      "Stat strip must not contain text below 12px"
    );
  });

  // Requirement (plan T10.3 / T06.4): assert the RENDERED row ergonomics — the action
  // button keeps its 44px touch target and the row uses aligned columns — instead of
  // locking individual spacing class strings.
  test("ExecutiveActionCenter rows keep an accessible action button and >=12px text", () => {
    const content = fs.readFileSync(actionCenterPath, "utf-8");
    assert.doesNotMatch(
      content,
      /text-\[8px\]|text-\[9px\]|text-\[10px\]|text-\[11px\]/,
      "Action center must not contain text below 12px"
    );

    const html = renderToStaticMarkup(
      React.createElement(ExecutiveActionCenter, {
        stats: { pendingSchoolApprovalCount: 0, blockedTasksCount: 0, overdueTasksCount: 0, strategicActiveCount: 0 },
        activeFilter: "ALL",
        onFilterChange: () => {},
        items: [
          {
            id: "act-1",
            taskId: "task-1",
            title: "Nhiệm vụ quá hạn cần xử lý",
            dueDate: "2026-09-10",
            filterType: "BLOCKED_OVERDUE",
            reasons: ["OVERDUE"],
            primaryReason: "OVERDUE",
            actionLabel: "Xem chi tiết",
          },
        ],
      })
    );

    assert.ok(html.includes('data-slot="action-item-row"'), "row must render");
    assert.match(
      html,
      /min-h-\[44px\] sm:min-h-\[36px\]/,
      "the row action button must meet the touch target"
    );
    // Overdue rows use a neutral action to open the file, never a destructive button.
    assert.equal(/variant="destructive"/.test(html), false, "no destructive button on a row");
  });
});
