export interface PortalStatsSummary {
  completionRate: number;
  total: number;
  schoolTasks: number;
}

export function formatProgressMetric(
  stats: PortalStatsSummary | null,
  isLoading: boolean,
  isAuthenticated: boolean
): string {
  if (isLoading) return "Đang tải...";
  if (!isAuthenticated) return "Đăng nhập để xem";
  if (!stats) return "Chưa có dữ liệu";
  return `${stats.completionRate}% hoàn thành (${stats.total} việc)`;
}

export function formatSchoolTasksMetric(
  stats: PortalStatsSummary | null,
  isLoading: boolean,
  isAuthenticated: boolean
): string {
  if (isLoading) return "Đang tải...";
  if (!isAuthenticated) return "Đăng nhập để xem";
  if (!stats) return "Chưa có dữ liệu";
  return `${stats.schoolTasks} việc trọng tâm`;
}
