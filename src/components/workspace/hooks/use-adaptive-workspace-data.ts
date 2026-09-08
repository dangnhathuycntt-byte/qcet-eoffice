import * as React from "react";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type {
  WorkspaceScope,
  AdaptiveWorkspaceMetrics,
  UniversalActionQueueItems,
} from "../types";

export type {
  WorkspaceScope,
  AdaptiveWorkspaceMetrics,
  UniversalActionQueueItems,
} from "../types";

export interface DeriveWorkspaceDataOptions {
  tasks: SchoolTask[];
  user: AuthUser | null;
  scope: WorkspaceScope;
  selectedDepartment?: string;
}

export interface DerivedWorkspaceData {
  activeScope: WorkspaceScope;
  scopedTasks: SchoolTask[];
  metrics: AdaptiveWorkspaceMetrics;
  actionQueue: UniversalActionQueueItems;
}

export function deriveAdaptiveWorkspaceData({
  tasks = [],
  user,
  scope,
  selectedDepartment,
}: DeriveWorkspaceDataOptions): DerivedWorkspaceData {
  const userDept = selectedDepartment || user?.departmentCode || user?.department || "";
  const userName = user?.name || "";

  let scopedTasks: SchoolTask[] = [];

  if (scope === "school") {
    scopedTasks = tasks;
  } else if (scope === "unit") {
    scopedTasks = tasks.filter((t) => {
      const matchParent =
        Boolean(userDept) &&
        (t.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
          t.department?.toLowerCase() === userDept.toLowerCase() ||
          t.leadDepartmentCode?.toUpperCase() === userDept.toUpperCase() ||
          t.leadDepartment?.toLowerCase() === userDept.toLowerCase());
      const matchChild =
        Boolean(userDept) &&
        t.subTasks?.some(
          (st) =>
            st.departmentCode?.toUpperCase() === userDept.toUpperCase() ||
            st.department?.toLowerCase() === userDept.toLowerCase()
        );
      return Boolean(matchParent || matchChild);
    });
  } else {
    // scope === "my"
    scopedTasks = tasks
      .map((t) => {
        const matchingSub = (t.subTasks || []).filter(
          (st) =>
            (userName && (st.assignedTo === userName || st.assigneeName === userName)) ||
            (user?.id && st.assigneeId === user.id)
        );
        if (matchingSub.length > 0) {
          return { ...t, subTasks: matchingSub };
        }
        if (
          (userName && (t.assignedTo === userName || t.leadAssigneeName === userName)) ||
          (user?.id && t.leadAssigneeId === user.id)
        ) {
          return t;
        }
        return null;
      })
      .filter((t): t is SchoolTask => t !== null);
  }

  // Calculate Metrics
  const totalTasks = scopedTasks.length;
  let completedCount = 0;
  let urgentOverdueCount = 0;
  let waitingApprovalCount = 0;

  const now = new Date();

  scopedTasks.forEach((t) => {
    if (t.status === "COMPLETED") completedCount++;
    if ((t.status as string) === "NEEDS_REVIEW" || t.status === "PENDING_EXECUTIVE_APPROVAL") {
      waitingApprovalCount++;
    }
    if (t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED") {
      urgentOverdueCount++;
    }

    t.subTasks?.forEach((st) => {
      if (st.status === "NEEDS_REVIEW") waitingApprovalCount++;
      if (st.dueDate && new Date(st.dueDate) < now && st.status !== "COMPLETED") {
        urgentOverdueCount++;
      }
    });
  });

  const completedRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

  const labelScope =
    scope === "school"
      ? "Toàn trường"
      : scope === "unit"
      ? userDept || "Đơn vị"
      : "Cá nhân";

  // Calculate Action Queue
  const pendingApprovals: UniversalActionQueueItems["pendingApprovals"] = [];
  const myPendingSubmissions: UniversalActionQueueItems["myPendingSubmissions"] = [];

  tasks.forEach((t) => {
    if ((t.status as string) === "NEEDS_REVIEW" || (t.status as string) === "PENDING_EXECUTIVE_APPROVAL") {
      pendingApprovals.push({
        task: t,
        parentTaskTitle: t.title,
        submittedBy: t.assignedTo || t.leadAssigneeName || t.department,
        submittedAt: (t as { updatedAt?: string }).updatedAt || t.assignedDate,
      });
    }

    t.subTasks?.forEach((st) => {
      if (st.status === "NEEDS_REVIEW") {
        pendingApprovals.push({
          task: st,
          parentTaskTitle: t.title,
          submittedBy: st.assignedTo || st.assigneeName,
          submittedAt: st.updatedAt,
        });
      }

      const isMine =
        Boolean(userName && (st.assignedTo === userName || st.assigneeName === userName)) ||
        Boolean(user?.id && st.assigneeId === user.id);
      if (isMine && st.status !== "COMPLETED") {
        const isOverdue = Boolean(st.dueDate && new Date(st.dueDate) < now);
        myPendingSubmissions.push({
          task: st,
          parentTaskTitle: t.title,
          dueDate: st.dueDate,
          isOverdue,
        });
      }
    });
  });

  return {
    activeScope: scope,
    scopedTasks,
    metrics: {
      totalTasks,
      urgentOverdueCount,
      waitingApprovalCount,
      completedRate,
      labelScope,
    },
    actionQueue: {
      pendingApprovals,
      myPendingSubmissions,
    },
  };
}

export function useAdaptiveWorkspaceData(
  tasks: SchoolTask[],
  user: AuthUser | null,
  scope: WorkspaceScope,
  selectedDepartment?: string
): DerivedWorkspaceData {
  return React.useMemo(
    () =>
      deriveAdaptiveWorkspaceData({
        tasks,
        user,
        scope,
        selectedDepartment,
      }),
    [tasks, user, scope, selectedDepartment]
  );
}
