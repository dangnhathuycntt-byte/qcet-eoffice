import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type { TaskProgressRollupResult } from "../types";

/**
 * Trích xuất phần trăm tiến độ của một việc con (0 - 100).
 * Nếu không xác định, tự động quy đổi: COMPLETED -> 100, các trạng thái khác -> 0.
 */
export function getSubtaskProgressPercent(
  subTask: Partial<StaffTask> & { progressPercent?: number; status?: string }
): number {
  if (
    typeof subTask.progressPercent === "number" &&
    !isNaN(subTask.progressPercent)
  ) {
    return Math.max(0, Math.min(100, Math.round(subTask.progressPercent)));
  }

  if (subTask.status === "COMPLETED") {
    return 100;
  }

  return 0;
}

/**
 * Lấy trọng số chuẩn hóa của công việc con (Weight >= 1).
 * Nếu không khai báo hoặc <= 0, mặc định là 1.
 */
export function getSubtaskWeight(
  subTask: Partial<StaffTask> & { weight?: number }
): number {
  if (
    typeof subTask.weight === "number" &&
    !isNaN(subTask.weight) &&
    subTask.weight > 0
  ) {
    return subTask.weight;
  }
  return 1;
}

/**
 * Tính toán tiến độ cuốn chiếu có trọng số (Weighted Progress Rollup):
 * Rollup = Sum(Progress_i * Weight_i) / Sum(Weight_i)
 */
export function calculateSubtasksWeightedProgress(
  subTasks?: Array<Partial<StaffTask> & { weight?: number; progressPercent?: number; status?: string }>
): number {
  if (!subTasks || subTasks.length === 0) {
    return 0;
  }

  let totalWeightedProgress = 0;
  let totalWeight = 0;

  for (const st of subTasks) {
    const progress = getSubtaskProgressPercent(st);
    const weight = getSubtaskWeight(st);

    totalWeightedProgress += progress * weight;
    totalWeight += weight;
  }

  if (totalWeight <= 0) {
    return 0;
  }

  const rawRollup = totalWeightedProgress / totalWeight;
  return Math.max(0, Math.min(100, Math.round(rawRollup)));
}

/**
 * Tính toán trạng thái tổng hợp tiến độ và số lượng việc con cho nhiệm vụ cha (SchoolTask)
 */
export function calculateTaskProgressRollup(
  task: SchoolTask
): TaskProgressRollupResult {
  const subTasks = task.subTasks;
  const hasSubtasks = Boolean(subTasks && subTasks.length > 0);

  if (hasSubtasks && subTasks) {
    const totalSubTasks = subTasks.length;
    const completedSubTasks = subTasks.filter(
      (st) => st.status === "COMPLETED"
    ).length;
    const isAllCompleted = totalSubTasks > 0 && completedSubTasks === totalSubTasks;
    const progressPercent = calculateSubtasksWeightedProgress(subTasks);

    return {
      progressPercent,
      totalSubTasks,
      completedSubTasks,
      isAllCompleted,
      hasSubtasks: true,
    };
  }

  // Trường hợp không có danh sách subTasks chi tiết trong mảng
  const totalSubTasks = task.totalSubTasks ?? 0;
  const completedSubTasks =
    task.completedSubTasks ??
    (task.status === "COMPLETED" ? totalSubTasks : 0);

  let progressPercent = 0;
  if (
    typeof task.progressPercent === "number" &&
    !isNaN(task.progressPercent)
  ) {
    progressPercent = Math.max(0, Math.min(100, Math.round(task.progressPercent)));
  } else if (task.status === "COMPLETED") {
    progressPercent = 100;
  } else if (totalSubTasks > 0) {
    progressPercent = Math.round((completedSubTasks / totalSubTasks) * 100);
  }

  const isAllCompleted =
    task.status === "COMPLETED" ||
    (totalSubTasks > 0 && completedSubTasks === totalSubTasks);

  return {
    progressPercent,
    totalSubTasks,
    completedSubTasks,
    isAllCompleted,
    hasSubtasks: false,
  };
}

/**
 * Chi tiết phân bổ đóng góp tiến độ của từng việc con vào tổng tiến độ cha
 */
export interface SubtaskProgressBreakdown {
  id: string;
  title: string;
  progressPercent: number;
  weight: number;
  contributionPercent: number; // Tỷ lệ % đóng góp vào tổng việc cha
}

export function getWeightedProgressBreakdown(
  subTasks?: StaffTask[]
): SubtaskProgressBreakdown[] {
  if (!subTasks || subTasks.length === 0) return [];

  const totalWeight = subTasks.reduce(
    (sum, st) => sum + getSubtaskWeight(st),
    0
  );

  return subTasks.map((st) => {
    const progress = getSubtaskProgressPercent(st);
    const weight = getSubtaskWeight(st);
    const contributionPercent =
      totalWeight > 0 ? (progress * weight) / totalWeight : 0;

    return {
      id: st.id,
      title: st.title,
      progressPercent: progress,
      weight,
      contributionPercent: Math.round(contributionPercent * 10) / 10,
    };
  });
}

/**
 * Tính toán tiến độ cuốn chiếu có trọng số với giá trị dự phòng nếu không có việc con.
 */
export function calculateWeightedProgress(
  subTasks?: Array<Partial<StaffTask> & { weight?: number; progressPercent?: number; status?: string }>,
  fallbackParentProgress?: number
): number {
  if (!subTasks || subTasks.length === 0) {
    return typeof fallbackParentProgress === "number"
      ? Math.max(0, Math.min(100, Math.round(fallbackParentProgress)))
      : 0;
  }
  return calculateSubtasksWeightedProgress(subTasks);
}

/**
 * Tính toán nhanh số lượng và tỷ lệ hoàn thành việc con.
 */
export function calculateSimpleRollup(subTasks: StaffTask[]): {
  totalSubTasks: number;
  completedSubTasks: number;
  progressPercent: number;
} {
  const totalSubTasks = subTasks.length;
  const completedSubTasks = subTasks.filter(
    (st) => st.status === "COMPLETED" || (typeof st.progressPercent === "number" && st.progressPercent >= 100)
  ).length;
  const progressPercent = calculateSubtasksWeightedProgress(subTasks);
  return { totalSubTasks, completedSubTasks, progressPercent };
}

/**
 * Tự động chuyển trạng thái hoàn thành hoặc đang làm dựa trên tiến độ tổng hợp.
 */
export function getDerivedTaskStatus(
  progressPercent: number,
  currentStatus: string
): string {
  if (progressPercent >= 100) return "COMPLETED";
  if (currentStatus === "COMPLETED" && progressPercent < 100) return "IN_PROGRESS";
  return currentStatus;
}

