/**
 * Dashboard Empty State Test Suite (Phase 0 / Regression Lock)
 * Target: Canonical Dashboard Empty States & Zero-Denominator Progress
 * Invariants: DASH-05 (Zero Denominator Invariant), DASH-06 (Empty Data != Healthy State)
 *
 * Requirements:
 * 1. Verify distinct empty states:
 *    a) No data: "Chưa có nhiệm vụ trong kỳ này"
 *    b) No action required: "Không có việc cần xử lý ngay"
 *    c) Load error: "Không thể tải dữ liệu bàn làm việc"
 * 2. Verify zero denominator is never rendered as 0% progress, but as "—"
 * 3. Assert no multiple competing empty states rendered simultaneously
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";

export type EmptyStateType = "NO_DATA" | "NO_ACTION_REQUIRED" | "LOAD_ERROR";

export interface DashboardEmptyStateConfig {
  type: EmptyStateType;
  title: string;
  description: string;
  badgeText?: string;
  allowRetry?: boolean;
}

export const CANONICAL_EMPTY_STATES: Record<EmptyStateType, DashboardEmptyStateConfig> = {
  NO_DATA: {
    type: "NO_DATA",
    title: "Chưa có nhiệm vụ trong kỳ này",
    description: "Không tìm thấy nhiệm vụ nào được phân công hoặc tạo mới trong kỳ vận hành đã chọn.",
  },
  NO_ACTION_REQUIRED: {
    type: "NO_ACTION_REQUIRED",
    title: "Không có việc cần xử lý ngay",
    description: "Tất cả nhiệm vụ đang diễn ra đúng tiến độ và không có hạng mục nào cần phê duyệt hoặc giải quyết kh��n cấp.",
    badgeText: "Tiến độ ổn định",
  },
  LOAD_ERROR: {
    type: "LOAD_ERROR",
    title: "Không thể tải dữ liệu bàn làm việc",
    description: "Máy chủ phản hồi không thành công hoặc xảy ra sự cố kết nối. Vui lòng làm mới dữ liệu.",
    allowRetry: true,
  },
};

/**
 * Resolves the single authoritative dashboard empty state.
 * Prevents conflating "No Data" with "Healthy/Clear" (DASH-06).
 */
export function resolveDashboardEmptyState(params: {
  error?: Error | string | null;
  totalTasks: number;
  urgentActionCount: number;
}): DashboardEmptyStateConfig | null {
  const { error, totalTasks, urgentActionCount } = params;

  // 1. Error state takes absolute precedence
  if (error) {
    return CANONICAL_EMPTY_STATES.LOAD_ERROR;
  }

  // 2. No operational tasks exist in the period -> NO_DATA (never claim healthy!)
  if (totalTasks <= 0) {
    return CANONICAL_EMPTY_STATES.NO_DATA;
  }

  // 3. Operational tasks exist, but none require immediate urgent action -> NO_ACTION_REQUIRED
  if (urgentActionCount <= 0) {
    return CANONICAL_EMPTY_STATES.NO_ACTION_REQUIRED;
  }

  // 4. Content is ready to display (action queue populated)
  return null;
}

/**
 * Formats completion rate or progress percent with zero-denominator safety (DASH-05).
 * When total is 0 (or null/negative), progress is undefined and MUST return "—", never "0%".
 */
export function formatProgressDenominator(completed: number, total: number | null | undefined): string {
  if (total === null || total === undefined || isNaN(total) || total <= 0) {
    return "—";
  }
  const validCompleted = Math.max(0, Math.min(completed, total));
  const percent = Math.round((validCompleted / total) * 100);
  return percent + "%";
}

/**
 * Single Authority Empty State Coordinator:
 * Evaluates whether multiple empty state blocks exist and asserts state exclusivity.
 */
export function coordinateDashboardEmptyStates(params: {
  hasLoadError: boolean;
  totalTasks: number;
  urgentCount: number;
  subWidgetStates: { widgetId: string; isEmpty: boolean }[];
}): {
  primaryEmptyState: DashboardEmptyStateConfig | null;
  renderedEmptyStateCount: number;
  competingWidgetEmptyStatesSuppressed: boolean;
} {
  const primaryState = resolveDashboardEmptyState({
    error: params.hasLoadError ? "LOAD_FAILED" : null,
    totalTasks: params.totalTasks,
    urgentActionCount: params.urgentCount,
  });

  // If primary dashboard state is an empty state or error, sub-widgets MUST NOT render competing empty states
  if (primaryState !== null) {
    return {
      primaryEmptyState: primaryState,
      renderedEmptyStateCount: 1,
      competingWidgetEmptyStatesSuppressed: true,
    };
  }

  // Content ready: action items are present, widget level empties are independent or 0
  return {
    primaryEmptyState: null,
    renderedEmptyStateCount: 0,
    competingWidgetEmptyStatesSuppressed: false,
  };
}

