import { SchoolTask, DashboardStats, TaskCategory } from "../types/dashboard";

export function computeSchoolTaskRollup(task: SchoolTask): SchoolTask {
  const totalSubTasks = task.subTasks.length;
  const completedSubTasks = task.subTasks.filter((st) => st.status === "COMPLETED").length;
  const progressPercent = totalSubTasks > 0
    ? Math.round((completedSubTasks / totalSubTasks) * 100)
    : task.status === "COMPLETED" ? 100 : 0;

  return {
    ...task,
    totalSubTasks,
    completedSubTasks,
    progressPercent,
  };
}

export function computeDashboardStats(tasks: SchoolTask[]): DashboardStats {
  const totalSchoolTasks = tasks.length;
  const schoolTasksCompleted = tasks.filter((t) => t.status === "COMPLETED").length;
  const schoolTasksInProgress = totalSchoolTasks - schoolTasksCompleted;

  let totalStaffTasks = 0;
  let staffTasksCompleted = 0;
  let staffTasksInProgress = 0;
  let needsReviewTasksCount = 0;
  let overdueTasksCount = 0;
  let totalProgress = 0;

  const now = new Date();

  for (const t of tasks) {
    totalProgress += t.progressPercent;
    for (const sub of t.subTasks) {
      totalStaffTasks++;
      if (sub.status === "COMPLETED") staffTasksCompleted++;
      if (sub.status === "IN_PROGRESS") staffTasksInProgress++;
      if (sub.status === "NEEDS_REVIEW") needsReviewTasksCount++;
      if (new Date(sub.dueDate) < now && sub.status !== "COMPLETED") {
        overdueTasksCount++;
      }
    }
  }

  const averageSchoolProgressPercent = totalSchoolTasks > 0
    ? Math.round(totalProgress / totalSchoolTasks)
    : 0;

  return {
    totalSchoolTasks,
    schoolTasksInProgress,
    schoolTasksCompleted,
    totalStaffTasks,
    staffTasksInProgress,
    staffTasksCompleted,
    needsReviewTasksCount,
    overdueTasksCount,
    averageSchoolProgressPercent,
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
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchLead = t.leadAssigneeName.toLowerCase().includes(q);
      const matchSub = t.subTasks.some((sub) => sub.title.toLowerCase().includes(q) || sub.assigneeName.toLowerCase().includes(q));
      if (!matchTitle && !matchLead && !matchSub) return false;
    }
    return true;
  });
}
