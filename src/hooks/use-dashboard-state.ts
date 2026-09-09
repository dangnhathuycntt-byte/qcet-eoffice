"use client";

import * as React from "react";
import { useAuth } from "@/lib/auth-context";
import { useSidebar } from "@/components/layout/sidebar-context";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { useUrlParamsSync, type UrlParamsSyncReturn } from "./use-url-params-sync";
import { useTaskMutations, type TaskMutationsReturn } from "./use-task-mutations";
import { useTaskFilters, type TaskFiltersReturn } from "./use-task-filters";

export type DashboardStateReturn = UrlParamsSyncReturn & TaskMutationsReturn & TaskFiltersReturn & {
  user: ReturnType<typeof useAuth>["user"];
  tasks: SchoolTask[];
  stats: TaskMutationsReturn["dashboardData"]["stats"];
  upcoming: TaskMutationsReturn["dashboardData"]["upcoming"];
  activities: TaskMutationsReturn["dashboardData"]["activities"];
};

export function useDashboardState(
  onSelectTask?: (task: SchoolTask | StaffTask) => void,
  onOpenCreateModal?: (level?: "TRUONG" | "DON_VI", parentId?: string, assigneeName?: string) => void
): DashboardStateReturn {
  const { user } = useAuth();
  const { setBadgeCounts } = useSidebar();

  const urlSync = useUrlParamsSync(user?.role);
  const mutations = useTaskMutations(user, onOpenCreateModal);
  const filters = useTaskFilters({
    tasks: mutations.dashboardData.tasks,
    upcoming: mutations.dashboardData.upcoming,
    scope: urlSync.scope,
    activeZone: urlSync.activeZone,
    selectedDepartment: urlSync.selectedDepartment,
    selectedAcademicMonth: urlSync.selectedAcademicMonth,
    user,
    onSelectTask,
    onResetDepartment: () => urlSync.handleDepartmentChange("ALL"),
    onResetMonth: () => urlSync.handleAcademicMonthChange("ALL"),
  });

  // Sync Dynamic Badge Counts with left sidebar
  React.useEffect(() => {
    const urgentTasks = mutations.dashboardData.tasks.filter(
      (t) =>
        (t.status === "PENDING_EXECUTIVE_APPROVAL" || t.dueDate <= "2026-09-08") &&
        t.status !== "COMPLETED"
    ).length;
    const todayStr = "2026-09-06";
    const todayEvents = mutations.dashboardData.upcoming.filter(
      (item) => item.dueDate === todayStr
    ).length;

    const nextTasks = urgentTasks > 0 ? urgentTasks : undefined;
    const nextCalendar = todayEvents > 0 ? todayEvents : undefined;
    const nextOrg = undefined;

    setBadgeCounts((prev) => {
      const currentNotifications = prev.notifications ?? 0;
      if (
        prev.tasks === nextTasks &&
        prev.calendar === nextCalendar &&
        prev.org === nextOrg &&
        prev.notifications === currentNotifications
      ) {
        return prev;
      }
      return {
        ...prev,
        tasks: nextTasks,
        calendar: nextCalendar,
        org: nextOrg,
        notifications: currentNotifications,
      };
    });
  }, [mutations.dashboardData.tasks, mutations.dashboardData.upcoming, setBadgeCounts]);

  return {
    ...urlSync,
    ...mutations,
    ...filters,
    user,
    tasks: mutations.dashboardData.tasks,
    stats: mutations.dashboardData.stats,
    upcoming: mutations.dashboardData.upcoming,
    activities: mutations.dashboardData.activities,
  };
}
