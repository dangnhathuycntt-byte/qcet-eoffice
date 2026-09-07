import { SchoolTask, StaffTask } from "../types/dashboard";
import { AuthUser } from "../types/auth";
import {
  AssigneeWorkloadItem,
  GroupedParentTaskView,
  OwnershipRoleFilter,
} from "../types/workspace";
import { matchesUser } from "./role-task-filter";

/**
 * Calculates workload distribution (total tasks and completed count) per assignee.
 */
export function calculateAssigneeWorkloads(
  subTasks: StaffTask[] = []
): AssigneeWorkloadItem[] {
  const map = new Map<string, { count: number; completedCount: number; assigneeId?: string }>();

  for (const st of subTasks) {
    const key = st.assigneeName.trim();
    if (!key) continue;

    const current = map.get(key) || { count: 0, completedCount: 0, assigneeId: st.assigneeId };
    current.count += 1;
    if (st.status === "COMPLETED") {
      current.completedCount += 1;
    }
    if (st.assigneeId && !current.assigneeId) {
      current.assigneeId = st.assigneeId;
    }
    map.set(key, current);
  }

  return Array.from(map.entries()).map(([assigneeName, data]) => ({
    assigneeName,
    assigneeId: data.assigneeId,
    count: data.count,
    completedCount: data.completedCount,
  }));
}

/**
 * Groups school tasks into 2-tier parent views for a given user.
 */
export function groupSchoolTasksForWorkspace(
  tasks: SchoolTask[] = [],
  user: AuthUser
): GroupedParentTaskView[] {
  if (!tasks || tasks.length === 0 || !user) return [];

  const results: GroupedParentTaskView[] = [];

  for (const task of tasks) {
    const isLeading = matchesUser(task.leadAssigneeName, user);
    const isCoAssignee = Boolean(
      task.coAssignees && task.coAssignees.some((ca) => matchesUser(ca, user))
    );

    const userSubTasks = (task.subTasks || []).filter(
      (st) =>
        (st.assigneeId && st.assigneeId === user.id) ||
        matchesUser(st.assigneeName, user)
    );

    // User is relevant if they are DRI, in coAssignees, or have assigned subtasks
    const isRelevant = isLeading || isCoAssignee || userSubTasks.length > 0;
    if (!isRelevant) continue;

    const isParticipating = !isLeading && (isCoAssignee || userSubTasks.length > 0);
    const isAwaitingAssignment = isParticipating && userSubTasks.length === 0;
    const workloads = calculateAssigneeWorkloads(task.subTasks || []);

    results.push({
      parentTask: task,
      isLeading,
      isParticipating,
      isAwaitingAssignment,
      workloads,
      userSubTasks,
      allSubTasks: task.subTasks || [],
    });
  }

  return results;
}

/**
 * Filters grouped tasks by ownership filter (ALL, LEADING, PARTICIPATING),
 * status filter, and optional search term.
 */
export function filterGroupedTasks(
  groups: GroupedParentTaskView[],
  options: {
    ownershipFilter: OwnershipRoleFilter;
    statusFilter?: string;
    searchTerm?: string;
  }
): GroupedParentTaskView[] {
  const { ownershipFilter, statusFilter, searchTerm } = options;
  const normalizedSearch = searchTerm?.trim().toLowerCase() || "";

  return groups.filter((group) => {
    // 1. Ownership Filter
    if (ownershipFilter === "LEADING" && !group.isLeading) return false;
    if (ownershipFilter === "PARTICIPATING" && !group.isParticipating) return false;

    // 2. Search Term Matching
    if (normalizedSearch) {
      const matchParent =
        group.parentTask.title.toLowerCase().includes(normalizedSearch) ||
        group.parentTask.leadAssigneeName.toLowerCase().includes(normalizedSearch) ||
        group.parentTask.categoryLabel.toLowerCase().includes(normalizedSearch);

      const relevantSubTasks = group.isLeading
        ? group.allSubTasks
        : group.userSubTasks;

      const matchSub = relevantSubTasks.some((st) =>
        st.title.toLowerCase().includes(normalizedSearch) ||
        st.assigneeName.toLowerCase().includes(normalizedSearch)
      );

      if (!matchParent && !matchSub) return false;
    }

    // 3. Status Filter (if provided and not ALL)
    if (statusFilter && statusFilter !== "ALL") {
      if (statusFilter === "COMPLETED") {
        return group.parentTask.status === "COMPLETED";
      }
      if (statusFilter === "IN_PROGRESS") {
        return group.parentTask.status === "IN_PROGRESS";
      }
      // If filtering by subtask criteria like NEEDS_REVIEW, check relevant subtasks
      const relevantSubTasks = group.isLeading
        ? group.allSubTasks
        : group.userSubTasks;
      return relevantSubTasks.some((st) => st.status === statusFilter);
    }

    return true;
  });
}
