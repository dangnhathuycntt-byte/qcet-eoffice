/**
 * Canonical Workspace Metrics & Aggregation Engine
 *
 * Consolidates user matching, department filtering, status predicates,
 * workbox counters, and attention queue aggregation across all workspace views
 * (SmartWorkbox, UnifiedAdaptiveWorkspace tab counts, ExecutiveStatStrip, PersonalWorkbench).
 */

import type { SchoolTask, StaffTask, TaskStatus } from "@qcet/contracts/types/dashboard";
import type { AuthUser } from "@qcet/contracts/types/auth";
import { isTaskPastDue, getSystemReferenceDate } from "@qcet/shared/lib/academic-calendar";
import { matchesUser } from "@/lib/role-task-filter";

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
 * Định nghĩa "Trễ hạn" duy nhất cho tab, bộ lọc thời hạn và bộ đếm: nhiệm vụ chưa xong, chưa hủy
 * và hạn của chính nó đã qua. Việc con trễ không kéo nhiệm vụ cha vào Trễ hạn.
 */
export function isOpenTaskOverdue(
  t: SchoolTask,
  refDate: string = getSystemReferenceDate()
): boolean {
  if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") {
    return false;
  }
  if (t.isOverdue) return true;
  return Boolean(t.dueDate && isTaskPastDue(t.dueDate, refDate));
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
    isOpenTaskOverdue(t, referenceDate)
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
