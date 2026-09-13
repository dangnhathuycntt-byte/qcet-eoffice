/**
 * Dashboard empty-state contract (DASH-05 / DASH-06).
 *
 * REPLACED (plan T10.2): the previous file defined a local `resolveDashboardEmptyState`
 * fake and imported NO production code, so it asserted nothing about what the screen
 * actually renders. This version renders the real components with `renderToStaticMarkup`
 * and asserts the honest empty / error / populated states.
 *
 * Requirement now covered:
 *  - DASH-06: an empty queue must say it is empty, never claim health ("thông suốt",
 *    "Verified Clear", "ổn định").
 *  - A load error is a DISTINCT state from empty.
 *  - DASH-05: an empty scope renders a zero/NO_DATA summary, not a fabricated healthy one.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveActionCenter } from "../src/components/dashboard/executive-action-center";
import { DashboardSituationStrip } from "../src/components/dashboard/dashboard-situation-strip";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";
import type { DashboardStats } from "../src/types/dashboard";

const EMPTY_EXEC_STATS: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 0,
  blockedTasksCount: 0,
  overdueTasksCount: 0,
  strategicActiveCount: 0,
};

const EMPTY_STATS: DashboardStats = {
  totalSchoolTasks: 0,
  totalStaffTasks: 0,
  overdueTasksCount: 0,
  averageSchoolProgressPercent: 0,
} as DashboardStats;

const render = (node: React.ReactElement) => renderToStaticMarkup(node);

describe("Dashboard empty-state contract (production render)", () => {
  test("an empty action queue describes the empty set and never claims health", () => {
    const html = render(
      React.createElement(ExecutiveActionCenter, {
        stats: EMPTY_EXEC_STATS,
        activeFilter: "ALL",
        onFilterChange: () => {},
        items: [],
      })
    );

    assert.ok(
      html.includes("Không có nhiệm vụ cần xử lý"),
      "empty queue must state that there is nothing to handle"
    );
    for (const claim of ["Verified Clear", "thông suốt", "ổn định", "Operational Clear"]) {
      assert.equal(
        html.includes(claim),
        false,
        `empty queue must NOT claim "${claim}" (DASH-06)`
      );
    }
  });

  test("a populated queue renders rows, not the empty state", () => {
    const html = render(
      React.createElement(ExecutiveActionCenter, {
        stats: { ...EMPTY_EXEC_STATS, blockedTasksCount: 1 },
        activeFilter: "ALL",
        onFilterChange: () => {},
        items: [
          {
            id: "act-1",
            taskId: "task-1",
            title: "Nhiệm vụ bị chặn cần xử lý",
            dueDate: "2026-09-15",
            filterType: "BLOCKED_OVERDUE",
            reasons: ["BLOCKED"],
            primaryReason: "BLOCKED",
            actionLabel: "Xem chi tiết",
          },
        ],
      })
    );

    assert.ok(html.includes("Nhiệm vụ bị chặn cần xử lý"), "row title must render");
    assert.equal(
      html.includes("Không có nhiệm vụ cần xử lý"),
      false,
      "the empty state must not render alongside rows"
    );
  });

  test("a load error is a distinct state, not the empty state", () => {
    const html = render(
      React.createElement(ExecutiveActionCenter, {
        stats: EMPTY_EXEC_STATS,
        activeFilter: "ALL",
        onFilterChange: () => {},
        items: [],
        errorMessage: "Không thể tải dữ liệu bàn làm việc",
      })
    );

    assert.ok(html.includes('data-slot="action-queue-error"'), "error slot must render");
    assert.ok(html.includes("Không thể tải dữ liệu bàn làm việc"), "error message must show");
    assert.equal(
      html.includes("Không có nhiệm vụ cần xử lý"),
      false,
      "an error must not be presented as an empty/healthy queue"
    );
  });
});

describe("Zero-denominator summary (DASH-05)", () => {
  test("an empty scope renders the NO_DATA summary, not a healthy claim", () => {
    const html = render(
      React.createElement(DashboardSituationStrip, {
        stats: EMPTY_STATS,
        isExecutive: true,
      })
    );
    assert.ok(html.includes('data-situation-state="NO_DATA"'), "empty scope must be NO_DATA");
    assert.ok(html.includes("Chưa có dữ liệu kỳ vận hành"), "must describe the empty set");
    assert.equal(html.includes("0% tiến độ"), false, "must not fabricate a 0% progress metric");
  });
});
