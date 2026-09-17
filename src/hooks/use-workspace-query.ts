"use client";

import * as React from "react";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { SearchParamsContext, PathnameContext } from "next/dist/shared/lib/hooks-client-context.shared-runtime";
import {
  parseWorkspaceQuery,
  serializeWorkspaceQuery,
  type WorkspaceFilterState,
  type ParseWorkspaceQueryOptions,
  type WorkspaceScopeType,
  type TaskLifecycleStatus,
  type TaskViewMode,
  type CalendarViewMode,
  type UserAttentionType,
} from "@/lib/workspace-query";

export interface UseWorkspaceQueryOptions extends ParseWorkspaceQueryOptions {
  omitDefaultScope?: boolean;
  unitParamKey?: "dept" | "unit";
}

export interface NavigationOptions {
  replace?: boolean;
  scroll?: boolean;
  shallow?: boolean;
}

export interface SetScopeOptions extends NavigationOptions {
  dept?: string;
  unit?: string;
}

export interface ResetFiltersOptions extends NavigationOptions {
  preserveScope?: boolean;
  preservePeriod?: boolean;
  preserveView?: boolean;
}

export interface UseWorkspaceQueryReturn {
  queryState: WorkspaceFilterState;
  setScope: (scope: WorkspaceScopeType, options?: SetScopeOptions) => void;
  setUnit: (unitId?: string | null, options?: NavigationOptions) => void;
  setDept: (dept?: string | null, options?: NavigationOptions) => void;
  setPeriod: (
    period: { month?: number | "ALL"; date?: string | null },
    options?: NavigationOptions
  ) => void;
  setStatus: (status: TaskLifecycleStatus | "ALL", options?: NavigationOptions) => void;
  setPriority: (priority?: string | null, options?: NavigationOptions) => void;
  setCategory: (category?: string | null, options?: NavigationOptions) => void;
  setDeadline: (deadline?: string | null, options?: NavigationOptions) => void;
  setAttention: (
    attention?: UserAttentionType | "ALL" | null,
    options?: NavigationOptions
  ) => void;
  setView: (view: TaskViewMode | CalendarViewMode, options?: NavigationOptions) => void;
  setSearchQuery: (q: string, options?: NavigationOptions) => void;
  setSelectedTask: (taskId?: string | null, options?: NavigationOptions) => void;
  resetFilters: (options?: ResetFiltersOptions) => void;
  updateWorkspaceQuery: (
    updater:
      | Partial<WorkspaceFilterState>
      | ((prev: WorkspaceFilterState) => Partial<WorkspaceFilterState>),
    options?: NavigationOptions
  ) => void;
}

/**
 * useWorkspaceQuery - Canonical Unified Workspace Query Hook
 *
 * Synchronizes workspace filter state with URL parameters via Next.js router and native history API.
 * Preserves unrelated query parameters across updates.
 * Supports shallow routing and browser back/forward (popstate) history.
 *
 * Provides:
 * - queryState: parsed, normalized WorkspaceFilterState
 * - setScope: update visual scope ('school' | 'unit' | 'my')
 * - setUnit / setDept: update organizational unit/department
 * - setPeriod: update month and/or date
 * - setStatus: update lifecycle status (migrates legacy 'tab')
 * - setView: update presentation view mode
 * - setSearchQuery: update search query needle
 * - setSelectedTask: update deep-linked task ID
 * - resetFilters: clear filters while preserving unrelated query params
 * - updateWorkspaceQuery: atomic multi-attribute update helper
 */
