/**
 * Dashboard Composition Invariants Test Suite (Phase 0 / Regression Lock)
 * Target: Canonical Dashboard (src/components/dashboard/zones/dashboard-zone.tsx, src/app/page.tsx)
 * Invariants: DASH-01, DASH-02, DASH-04, DASH-06, DASH-07, DASH-09 (ACTION→SITUATION→CONTEXT order)
 *
 * Requirements:
 * 1. Enforce exactly ONE situation summary on canonical dashboard (DashboardSituationStrip)
 * 2. Enforce exactly ONE primary action queue
 * 3. Prohibit SmartWorkbox on dashboard
 * 4. Prohibit ExecutiveActionCenter metric cards on dashboard
 * 5. Prohibit literal markers: "Verified Clear", "Hàng đợi điều hành thông suốt", "Operational Clear", "Ổn định tuyệt đối"
 * 6. Enforce department dashboard summary has at most 5 rows
 * 7. (DASH-09) Enforce ACTION section appears before SITUATION, SITUATION before CONTEXT
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { deriveSituationState } from "../src/components/dashboard/dashboard-situation-strip";

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

  test("1. Enforce exactly ONE situation summary on canonical dashboard (DASH-01)", () => {
    // Situation summary component: DashboardSituationStrip (replaces legacy ExecutiveStatStrip on dashboard)
    const situationStripMatches = dashboardSource.match(/<DashboardSituationStrip\b/g) || [];
    const adaptiveMetricStripMatches = dashboardSource.match(/<AdaptiveMetricStrip\b/g) || [];
    const totalSituationSurfaces = situationStripMatches.length + adaptiveMetricStripMatches.length;

    assert.equal(
      totalSituationSurfaces,
      1,
      `Canonical dashboard must contain exactly ONE situation summary (found ${totalSituationSurfaces}: ${situationStripMatches.length} DashboardSituationStrip, ${adaptiveMetricStripMatches.length} AdaptiveMetricStrip)`
    );

    // ExecutiveStatStrip must not appear in dashboard-zone (it's a KPI card grid — too heavy for dashboard SITUATION)
    assert.equal(
      dashboardSource.includes("<ExecutiveStatStrip"),
      false,
      "dashboard-zone.tsx must NOT render <ExecutiveStatStrip /> — use DashboardSituationStrip for the compact SITUATION section"
    );

    // Ensure no secondary metric strip container exists
    assert.equal(
      dashboardSource.includes("<SecondaryStatStrip"),
      false,
      "Canonical dashboard must not mount secondary stat strips"
    );
  });

  test("2. Enforce exactly ONE primary action queue on canonical dashboard (DASH-02)", () => {
    // Action queue components: ExecutiveActionCenter (for execs) or PersonalWorkbench with attentionOnly (for others)
    const actionCenterMatches = dashboardSource.match(/<ExecutiveActionCenter\b/g) || [];
    const actionInboxMatches = dashboardSource.match(/<ActionInboxQueue\b/g) || [];
    // PersonalWorkbench rendered with attentionOnly in section-action is the non-exec action surface
    const personalWorkbenchMatches = dashboardSource.match(/<PersonalWorkbench\b/g) || [];
    const totalActionQueues = actionCenterMatches.length + actionInboxMatches.length + personalWorkbenchMatches.length;

    assert.equal(
      totalActionQueues,
      2,
      `Canonical dashboard must contain exactly ONE executive action queue + ONE non-exec action queue (PersonalWorkbench), found ${totalActionQueues} (ExecCenter: ${actionCenterMatches.length}, ActionInbox: ${actionInboxMatches.length}, PersonalWorkbench: ${personalWorkbenchMatches.length}). They render exclusively based on isExecutive.`
    );

    // Both must live inside section-action, not duplicated outside
    const sectionActionContent = dashboardSource.slice(
      dashboardSource.indexOf('data-slot="section-action"'),
      dashboardSource.indexOf('data-slot="section-situation"')
    );
    assert.ok(
      sectionActionContent.includes("<ExecutiveActionCenter"),
      "ExecutiveActionCenter must be inside section-action"
    );
    assert.ok(
      sectionActionContent.includes("<PersonalWorkbench"),
      "PersonalWorkbench (non-exec action surface) must be inside section-action"
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

  test("7. Enforce ACTION → SITUATION → CONTEXT section order on canonical dashboard (DASH-09)", () => {
    const actionPos = dashboardSource.indexOf('data-slot="section-action"');
    const situationPos = dashboardSource.indexOf('data-slot="section-situation"');
    const contextPos = dashboardSource.indexOf('data-slot="section-context"');

    assert.ok(actionPos > -1, 'dashboard-zone.tsx must have data-slot="section-action"');
    assert.ok(situationPos > -1, 'dashboard-zone.tsx must have data-slot="section-situation"');
    assert.ok(contextPos > -1, 'dashboard-zone.tsx must have data-slot="section-context"');
    assert.ok(
      actionPos < situationPos,
      `DASH-09: ACTION section (pos ${actionPos}) must appear before SITUATION section (pos ${situationPos})`
    );
    assert.ok(
      situationPos < contextPos,
      `DASH-09: SITUATION section (pos ${situationPos}) must appear before CONTEXT section (pos ${contextPos})`
    );

    // DashboardSituationStrip must be inside section-situation
    const situationSectionStart = dashboardSource.indexOf('data-slot="section-situation"');
    const contextSectionStart = dashboardSource.indexOf('data-slot="section-context"');
    const situationSectionContent = dashboardSource.slice(situationSectionStart, contextSectionStart);
    assert.ok(
      situationSectionContent.includes("<DashboardSituationStrip"),
      "DashboardSituationStrip must reside inside section-situation"
    );
  });

  test("8. Executive overdue display: HAS_ISSUES when stats.overdueTasksCount=0 but executiveStats.overdueTasksCount>0 (DASH-Task5)", () => {
    // stats has no personal overdue tasks
    const stats = {
      totalSchoolTasks: 10,
      totalStaffTasks: 0,
      overdueTasksCount: 0,
      averageSchoolProgressPercent: 80,
    } as import("@/types/dashboard").DashboardStats;

    // executive layer has overdue tasks that must surface
    const executiveStats = {
      overdueTasksCount: 3,
      blockedTasksCount: 0,
      pendingSchoolApprovalCount: 0,
      strategicActiveCount: 0,
    } as import("@/lib/executive-matrix-aggregator").ExecutiveActionStats;

    const state = deriveSituationState(stats, executiveStats);
    assert.equal(
      state,
      "HAS_ISSUES",
      "deriveSituationState must return HAS_ISSUES when executiveStats.overdueTasksCount>0 even if stats.overdueTasksCount===0"
    );

    // Also verify that zero executiveStats yields HEALTHY (baseline sanity)
    const healthyState = deriveSituationState(stats, {
      ...executiveStats,
      overdueTasksCount: 0,
      blockedTasksCount: 0,
    });
    assert.equal(
      healthyState,
      "HEALTHY",
      "deriveSituationState must return HEALTHY when both overdue counts are 0"
    );
  });
});
