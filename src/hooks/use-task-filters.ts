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
} from "@/lib/executive-matrix-aggregator";
import {
  computeExecutiveActionStats,
  computeDepartmentHealthMatrix,
  filterTasksByExecutive,
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
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
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
    handleSelectUpcoming,
  };
}
