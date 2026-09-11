/**
 * Dashboard Composition Invariants Test Suite (Phase 0 / Regression Lock)
 * Target: Canonical Dashboard (src/components/dashboard/zones/dashboard-zone.tsx, src/app/page.tsx)
 * Invariants: DASH-01, DASH-02, DASH-04, DASH-06, DASH-07
 *
 * Requirements:
 * 1. Enforce exactly ONE metric strip on canonical dashboard
 * 2. Enforce exactly ONE primary action queue
 * 3. Prohibit SmartWorkbox on dashboard
 * 4. Prohibit ExecutiveActionCenter metric cards on dashboard
 * 5. Prohibit literal markers: "Verified Clear", "Hàng đợi điều hành thông suốt", "Operational Clear", "Ổn định tuyệt đối"
 * 6. Enforce department dashboard summary has at most 5 rows
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";

const DASHBOARD_ZONE_PATH = path.join(
  process.cwd(),
  "src/components/dashboard/zones/dashboard-zone.tsx"
);
const ACTION_CENTER_PATH = path.join(
  process.cwd(),
  "src/components/dashboard/executive-action-center.tsx"
);

// Prohibited pseudo-healthy and deceptive literal markers (DASH-06)
export const PROHIBITED_DASHBOARD_MARKERS = [
  "Verified Clear",
  "Hàng đợi điều hành thông suốt",
  "Operational Clear",
  "Ổn định tuyệt đối",
] as const;

/**
 * Validates that text content contains zero prohibited dashboard markers
 */
export function assertNoProhibitedDashboardMarkers(content: string, contextName = "content"): void {
  for (const marker of PROHIBITED_DASHBOARD_MARKERS) {
    assert.equal(
      content.includes(marker),
      false,
      `Prohibited literal marker detected in ${contextName}: "${marker}" violates DASH-06 (Empty data != healthy state)`
    );
  }
}

/**
 * Limits department health summaries to at most 5 rows for canonical dashboard display (DASH-07)
 */
export function getDepartmentDashboardSummary<T>(departments: readonly T[], maxRows = 5): T[] {
  if (maxRows > 5) {
    throw new Error(`DASH-07 violation: Dashboard context list must not exceed 5 items (requested ${maxRows})`);
  }
  return departments.slice(0, maxRows);
}

describe("Dashboard Composition Invariants (Phase 0)", () => {
  const dashboardSource = fs.readFileSync(DASHBOARD_ZONE_PATH, "utf8");
  const actionCenterSource = fs.readFileSync(ACTION_CENTER_PATH, "utf8");

  test("1. Enforce exactly ONE metric strip on canonical dashboard (DASH-01)", () => {
    // Metric strip components: ExecutiveStatStrip or AdaptiveMetricStrip
    const executiveStatStripMatches = dashboardSource.match(/<ExecutiveStatStrip\b/g) || [];
    const adaptiveMetricStripMatches = dashboardSource.match(/<AdaptiveMetricStrip\b/g) || [];
    const totalMetricStrips = executiveStatStripMatches.length + adaptiveMetricStripMatches.length;

    assert.equal(
      totalMetricStrips,
      1,
      `Canonical dashboard must contain exactly ONE metric strip component (found ${totalMetricStrips}: ${executiveStatStripMatches.length} ExecutiveStatStrip, ${adaptiveMetricStripMatches.length} AdaptiveMetricStrip)`
    );

    // Ensure no secondary metric strip container exists
    assert.equal(
      dashboardSource.includes("<SecondaryStatStrip"),
      false,
      "Canonical dashboard must not mount secondary stat strips"
    );
  });

  test("2. Enforce exactly ONE primary action queue on canonical dashboard (DASH-02)", () => {
    // Action queue components: ExecutiveActionCenter or ActionInboxQueue
    const actionCenterMatches = dashboardSource.match(/<ExecutiveActionCenter\b/g) || [];
    const actionInboxMatches = dashboardSource.match(/<ActionInboxQueue\b/g) || [];
    const totalActionQueues = actionCenterMatches.length + actionInboxMatches.length;

    assert.equal(
      totalActionQueues,
      1,
      `Canonical dashboard must contain exactly ONE primary action queue (found ${totalActionQueues})`
    );
  });

  test("3. Prohibit SmartWorkbox on canonical dashboard (DASH-08)", () => {
    // SmartWorkbox belongs strictly to operational task view (/tasks), never on dashboard
    assert.equal(
      dashboardSource.includes("<SmartWorkbox"),
      false,
      "dashboard-zone.tsx must NOT render <SmartWorkbox />"
    );
    assert.equal(
      dashboardSource.includes("SmartWorkbox"),
      false,
      "dashboard-zone.tsx must NOT import or reference SmartWorkbox"
    );
  });

  test("4. Prohibit ExecutiveActionCenter metric cards on dashboard (DASH-04)", () => {
    // Metric cards duplicate the macro metric strip; they must be suppressed on dashboard
    // In ExecutiveActionCenter, hideCards must default to true
    assert.match(
      actionCenterSource,
      /hideCards\s*=\s*true/,
      "ExecutiveActionCenter must default hideCards to true to avoid duplicate cards on dashboard"
    );

    // In dashboard-zone.tsx, ExecutiveActionCenter must not explicitly enable metric cards
    assert.equal(
      dashboardSource.includes("hideCards={false}"),
      false,
      "dashboard-zone.tsx must not pass hideCards={false} to ExecutiveActionCenter"
    );
  });

  test("5. Prohibit literal markers: Verified Clear, Hàng đợi điều hành thông suốt, Operational Clear, Ổn định tuyệt đối (DASH-06)", () => {
    // Canonical dashboard must not display deceptive or pseudo-healthy literal markers
    assertNoProhibitedDashboardMarkers(dashboardSource, "dashboard-zone.tsx");

    // The invariant validator itself must strictly reject any of the prohibited markers
    for (const marker of PROHIBITED_DASHBOARD_MARKERS) {
      assert.throws(
        () => assertNoProhibitedDashboardMarkers(`Tình trạng: ${marker}`, "test-string"),
        /Prohibited literal marker detected/,
        `Validator must throw when prohibited marker "${marker}" is detected`
      );
    }
  });

  test("6. Enforce department dashboard summary has at most 5 rows (DASH-07)", () => {
    // Canonical 17 departments in QCET
    const mock17Departments = Array.from({ length: 17 }, (_, i) => ({
      departmentId: `DEPT_${i + 1}`,
      departmentName: `Đơn vị ${i + 1}`,
      overdueTasksCount: 17 - i,
      averageProgressPercent: i * 5,
    }));

    const dashboardSummary = getDepartmentDashboardSummary(mock17Departments);
    assert.ok(
      dashboardSummary.length <= 5,
      `Department summary on dashboard must have at most 5 rows (got ${dashboardSummary.length})`
    );
    assert.equal(dashboardSummary.length, 5, "Should cap 17 departments to top 5 items");

    // Enforce that requesting > 5 items throws DASH-07 violation
    assert.throws(
      () => getDepartmentDashboardSummary(mock17Departments, 10),
      /DASH-07 violation/
    );

    // Small list (e.g. 3 departments) is preserved without expansion
    const smallList = mock17Departments.slice(0, 3);
    assert.equal(getDepartmentDashboardSummary(smallList).length, 3);
  });
});
