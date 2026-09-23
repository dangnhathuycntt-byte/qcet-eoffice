/**
 * Canonical Workspace Metrics & Aggregation Engine
 *
 * Consolidates user matching, department filtering, status predicates,
 * workbox counters, and attention queue aggregation across all workspace views
 * (SmartWorkbox, UnifiedAdaptiveWorkspace tab counts, ExecutiveStatStrip, PersonalWorkbench).
 */

import type { SchoolTask, StaffTask, TaskStatus, DashboardStats } from "@/types/dashboard";
import type { AuthUser, UserRole } from "@/types/auth";
import { isTaskPastDue, getSystemReferenceDate } from "@/lib/academic-calendar";
import { matchesUser } from "@/lib/role-task-filter";
import type { ExecutiveActionStats } from "@/lib/executive-matrix-aggregator";

export type WorkspaceScope = "school" | "unit" | "my";

// ============================================================================
// 1. User & Department Matching
// ============================================================================

/**
 * Check if a subtask is assigned to a specific user by ID, exact name, or alias.
 */
export function isSubTaskAssignedToUser(
  st: StaffTask,
  user?: AuthUser | null
): boolean {
  if (!user) return false;
  const anySt = st as any;
  if (user.id && (anySt.assignedToId === user.id || anySt.assignedTo === user.id || anySt.assigneeId === user.id)) {
    return true;
  }
  if (st.assignedTo === user.name || st.assigneeName === user.name) {
    return true;
  }
  if (matchesUser(st.assignedTo, user) || matchesUser(st.assigneeName, user)) {
    return true;
  }
  if (Array.isArray(anySt.collaborators)) {
    return anySt.collaborators.some(
      (c: any) =>
        (user.id && c.id === user.id) ||
        c.name === user.name ||
        matchesUser(c.name, user)
    );
  }
  return false;
}

/**
 * Check if a task is assigned to a specific user (as lead, co-assignee, or subtask assignee).
 */
export function isTaskAssignedToUser(
  t: SchoolTask,
  user?: AuthUser | null
): boolean {
  if (!user) return false;
  const anyT = t as any;

  if (user.id && (anyT.assignedToId === user.id || anyT.assignedTo === user.id || anyT.leadAssigneeId === user.id)) {
    return true;
  }
  if (t.assignedTo === user.name || t.leadAssigneeName === user.name) {
    return true;
  }
  if (matchesUser(t.assignedTo, user) || matchesUser(t.leadAssigneeName, user)) {
    return true;
  }
  if (Array.isArray(t.coAssignees)) {
    const matchCo = t.coAssignees.some(
      (ca: any) =>
        (typeof ca === "string" && (ca === user.name || matchesUser(ca, user))) ||
        (ca && typeof ca === "object" && ((user.id && ca.id === user.id) || ca.name === user.name || matchesUser(ca.name, user)))
    );
    if (matchCo) return true;
  }
  if (Array.isArray(t.subTasks)) {
    return t.subTasks.some((st) => isSubTaskAssignedToUser(st, user));
  }
  return false;
}

/**
 * Check if a task belongs to a department by department code or name.
 */
export function isTaskInDepartment(
  t: SchoolTask,
  departmentCodeOrName?: string | null
): boolean {
  if (!departmentCodeOrName) return true;
  const target = departmentCodeOrName.trim().toLowerCase();

  const matchParent =
    t.departmentCode?.toLowerCase() === target ||
    t.department?.toLowerCase() === target ||
    t.leadDepartmentCode?.toLowerCase() === target ||
    t.leadDepartment?.toLowerCase() === target;
  if (matchParent) return true;

  if (Array.isArray(t.subTasks)) {
    return t.subTasks.some(
      (st) =>
        st.departmentCode?.toLowerCase() === target ||
        st.department?.toLowerCase() === target
    );
  }
  return false;
}

/**
 * Check if a task is assigned to a user OR user's unit.
 */
export function isTaskAssignedToUserOrUnit(
  t: SchoolTask,
  user?: AuthUser | null
): boolean {
  if (!user) return true;
  if (isTaskAssignedToUser(t, user)) return true;
  const userDept = user.departmentCode || user.department;
  if (userDept && isTaskInDepartment(t, userDept)) return true;
  return false;
}

// ============================================================================
// 2. Status, Workflow & Overdue Predicates
// ============================================================================

/**
 * Checks whether a status represents waiting for review/approval.
 */
export function isTaskWaitingApproval(
  status?: TaskStatus | string | null
): boolean {
  if (!status) return false;
  return (
    status === "WAITING_APPROVAL" ||
    status === "PENDING_EXECUTIVE_APPROVAL" ||
    status === "NEEDS_REVIEW" ||
    status === "PENDING" ||
    status === "IN_REVIEW"
  );
}

