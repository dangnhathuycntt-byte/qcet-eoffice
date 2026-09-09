"use client";

import * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  UpcomingItem,
  DashboardStats,
} from "@/types/dashboard";
import { computeDashboardStats } from "@/lib/dashboard-aggregator";
import type { WorkboxFilter } from "@/components/dashboard/executive-stat-strip";
import type {
  ExecutiveFilter,
  ExecutiveActionStats,
  DepartmentHealthSummary,
  ExecutiveActionItem,
} from "@/lib/executive-matrix-aggregator";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  filterTasksByExecutive,
  extractExecutiveActionItems,
} from "@/lib/executive-matrix-aggregator";
import type { TaskScope } from "@/components/dashboard/unified-task-toolbar";
import { filterTasksByScope } from "@/components/dashboard/unified-task-toolbar";
import { WorkspaceZone } from "@/types/workspace";
import type { AuthUser } from "@/types/auth";
import {
  filterTasksByRole,
  filterUpcomingByRole,
} from "@/lib/role-task-filter";
import {
  filterTasksHub,
  computeMonthlyTaskCounts,
} from "@/lib/unified-task-hub";
import {
  formatDepartmentLabel,
  resolveDepartment,
} from "@/components/layout/scope-switcher";
import {
  getAcademicMonthsForYear,
  getAcademicYear,
  filterTasksByAcademicMonthStrict,
  computePriorOverdueBacklog,
  type AcademicMonthInfo,
} from "@/lib/academic-calendar";

export interface TaskFiltersReturn {
  // Filter state
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
  deferredSearchQuery: string;
  deferredSearch: string;
  isFilteringStale: boolean;
  isFilteringDeferred: boolean;
  activeWorkbox: WorkboxFilter;
  executiveFilter: ExecutiveFilter;
  setSelectedCategory: React.Dispatch<React.SetStateAction<string>>;
  setSelectedPriority: React.Dispatch<React.SetStateAction<string>>;
  setSearchQuery: React.Dispatch<React.SetStateAction<string>>;
  setActiveWorkbox: React.Dispatch<React.SetStateAction<WorkboxFilter>>;
  setExecutiveFilter: React.Dispatch<React.SetStateAction<ExecutiveFilter>>;
  handleResetFilters: () => void;

  // Role resolution
  isExecutive: boolean;
  isManager: boolean;
  isStaff: boolean;
  isUnitView: boolean;
  isSchoolView: boolean;
  effectiveManagerUser: AuthUser | null;

  // Computed memoized outputs
  scopedBaseTasks: SchoolTask[];
  monthScopedBaseTasks: SchoolTask[];
  priorOverdueBacklog: SchoolTask[];
  selectedAcademicMonth: number | "ALL";
  monthlyTaskCounts: Record<number, number>;
  selectedMonthPeriod: AcademicMonthInfo | null;
  displayedStats: DashboardStats;
  monthlyScopedStats: DashboardStats;
  filteredTasks: SchoolTask[];
  roleUpcoming: UpcomingItem[];
  departmentHealth: DepartmentHealthSummary[];
  monthlyDepartmentHealth: DepartmentHealthSummary[];
  executiveStats: ExecutiveActionStats | null;
  monthlyExecutiveStats: ExecutiveActionStats | null;
  executiveActionItems: ExecutiveActionItem[];
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
}

// ============================================================================
// URL Parameter Synchronization Types & Pure Functions
// ============================================================================

export interface TaskUrlParams {
  scope?: "school" | "unit" | "my";
  dept?: string;
  status?: string;
  month?: number | "ALL";
  q?: string;
  view?: "table" | "kanban";
  taskId?: string | null;
}

/**
 * Pure parser extracting task filters and selection state from URL search params.
 */
