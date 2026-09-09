import type { SchoolTask, DashboardStats, TaskCategory } from "@/types/dashboard";
import { getSystemReferenceDate, isTaskPastDue } from "@/lib/academic-calendar";

export function computeSchoolTaskRollup(task: SchoolTask): SchoolTask {
  const totalSubTasks = task.subTasks ? task.subTasks.length : 0;
  const completedSubTasks = totalSubTasks > 0
    ? task.subTasks.filter((st) => st.status === "COMPLETED").length
    : 0;

  const progressPercent = totalSubTasks > 0
    ? Math.round((completedSubTasks / totalSubTasks) * 100)
    : task.status === "COMPLETED"
      ? 100
      : (typeof task.progressPercent === "number" && !isNaN(task.progressPercent)
          ? task.progressPercent
          : 0);

  return {
    ...task,
    totalSubTasks,
    completedSubTasks,
    progressPercent,
  };
}

export function computeDashboardStats(
  tasks: SchoolTask[],
  referenceDate: string = getSystemReferenceDate()
): DashboardStats {
  const totalSchoolTasks = tasks.length;

  let schoolTasksCompleted = 0;
  let schoolTasksInProgress = 0;
  let schoolTasksNotStarted = 0;
  let schoolTasksWaitingApproval = 0;
  let schoolTasksOverdue = 0;
  let cancelledTasksCount = 0;

  let totalStaffTasks = 0;
  let staffTasksCompleted = 0;
  let staffTasksInProgress = 0;
  let staffTasksNotStarted = 0;
  let staffTasksWaitingApproval = 0;
  let staffTasksOverdue = 0;

  let totalProgress = 0;

  for (const t of tasks) {
    if ((t.status as string) === "CANCELLED") {
      cancelledTasksCount++;
      continue;
    }

    const rawProgress =
      typeof t.progressPercent === "number" && !isNaN(t.progressPercent)
        ? t.progressPercent
        : t.status === "COMPLETED"
        ? 100
        : 0;
    totalProgress += rawProgress;

    const isWaitingApproval =
      (t.status as string) === "WAITING_APPROVAL" ||
      t.status === "PENDING_EXECUTIVE_APPROVAL" ||
      (rawProgress === 100 && t.status !== "COMPLETED");

    const isOverdue =
      (t.status as string) === "OVERDUE" ||
      (t.status as string) === "BLOCKED" ||
      (t.status !== "COMPLETED" && isTaskPastDue(t.dueDate, referenceDate));

    if (t.status === "COMPLETED") {
      schoolTasksCompleted++;
    } else if (isWaitingApproval) {
      schoolTasksWaitingApproval++;
    } else if (isOverdue) {
      schoolTasksOverdue++;
    } else if ((t.status as string) === "NOT_STARTED") {
      schoolTasksNotStarted++;
    } else {
      schoolTasksInProgress++;
    }

    for (const sub of t.subTasks || []) {
      if ((sub.status as string) === "CANCELLED") continue;
      totalStaffTasks++;

      const isSubWaiting =
        sub.status === "NEEDS_REVIEW" ||
        (sub.status as string) === "WAITING_APPROVAL" ||
        sub.requiresReview === true;

      const isSubOverdue =
        (sub.status as string) === "OVERDUE" ||
        (sub.status as string) === "BLOCKED" ||
        (sub.status !== "COMPLETED" && isTaskPastDue(sub.dueDate, referenceDate));

      if (sub.status === "COMPLETED") {
        staffTasksCompleted++;
      } else if (isSubWaiting) {
        staffTasksWaitingApproval++;
      } else if (isSubOverdue) {
        staffTasksOverdue++;
      } else if ((sub.status as string) === "NOT_STARTED") {
        staffTasksNotStarted++;
      } else {
        staffTasksInProgress++;
      }
    }
  }

  const validSchoolTasks = totalSchoolTasks - cancelledTasksCount;
  const averageSchoolProgressPercent =
    validSchoolTasks > 0 ? Math.round(totalProgress / validSchoolTasks) : 0;
  const completionRate =
    validSchoolTasks > 0 ? Math.round((schoolTasksCompleted / validSchoolTasks) * 100) : 0;

  return {
    totalSchoolTasks,
    schoolTasksInProgress,
    schoolTasksCompleted,
    schoolTasksNotStarted,
    schoolTasksWaitingApproval,
    schoolTasksOverdue,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    staffTasksNotStarted,
    staffTasksWaitingApproval,
    staffTasksOverdue,
    needsReviewTasksCount: schoolTasksWaitingApproval + staffTasksWaitingApproval,
    overdueTasksCount: schoolTasksOverdue + staffTasksOverdue,
    averageSchoolProgressPercent,
    completionRate,
    cancelledTasksCount,
    totalTasks: validSchoolTasks,
    inProgressTasks: schoolTasksInProgress,
    completedTasks: schoolTasksCompleted,
    overdueTasks: schoolTasksOverdue,
    pendingApprovals: schoolTasksWaitingApproval,
  };
}

export function filterSchoolTasks(
  tasks: SchoolTask[],
  filter: { query?: string; category?: TaskCategory | "ALL"; lead?: string }
): SchoolTask[] {
  return tasks.filter((t) => {
    if (filter.category && filter.category !== "ALL" && t.category !== filter.category) {
      return false;
    }
    if (filter.lead && filter.lead !== "ALL" && t.leadAssigneeName !== filter.lead) {
      return false;
    }
    if (filter.query && filter.query.trim() !== "") {
      const q = filter.query.toLowerCase().trim();
      const matchTitle = t.title?.toLowerCase().includes(q) ?? false;
      const matchLead = t.leadAssigneeName?.toLowerCase().includes(q) ?? false;
      const matchSub = (t.subTasks || []).some(
        (sub) =>
          sub.title?.toLowerCase().includes(q) ||
          sub.assigneeName?.toLowerCase().includes(q)
      );
      if (!matchTitle && !matchLead && !matchSub) return false;
    }
    return true;
  });
}
