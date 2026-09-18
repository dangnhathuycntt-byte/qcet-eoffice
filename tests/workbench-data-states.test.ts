/**
 * W-A / plan T09.4 — the workbench load / error / empty / success states must be
 * REACHABLE from the production dashboard context.
 *
 * The gap this locks: `ExecutiveActionCenter` already had an `errorMessage` branch, but
 * nothing ever passed it, so the error state could never appear in the real app — the old
 * test only proved the component *can* render an error when a test injects the prop.
 *
 * These tests render the real production consumers:
 *  - `DashboardZone` reads the error/loading from `DashboardDataContext` and forwards it to
 *    `ExecutiveActionCenter`. If that forwarding is removed, the error/loading branch
 *    disappears and these tests fail.
 *  - `WorkbenchMobileFeed` consumes the same context states and must never render "0" or a
 *    healthy "no work" message before a successful load.
 *
 * SSR note: `DashboardZone` renders layout children that call `useRouter`/`useSearchParams`
 * from `next/navigation`, so it must be rendered inside the real Next router contexts.
 * That pattern already exists in `tests/workspace-query.test.ts`; it is the only way to
 * render this production tree in the SSR harness.
 */

import { describe, test } from "node:test";
import assert from "node:assert/strict";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";
import { ExecutiveActionCenter } from "../src/components/dashboard/executive-action-center";
import { WorkbenchMobileFeed } from "../src/components/dashboard/workbench-mobile-feed";
import {
  DashboardDataContext,
  DashboardActionsContext,
  DashboardModalContext,
  DashboardNavContext,
  type DashboardDataContextValue,
  type DashboardActionsContextValue,
  type DashboardModalContextValue,
  type DashboardNavContextValue,
} from "../src/components/dashboard/dashboard-context";
import type { DashboardStats } from "../src/types/dashboard";
import type { ExecutiveActionStats } from "../src/lib/executive-matrix-aggregator";

const EMPTY_EXEC_STATS: ExecutiveActionStats = {
  pendingSchoolApprovalCount: 0,
  blockedTasksCount: 0,
  overdueTasksCount: 0,
  strategicActiveCount: 0,
};

const EMPTY_STATS: DashboardStats = {
  totalSchoolTasks: 0,
  schoolTasksInProgress: 0,
  schoolTasksCompleted: 0,
  totalStaffTasks: 0,
  staffTasksInProgress: 0,
  staffTasksCompleted: 0,
  needsReviewTasksCount: 0,
  overdueTasksCount: 0,
  averageSchoolProgressPercent: 0,
  totalTasks: 0,
  inProgressTasks: 0,
  completedTasks: 0,
  overdueTasks: 0,
};

const noop = () => {};

function makeDataValue(
  overrides: Partial<DashboardDataContextValue>
): DashboardDataContextValue {
  return {
    tasks: [],
    stats: EMPTY_STATS,
    upcoming: [],
    activities: [],
    filteredTasks: [],
    scopedBaseTasks: [],
    monthScopedBaseTasks: [],
    priorOverdueBacklog: [],
    monthlyTaskCounts: {},
    selectedMonthPeriod: null,
    displayedStats: EMPTY_STATS,
    user: null,
    effectiveManagerUser: null,
    isExecutive: true,
    isManager: false,
    isStaff: false,
    isUnitView: false,
    isSchoolView: true,
    selectedDepartment: "ALL",
    selectedAcademicMonth: "ALL",
    activeWorkbox: "ALL",
    executiveFilter: "ALL",
    searchQuery: "",
    selectedPriority: "ALL",
    selectedCategory: "ALL",
    departmentHealth: [],
    executiveStats: EMPTY_EXEC_STATS,
    executiveActionItems: [],
    roleUpcoming: [],
    delegations: [],
    delegationDeptCode: "",
    isRefreshing: false,
    isLoading: false,
    errorMessage: null,
    ...overrides,
  };
}

const ACTIONS_VALUE: DashboardActionsContextValue = {
  handleDepartmentChange: noop,
  handleAcademicMonthChange: noop,
  setActiveWorkbox: noop as DashboardActionsContextValue["setActiveWorkbox"],
  setExecutiveFilter: noop as DashboardActionsContextValue["setExecutiveFilter"],
  setSearchQuery: noop as DashboardActionsContextValue["setSearchQuery"],
  setSelectedPriority: noop as DashboardActionsContextValue["setSelectedPriority"],
  setSelectedCategory: noop as DashboardActionsContextValue["setSelectedCategory"],
  handleResetFilters: noop,
  handleStatusChange: noop,
  handleSubmitDeliverable: async () => {},
  handleReviewAction: async () => {},
  handleCreateTask: noop,
  handleManualRefresh: async () => {},
  handleSaveDelegation: noop,
  handleRevokeDelegation: noop,
  handleSelectUpcoming: () => undefined,
};

const MODAL_VALUE: DashboardModalContextValue = {
  selectedTask: null,
  isCreateModalOpen: false,
  initialTaskLevel: "TRUONG",
  isDelegationModalOpen: false,
  delegationDeptCode: "",
  taskDetailNotice: null,
  dismissTaskDetailNotice: noop,
  openTaskDetail: noop,
  openTaskDetailById: noop,
  closeTaskDetail: noop,
  openCreateModal: noop,
  closeCreateModal: noop,
  openDelegationModal: noop,
  closeDelegationModal: noop,
};

const NAV_VALUE: DashboardNavContextValue = {
  activeZone: "dashboard",
  scope: "SCHOOL_TASKS",
  viewMode: "table",
  isStaffExpanded: false,
  useAdvancedToolbar: false,
  handleZoneChange: noop,
  handleScopeChange: noop,
  handleViewModeChange: noop,
  handleToggleStaffExpanded: noop,
  setIsStaffExpanded: noop,
  setUseAdvancedToolbar: noop,
};

