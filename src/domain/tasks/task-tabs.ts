/**
 * Các view (tab) của trang Nhiệm vụ: Tất cả · Đang thực hiện · Trễ hạn · Hoàn thành.
 * View là tập nền; bộ lọc trạng thái/thời hạn do người dùng chọn thay thế view (xem `resolveTaskTab`).
 * Hàm thuần, không phụ thuộc UI.
 */

export type TaskTab = "all" | "active" | "overdue" | "done";

export const TASK_TABS: ReadonlyArray<{ id: TaskTab; label: string }> = [
  { id: "all", label: "Tất cả" },
  { id: "active", label: "Đang thực hiện" },
  { id: "overdue", label: "Trễ hạn" },
  { id: "done", label: "Hoàn thành" },
];

const TAB_IDS = new Set<string>(TASK_TABS.map((t) => t.id));

export function parseTaskTab(raw: unknown): TaskTab | undefined {
  return typeof raw === "string" && TAB_IDS.has(raw) ? (raw as TaskTab) : undefined;
}

/**
 * View đang hiệu lực.
 * - URL có `taskTab` hợp lệ: dùng đúng giá trị đó.
 * - Không có, nhưng URL đã mang bộ lọc/đường dẫn sâu (trạng thái, thời hạn, tìm kiếm, nhiệm vụ…): "all",
 *   để liên kết từ nơi khác (bảng điều khiển, thông báo) không bị view mặc định che mất kết quả.
 * - Còn lại: view mặc định của trang (không truyền thì "all").
 */
export function resolveTaskTab(options: {
  param?: TaskTab;
  hasOtherLifecycleFilters: boolean;
  defaultTab?: TaskTab;
}): TaskTab {
  if (options.param) return options.param;
  if (options.hasOtherLifecycleFilters) return "all";
  return options.defaultTab ?? "all";
}

interface TabTask {
  status?: string | null;
}

/** Nhiệm vụ còn dang dở: chưa hoàn thành và chưa hủy (Mới, Đang thực hiện, Chờ duyệt…). */
export function isUnfinishedTask(task: TabTask): boolean {
  return task.status !== "COMPLETED" && task.status !== "CANCELLED";
}

/** Nhiệm vụ có thuộc view không. `isOverdue` do nơi gọi cấp để dùng đúng định nghĩa "Trễ hạn" của bộ lọc thời hạn. */
export function matchesTaskTab<T extends TabTask>(task: T, tab: TaskTab, isOverdue: (task: T) => boolean): boolean {
  switch (tab) {
    case "active":
      return isUnfinishedTask(task);
    case "overdue":
      return isOverdue(task);
    case "done":
      return task.status === "COMPLETED";
    default:
      return true;
  }
}