/**
 * Checks whether a task or any of its subtasks is awaiting approval.
 */
export function hasTaskWaitingApproval(t: SchoolTask): boolean {
  if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") {
    return false;
  }
  if (isTaskWaitingApproval(t.status)) return true;
  if (t.progressPercent === 100) return true;

  if (Array.isArray(t.subTasks)) {
    return t.subTasks.some(
      (st) =>
        st.status !== "COMPLETED" &&
        (st.status as string) !== "CANCELLED" &&
        (isTaskWaitingApproval(st.status) || st.requiresReview === true)
    );
  }
  return false;
}

/**
 * Checks whether a task status is active (in-progress, todo, not started).
 */
export function isActiveTaskStatus(
  status?: TaskStatus | string | null
): boolean {
  if (!status) return false;
  return (
    status === "IN_PROGRESS" ||
    status === "TODO" ||
    status === "NOT_STARTED" ||
    status === "ASSIGNED" ||
    status === "NEW"
  );
}

/**
 * Checks whether a task or any of its uncompleted subtasks is overdue.
 */
export function isTaskOverdueOrHasOverdueSubtask(
  t: SchoolTask,
  refDate: string = getSystemReferenceDate()
): boolean {
  if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") {
    return false;
  }
  if (t.isOverdue) return true;

  const parentOverdue = Boolean(t.dueDate && isTaskPastDue(t.dueDate, refDate));
  const subtaskOverdue = Boolean(
    t.subTasks?.some(
      (st) =>
        st.status !== "COMPLETED" &&
        (st.status as string) !== "CANCELLED" &&
        Boolean(st.dueDate && isTaskPastDue(st.dueDate, refDate))
    )
  );

  return parentOverdue || subtaskOverdue;
}

/**
 * Checks whether a task or any of its subtasks is blocked.
 */
export function isTaskBlocked(t: SchoolTask): boolean {
  if ((t.status as string) === "BLOCKED") return true;
  return Boolean(
    t.subTasks?.some((st) => (st.status as string) === "BLOCKED")
  );
}

// ============================================================================
// 3. Smart Workbox Counters Aggregator
// ============================================================================

export interface SmartWorkboxCounts {
  myCount: number;
  waitingApprovalCount: number;
  pendingSubmissionCount: number;
  overdueCount: number;
}

/**
 * Pure canonical calculation for Smart Workbox counters.
 */
export function computeSmartWorkboxCounts({
  tasks = [],
  user,
  roleScope = "my",
  referenceDate = getSystemReferenceDate(),
}: {
  tasks?: SchoolTask[];
  user?: AuthUser | null;
  roleScope?: WorkspaceScope | string;
  referenceDate?: string;
}): SmartWorkboxCounts {
  const normScope = (roleScope || "my").toLowerCase();
  let myCount = 0;
  let waitingApprovalCount = 0;
  let pendingSubmissionCount = 0;
  let overdueCount = 0;

  for (const t of tasks) {
    if ((t.status as string) === "CANCELLED") continue;

    let inScope = false;
    if (normScope === "school" || normScope === "school_tasks") {
      inScope = true;
    } else if (normScope === "unit" || normScope === "unit_tasks") {
      inScope = !user || isTaskAssignedToUserOrUnit(t, user);
    } else {
      inScope = !user || isTaskAssignedToUser(t, user);
    }

    if (!inScope) continue;

    // 1. My / Active in-scope tasks
    if (t.status !== "COMPLETED") {
      myCount++;
    }

    // 2. Waiting approval count
    if (t.status !== "COMPLETED" && hasTaskWaitingApproval(t)) {
      waitingApprovalCount++;
    }

    // 3. Pending submission count
    if (t.status !== "COMPLETED" && !hasTaskWaitingApproval(t)) {
      const isActive =
        isActiveTaskStatus(t.status) ||
        Boolean(t.subTasks?.some((st) => isActiveTaskStatus(st.status)));
      if (isActive) {
        pendingSubmissionCount++;
      }
    }

    // 4. Overdue count
    if (
      t.status !== "COMPLETED" &&
      isTaskOverdueOrHasOverdueSubtask(t, referenceDate)
    ) {
      overdueCount++;
    }
  }

  return {
    myCount,
    waitingApprovalCount,
    pendingSubmissionCount,
    overdueCount,
  };
}

// ============================================================================
// 4. Workspace Tab Counts Aggregator
// ============================================================================

