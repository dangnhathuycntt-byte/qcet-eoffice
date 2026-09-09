import type * as React from "react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
  TaskPriority,
} from "@/types/dashboard";

/**
 * Mật độ hiển thị bảng công việc (Table Density)
 * - compact: 36px hàng (dày đặc thông tin, tối ưu cho điều hành viên)
 * - comfortable: 48px hàng (thoáng đãng, tiêu chuẩn hành chính)
 */
export type TableDensity = "compact" | "comfortable";

/**
 * Thẻ lọc thông minh (Smart Filter Tabs) theo chuẩn Linear / công quyền hiện đại
 */
export type SmartFilterTab =
  | "all"        // Tất cả nhiệm vụ
  | "my_tasks"   // Nhiệm vụ phân công cho tôi (DRI hoặc việc con)
  | "overdue"    // Nhiệm vụ quá hạn SLA
  | "review"     // Chờ duyệt minh chứng / cần chỉnh sửa
  | "today"      // Hạn chót hôm nay theo ngày tham chiếu
  | "in_progress"// Đang thực hiện
  | "completed"; // Đã hoàn thành

/**
 * Chiều sắp xếp dữ liệu
 */
export type SortDirection = "asc" | "desc";

/**
 * Các trường dữ liệu hỗ trợ sắp xếp trên bảng
 */
export type TaskSortField =
  | "code"
  | "title"
  | "dueDate"
  | "status"
  | "progress"
  | "leadAssignee"
  | "category"
  | "priority"
  | "department";

/**
 * Trạng thái sắp xếp cột
 */
export interface ColumnSortState {
  field?: TaskSortField;
  column?: TaskSortField | string;
  direction: SortDirection;
}

/**
 * Trạng thái lựa chọn checkbox đa dòng (Selection State)
 */
export interface SelectionState {
  selectedIds: Set<string>;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  totalSelected: number;
}

/**
 * Trạng thái bộ lọc đa chiều của bảng nhiệm vụ
 */
export interface TaskTableFilterState {
  search: string;
  category: TaskCategory | "ALL";
  department: string;
  tab: SmartFilterTab;
  month?: number | "ALL";
  academicYear?: string;
}

/**
 * Cấu hình mật độ hiển thị
 */
export interface TableDensityConfig {
  id: TableDensity;
  label: string;
  rowHeight: string;
  padding: string;
  fontSize: string;
}

/**
 * Chế độ hiển thị không gian làm việc
 */
export type TaskViewMode = "table" | "kanban" | "gantt";

/**
 * Tab lọc danh mục DACUM
 */
export interface CategoryTab {
  id: TaskCategory | "ALL";
  label: string;
  icon?: React.ComponentType<{ className?: string; strokeWidth?: number }>;
}

/**
 * Tùy chọn lọc đơn vị phòng ban
 */
export interface DepartmentOption {
  id: string;
  label: string;
  code?: string;
}

/**
 * Cấu hình thẻ lọc thông minh
 */
export interface SmartFilterTabOption {
  id: SmartFilterTab;
  label: string;
  description?: string;
  count?: number;
}

/**
 * Kết quả tính toán cuốn chiếu tiến độ nhiệm vụ (Rollup)
 */
export interface TaskProgressRollupResult {
  progressPercent: number;
  totalSubTasks: number;
  completedSubTasks: number;
  isAllCompleted: boolean;
  hasSubtasks: boolean;
}

/**
 * Trạng thái nhãn SLA hạn chót
 */
export interface SlaBadgeStatus {
  label: string;
  colorClass: string;
  isOverdue: boolean;
  isToday: boolean;
  daysRemaining: number | null;
  formattedDate: string;
}

/**
 * Thực thể công việc làm phẳng cho chế độ xem việc cá nhân (Personal Workbox)
 */
export type FlattenedPersonalTask = (SchoolTask | StaffTask) & {
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  parentSchoolTaskCode?: string;
  isFlattenedSubtask?: boolean;
};

/**
 * Props cho bảng nhiệm vụ phân cấp mới (TaskTableProps)
 */
export interface TaskTableProps {
  tasks: SchoolTask[];
  loading?: boolean;
  onTaskClick?: (task: SchoolTask) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void; // Backward compatibility
  onSubTaskClick?: (subTask: StaffTask, parentTask: SchoolTask) => void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    isSubTask?: boolean,
    parentId?: string
  ) => Promise<void> | void;
  onUrge?: (
    taskId: string,
    taskTitle: string,
    assigneeName: string
  ) => Promise<void> | void;
  onBulkStatusChange?: (
    taskIds: string[],
    newStatus: TaskStatus
  ) => Promise<void> | void;
  onBulkDelete?: (taskIds: string[]) => Promise<void> | void;
  onBulkReassign?: (
    taskIds: string[],
    newAssigneeId: string
  ) => Promise<void> | void;
  onBulkExtendDeadline?: (
    taskIds: string[],
    newDueDate: string
  ) => Promise<void> | void;
  onAddTask?: () => void;
  onRefresh?: () => Promise<void> | void;
  onOpenSubmitModal?: (task: StaffTask) => void;

  // Ngữ cảnh người dùng
  currentUserId?: string;
  currentUserRole?: string;
  currentUserDepartment?: string;
  currentUserName?: string;

  // Trạng thái khởi tạo
  initialDensity?: TableDensity;
  initialTab?: SmartFilterTab;
  initialCategory?: TaskCategory | "ALL";
  initialDepartment?: string;
  initialSearch?: string;
  initialPage?: number;
  pageSize?: number;
  selectedAcademicMonth?: number | "ALL";
  academicYear?: string;
  priorOverdueBacklog?: SchoolTask[];

  // Tùy chỉnh hiển thị
  className?: string;
  hideToolbar?: boolean;
  hidePagination?: boolean;
}
