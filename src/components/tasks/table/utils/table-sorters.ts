import type { SchoolTask } from "@/types/dashboard";
import type {
  ColumnSortState,
  SortDirection,
  TaskSortField,
} from "../types";
import { sortTasks } from "./table-filter-engine";

export type {
  ColumnSortState,
  SortDirection,
  TaskSortField,
};

export { sortTasks };

/**
 * Trọng số ưu tiên (Priority weights) dùng trong phân loại và sắp xếp nhiệm vụ
 */
export const TASK_PRIORITY_WEIGHTS: Record<string, number> = {
  URGENT: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

/**
 * So sánh chuỗi tiếng Việt chuẩn có tính đến số (numeric collation)
 */
export function compareVietnameseStrings(
  a: string,
  b: string,
  direction: SortDirection = "asc"
): number {
  const factor = direction === "asc" ? 1 : -1;
  return factor * a.localeCompare(b, "vi", { numeric: true, sensitivity: "base" });
}

/**
 * So sánh giá trị số an toàn
 */
export function compareNumbers(
  a: number,
  b: number,
  direction: SortDirection = "asc"
): number {
  const factor = direction === "asc" ? 1 : -1;
  return factor * (a - b);
}
