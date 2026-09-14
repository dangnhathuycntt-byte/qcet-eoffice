/**
 * Dashboard composition invariants.
 *
 * REPLACED (plan T10.1 / T10.2 / T10.5):
 *  - The old file defined a test-only `getDepartmentDashboardSummary` top-5 helper that
 *    never called production. It is replaced by the real production helper
 *    `summarizeDepartmentAttention` plus a real SSR render.
 *  - Empty-state claims are now asserted against rendered output, so this file and
 *    `executive-action-center-ui.test.ts` agree: deceptive health markers are FORBIDDEN
 *    everywhere, and the assertion actually covers the components that render them.
 *  - Section order follows the new SUMMARY → ACTION → CONTEXT structure (plan T06.2).
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ExecutiveActionCenter } from "../src/components/dashboard/executive-action-center";
import { DepartmentAttentionPreview } from "../src/components/dashboard/department-attention-preview";
import { summarizeDepartmentAttention } from "../src/lib/executive-matrix-aggregator";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";
import { DashboardSituationStrip, deriveSituationState } from "../src/components/dashboard/dashboard-situation-strip";
import type { DashboardStats } from "../src/types/dashboard";
import {
  FIXTURE_DEPARTMENTS,
  EXPECTED_DEPARTMENT_TOTALS,
  EXPECTED_ATTENTION_ORDER,
  EXPECTED_NOT_ATTENTION,
} from "./fixtures/workbench-queue-fixture";

const DASHBOARD_ZONE_PATH = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");
const ACTION_CENTER_PATH = path.join(process.cwd(), "src/components/dashboard/executive-action-center.tsx");

/** Deceptive pseudo-healthy markers (DASH-06). */
export const PROHIBITED_DASHBOARD_MARKERS = [
  "Verified Clear",
  "Hàng đợi điều hành thông suốt",
  "Operational Clear",
  "Ổn định tuyệt đối",
] as const;

function assertNoProhibitedMarkers(content: string, contextName = "content"): void {
  for (const marker of PROHIBITED_DASHBOARD_MARKERS) {
    assert.equal(
      content.includes(marker),
      false,
      `Prohibited marker "${marker}" in ${contextName} (empty data != healthy state)`
    );
  }
}

