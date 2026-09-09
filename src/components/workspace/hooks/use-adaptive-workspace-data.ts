import * as React from "react";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type {
  WorkspaceScope,
  AdaptiveWorkspaceMetrics,
  UniversalActionQueueItems,
} from "../types";
import { matchesUser } from "@/lib/role-task-filter";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";

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

export function isTaskAssignedToUser(t: SchoolTask, user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.id && (t.leadAssigneeId === user.id || t.assignedTo === user.id)) return true;
  if (matchesUser(t.assignedTo, user)) return true;
  if (matchesUser(t.leadAssigneeName, user)) return true;
  if (t.coAssignees?.some((ca) => matchesUser(ca, user))) return true;
  return false;
}

export function isSubTaskAssignedToUser(st: StaffTask, user: AuthUser | null): boolean {
  if (!user) return false;
  if (user.id && (st.assigneeId === user.id || st.assignedTo === user.id)) return true;
  if (matchesUser(st.assignedTo, user)) return true;
  if (matchesUser(st.assigneeName, user)) return true;
  return false;
}

export function countScopeTasks(
  tasks: SchoolTask[] = [],
  user: AuthUser | null,
  scope: WorkspaceScope,
  selectedDepartment?: string
): number {
  if (scope === "school") return tasks.length;
  const userDept = selectedDepartment || user?.departmentCode || user?.department || "";
  if (scope === "unit") {
    return tasks.filter((t) => {
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
    }).length;
  }
  // scope === "my"
  return tasks.filter((t) => {
    const matchingSub = (t.subTasks || []).some((st) => isSubTaskAssignedToUser(st, user));
    return matchingSub || isTaskAssignedToUser(t, user);
  }).length;
}

