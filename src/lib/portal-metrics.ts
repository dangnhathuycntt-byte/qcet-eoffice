export interface PortalStatsSummary {
  completionRate: number;
  /**
   * Parent tasks only — subtasks are excluded so the denominator matches completionRate.
   * Guaranteed by parentTaskId: null in the dashboard-service query.
   */
  parentTaskTotal: number;
  schoolTasks: number;
  /** True when the parent-task denominator is guaranteed separate from subtasks (the server query constrains parentTaskId: null). */
  isDenominatorSeparated: boolean;
}

export function formatProgressMetric(
  stats: PortalStatsSummary | null,
  isLoading: boolean,
  isAuthenticated: boolean
): string | null {
  if (isLoading) return null;
  if (!isAuthenticated) return "Đăng nhập để xem";
  if (!stats) return "Chưa có dữ liệu";
  return `${stats.completionRate}% hoàn thành (${stats.parentTaskTotal} việc gốc)`;
}

export function formatSchoolTasksMetric(
  stats: PortalStatsSummary | null,
  isLoading: boolean,
  isAuthenticated: boolean
): string | null {
  if (isLoading) return null;
  if (!isAuthenticated) return "Đăng nhập để xem";
  if (!stats) return "Chưa có dữ liệu";
  return `${stats.schoolTasks} việc trọng tâm`;
}