describe("Dashboard composition invariants", () => {
  const dashboardSource = fs.readFileSync(DASHBOARD_ZONE_PATH, "utf8");
  const actionCenterSource = fs.readFileSync(ACTION_CENTER_PATH, "utf8");

  test("1. Exactly one situation summary on the dashboard", () => {
    const situationStripMatches = dashboardSource.match(/<DashboardSituationStrip\b/g) || [];
    const adaptiveMetricStripMatches = dashboardSource.match(/<AdaptiveMetricStrip\b/g) || [];
    assert.equal(situationStripMatches.length + adaptiveMetricStripMatches.length, 1);
    assert.equal(dashboardSource.includes("<ExecutiveStatStrip"), false);
    assert.equal(dashboardSource.includes("<SecondaryStatStrip"), false);
  });

  test("2. Exactly one action queue per audience on the dashboard", () => {
    const actionCenterMatches = dashboardSource.match(/<ExecutiveActionCenter\b/g) || [];
    const personalWorkbenchMatches = dashboardSource.match(/<PersonalWorkbench\b/g) || [];
    assert.equal(actionCenterMatches.length, 1, "one executive queue");
    assert.equal(personalWorkbenchMatches.length, 1, "one non-exec queue");
    assert.equal(dashboardSource.includes("<ActionInboxQueue"), false);
  });

  test("3. No SmartWorkbox on the dashboard", () => {
    assert.equal(dashboardSource.includes("SmartWorkbox"), false);
  });

  test("4. Dashboard hides the large action KPI cards", () => {
    assert.match(actionCenterSource, /hideCards\s*=\s*true/);
    assert.equal(dashboardSource.includes("hideCards={false}"), false);
  });

  test("5. Prohibited health markers are forbidden and absent from rendered output", () => {
    assertNoProhibitedMarkers(dashboardSource, "dashboard-zone.tsx");
    assertNoProhibitedMarkers(actionCenterSource, "executive-action-center.tsx");

    // The contract is enforced on what actually renders, not only on source text.
    const emptyHtml = renderToStaticMarkup(
      React.createElement(ExecutiveActionCenter, {
        stats: {
          pendingSchoolApprovalCount: 0,
          blockedTasksCount: 0,
          overdueTasksCount: 0,
          strategicActiveCount: 0,
        },
        activeFilter: "ALL",
        onFilterChange: () => {},
        items: [],
      })
    );
    assertNoProhibitedMarkers(emptyHtml, "rendered empty queue");

    for (const marker of PROHIBITED_DASHBOARD_MARKERS) {
      assert.throws(() => assertNoProhibitedMarkers(`x ${marker}`, "self-test"), /Prohibited marker/);
    }
  });

  test("6. Department preview uses the production helper and caps at 5 rows", () => {
    const summary = summarizeDepartmentAttention(FIXTURE_DEPARTMENTS);
    assert.equal(summary.all.length, EXPECTED_DEPARTMENT_TOTALS.all);
    assert.equal(summary.attentionCount, EXPECTED_DEPARTMENT_TOTALS.attention);
    assert.deepEqual(summary.attention.map((d) => d.departmentId), EXPECTED_ATTENTION_ORDER);
    for (const id of EXPECTED_NOT_ATTENTION) {
      assert.equal(summary.attention.some((d) => d.departmentId === id), false, id);
    }

    const html = renderToStaticMarkup(
      React.createElement(DepartmentAttentionPreview, { departments: FIXTURE_DEPARTMENTS })
    );
    const rowCount = (html.match(/data-slot="department-attention-row"/g) || []).length;
    assert.equal(rowCount, EXPECTED_DEPARTMENT_TOTALS.preview, "preview renders exactly 5 rows");
  });

  test("7. Department preview empty state is scoped, not a system-wide health claim", () => {
    const html = renderToStaticMarkup(
      React.createElement(DepartmentAttentionPreview, { departments: [] })
    );
    assert.ok(
      html.includes("Không có đơn vị có việc quá hạn hoặc bị chặn trong phạm vi này"),
      "empty preview must describe only its own scope"
    );
  });

  test("8. Section order is ACTION → SITUATION → CONTEXT (Action-First)", () => {
    const actionPos = dashboardSource.indexOf('data-slot="section-action"');
    const situationPos = dashboardSource.indexOf('data-slot="section-situation"');
    const contextPos = dashboardSource.indexOf('data-slot="section-context"');

    assert.ok(situationPos > -1 && actionPos > -1 && contextPos > -1);
    assert.ok(actionPos < situationPos, "the action queue must sit BEFORE the situation summary");
    assert.ok(situationPos < contextPos, "the situation summary must sit BEFORE the context section");
  });

  test("9. Executive overdue surfaces even when personal stats show none", () => {
    const stats = { totalSchoolTasks: 10, totalStaffTasks: 0, overdueTasksCount: 0, averageSchoolProgressPercent: 80 } as import("@/types/dashboard").DashboardStats;
    const executiveStats = { overdueTasksCount: 3, blockedTasksCount: 0, pendingSchoolApprovalCount: 0, strategicActiveCount: 0 } as import("@/lib/executive-matrix-aggregator").ExecutiveActionStats;
    assert.equal(deriveSituationState(stats, executiveStats), "HAS_ISSUES");
    assert.equal(
      deriveSituationState(stats, { ...executiveStats, overdueTasksCount: 0, blockedTasksCount: 0 }),
      "HEALTHY"
    );
  });
});

/**
 * Dashboard empty-state contract (DASH-05 / DASH-06).
 *
 * An empty queue must say it is empty, never claim health; a load error is a DISTINCT
 * state from empty; and an empty scope renders a zero/NO_DATA summary, not a fabricated
 * healthy one.
 */
describe("Dashboard empty-state contract (production render)", () => {
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

  test("an empty scope renders the NO_DATA summary, not a healthy claim (DASH-05)", () => {
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