const MOCK_ROUTER = {
  push: noop,
  replace: noop,
  prefetch: noop,
  back: noop,
  forward: noop,
  refresh: noop,
};

function renderZone(data: DashboardDataContextValue): string {
  return renderToStaticMarkup(
    React.createElement(
      AppRouterContext.Provider,
      { value: MOCK_ROUTER },
      React.createElement(
        PathnameContext.Provider,
        { value: "/" },
        React.createElement(
          SearchParamsContext.Provider,
          { value: new URLSearchParams("") },
          React.createElement(
            DashboardNavContext.Provider,
            { value: NAV_VALUE },
            React.createElement(
              DashboardDataContext.Provider,
              { value: data },
              React.createElement(
                DashboardActionsContext.Provider,
                { value: ACTIONS_VALUE },
                React.createElement(
                  DashboardModalContext.Provider,
                  { value: MODAL_VALUE },
                  React.createElement(
                    "div",
                    null,
                    React.createElement(DashboardZone),
                    React.createElement(ExecutiveActionCenter, {
                      stats: data.executiveStats || EMPTY_EXEC_STATS,
                      activeFilter: data.executiveFilter,
                      onFilterChange: noop,
                      items: data.executiveActionItems,
                      isLoading: data.isLoading,
                      errorMessage: data.errorMessage,
                    })
                  )
                )
              )
            )
          )
        )
      )
    )
  );
}

function renderMobile(
  data: DashboardDataContextValue,
  props: Record<string, unknown> = {}
): string {
  return renderToStaticMarkup(
    React.createElement(
      DashboardDataContext.Provider,
      { value: data },
      React.createElement(WorkbenchMobileFeed, props)
    )
  );
}

describe("W-A — the dashboard error state is reachable from the production context", () => {
  test("DashboardZone forwards a context load error into the action queue (not the empty state)", () => {
    const html = renderZone(
      makeDataValue({ errorMessage: "Không thể tải dữ liệu bàn làm việc" })
    );

    assert.ok(
      html.includes('data-slot="action-queue-error"'),
      "the real zone must surface the context error — the branch must not be dead"
    );
    assert.ok(
      html.includes("Không thể tải dữ liệu bàn làm việc"),
      "the server error message must be shown"
    );
    assert.equal(
      html.includes("Không có nhiệm vụ cần xử lý"),
      false,
      "an error must never be presented as the empty/healthy queue"
    );
  });

  test("DashboardZone forwards the context loading state (distinct from empty)", () => {
    const html = renderZone(makeDataValue({ isLoading: true }));

    assert.ok(
      html.includes('data-slot="action-queue-loading"'),
      "first-load must render the loading state, not the empty state"
    );
    assert.equal(
      html.includes("Không có nhiệm vụ cần xử lý"),
      false,
      "loading must not be presented as an empty queue"
    );
  });

  test("a successful empty load still renders the honest empty state", () => {
    const html = renderZone(makeDataValue({ isLoading: false, errorMessage: null }));

    assert.ok(
      html.includes('data-slot="action-center-empty-state"'),
      "loaded + empty must render the empty state"
    );
    assert.equal(
      html.includes('data-slot="action-queue-error"'),
      false,
      "no error when the load succeeded"
    );
    assert.equal(
      html.includes('data-slot="action-queue-loading"'),
      false,
      "no loading once the load completed"
    );
  });
});

describe("W-A / T09.4 — mobile consumes loading / error before claiming empty", () => {
  test("a context load error renders the error state, not zeros or a healthy queue", () => {
    const html = renderMobile(
      makeDataValue({ errorMessage: "Không thể tải dữ liệu bàn làm việc" })
    );

    assert.ok(
      html.includes('data-slot="mobile-workbench-error"'),
      "mobile must render the error state from context"
    );
    assert.equal(
      html.includes("Tiến độ thông suốt, không có việc tồn đọng khẩn cấp"),
      false,
      "an error must never claim health"
    );
    assert.equal(
      html.includes("việc cấp bách"),
      false,
      "mobile must not render a fabricated 0 urgent-count before a successful load"
    );
  });

  test("first-load renders the loading state, not zeros or a healthy queue", () => {
    const html = renderMobile(makeDataValue({ isLoading: true }));

    assert.ok(
      html.includes('data-slot="mobile-workbench-loading"'),
      "mobile must render the loading state from context"
    );
    assert.equal(
      html.includes("Tiến độ thông suốt, không có việc tồn đọng khẩn cấp"),
      false,
      "loading must not claim health"
    );
    assert.equal(
      html.includes("0/0 nhiệm vụ"),
      false,
      "loading must not render a zero task count"
    );
  });

  test("a successful empty load still renders the honest empty state", () => {
    const html = renderMobile(makeDataValue({ isLoading: false, errorMessage: null }));

    assert.ok(
      html.includes("Tiến độ thông suốt, không có việc tồn đọng khẩn cấp"),
      "a successful empty load may state there is nothing urgent"
    );
    assert.equal(
      html.includes('data-slot="mobile-workbench-error"'),
      false,
      "no error when the load succeeded"
    );
    assert.equal(
      html.includes('data-slot="mobile-workbench-loading"'),
      false,
      "no loading once the load completed"
    );
  });

  test("explicit prop data bypasses the context gate (standalone usage stays intact)", () => {
    const html = renderMobile(makeDataValue({ isLoading: true }), {
      isExecutive: true,
      stats: EMPTY_STATS,
      tasks: [],
      referenceDate: "2026-09-09",
    });

    assert.equal(
      html.includes('data-slot="mobile-workbench-loading"'),
      false,
      "a caller supplying its own data must not be gated by the provider's load state"
    );
  });
});
