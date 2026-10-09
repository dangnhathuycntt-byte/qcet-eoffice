// Hàm thuần cho state chi tiết nhiệm vụ: tách khỏi component để test được.

import type { TaskStatus } from "@/types/dashboard";

/** Kết quả của POST /actions/update-progress (server là nguồn sự thật cho status và version). */
export interface ProgressResult {
  status?: TaskStatus;
  progressPercent: number;
  version?: number;
}

/** Áp kết quả server lên task đang hiển thị, không suy đoán status ở client. */
export function applyProgressResult<T extends object>(task: T, result: ProgressResult): T {
  return {
    ...task,
    progressPercent: result.progressPercent,
    progress: result.progressPercent,
    ...(result.status ? { status: result.status } : {}),
    ...(result.version !== undefined ? { version: result.version } : {}),
  };
}

interface AggregateInput {
  subTasks: ReadonlyArray<{ status?: string }>;
  /** Số liệu thô từ server (đếm cả việc con người dùng không được xem). */
  totalSubTasks?: number;
  completedSubTasks?: number;
}

/** Ưu tiên số liệu thô của server; chỉ fallback về danh sách đã lọc quyền khi thiếu. */
export function resolveSubtaskAggregates(input: AggregateInput): { total: number; completed: number } {
  const total = input.totalSubTasks ?? input.subTasks.length;
  const completed =
    input.completedSubTasks ?? input.subTasks.filter((st) => st.status === "COMPLETED").length;
  return { total, completed };
}

/** Phần tiến độ tự động: làm tròn từ số việc con hoàn thành / tổng. */
export function computeProgressFromSubtasks(total: number, completed: number): number {
  return total > 0 ? Math.round((completed / total) * 100) : 0;
}

/**
 * Cập nhật số hoàn thành thô khi một việc con đổi trạng thái (không tải lại trang).
 * Chỉ dịch chuyển theo chênh lệch COMPLETED, không đếm lại toàn bộ danh sách đã lọc.
 */
export function applySubtaskStatusToAggregates<T extends { completedSubTasks?: number }>(
  parent: T,
  previousStatus: string | undefined,
  nextStatus: string | undefined,
): T {
  const delta = (nextStatus === "COMPLETED" ? 1 : 0) - (previousStatus === "COMPLETED" ? 1 : 0);
  if (delta === 0 || parent.completedSubTasks === undefined) return parent;
  return { ...parent, completedSubTasks: Math.max(0, parent.completedSubTasks + delta) };
}