export function parseTaskUrlParams(
  searchParams?: URLSearchParams | string | null
): TaskUrlParams {
  let params: URLSearchParams;
  if (!searchParams) {
    if (typeof window !== "undefined") {
      params = new URLSearchParams(window.location.search);
    } else {
      params = new URLSearchParams();
    }
  } else if (typeof searchParams === "string") {
    params = new URLSearchParams(searchParams);
  } else {
    params = searchParams;
  }

  const rawScope = params.get("scope");
  const rawDept = params.get("dept");
  const rawStatus = params.get("status") || params.get("tab");
  const rawMonth = params.get("month");
  const rawQ = params.get("q");
  const rawView = params.get("view");
  const rawTaskId = params.get("taskId");

  const result: TaskUrlParams = {};

  if (rawScope === "school" || rawScope === "unit" || rawScope === "my") {
    result.scope = rawScope;
  } else if (rawScope === "SCHOOL_TASKS") {
    result.scope = "school";
  } else if (rawScope === "UNIT_TASKS") {
    result.scope = "unit";
  } else if (rawScope === "MY_TASKS") {
    result.scope = "my";
  }

  if (rawDept && rawDept.trim() !== "" && rawDept !== "ALL") {
    result.dept = rawDept.trim();
  }

  if (
    rawStatus &&
    rawStatus.trim() !== "" &&
    rawStatus !== "ALL" &&
    rawStatus !== "all"
  ) {
    result.status = rawStatus.trim();
  }

  if (rawMonth) {
    if (rawMonth === "ALL") {
      result.month = "ALL";
    } else {
      const parsedMonth = parseInt(rawMonth, 10);
      if (!isNaN(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12) {
        result.month = parsedMonth;
      }
    }
  }

  if (rawQ && rawQ.trim() !== "") {
    result.q = rawQ.trim();
  }

  if (rawView === "table" || rawView === "kanban") {
    result.view = rawView;
  }

  if (rawTaskId && rawTaskId.trim() !== "") {
    result.taskId = rawTaskId.trim();
  }

  return result;
}

/**
 * Pure builder creating canonical query string from TaskUrlParams while optionally
 * preserving other unrelated query parameters.
 */
export function buildTaskUrlQuery(
  currentUrlState: Partial<TaskUrlParams>,
  existingQuery?: string | URLSearchParams
): string {
  let params: URLSearchParams;
  if (typeof existingQuery === "string") {
    params = new URLSearchParams(existingQuery);
  } else if (existingQuery instanceof URLSearchParams) {
    params = new URLSearchParams(existingQuery.toString());
  } else if (typeof window !== "undefined") {
    params = new URLSearchParams(window.location.search);
  } else {
    params = new URLSearchParams();
  }

  // 1. scope
  if (currentUrlState.scope) {
    params.set("scope", currentUrlState.scope);
  } else {
    params.delete("scope");
  }

  // 2. dept
  if (currentUrlState.dept && currentUrlState.dept !== "ALL") {
    params.set("dept", currentUrlState.dept);
  } else {
    params.delete("dept");
  }

  // 3. status (also remove obsolete tab)
  if (
    currentUrlState.status &&
    currentUrlState.status !== "ALL" &&
    currentUrlState.status !== "all"
  ) {
    params.set("status", currentUrlState.status);
    params.delete("tab");
  } else {
    params.delete("status");
    params.delete("tab");
  }

  // 4. month
  if (
    currentUrlState.month !== undefined &&
    currentUrlState.month !== "ALL" &&
    currentUrlState.month !== null
  ) {
    params.set("month", String(currentUrlState.month));
  } else {
    params.delete("month");
  }

  // 5. q
  if (currentUrlState.q && currentUrlState.q.trim() !== "") {
    params.set("q", currentUrlState.q.trim());
  } else {
    params.delete("q");
  }

  // 6. view
  if (currentUrlState.view && currentUrlState.view !== "table") {
    params.set("view", currentUrlState.view);
  } else {
    params.delete("view");
  }

  // 7. taskId
  if (currentUrlState.taskId && currentUrlState.taskId.trim() !== "") {
    params.set("taskId", currentUrlState.taskId.trim());
  } else {
    params.delete("taskId");
  }

  return params.toString();
}

/**
 * Synchronize task filters to the browser URL search params without reload.
 */
export function syncTaskUrlParams(
  updates: Partial<TaskUrlParams>,
  router?: { replace: (url: string, opts?: { scroll?: boolean }) => void }
): string {
  if (typeof window === "undefined") return "";
  const existingParams = new URLSearchParams(window.location.search);
  const currentParsed = parseTaskUrlParams(existingParams);
  const merged: TaskUrlParams = {
    ...currentParsed,
    ...updates,
  };

  for (const [key, val] of Object.entries(updates)) {
    if (val === null || val === "" || val === "ALL") {
      delete (merged as any)[key];
    }
  }

  const queryString = buildTaskUrlQuery(merged, existingParams);
  const newUrl = queryString
    ? `${window.location.pathname}?${queryString}`
    : window.location.pathname;

  try {
    if (router && typeof router.replace === "function") {
      router.replace(newUrl, { scroll: false });
    } else {
      window.history.replaceState(null, "", newUrl);
    }
  } catch {
    window.history.replaceState(null, "", newUrl);
  }

  return queryString;
}

export function useTaskFilters({
  tasks,
  upcoming,
  scope,
  activeZone,
  selectedDepartment,
  selectedAcademicMonth,
  referenceDate,
  user,
  onSelectTask,
  onResetDepartment,
  onResetMonth,
}: {
  tasks: SchoolTask[];
  upcoming: UpcomingItem[];
  scope: TaskScope;
  activeZone: WorkspaceZone;
  selectedDepartment: string;
  selectedAcademicMonth: number | "ALL";
  referenceDate?: string;
  user: AuthUser | null;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onResetDepartment: () => void;
  onResetMonth: () => void;
}): TaskFiltersReturn {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const isFilteringStale = searchQuery !== deferredSearchQuery;
  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const [executiveFilter, setExecutiveFilter] = React.useState<ExecutiveFilter>("ALL");

  const handleResetFilters = React.useCallback(() => {
    onResetDepartment();
    onResetMonth();
    setSelectedPriority("ALL");
    setSelectedCategory("ALL");
    setActiveWorkbox("ALL");
    setExecutiveFilter("ALL");
    setSearchQuery("");
  }, [onResetDepartment, onResetMonth]);

  const roleStr = String(user?.role || "").toUpperCase();
  const isExecutive =
    user?.role === "ADMIN" ||
    roleStr === "ADMIN" ||
    roleStr === "BGH" ||
    roleStr === "BAN_GIAM_HIEU";
  const isManager =
    user?.role === "MANAGER" ||
    roleStr === "MANAGER" ||
    roleStr === "TRUONG_DON_VI" ||
    roleStr === "TRUONG_PHONG";
  const isStaff =
    user?.role === "STAFF" ||
    roleStr === "STAFF" ||
    roleStr === "GIANG_VIEN" ||
    roleStr === "CHUYEN_VIEN" ||
    (!isExecutive && !isManager);

  const isSchoolView = isExecutive && (scope === "SCHOOL_TASKS" || (scope !== "UNIT_TASKS" && scope !== "MY_TASKS"));
  const isUnitView = !isSchoolView && (scope === "UNIT_TASKS" || (isManager && scope !== "MY_TASKS"));

  const effectiveManagerUser: AuthUser | null = React.useMemo(() => {
    if (!user) return null;
    if (
      selectedDepartment &&
      selectedDepartment !== "ALL" &&
      selectedDepartment !== user?.departmentCode
    ) {
      const resolvedDept = resolveDepartment(selectedDepartment);
      return {
        ...user,
        departmentCode: selectedDepartment,
        department: resolvedDept
          ? formatDepartmentLabel(resolvedDept)
          : (user?.department || selectedDepartment),
      };
    }
    return user;
  }, [user, selectedDepartment]);

  const effectiveScope = React.useMemo(() => {
    if (scope === "SCHOOL_TASKS" && !isExecutive) {
      return isManager ? "UNIT_TASKS" : "MY_TASKS";
    }
    return scope;
  }, [scope, isExecutive, isManager]);

  const currentAcademicYear = React.useMemo(() => getAcademicYear(new Date()), []);

  const scopedBaseTasks = React.useMemo(
    () => filterTasksByScope(tasks, effectiveScope, user, selectedDepartment),
    [tasks, effectiveScope, user, selectedDepartment]
  );

  const monthScopedBaseTasks = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return scopedBaseTasks;
    return filterTasksByAcademicMonthStrict(
      scopedBaseTasks,
      selectedAcademicMonth,
      currentAcademicYear
    );
  }, [scopedBaseTasks, selectedAcademicMonth, currentAcademicYear]);

  const priorOverdueBacklog = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return [];
    return computePriorOverdueBacklog(
      scopedBaseTasks,
      selectedAcademicMonth,
      currentAcademicYear,
      referenceDate
    );
  }, [scopedBaseTasks, selectedAcademicMonth, currentAcademicYear, referenceDate]);

  const monthlyTaskCounts = React.useMemo(
    () => computeMonthlyTaskCounts(scopedBaseTasks, currentAcademicYear),
    [scopedBaseTasks, currentAcademicYear]
  );

  const selectedMonthPeriod = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return null;
    const months = getAcademicMonthsForYear(currentAcademicYear);
    return months.find((m) => m.monthNumber === selectedAcademicMonth) ?? null;
  }, [selectedAcademicMonth, currentAcademicYear]);

  const displayedStats = React.useMemo(() => {
    if (selectedAcademicMonth !== "ALL") {
      return computeDashboardStats(monthScopedBaseTasks);
    }
    if (scopedBaseTasks.length > 0) return computeDashboardStats(scopedBaseTasks);
    if (selectedDepartment && selectedDepartment !== "ALL") return computeDashboardStats([]);
    if (!isExecutive && effectiveScope === "MY_TASKS") return computeDashboardStats([]);
    return computeDashboardStats(tasks);
  }, [monthScopedBaseTasks, scopedBaseTasks, tasks, isExecutive, selectedDepartment, effectiveScope, selectedAcademicMonth]);

  const monthFilteredSchoolTasks = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return tasks;
    return filterTasksByAcademicMonthStrict(tasks, selectedAcademicMonth, currentAcademicYear);
  }, [tasks, selectedAcademicMonth, currentAcademicYear]);

  const executiveStats = React.useMemo(
    () =>
      isExecutive && activeZone === "dashboard"
        ? computeExecutiveActionStats(monthFilteredSchoolTasks)
        : null,
    [monthFilteredSchoolTasks, isExecutive, activeZone]
  );

  const departmentHealth = React.useMemo(
    () =>
      isExecutive && activeZone === "dashboard"
        ? computeDepartmentHealthMatrix(monthFilteredSchoolTasks, referenceDate)
        : [],
    [monthFilteredSchoolTasks, isExecutive, activeZone, referenceDate]
  );

  const executiveActionItems = React.useMemo(
    () => (isExecutive ? extractExecutiveActionItems(monthFilteredSchoolTasks, referenceDate) : []),
    [isExecutive, monthFilteredSchoolTasks, referenceDate]
  );

  const filteredTasks = React.useMemo(() => {
    if (activeZone === "portal" || activeZone === "org") return [];
    let result = filterTasksHub({
      tasks,
      scope: effectiveScope,
      workboxFilter: activeWorkbox,
      category: selectedCategory,
      priority: selectedPriority,
      department: selectedDepartment,
      searchQuery: deferredSearchQuery,
      user,
      academicMonth: selectedAcademicMonth,
      academicYear: currentAcademicYear,
    });
    if (isExecutive && executiveFilter !== "ALL") {
      result = filterTasksByExecutive(result, executiveFilter);
    }
    return result;
  }, [
    activeZone,
    tasks,
    effectiveScope,
    activeWorkbox,
    selectedCategory,
    selectedPriority,
    selectedDepartment,
    deferredSearchQuery,
    user,
    isExecutive,
    executiveFilter,
    selectedAcademicMonth,
    currentAcademicYear,
  ]);

  const roleVisibleTasks = React.useMemo(
    () => filterTasksByRole(tasks, user),
    [tasks, user]
  );

  const roleUpcoming = React.useMemo(
    () => filterUpcomingByRole(upcoming, user, roleVisibleTasks),
    [upcoming, user, roleVisibleTasks]
  );

  const handleSelectUpcoming = React.useCallback(
    (item: UpcomingItem) => {
      const targetId = item.taskId || item.id;
      const matched = tasks.find((t) => t.id === targetId);
      if (matched) {
        onSelectTask?.(matched);
        return matched;
      }
      for (const parent of tasks) {
        const foundSub = parent.subTasks?.find((s) => s.id === targetId);
        if (foundSub) {
          onSelectTask?.(foundSub);
          return foundSub;
        }
      }
      return undefined;
    },
    [tasks, onSelectTask]
  );

  return {
    selectedCategory,
    selectedPriority,
    searchQuery,
    deferredSearchQuery,
    deferredSearch: deferredSearchQuery,
    isFilteringStale,
    isFilteringDeferred: isFilteringStale,
    activeWorkbox,
    executiveFilter,
    setSelectedCategory,
    setSelectedPriority,
    setSearchQuery,
    setActiveWorkbox,
    setExecutiveFilter,
    handleResetFilters,
    isExecutive,
    isManager,
    isStaff,
    isUnitView,
    isSchoolView,
    effectiveManagerUser,
    scopedBaseTasks,
    monthScopedBaseTasks,
    priorOverdueBacklog,
    selectedAcademicMonth,
    monthlyTaskCounts,
    selectedMonthPeriod,
    displayedStats,
    monthlyScopedStats: displayedStats,
    filteredTasks,
    roleUpcoming,
    departmentHealth,
    monthlyDepartmentHealth: departmentHealth,
    executiveStats,
    monthlyExecutiveStats: executiveStats,
    executiveActionItems,
    handleSelectUpcoming,
  };
}
