import * as React from "react";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type {
  WorkspaceScope,
  UniversalActionQueueItems,
} from "../types";
import { matchesUser } from "@/lib/role-task-filter";
import { isExecutiveUser, isManagerUser } from "@/components/layout/scope-switcher";
import { isTaskPastDue, getSystemReferenceDate } from "@/lib/academic-calendar";
import { resolveDepartmentId } from "@/lib/executive-matrix-aggregator";

export type {
  WorkspaceScope,
  UniversalActionQueueItems,
} from "../types";

export interface WorkspaceMetrics {
  totalParentTasks: number;
  completedParentTasks: number;
  parentCompletionRate: number;
  waitingApprovalCount: number;
  urgentOverdueCount: number;
  totalSubtasks: number;
  completedSubtasks: number;
  totalWorkItems: number;
  subtasksWaitingApprovalCount?: number;
  subtasksUrgentOverdueCount?: number;
  parentWaitingApprovalCount?: number;
  parentUrgentOverdueCount?: number;
  // Backwards compatibility properties:
  totalTasks: number; // = totalParentTasks
  completedCount: number; // = completedParentTasks
  completedRate: number; // = parentCompletionRate
  labelScope?: string;
}

export type AdaptiveWorkspaceMetrics = WorkspaceMetrics & { labelScope: string };

export interface DeriveWorkspaceDataOptions {
  tasks: SchoolTask[];
  user: AuthUser | null;
  scope: WorkspaceScope;
  selectedDepartment?: string;
  referenceDate?: string;
}

export interface DerivedWorkspaceData {
  activeScope: WorkspaceScope;
  scopedTasks: SchoolTask[];
  metrics: AdaptiveWorkspaceMetrics;
  actionQueue: UniversalActionQueueItems;
}