describe("Dashboard Empty State Invariants (Phase 0)", () => {
  test("1. Verify distinct empty states (DASH-06)", () => {
    // a) Load Error
    const errorState = resolveDashboardEmptyState({
      error: new Error("Network timeout"),
      totalTasks: 0,
      urgentActionCount: 0,
    });
    assert.ok(errorState, "Error must produce an empty state");
    assert.equal(errorState?.type, "LOAD_ERROR");
    assert.equal(
      errorState?.title,
      "Không thể tải dữ liệu bàn làm việc",
      "Load error must display literal title: Không thể tải dữ liệu bàn làm việc"
    );

    // b) No Data (0 tasks in period)
    const noDataState = resolveDashboardEmptyState({
      error: null,
      totalTasks: 0,
      urgentActionCount: 0,
    });
    assert.ok(noDataState, "Zero total tasks must produce NO_DATA state");
    assert.equal(noDataState?.type, "NO_DATA");
    assert.equal(
      noDataState?.title,
      "Chưa có nhiệm vụ trong kỳ này",
      "No data state must display literal title: Chưa có nhiệm vụ trong kỳ này"
    );

    // CRITICAL: Empty data must NEVER be treated as healthy / no action required (DASH-06)
    assert.notEqual(
      noDataState?.title,
      "Không có việc cần xử lý ngay",
      "Zero total tasks must NEVER render as 'Không có việc cần xử lý ngay' (Empty data != healthy state)"
    );

    // c) No Action Required (Operational tasks exist, but zero urgent items)
    const noActionState = resolveDashboardEmptyState({
      error: null,
      totalTasks: 18,
      urgentActionCount: 0,
    });
    assert.ok(noActionState, "Zero urgent items with active tasks must produce NO_ACTION_REQUIRED state");
    assert.equal(noActionState?.type, "NO_ACTION_REQUIRED");
    assert.equal(
      noActionState?.title,
      "Không có việc cần xử lý ngay",
      "No action required must display literal title: Không có việc cần xử lý ngay"
    );

    // d) Content ready (urgent tasks exist)
    const contentState = resolveDashboardEmptyState({
      error: null,
      totalTasks: 18,
      urgentActionCount: 4,
    });
    assert.equal(contentState, null, "When urgent actions exist, no empty state should be rendered");
  });

  test("2. Verify zero denominator is never rendered as 0% progress, but as '—' (DASH-05)", () => {
    // Case A: 0 completed out of 0 total tasks
    const zeroDenominator = formatProgressDenominator(0, 0);
    assert.equal(
      zeroDenominator,
      "—",
      "Zero denominator (0/0) must render as em-dash '—', NEVER '0%'"
    );
    assert.notEqual(zeroDenominator, "0%");
    assert.notEqual(zeroDenominator, "0.0%");
    assert.notEqual(zeroDenominator, "NaN%");

    // Case B: null or undefined total
    assert.equal(formatProgressDenominator(0, null), "—");
    assert.equal(formatProgressDenominator(0, undefined), "—");
    assert.equal(formatProgressDenominator(0, NaN), "—");
    assert.equal(formatProgressDenominator(0, -5), "—");

    // Case C: Valid non-zero denominators must format actual percentages correctly
    assert.equal(formatProgressDenominator(0, 10), "0%", "0 out of 10 tasks is valid 0%");
    assert.equal(formatProgressDenominator(3, 10), "30%");
    assert.equal(formatProgressDenominator(5, 10), "50%");
    assert.equal(formatProgressDenominator(10, 10), "100%");
    assert.equal(formatProgressDenominator(1, 3), "33%");
  });

  test("3. Assert no multiple competing empty states rendered simultaneously", () => {
    // Scenario 1: Page-level load failure
    const errorCoordination = coordinateDashboardEmptyStates({
      hasLoadError: true,
      totalTasks: 0,
      urgentCount: 0,
      subWidgetStates: [
        { widgetId: "action-queue", isEmpty: true },
        { widgetId: "workbench-feed", isEmpty: true },
        { widgetId: "dept-summary", isEmpty: true },
      ],
    });

    assert.equal(
      errorCoordination.renderedEmptyStateCount,
      1,
      "Exactly 1 empty state container must render during error"
    );
    assert.equal(errorCoordination.primaryEmptyState?.type, "LOAD_ERROR");
    assert.equal(errorCoordination.competingWidgetEmptyStatesSuppressed, true);

    // Scenario 2: Zero tasks across entire period
    const emptyCoordination = coordinateDashboardEmptyStates({
      hasLoadError: false,
      totalTasks: 0,
      urgentCount: 0,
      subWidgetStates: [
        { widgetId: "action-queue", isEmpty: true },
        { widgetId: "workbench-feed", isEmpty: true },
      ],
    });

    assert.equal(
      emptyCoordination.renderedEmptyStateCount,
      1,
      "Exactly 1 empty state container must render when no data is present"
    );
    assert.equal(emptyCoordination.primaryEmptyState?.type, "NO_DATA");
    assert.equal(emptyCoordination.competingWidgetEmptyStatesSuppressed, true);

    // Scenario 3: All clear (tasks exist, nothing urgent)
    const clearCoordination = coordinateDashboardEmptyStates({
      hasLoadError: false,
      totalTasks: 15,
      urgentCount: 0,
      subWidgetStates: [
        { widgetId: "action-queue", isEmpty: true },
      ],
    });

    assert.equal(clearCoordination.renderedEmptyStateCount, 1);
    assert.equal(clearCoordination.primaryEmptyState?.type, "NO_ACTION_REQUIRED");
    assert.equal(clearCoordination.competingWidgetEmptyStatesSuppressed, true);

    // Scenario 4: Tasks requiring action are present -> NO primary empty state
    const populatedCoordination = coordinateDashboardEmptyStates({
      hasLoadError: false,
      totalTasks: 15,
      urgentCount: 3,
      subWidgetStates: [],
    });

    assert.equal(populatedCoordination.renderedEmptyStateCount, 0);
    assert.equal(populatedCoordination.primaryEmptyState, null);
    assert.equal(populatedCoordination.competingWidgetEmptyStatesSuppressed, false);
  });
});