export function deriveAdaptiveWorkspaceData({
  tasks = [],
  user,
  scope,
  selectedDepartment,
}: DeriveWorkspaceDataOptions): DerivedWorkspaceData {
  const userDept = selectedDepartment || user?.departmentCode || user?.department || "";
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);

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
        const matchingSub = (t.subTasks || []).filter((st) => isSubTaskAssignedToUser(st, user));
        if (matchingSub.length > 0) {
          return { ...t, subTasks: matchingSub };
        }
        if (isTaskAssignedToUser(t, user)) {
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
    if (
      (t.status as string) === "WAITING_APPROVAL" ||
      (t.status as string) === "NEEDS_REVIEW" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL"
    ) {
      waitingApprovalCount++;
    }
    if (t.dueDate && new Date(t.dueDate) < now && t.status !== "COMPLETED") {
      urgentOverdueCount++;
    }

    t.subTasks?.forEach((st) => {
      if (
        (st.status as string) === "WAITING_APPROVAL" ||
        (st.status as string) === "NEEDS_REVIEW" ||
        (st.status as string) === "PENDING_EXECUTIVE_APPROVAL"
      ) {
        waitingApprovalCount++;
      }
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

  // Helper to check if a task or subtask belongs to the user's unit
  const isTaskInUnit = (t: SchoolTask): boolean => {
    if (!userDept) return false;
    const deptUpper = userDept.toUpperCase();
    const deptLower = userDept.toLowerCase();
    const matchParent =
      t.departmentCode?.toUpperCase() === deptUpper ||
      t.department?.toLowerCase() === deptLower ||
      t.leadDepartmentCode?.toUpperCase() === deptUpper ||
      t.leadDepartment?.toLowerCase() === deptLower;
    const matchChild = t.subTasks?.some(
      (st) =>
        st.departmentCode?.toUpperCase() === deptUpper ||
        st.department?.toLowerCase() === deptLower
    );
    return Boolean(matchParent || matchChild);
  };

  const isSubTaskInUnit = (st: StaffTask, parentTask: SchoolTask): boolean => {
    if (!userDept) return false;
    const deptUpper = userDept.toUpperCase();
    const deptLower = userDept.toLowerCase();
    if (st.departmentCode?.toUpperCase() === deptUpper || st.department?.toLowerCase() === deptLower) {
      return true;
    }
    return isTaskInUnit(parentTask);
  };

  const canUserApproveParentTask = (t: SchoolTask): boolean => {
    if (!user) return false;
    const isExecApproval = (t.status as string) === "PENDING_EXECUTIVE_APPROVAL";
    const isNeedsReview =
      (t.status as string) === "NEEDS_REVIEW" ||
      (t.status as string) === "WAITING_APPROVAL";
    if (!isExecApproval && !isNeedsReview) return false;

    // Separation of Duties: Submitter / primary assignee cannot approve their own task unless Executive
    if (isTaskAssignedToUser(t, user) && !isExecutive) return false;

    // Only Executive can approve PENDING_EXECUTIVE_APPROVAL
    if (isExecApproval) {
      if (!isExecutive) return false;
      if (scope === "unit") return isTaskInUnit(t);
      if (scope === "my") return isTaskAssignedToUser(t, user);
      return true; // school scope
    }

    // t.status === "NEEDS_REVIEW" or "WAITING_APPROVAL"
    if (isExecutive) {
      if (scope === "unit") return isTaskInUnit(t);
      if (scope === "my") return isTaskAssignedToUser(t, user);
      return true;
    }

    if (isManager) {
      // Managers never leak school-wide tasks: must belong to unit or lead by them
      if (scope === "my") return isTaskAssignedToUser(t, user);
      return isTaskInUnit(t) || isTaskAssignedToUser(t, user);
    }

    // Staff: only if they lead the task
    return isTaskAssignedToUser(t, user);
  };

  const canUserApproveSubTask = (st: StaffTask, parentTask: SchoolTask): boolean => {
    const isSubReview =
      (st.status as string) === "NEEDS_REVIEW" ||
      (st.status as string) === "WAITING_APPROVAL";
    if (!user || !isSubReview) return false;

    // User cannot approve their own submitted subtask (Separation of Duties)
    if (isSubTaskAssignedToUser(st, user)) return false;

    if (isExecutive) {
      if (scope === "unit") return isSubTaskInUnit(st, parentTask);
      if (scope === "my") return isTaskAssignedToUser(parentTask, user);
      return true;
    }

    if (isManager) {
      // Manager approves subtasks in their unit, or under parent task they lead
      if (scope === "my") return isTaskAssignedToUser(parentTask, user);
      return isSubTaskInUnit(st, parentTask) || isTaskAssignedToUser(parentTask, user);
    }

    // Staff: only if they lead the parent task
    return isTaskAssignedToUser(parentTask, user);
  };

  // Calculate Action Queue
  const pendingApprovals: UniversalActionQueueItems["pendingApprovals"] = [];
  const myPendingSubmissions: UniversalActionQueueItems["myPendingSubmissions"] = [];

  tasks.forEach((t) => {
    if (canUserApproveParentTask(t)) {
      pendingApprovals.push({
        task: t,
        parentTaskTitle: (t as any).parentTaskTitle || t.title,
        parentTaskCode: (t as any).parentTaskCode || t.taskCode,
        parentTaskId: (t as any).parentTaskId || t.id,
        submittedBy: t.assignedTo || t.leadAssigneeName || t.department,
        submittedAt: (t as { updatedAt?: string }).updatedAt || t.assignedDate,
        actionTypeBadge: "Cần duyệt",
      });
    }

    t.subTasks?.forEach((st) => {
      if (canUserApproveSubTask(st, t)) {
        pendingApprovals.push({
          task: st,
          parentTaskTitle: t.title,
          parentTaskCode: t.taskCode,
          parentTaskId: t.id,
          submittedBy: st.assignedTo || st.assigneeName,
          submittedAt: st.updatedAt,
          actionTypeBadge: "Cần duyệt",
        });
      }

      const isMine = isSubTaskAssignedToUser(st, user);
      if (isMine && st.status !== "COMPLETED") {
        const isOverdue = Boolean(st.dueDate && new Date(st.dueDate) < now);
        myPendingSubmissions.push({
          task: st,
          parentTaskTitle: t.title,
          parentTaskCode: t.taskCode,
          parentTaskId: t.id,
          dueDate: st.dueDate,
          isOverdue,
          actionTypeBadge: "Chờ nộp BC",
        });
      }
    });

    if ((!t.subTasks || t.subTasks.length === 0) && t.status !== "COMPLETED") {
      const isMine = isTaskAssignedToUser(t, user);
      if (isMine) {
        const isOverdue = Boolean(t.dueDate && new Date(t.dueDate) < now);
        const adaptedStaffTask: StaffTask = {
          id: t.id,
          title: t.title,
          assigneeName: t.leadAssigneeName || t.assignedTo || user?.name || "",
          assigneeId: t.leadAssigneeId || user?.id,
          department: t.department || userDept,
          departmentCode: t.departmentCode || userDept,
          dueDate: t.dueDate || "",
          status: (t.status === "PENDING_EXECUTIVE_APPROVAL" ? "NEEDS_REVIEW" : t.status) as any,
          parentSchoolTaskId: t.id,
          updatedAt: (t as { updatedAt?: string }).updatedAt || t.assignedDate,
        };
        myPendingSubmissions.push({
          task: adaptedStaffTask,
          parentTaskTitle: (t as any).parentTaskTitle || t.title,
          parentTaskCode: (t as any).parentTaskCode || t.taskCode,
          parentTaskId: (t as any).parentTaskId,
          dueDate: t.dueDate,
          isOverdue,
          actionTypeBadge: "Chờ nộp BC",
        });
      }
    }
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