export interface WorkspaceTabCounts {
  [key: string]: number;
  all: number;
  my: number;
  waiting_approval: number;
  pending_submission: number;
  overdue: number;
  today: number;
  this_week: number;
}

/**
 * Pure canonical calculation for Unified Adaptive Workspace tab badges.
 */
export function computeWorkspaceTabCounts({
  scopedTasks = [],
  user,
  referenceDate = getSystemReferenceDate(),
  pendingApprovalsCount,
  pendingSubmissionsCount,
}: {
  scopedTasks?: SchoolTask[];
  user?: AuthUser | null;
  referenceDate?: string;
  pendingApprovalsCount?: number;
  pendingSubmissionsCount?: number;
}): WorkspaceTabCounts {
  const activeTasks = scopedTasks.filter(
    (t) => t.status !== "COMPLETED" && (t.status as string) !== "CANCELLED"
  );

  const my = activeTasks.filter((t) =>
    !user ? true : isTaskAssignedToUser(t, user)
  ).length;

  const waiting_approval =
    pendingApprovalsCount !== undefined && pendingApprovalsCount > 0
      ? pendingApprovalsCount
      : activeTasks.filter((t) => hasTaskWaitingApproval(t)).length;

  const pending_submission =
    pendingSubmissionsCount !== undefined && pendingSubmissionsCount > 0
      ? pendingSubmissionsCount
      : activeTasks.filter(
          (t) =>
            !hasTaskWaitingApproval(t) &&
            (isActiveTaskStatus(t.status) ||
              Boolean(
                t.subTasks?.some((st) => isActiveTaskStatus(st.status))
              ))
        ).length;

  const overdue = activeTasks.filter((t) =>
    isTaskOverdueOrHasOverdueSubtask(t, referenceDate)
  ).length;

  const today = activeTasks.filter((t) =>
    Boolean(t.dueDate && t.dueDate.startsWith(referenceDate))
  ).length;

  // Due within 7 days from reference date
  const refDateObj = new Date(referenceDate);
  const endOfWeekObj = new Date(refDateObj);
  endOfWeekObj.setDate(endOfWeekObj.getDate() + 7);
  const endOfWeekStr = endOfWeekObj.toISOString().split("T")[0];

  const this_week = activeTasks.filter((t) => {
    const isDueThisWeek = t.dueDate && t.dueDate >= referenceDate && t.dueDate <= endOfWeekStr;
    const hasSubDueThisWeek = t.subTasks?.some(
      (s) => s.status !== "COMPLETED" && s.dueDate && s.dueDate >= referenceDate && s.dueDate <= endOfWeekStr
    );
    return isDueThisWeek || hasSubDueThisWeek;
  }).length;

  return {
    all: scopedTasks.length,
    my,
    waiting_approval,
    pending_submission,
    overdue,
    today,
    this_week,
  };
}

// ============================================================================
// 5. Executive Action Stats Aggregator
// ============================================================================

/**
 * Pure canonical calculation for Executive Action Stats (School level).
 */
export function computeExecutiveActionStatsUnified(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): ExecutiveActionStats {
  let pendingSchoolApprovalCount = 0;
  let blockedTasksCount = 0;
  let overdueTasksCount = 0;
  let strategicActiveCount = 0;

  for (const task of tasks) {
    if ((task.status as string) === "CANCELLED") continue;

    if (task.status !== "COMPLETED") {
      const isWaiting =
        (task.status as string) === "WAITING_APPROVAL" ||
        task.status === "PENDING_EXECUTIVE_APPROVAL" ||
        task.progressPercent === 100;
      const hasSubtaskNeedingReview = (task.subTasks || []).some(
        (st) =>
          (st.status as string) !== "CANCELLED" &&
          (st.status === "NEEDS_REVIEW" ||
            st.requiresReview === true ||
            isTaskWaitingApproval(st.status))
      );
      if (isWaiting || hasSubtaskNeedingReview) {
        pendingSchoolApprovalCount++;
      }
    }

    if (task.status === "IN_PROGRESS") {
      strategicActiveCount++;
    }

    if ((task.status as string) === "BLOCKED") {
      blockedTasksCount++;
    }
    for (const sub of task.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;
      if ((sub.status as string) === "BLOCKED") {
        blockedTasksCount++;
      }
      if (sub.status !== "COMPLETED" && isTaskPastDue(sub.dueDate, referenceDate)) {
        overdueTasksCount++;
      }
    }
    if (task.status !== "COMPLETED" && isTaskPastDue(task.dueDate, referenceDate)) {
      overdueTasksCount++;
    }
  }

  return {
    pendingSchoolApprovalCount,
    blockedTasksCount,
    overdueTasksCount,
    strategicActiveCount,
  };
}