export function isTaskAssignedToUser(t: SchoolTask, user: AuthUser | null): boolean {
  if (!user) return false;
  if ((t as any).viewerContext?.relation) return true;
  if (
    user.id &&
    (t.leadAssigneeId === user.id ||
      t.assignedTo === user.id ||
      (t as any).createdById === user.id ||
      (t as any).assignedById === user.id ||
      (t as any).createdBy === user.id ||
      (Array.isArray((t as any).actors) && (t as any).actors.some((a: any) => a.userId === user.id)))
  ) {
    return true;
  }
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

import { filterTasksForTable } from "@/components/tasks/cascading-task-table";

export function countScopeTasks(
  tasks: SchoolTask[] = [],
  user: AuthUser | null,
  scope: WorkspaceScope,
  selectedDepartment?: string
): number {
  const cleanTasks = tasks;
  if (scope === "school") return cleanTasks.length;
  const userDept = selectedDepartment || user?.departmentCode || user?.department || (isExecutiveUser(user) ? "BGH" : "");
  if (scope === "unit") {
    if (!userDept || userDept === "ALL") {
      return cleanTasks.filter((t) => t.subTasks && t.subTasks.length > 0).length;
    }
    const canonicalDept = resolveDepartmentId(userDept) || userDept;
    return cleanTasks.filter((t) => {
      const taskDept =
        t.departmentCode ||
        t.department ||
        t.leadDepartmentCode ||
        t.leadDepartment ||
        t.departmentId ||
        t.leadDepartmentId;

      const matchParent =
        (taskDept && (
          taskDept.toUpperCase() === userDept.toUpperCase() ||
          taskDept.toLowerCase() === userDept.toLowerCase() ||
          taskDept === canonicalDept ||
          resolveDepartmentId(taskDept) === canonicalDept
        )) ||
        t.coDepartmentCodes?.some(
          (code) =>
            code.toUpperCase() === userDept.toUpperCase() ||
            code === canonicalDept ||
            resolveDepartmentId(code) === canonicalDept
        ) ||
        t.coDepartments?.some(
          (dept) =>
            dept.toLowerCase() === userDept.toLowerCase() ||
            dept === canonicalDept ||
            resolveDepartmentId(dept) === canonicalDept
        );

      const matchChild =
        t.subTasks?.some((st) => {
          const subDept = st.departmentCode || st.department || st.departmentId;
          return (
            subDept && (
              subDept.toUpperCase() === userDept.toUpperCase() ||
              subDept.toLowerCase() === userDept.toLowerCase() ||
              subDept === canonicalDept ||
              resolveDepartmentId(subDept) === canonicalDept
            )
          );
        });

      return Boolean(matchParent || matchChild);
    }).length;
  }
  // scope === "my"
  if (!user) return cleanTasks.length;
  return cleanTasks.filter((t) => {
    if ((t as any).viewerContext?.relation) return true;
    const isCreator = Boolean(
      user.id &&
        ((t as any).createdById === user.id ||
          (t as any).assignedById === user.id ||
          (t as any).createdBy === user.id ||
          (Array.isArray((t as any).actors) && (t as any).actors.some((a: any) => a.userId === user.id)))
    );
    const isLead =
      t.leadAssigneeName === user.name ||
      matchesUser(t.leadAssigneeName, user) ||
      (user.id && (t.leadAssigneeId === user.id || t.assignedTo === user.id));
    const hasSub = t.subTasks?.some(
      (s) =>
        s.assigneeName === user.name ||
        matchesUser(s.assigneeName, user) ||
        (user.id && (s.assigneeId === user.id || s.assignedTo === user.id))
    );
    const isCo = Boolean(
      t.coAssignees?.some((ca) => matchesUser(ca, user))
    );
    return Boolean(isLead || hasSub || isCo || isCreator);
  }).length;
}

export function deriveAdaptiveWorkspaceData({
  tasks = [],
  user,
  scope,
  selectedDepartment,
  referenceDate,
}: DeriveWorkspaceDataOptions): DerivedWorkspaceData {
  const cleanTasks = tasks;
  const userDept = selectedDepartment || user?.departmentCode || user?.department || (isExecutiveUser(user) ? "BGH" : "");
  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);

  let scopedTasks: SchoolTask[] = [];

  if (scope === "school") {
    scopedTasks = cleanTasks;
  } else if (scope === "unit") {
    if (userDept && userDept !== "ALL") {
      const canonicalDept = resolveDepartmentId(userDept) || userDept;
      scopedTasks = cleanTasks.filter((t) => {
        const taskDept =
          t.departmentCode ||
          t.department ||
          t.leadDepartmentCode ||
          t.leadDepartment ||
          t.departmentId ||
          t.leadDepartmentId;

        const matchParent =
          (taskDept && (
            taskDept.toUpperCase() === userDept.toUpperCase() ||
            taskDept.toLowerCase() === userDept.toLowerCase() ||
            taskDept === canonicalDept ||
            resolveDepartmentId(taskDept) === canonicalDept
          )) ||
          t.coDepartmentCodes?.some(
            (code) =>
              code.toUpperCase() === userDept.toUpperCase() ||
              code === canonicalDept ||
              resolveDepartmentId(code) === canonicalDept
          ) ||
          t.coDepartments?.some(
            (dept) =>
              dept.toLowerCase() === userDept.toLowerCase() ||
              dept === canonicalDept ||
              resolveDepartmentId(dept) === canonicalDept
          );

        const matchChild =
          t.subTasks?.some((st) => {
            const subDept = st.departmentCode || st.department || st.departmentId;
            return (
              subDept && (
                subDept.toUpperCase() === userDept.toUpperCase() ||
                subDept.toLowerCase() === userDept.toLowerCase() ||
                subDept === canonicalDept ||
                resolveDepartmentId(subDept) === canonicalDept
              )
            );
          });

        return Boolean(matchParent || matchChild);
      });
    } else {
      scopedTasks = cleanTasks.filter((t) => t.subTasks && t.subTasks.length > 0);
    }
  } else {
    // scope === "my"
    scopedTasks = cleanTasks
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
  const totalParentTasks = scopedTasks.length;
  let completedParentTasks = 0;
  let parentWaitingApprovalCount = 0;
  let parentUrgentOverdueCount = 0;

  let totalSubtasks = 0;
  let completedSubtasks = 0;
  let subtasksWaitingApprovalCount = 0;
  let subtasksUrgentOverdueCount = 0;

  const refDate = referenceDate || (selectedDepartment?.startsWith('20') ? selectedDepartment : getSystemReferenceDate());

  scopedTasks.forEach((t) => {
    if (t.status === "COMPLETED") completedParentTasks++;
    if (
      (t.status as string) === "WAITING_APPROVAL" ||
      (t.status as string) === "NEEDS_REVIEW" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL"
    ) {
      parentWaitingApprovalCount++;
    }
    if (t.dueDate && isTaskPastDue(t.dueDate, refDate) && t.status !== "COMPLETED") {
      parentUrgentOverdueCount++;
    }

    t.subTasks?.forEach((st) => {
      totalSubtasks++;
      if (st.status === "COMPLETED") completedSubtasks++;
      if (
        (st.status as string) === "WAITING_APPROVAL" ||
        (st.status as string) === "NEEDS_REVIEW" ||
        (st.status as string) === "PENDING_EXECUTIVE_APPROVAL"
      ) {
        subtasksWaitingApprovalCount++;
      }
      if (st.dueDate && isTaskPastDue(st.dueDate, refDate) && st.status !== "COMPLETED") {
        subtasksUrgentOverdueCount++;
      }
    });
  });

  const waitingApprovalCount = parentWaitingApprovalCount + subtasksWaitingApprovalCount;
  const urgentOverdueCount = parentUrgentOverdueCount + subtasksUrgentOverdueCount;
  const totalWorkItems = totalParentTasks + totalSubtasks;
  const parentCompletionRate =
    totalParentTasks > 0 ? Math.round((completedParentTasks / totalParentTasks) * 100) : 0;

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
        const isOverdue = Boolean(st.dueDate && isTaskPastDue(st.dueDate));
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
        const isOverdue = Boolean(t.dueDate && isTaskPastDue(t.dueDate));
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
      totalParentTasks,
      completedParentTasks,
      parentCompletionRate,
      waitingApprovalCount,
      urgentOverdueCount,
      totalSubtasks,
      completedSubtasks,
      totalWorkItems,
      subtasksWaitingApprovalCount,
      subtasksUrgentOverdueCount,
      parentWaitingApprovalCount,
      parentUrgentOverdueCount,
      // Backwards compatibility properties:
      totalTasks: totalParentTasks,
      completedCount: completedParentTasks,
      completedRate: parentCompletionRate,
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