export function useWorkspaceQuery(
  options?: UseWorkspaceQueryOptions
): UseWorkspaceQueryReturn {
  const router = React.useContext(AppRouterContext);
  const rawSearchParams = React.useContext(SearchParamsContext);
  const rawPathname = React.useContext(PathnameContext);

  const searchParams = React.useMemo(() => {
    if (rawSearchParams) return new URLSearchParams(rawSearchParams);
    if (typeof window !== "undefined") return new URLSearchParams(window.location.search);
    return new URLSearchParams();
  }, [rawSearchParams]);

  const pathname = rawPathname ?? (typeof window !== "undefined" ? window.location.pathname : "");

  const isCalendar = options?.isCalendar ?? false;
  const defaultView = options?.defaultView;
  const defaultScope = options?.defaultScope;
  const defaultMonth = options?.defaultMonth;
  const omitDefaultScope = options?.omitDefaultScope;
  const unitParamKey = options?.unitParamKey;

  // Track popstate events for browser back/forward history synchronization
  const [popstateCount, setPopstateCount] = React.useState(0);

  React.useEffect(() => {
    const handlePopState = () => {
      setPopstateCount((c) => c + 1);
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // Memoized parsing of active search parameters, reacting to Next.js searchParams or browser popstate
  const queryState = React.useMemo(() => {
    const effectiveParams =
      typeof window !== "undefined" && popstateCount > 0
        ? new URLSearchParams(window.location.search)
        : searchParams;
    return parseWorkspaceQuery(effectiveParams, {
      isCalendar,
      defaultView,
      defaultScope,
      defaultMonth,
    });
  }, [searchParams, isCalendar, defaultView, defaultScope, defaultMonth, popstateCount]);

  // Event handlers (including debounced search) must merge into the live URL,
  // not the render snapshot captured before another filter or scope changed.
  const readCurrentState = React.useCallback(() => {
    if (typeof window === "undefined" || !window.location) return queryState;
    return parseWorkspaceQuery(window.location.search || "", {
      isCalendar,
      defaultView,
      defaultScope,
      defaultMonth,
    });
  }, [queryState, isCalendar, defaultView, defaultScope, defaultMonth]);

  // Internal navigation dispatcher with unrelated param preservation and shallow routing support
  const dispatchUpdate = React.useCallback(
    (
      nextState: Partial<WorkspaceFilterState>,
      navOptions?: NavigationOptions
    ) => {
      const effectiveSearchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : searchParams;

      const nextParams = serializeWorkspaceQuery(nextState, {
        isCalendar,
        omitDefaultScope,
        unitParamKey: unitParamKey ?? nextState._unitParamKey,
        preserveParams: effectiveSearchParams || undefined,
        defaultMonth,
      });

      const queryStr = nextParams.toString();
      const targetUrl = queryStr ? `${pathname}?${queryStr}` : pathname;
      const shouldReplace = navOptions?.replace ?? true;

      // Do not add duplicate history entry if targetUrl matches current browser URL
      if (!shouldReplace && typeof window !== "undefined") {
        const currentTarget = `${window.location.pathname}${window.location.search || ""}`;
        if (targetUrl === currentTarget) {
          return;
        }
      }

      // Native shallow routing via history API if requested
      if (navOptions?.shallow && typeof window !== "undefined") {
        if (shouldReplace) {
          window.history.replaceState(null, "", targetUrl);
        } else {
          window.history.pushState(null, "", targetUrl);
        }
        if (typeof window.dispatchEvent === "function") {
          window.dispatchEvent(new Event("popstate"));
        } else {
          setPopstateCount((c) => c + 1);
        }
        return;
      }

      // Next.js App Router navigation (default)
      if (shouldReplace) {
        if (router) {
          router.replace(targetUrl, { scroll: navOptions?.scroll ?? false });
        } else if (typeof window !== "undefined") {
          window.history.replaceState(null, "", targetUrl);
          setPopstateCount((c) => c + 1);
        }
      } else {
        if (router) {
          router.push(targetUrl, { scroll: navOptions?.scroll ?? false });
        } else if (typeof window !== "undefined") {
          window.history.pushState(null, "", targetUrl);
          setPopstateCount((c) => c + 1);
        }
      }
    },
    [
      router,
      searchParams,
      pathname,
      isCalendar,
      omitDefaultScope,
      unitParamKey,
      popstateCount,
    ]
  );

  const setScope = React.useCallback(
    (scope: WorkspaceScopeType, navOptions?: SetScopeOptions) => {
      const queryState = readCurrentState();
      const isScopeChanging = scope !== queryState.scope;
      const patch: Partial<WorkspaceFilterState> = {
        ...queryState,
        scope,
      };

      if (isScopeChanging) {
        // Clear sticky filters when transitioning between scopes (Personal -> Unit -> School)
        patch.status = "ALL";
        patch.priority = undefined;
        patch.category = undefined;
        patch.deadline = undefined;
        patch.attention = undefined;
        patch.q = undefined;
        patch.query = undefined;
      }

      const specifiedUnit = navOptions?.unit || navOptions?.dept;
      if (scope === "unit") {
        if (specifiedUnit) {
          patch.dept = specifiedUnit;
          patch.unit = specifiedUnit;
          patch.unitId = specifiedUnit;
          if (navOptions?.unit && !navOptions?.dept) {
            patch._unitParamKey = "unit";
          } else if (unitParamKey) {
            patch._unitParamKey = unitParamKey;
          }
        }
      } else {
        // Clear department when switching away from unit scope unless explicitly specified
        if (!specifiedUnit) {
          patch.dept = undefined;
          patch.unit = undefined;
          patch.unitId = undefined;
        }
      }

      dispatchUpdate(patch, { shallow: true, replace: true, ...navOptions });
    },
    [readCurrentState, dispatchUpdate, unitParamKey]
  );

  const setUnit = React.useCallback(
    (unitId?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const trimmed = unitId ? unitId.trim() : undefined;
      const clean =
        trimmed && trimmed !== "ALL" && trimmed !== "all" && trimmed.length > 0
          ? trimmed
          : undefined;
      // Khi chọn đơn vị cụ thể (clean): chuyển sang 'unit'. Khi xóa đơn vị (clean === undefined): giữ nguyên scope hiện tại
      const targetScope = clean ? "unit" : queryState.scope;
      dispatchUpdate(
        {
          ...queryState,
          scope: targetScope,
          dept: clean,
          unitId: clean,
          unit: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setDept = React.useCallback(
    (dept?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const trimmed = dept ? dept.trim() : undefined;
      const clean =
        trimmed && trimmed !== "ALL" && trimmed !== "all" && trimmed.length > 0
          ? trimmed
          : undefined;
      // Khi chọn đơn vị cụ thể (clean): chuyển sang 'unit'. Khi xóa đơn vị (clean === undefined): giữ nguyên scope hiện tại
      const targetScope = clean ? "unit" : queryState.scope;
      dispatchUpdate(
        {
          ...queryState,
          scope: targetScope,
          dept: clean,
          unitId: clean,
          unit: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setPeriod = React.useCallback(
    (
      period: { month?: number | "ALL"; date?: string | null },
      navOptions?: NavigationOptions
    ) => {
      const queryState = readCurrentState();
      const patch: Partial<WorkspaceFilterState> = { ...queryState };

      if (period.month !== undefined) {
        patch.month = period.month;
      }

      if (period.date !== undefined) {
        patch.date = period.date ? period.date : undefined;
      }

      dispatchUpdate(patch, navOptions);
    },
    [readCurrentState, dispatchUpdate]
  );

  const setStatus = React.useCallback(
    (status: TaskLifecycleStatus | "ALL", navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      dispatchUpdate(
        {
          ...queryState,
          status,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setPriority = React.useCallback(
    (priority?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const clean = priority && priority !== "ALL" ? priority.trim() : undefined;
      dispatchUpdate(
        {
          ...queryState,
          priority: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setCategory = React.useCallback(
    (category?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const clean = category && category !== "ALL" ? category.trim() : undefined;
      dispatchUpdate(
        {
          ...queryState,
          category: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setDeadline = React.useCallback(
    (deadline?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const clean = deadline && deadline !== "ALL" ? deadline.trim() : undefined;
      dispatchUpdate(
        {
          ...queryState,
          deadline: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setAttention = React.useCallback(
    (
      attention?: UserAttentionType | "ALL" | null,
      navOptions?: NavigationOptions
    ) => {
      const queryState = readCurrentState();
      const clean =
        attention && attention !== "ALL"
          ? attention
          : undefined;
      dispatchUpdate(
        {
          ...queryState,
          attention: clean,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setView = React.useCallback(
    (view: TaskViewMode | CalendarViewMode, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      dispatchUpdate(
        {
          ...queryState,
          view,
        },
        { shallow: true, replace: true, ...navOptions }
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setSearchQuery = React.useCallback(
    (q: string, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const trimmed = q.trim();
      dispatchUpdate(
        {
          ...queryState,
          q: trimmed.length > 0 ? trimmed : undefined,
          query: trimmed.length > 0 ? trimmed : undefined,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const setSelectedTask = React.useCallback(
    (taskId?: string | null, navOptions?: NavigationOptions) => {
      const queryState = readCurrentState();
      const trimmed = taskId ? taskId.trim() : undefined;
      dispatchUpdate(
        {
          ...queryState,
          taskId: trimmed && trimmed.length > 0 ? trimmed : undefined,
          selectedTaskId: trimmed && trimmed.length > 0 ? trimmed : undefined,
        },
        navOptions
      );
    },
    [readCurrentState, dispatchUpdate]
  );

  const resetFilters = React.useCallback(
    (navOptions?: ResetFiltersOptions) => {
      const queryState = readCurrentState();
      const preserveScope = navOptions?.preserveScope ?? false;
      const preservePeriod = navOptions?.preservePeriod ?? false;
      const preserveView = navOptions?.preserveView ?? false;

      const resetState: Partial<WorkspaceFilterState> = {
        scope: preserveScope ? queryState.scope : (defaultScope ?? "school"),
        dept: preserveScope ? queryState.dept : undefined,
        unit: preserveScope ? queryState.unit : undefined,
        unitId: preserveScope ? queryState.unitId : undefined,
        month: preservePeriod ? queryState.month : (defaultMonth ?? "ALL"),
        date: preservePeriod ? queryState.date : undefined,
        status: "ALL",
        priority: undefined,
        category: undefined,
        deadline: undefined,
        attention: undefined,
        view: preserveView
          ? (queryState.view || defaultView || (isCalendar ? "month" : "table"))
          : (defaultView ?? (isCalendar ? "month" : "table")),
        q: undefined,
        query: undefined,
        taskId: undefined,
        selectedTaskId: undefined,
      };

      dispatchUpdate(resetState, navOptions);
    },
    [readCurrentState, dispatchUpdate, isCalendar, defaultScope, defaultView, defaultMonth]
  );

  const updateWorkspaceQuery = React.useCallback(
    (
      updater:
        | Partial<WorkspaceFilterState>
        | ((prev: WorkspaceFilterState) => Partial<WorkspaceFilterState>),
      navOptions?: NavigationOptions
    ) => {
      const queryState = readCurrentState();
      const rawPatch = typeof updater === "function" ? updater(queryState) : updater;
      const patch: Partial<WorkspaceFilterState> = { ...rawPatch };

      // Synchronize taskId and selectedTaskId alias pair
      if ("taskId" in patch || "selectedTaskId" in patch) {
        let syncedTaskId: string | undefined;
        const taskIdChanged = "taskId" in patch && patch.taskId !== queryState.taskId;
        const selectedTaskIdChanged =
          "selectedTaskId" in patch && patch.selectedTaskId !== queryState.selectedTaskId;

        if (selectedTaskIdChanged && !taskIdChanged) {
          syncedTaskId = patch.selectedTaskId;
        } else if (taskIdChanged && !selectedTaskIdChanged) {
          syncedTaskId = patch.taskId;
        } else {
          syncedTaskId =
            "taskId" in patch && patch.taskId !== undefined
              ? patch.taskId
              : patch.selectedTaskId;
        }
        patch.taskId = syncedTaskId;
        patch.selectedTaskId = syncedTaskId;
      }

      // Synchronize q and query alias pair
      if ("q" in patch || "query" in patch) {
        let syncedQ: string | undefined;
        const qChanged = "q" in patch && patch.q !== queryState.q;
        const queryChanged =
          "query" in patch && patch.query !== queryState.query;

        if (queryChanged && !qChanged) {
          syncedQ = patch.query;
        } else if (qChanged && !queryChanged) {
          syncedQ = patch.q;
        } else {
          syncedQ =
            "q" in patch && patch.q !== undefined
              ? patch.q
              : patch.query;
        }
        patch.q = syncedQ;
        patch.query = syncedQ;
      }

      // Synchronize dept, unit, and unitId alias tuple
      if ("dept" in patch || "unit" in patch || "unitId" in patch) {
        let syncedUnit: string | undefined;
        const deptChanged = "dept" in patch && patch.dept !== queryState.dept;
        const unitChanged = "unit" in patch && patch.unit !== queryState.unit;
        const unitIdChanged =
          "unitId" in patch && patch.unitId !== queryState.unitId;

        const changedCount =
          (deptChanged ? 1 : 0) + (unitChanged ? 1 : 0) + (unitIdChanged ? 1 : 0);

        if (changedCount === 1) {
          if (unitIdChanged) syncedUnit = patch.unitId;
          else if (unitChanged) syncedUnit = patch.unit;
          else if (deptChanged) syncedUnit = patch.dept;
        } else {
          const presentKeys = (["dept", "unit", "unitId"] as const).filter(
            (k) => k in patch
          );
          if (presentKeys.length === 1) {
            syncedUnit = patch[presentKeys[0]];
          } else {
            syncedUnit = patch.dept ?? patch.unit ?? patch.unitId;
          }
        }

        patch.dept = syncedUnit;
        patch.unit = syncedUnit;
        patch.unitId = syncedUnit;

        if ("unit" in patch && !("dept" in patch)) {
          patch._unitParamKey = "unit";
        } else if ("dept" in patch && !("unit" in patch)) {
          patch._unitParamKey = "dept";
        }
      }

      dispatchUpdate({ ...queryState, ...patch }, navOptions);
    },
    [readCurrentState, dispatchUpdate]
  );

  return {
    queryState,
    setScope,
    setUnit,
    setDept,
    setPeriod,
    setStatus,
    setPriority,
    setCategory,
    setDeadline,
    setAttention,
    setView,
    setSearchQuery,
    setSelectedTask,
    resetFilters,
    updateWorkspaceQuery,
  };
}
