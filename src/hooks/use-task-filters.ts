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
  type AcademicMonthInfo,
} from "@/lib/academic-calendar";

export interface TaskFiltersReturn {
  // Filter state
  selectedCategory: string;
  selectedPriority: string;
  searchQuery: string;
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
  effectiveManagerUser: AuthUser;

  // Computed memoized outputs
  scopedBaseTasks: SchoolTask[];
  monthlyTaskCounts: Record<number, number>;
  selectedMonthPeriod: AcademicMonthInfo | null;
  displayedStats: DashboardStats;
  filteredTasks: SchoolTask[];
  roleUpcoming: UpcomingItem[];
  departmentHealth: DepartmentHealthSummary[];
  executiveStats: ExecutiveActionStats | null;
  handleSelectUpcoming: (item: UpcomingItem) => SchoolTask | StaffTask | undefined;
}

export function useTaskFilters({
  tasks,
  upcoming,
  scope,
  activeZone,
  selectedDepartment,
  selectedAcademicMonth,
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
  user: AuthUser;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onResetDepartment: () => void;
  onResetMonth: () => void;
}): TaskFiltersReturn {
  const [selectedCategory, setSelectedCategory] = React.useState<string>("ALL");
  const [selectedPriority, setSelectedPriority] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [activeWorkbox, setActiveWorkbox] = React.useState<WorkboxFilter>("ALL");
  const [executiveFilter, setExecutiveFilter] = React.useState<ExecutiveFilter>("ALL");

  const handleResetFilters = React.useCallback(() => {
    onResetDepartment();
    onResetMonth();
    setSelectedPriority("ALL");
    setSelectedCategory("ALL");
    setActiveWorkbox("ALL");
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

  const isSchoolView = scope === "SCHOOL_TASKS" || (isExecutive && scope !== "UNIT_TASKS" && scope !== "MY_TASKS");
  const isUnitView = !isSchoolView && (scope === "UNIT_TASKS" || (isManager && scope !== "MY_TASKS"));

  const effectiveManagerUser: AuthUser = React.useMemo(() => {
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

  const scopedBaseTasks = React.useMemo(
    () => filterTasksByScope(tasks, scope, user, selectedDepartment),
    [tasks, scope, user, selectedDepartment]
  );

  const monthlyTaskCounts = React.useMemo(
    () => computeMonthlyTaskCounts(scopedBaseTasks, "2026-2027"),
    [scopedBaseTasks]
  );

  const selectedMonthPeriod = React.useMemo(() => {
    if (selectedAcademicMonth === "ALL") return null;
    const months = getAcademicMonthsForYear("2026-2027");
    return months.find((m) => m.monthNumber === selectedAcademicMonth) ?? null;
  }, [selectedAcademicMonth]);

  const displayedStats = React.useMemo(() => {
    if (scopedBaseTasks.length > 0) return computeDashboardStats(scopedBaseTasks);
    return computeDashboardStats(tasks);
  }, [scopedBaseTasks, tasks]);

  const executiveStats = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeExecutiveActionStats(tasks) : null),
    [tasks, isExecutive, activeZone]
  );

  const departmentHealth = React.useMemo(
    () => (isExecutive && activeZone === "dashboard" ? computeDepartmentHealthMatrix(tasks) : []),
    [tasks, isExecutive, activeZone]
  );

  const filteredTasks = React.useMemo(() => {
    if (activeZone === "portal" || activeZone === "org") return [];
    let result = filterTasksHub({
      tasks,
      scope,
      workboxFilter: activeWorkbox,
      category: selectedCategory,
      priority: selectedPriority,
      department: selectedDepartment,
      searchQuery,
      user,
      academicMonth: selectedAcademicMonth,
      academicYear: "2026-2027",
    });
    if (isExecutive && executiveFilter !== "ALL") {
      result = filterTasksByExecutive(result, executiveFilter);
    }
    return result;
  }, [
    activeZone,
    tasks,
    scope,
    activeWorkbox,
    selectedCategory,
    selectedPriority,
    selectedDepartment,
    searchQuery,
    user,
    isExecutive,
    executiveFilter,
    selectedAcademicMonth,
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
        const foundSub = parent.subTasks.find((s) => s.id === targetId);
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
    monthlyTaskCounts,
    selectedMonthPeriod,
    displayedStats,
    filteredTasks,
    roleUpcoming,
    departmentHealth,
    executiveStats,
    handleSelectUpcoming,
  };
}
