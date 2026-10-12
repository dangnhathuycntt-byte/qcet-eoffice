"use client";

// Unified Task Toolbar Component — Unified control toolbar for task views
import * as React from "react";
import { Plus, RotateCcw } from "lucide-react";
import { IconSidebarPanel } from "@/components/layout/sidebar-rounded-icons";
import {
  HealthSubAll,
  HealthSubOnTrack,
  HealthSubAtRisk,
  HealthSubOverdue,
  HealthSubCompleted,
  FilterIconStatus,
  FilterIconPriority,
  FilterIconProgress,
  FilterIconLead,
  FilterIconCollaborator,
  FilterIconCategory,
  FilterIconDept,
  FilterIconDeadline,
  FilterIconOrigin,
} from "./task-filter-icons";
import type { TaskView } from "@/domain/tasks";
import { cn } from "@/lib/utils";
import { MENU_POPUP_CLASS, MENU_ROW_CLASS } from "@/components/ui/menu";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  TaskIconPriorityUrgent,
  TaskIconPriorityHigh,
  TaskIconPriorityNormal,
} from "@/components/tasks/task-action-icons";
import {
  TaskIconAssignee,
  TaskIconCollaborators,
  TaskIconDepartment,
  TaskIconPriority,
  TaskIconStatus,
  TaskIconDeadline,
  TaskIconTime,
  TaskIconStatusNew,
  TaskIconSearch,
} from "@/lib/icons/task-icons";
import { VietnameseDayCalendar } from "@/components/ui/vietnamese-day-calendar";
import { ListToolbarFilterButton, ListToolbarSearch, listToolbarIconButtonClass, listToolbarPrimaryButtonClass } from "@/components/ui/list-toolbar";
import {
  NO_TASK_TIME_FILTER,
  getTaskTimeFilterLabel,
  type TaskTimeFilter,
} from "@/lib/task-time-filter";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask } from "@/types/dashboard";
import {
  isExecutiveUser,
} from "@/components/layout/scope-switcher";
import { isUserUnassignedDepartment } from "@/lib/auth-context";
import {
  getAcademicMonthsForYear,
} from "@/lib/academic-calendar";
import { filterTasksForTable } from "@/components/tasks/cascading-task-table";
import { filterTasksByRole, matchesUser } from "@/lib/role-task-filter";
import {
  MenuRoot,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
  MenuOptionItem,
  MenuSeparator,
  MenuSubmenu,
  MenuBackdrop,
  MenuSheetHeader,
  SHEET_BACKDROP_CLASS,
  SHEET_POSITIONER_CLASS,
  SHEET_POPUP_CLASS,
} from "@/components/ui/menu";
import {
  type SavedTaskView,
  type TaskViewCriteria,
  type SavedViewRole,
  type UseSavedViewsOptions,
  type UseSavedViewsReturn,
  EXECUTIVE_PRESETS,
  MANAGER_PRESETS,
  STAFF_PRESETS,
  ALL_ROLE_PRESETS,
  getRolePresetViews,
  findPresetById,
  findPresetByName,
  areCriteriaEqual,
  criteriaToUrlParams,
  urlParamsToCriteria,
  getCustomSavedViews,
  saveCustomView,
  updateCustomView,
  deleteCustomView,
  clearCustomViews,
  useSavedViews,
} from "@/lib/saved-views/saved-views-store";
import type { TableColumnVisibility } from "@/components/tasks/table/types";
import {
  DEFAULT_DISPLAY_PROPERTIES,
  TaskTableViewOptionsPopover,
} from "@/components/tasks/table/components/task-table-toolbar";
import { Pressable } from "@/components/ui/pressable";

// Export Saved Views Infrastructure
export {
  type SavedTaskView,
  type TaskViewCriteria,
  type SavedViewRole,
  type UseSavedViewsOptions,
  type UseSavedViewsReturn,
  EXECUTIVE_PRESETS,
  MANAGER_PRESETS,
  STAFF_PRESETS,
  ALL_ROLE_PRESETS,
  getRolePresetViews,
  findPresetById,
  findPresetByName,
  areCriteriaEqual,
  criteriaToUrlParams,
  urlParamsToCriteria,
  getCustomSavedViews,
  saveCustomView,
  updateCustomView,
  deleteCustomView,
  clearCustomViews,
  useSavedViews,
};

// ============================================================================
// 1. Interfaces & Types
// ============================================================================

export type TaskScope = "MY_TASKS" | "SCHOOL_TASKS" | "UNIT_TASKS";
export type WorkspaceScope = "school" | "unit" | "my";
export type TaskViewMode = "table" | "kanban" | "calendar" | "department" | "executive";
export type TableDensity = "compact" | "comfortable";

export interface ScopeTab {
  id: TaskScope;
  label: string;
  shortLabel?: string;
}

export interface ViewModeOption {
  id: TaskViewMode;
  label: string;
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
}

export interface UnifiedTaskToolbarProps {
  /** Chưa có nhiệm vụ nào: chỉ giữ tiêu đề và nút tạo việc, ẩn tìm kiếm, bộ lọc và tùy chọn hiển thị. */
  quiet?: boolean;
  // Scope (supports both "school" | "unit" | "my" and "SCHOOL_TASKS" | "UNIT_TASKS" | "MY_TASKS")
  scope: WorkspaceScope | TaskScope | string;
  onScopeChange: (scope: any) => void;
  user?: AuthUser | null;
  userRole?: string;
  isExecutive?: boolean;
  badgeCounts?: {
    school?: number;
    unit?: number;
    my?: number;
    [key: string]: number | undefined;
  };
  isUnassignedDepartment?: boolean;

  // Search
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  loading?: boolean;

  // Primary Action
  onNewTaskClick?: () => void;
  onCreateTask?: () => void;
  onAddTask?: (level?: any, parentId?: any) => void;
  canCreateTask?: boolean;
  createButtonLabel?: string;

  // Smart Filter Pills (Row 2)
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  // Independent Status & Deadline Filter props
  selectedStatus?: string;
  onStatusChange?: (status: string) => void;
  selectedDeadline?: string;
  onDeadlineChange?: (deadline: string) => void;

  // Custom Left Content (e.g. view title or summary strip)
  leftContent?: React.ReactNode;

  tabCounts?: {
    all?: number;
    my?: number;
    my_tasks?: number;
    waiting_approval?: number;
    review?: number;
    pending_submission?: number;
    overdue?: number;
    today?: number;
    in_progress?: number;
    completed?: number;
    [key: string]: number | undefined;
  };

  // Advanced Filters
  selectedDepartment?: string;
  onDepartmentChange?: (dept: string) => void;
  availableDepartments?: Array<{ code: string; name: string }>;

  selectedCategory?: string;
  onCategoryChange?: (category: string) => void;

  selectedPriority?: string;
  onPriorityChange?: (priority: string) => void;

  selectedHealth?: string | null;
  onHealthChange?: (health: string | null) => void;

  selectedOrigin?: string | null;
  onOriginChange?: (origin: string | null) => void;

  selectedCollaborator?: string | null;
  onCollaboratorChange?: (collaborator: string | null) => void;

  selectedAcademicMonth?: number | "ALL";
  onAcademicMonthChange?: (month: number | "ALL") => void;
  // Compatibility aliases
  selectedMonth?: number | "ALL";
  onMonthChange?: (month: number | "ALL") => void;
  selectedTimeFilter?: TaskTimeFilter;
  onTimeFilterChange?: (filter: TaskTimeFilter) => void;

  academicYear?: string;
  monthlyTaskCounts?: Record<number, number>;
  showAcademicMonthBar?: boolean;

  onResetFilters?: () => void;

  // Density
  /** Các view (Đang thực hiện, Trễ hạn…) đặt bên trái hàng điều khiển */
  viewTabs?: React.ReactNode;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;

  // Column Visibility (Display properties)
  visibleColumns?: TableColumnVisibility;
  onVisibleColumnsChange?: (columns: TableColumnVisibility) => void;

  // Sorting (Mobile & Adaptive support)
  sortField?: string;
  sortDirection?: "asc" | "desc";
  groupingField?: string;
  onGroupingChange?: (field: string) => void;
  onSort?: (field: string) => void;

  // Refresh
  onRefresh?: () => void;
  isRefreshing?: boolean;

  // Presentation
  totalTasksCount?: number;
  filteredTasksCount?: number;
  className?: string;

  // Action Queue (Row 1 integrated trigger)
  actionQueueCount?: number;
  onOpenActionQueue?: () => void;
  actionQueueTrigger?: React.ReactNode;
  onActionQueueClick?: () => void;

  // Saved Views Infrastructure (Phase 10)
  showSavedViews?: boolean;
  activeViewId?: string | null;
  onSelectView?: (view: SavedTaskView) => void;
  currentCriteria?: TaskViewCriteria;
  onSaveView?: (newView: SavedTaskView) => void;
  onDeleteView?: (viewId: string) => void;
  onRenameView?: (viewId: string, newName: string) => void;
}

// ============================================================================
// 2. Constants & Metadata (Legacy Compatibility)
// ============================================================================

export const DEFAULT_AVAILABLE_DEPARTMENTS: { code: string; name: string }[] = [
  { code: "ALL", name: "Tất cả đơn vị" },
  { code: "BGH", name: "Ban Giám hiệu" },
  { code: "CNTT", name: "Khoa Công nghệ thông tin" },
  { code: "DAO_TAO", name: "Phòng Đào tạo & QLKH" },
  { code: "TRUYEN_THONG", name: "Trung tâm Truyền thông & Số hóa (DCC)" },
  { code: "HANH_CHINH", name: "Phòng Hành chính - Quản trị" },
  { code: "KHAO_THI", name: "Phòng Khảo thí & ĐBCL" },
  { code: "THU_VIEN", name: "Trung tâm Ngoại ngữ - Tin học & Thư viện" },
  { code: "KINH_TE", name: "Khoa Kinh tế - Quản trị" },
  { code: "KY_THUAT", name: "Khoa Kỹ thuật - Công nghệ" },
  { code: "TAI_CHINH", name: "Phòng Kế hoạch - Tài chính" },
  { code: "CTHSSV", name: "Phòng Công tác học sinh sinh viên" },
];

export const CATEGORY_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả danh mục" },
  { id: "CHUYEN_DOI_SO", label: "Chuyển đổi số" },
  { id: "TRUYEN_THONG", label: "Truyền thông" },
  { id: "CNTT", label: "Công nghệ thông tin" },
  { id: "ATTT", label: "An toàn thông tin" },
  { id: "THU_VIEN", label: "Thư viện & Học liệu" },
  { id: "BAO_CAO", label: "Báo cáo & Tổng hợp" },
  { id: "KHAC", label: "Khác" },
];

export const PRIORITY_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả mức độ" },
  { id: "URGENT", label: "Khẩn cấp" },
  { id: "HIGH", label: "Ưu tiên cao" },
  { id: "NORMAL", label: "Bình thường" },
];

/** Số giá trị đang lọc của một nhóm (0 khi đang là "Tất cả"). */
function countFilterValues(raw: string | undefined | null, allToken: string): number {
  if (!raw) return 0;
  return raw.split(",").map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== allToken.toLowerCase()).length;
}

function toggleMultiValue(
  selectedList: string[],
  isAll: boolean,
  selected: boolean,
  value: string,
  allToken: string
): string[] {
  if (isAll) return [value];
  if (selected) {
    const next = selectedList.filter((v) => v !== value && v !== allToken);
    return next.length === 0 ? [allToken] : next;
  }
  return [...selectedList.filter((v) => v !== allToken), value];
}

// Helper: filterTasksByScope (backward compatibility & unified scopes)

export function filterTasksByScope(
  tasks: SchoolTask[],
  scope: TaskScope | WorkspaceScope | string,
  user?: AuthUser | null,
  departmentCode?: string
): SchoolTask[] {
  const normScope =
    scope === "my" || scope === "MY_TASKS"
      ? "MY_TASKS"
      : scope === "unit" || scope === "UNIT_TASKS"
      ? "UNIT_TASKS"
      : "SCHOOL_TASKS";

  if (normScope === "MY_TASKS") {
    if (!user) return tasks;
    return tasks.filter((t) => {
      if ((t as any).viewerContext?.relation) return true;
      const isCreator = Boolean(
        user.id &&
          ((t as any).createdById === user.id ||
            (t as any).assignedById === user.id ||
            (t as any).createdBy === user.id ||
            (Array.isArray((t as any).actors) && (t as any).actors.some((a: any) => a.userId === user.id)))
      );
      const isLead =
        t.leadAssigneeName === user.name ||
        matchesUser(t.leadAssigneeName, user) ||
        (user.id && (t.leadAssigneeId === user.id || t.assignedTo === user.id));
      const hasSub = t.subTasks?.some(
        (s) =>
          s.assigneeName === user.name ||
          matchesUser(s.assigneeName, user) ||
          (user.id && (s.assigneeId === user.id || s.assignedTo === user.id))
      );
      const isCo = Boolean(
        t.coAssignees?.some((ca) => matchesUser(ca, user))
      );
      return Boolean(isLead || hasSub || isCo || isCreator);
    });
  }

  if (normScope === "SCHOOL_TASKS") {
    if (!user || user.role === "ADMIN" || isExecutiveUser(user)) {
      return [...tasks];
    }
    return filterTasksByRole(tasks, user);
  }

  if (normScope === "UNIT_TASKS") {
    const targetDept =
      departmentCode && departmentCode !== "ALL"
        ? departmentCode
        : user?.departmentCode || (user as any)?.departmentId || user?.department || (isExecutiveUser(user) ? "BGH" : undefined);

    if (targetDept && targetDept !== "ALL") {
      return filterTasksForTable(tasks, "ALL", "", targetDept);
    }
    return tasks.filter((t) => t.subTasks && t.subTasks.length > 0);
  }

  return tasks;
}

// Re-export academic calendar helpers
export { getAcademicMonthsForYear };

// ============================================================================
// Quick Filter Pills Factory (exported for unit testing without DOM)
// ============================================================================

export interface QuickFilterPill {
  id: string;
  label: string;
  count: number | undefined;
  isActive: boolean;
}

// ============================================================================
// 3. UnifiedTaskToolbar Component
// ============================================================================

/** Prefer the workspace's atomic reset over competing per-filter updates. */
export function resetTaskToolbarFilters(callbacks: Pick<UnifiedTaskToolbarProps,
  "onResetFilters" | "onSearchChange" | "onTabChange" | "onStatusChange" |
  "onDeadlineChange" | "onCategoryChange" | "onPriorityChange" |
  "onMonthChange" | "onAcademicMonthChange" | "onDepartmentChange"
>) {
  if (callbacks.onResetFilters) {
    callbacks.onResetFilters();
    return;
  }
  callbacks.onSearchChange("");
  callbacks.onTabChange?.("all");
  callbacks.onStatusChange?.("all");
  callbacks.onDeadlineChange?.("all");
  callbacks.onCategoryChange?.("ALL");
  callbacks.onPriorityChange?.("ALL");
  callbacks.onDepartmentChange?.("ALL");
  (callbacks.onMonthChange || callbacks.onAcademicMonthChange)?.("ALL");
}

export function UnifiedTaskToolbar({
  quiet = false,
  scope,
  onScopeChange,
  user,
  userRole,
  isExecutive: propIsExecutive,
  badgeCounts,
  isUnassignedDepartment: propIsUnassigned,
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Tìm nhiệm vụ... /",
  loading = false,
  onNewTaskClick,
  onCreateTask,
  onAddTask,
  canCreateTask = true,
  createButtonLabel,
  activeTab = "all",
  onTabChange,
  selectedStatus,
  onStatusChange,
  selectedDeadline,
  onDeadlineChange,
  leftContent,
  tabCounts,
  selectedDepartment = "ALL",
  onDepartmentChange,
  availableDepartments = DEFAULT_AVAILABLE_DEPARTMENTS,
  selectedCategory = "ALL",
  onCategoryChange,
  selectedPriority = "ALL",
  onPriorityChange,
  selectedHealth: propSelectedHealth,
  onHealthChange,
  selectedOrigin: propSelectedOrigin,
  onOriginChange,
  selectedCollaborator: propSelectedCollaborator,
  onCollaboratorChange,
  selectedAcademicMonth = "ALL",
  onAcademicMonthChange,
  selectedMonth,
  onMonthChange,
  selectedTimeFilter,
  onTimeFilterChange,
  academicYear = "2026-2027",
  monthlyTaskCounts,
  showAcademicMonthBar = false,
  onResetFilters,
  viewTabs,
  density = "comfortable",
  onDensityChange,
  visibleColumns: propVisibleColumns,
  onVisibleColumnsChange,
  sortField,
  sortDirection,
  groupingField: propGroupingField,
  onGroupingChange,
  onSort,
  totalTasksCount,
  filteredTasksCount,
  className,
  actionQueueCount,
  onOpenActionQueue,
  actionQueueTrigger,
  onActionQueueClick,
  showSavedViews = true,
  activeViewId,
  onSelectView,
  currentCriteria,
  onSaveView,
  onDeleteView,
  onRenameView,
}: UnifiedTaskToolbarProps) {
  // Input ref for keyboard focus shortcut
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);

  // Search input local state & debouncing (synchronous typing, 0ms input lag)
  const [localSearch, setLocalSearch] = React.useState(searchQuery || "");
  const searchDebounceRef = React.useRef<NodeJS.Timeout | null>(null);

  const onSearchChangeRef = React.useRef(onSearchChange);
  React.useEffect(() => {
    onSearchChangeRef.current = onSearchChange;
  }, [onSearchChange]);

  React.useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setLocalSearch(searchQuery || "");
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [searchQuery, scope]);

  const handleSearchInputChange = React.useCallback((val: string) => {
    setLocalSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onSearchChangeRef.current(val);
    }, 200);
  }, [onSearchChange]);

  const handleSearchClear = React.useCallback(() => {
    setLocalSearch("");
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    onSearchChange("");
  }, [onSearchChange]);

  const [isCollapsedFilterOpen, setIsCollapsedFilterOpen] = React.useState(false);
  const [selectedLead, setSelectedLead] = React.useState<string | null>(null);
  const [internalHealth, setInternalHealth] = React.useState<string | null>(null);
  const selectedHealth = propSelectedHealth !== undefined ? propSelectedHealth : internalHealth;
  const handleHealthChange = React.useCallback((val: string | null) => {
    if (onHealthChange) onHealthChange(val);
    else setInternalHealth(val);
  }, [onHealthChange]);

  const [internalOrigin, setInternalOrigin] = React.useState<string | null>(null);
  const selectedOrigin = propSelectedOrigin !== undefined ? propSelectedOrigin : internalOrigin;
  const handleOriginChange = React.useCallback((val: string | null) => {
    if (onOriginChange) onOriginChange(val);
    else setInternalOrigin(val);
  }, [onOriginChange]);

  const [internalCollaborator, setInternalCollaborator] = React.useState<string | null>(null);
  const selectedCollaborator = propSelectedCollaborator !== undefined ? propSelectedCollaborator : internalCollaborator;
  const handleCollaboratorChange = React.useCallback((val: string | null) => {
    if (onCollaboratorChange) onCollaboratorChange(val);
    else setInternalCollaborator(val);
  }, [onCollaboratorChange]);

  // Display properties (Column Visibility) & Grouping
  const [internalVisibleColumns, setInternalVisibleColumns] = React.useState<TableColumnVisibility>(DEFAULT_DISPLAY_PROPERTIES);
  const effectiveVisibleColumns = propVisibleColumns || internalVisibleColumns;
  const handleVisibleColumnsChange = onVisibleColumnsChange || setInternalVisibleColumns;

  const [internalGroupingField, setInternalGroupingField] = React.useState<string>("none");
  const groupingField = propGroupingField ?? internalGroupingField;
  const setGroupingField = onGroupingChange ?? setInternalGroupingField;

  const isDisplayCustomized = React.useMemo(() => {
    return (
      effectiveVisibleColumns.code !== DEFAULT_DISPLAY_PROPERTIES.code ||
      effectiveVisibleColumns.department !== DEFAULT_DISPLAY_PROPERTIES.department ||
      effectiveVisibleColumns.priority !== DEFAULT_DISPLAY_PROPERTIES.priority ||
      effectiveVisibleColumns.leadAssignee !== DEFAULT_DISPLAY_PROPERTIES.leadAssignee ||
      effectiveVisibleColumns.dueDate !== DEFAULT_DISPLAY_PROPERTIES.dueDate ||
      effectiveVisibleColumns.subtasks !== DEFAULT_DISPLAY_PROPERTIES.subtasks ||
      effectiveVisibleColumns.coAssignees !== DEFAULT_DISPLAY_PROPERTIES.coAssignees ||
      effectiveVisibleColumns.status !== DEFAULT_DISPLAY_PROPERTIES.status ||
      effectiveVisibleColumns.category !== DEFAULT_DISPLAY_PROPERTIES.category ||
      effectiveVisibleColumns.createdAt !== DEFAULT_DISPLAY_PROPERTIES.createdAt ||
      effectiveVisibleColumns.startDate !== DEFAULT_DISPLAY_PROPERTIES.startDate
    );
  }, [effectiveVisibleColumns]);

  const handleResetDisplayProperties = React.useCallback(() => {
    handleVisibleColumnsChange(DEFAULT_DISPLAY_PROPERTIES);
  }, [handleVisibleColumnsChange]);

  // Resolve Month props (supporting compatibility aliases)
  const effectiveMonth = selectedMonth !== undefined ? selectedMonth : selectedAcademicMonth;
  const handleEffectiveMonthChange = onMonthChange || onAcademicMonthChange;
  const effectiveTimeFilter: TaskTimeFilter = selectedTimeFilter ??
    (typeof effectiveMonth === "number" ? { kind: "month", month: effectiveMonth } : NO_TASK_TIME_FILTER);
  const handleTimeFilterChange = (filter: TaskTimeFilter) => {
    if (onTimeFilterChange) onTimeFilterChange(filter);
    else handleEffectiveMonthChange?.(filter.kind === "month" ? filter.month : "ALL");
  };
  // Resolve role authorizations
  const isExecutive =
    propIsExecutive !== undefined
      ? propIsExecutive
      : userRole === "ADMIN" || isExecutiveUser(user);
  const isUnassigned =
    propIsUnassigned !== undefined
      ? propIsUnassigned
      : isUserUnassignedDepartment(user);

  // Normalize current scope to canonical TaskView ("related" | "unit" | "all" | "approval")
  const normalizedTaskView: TaskView = React.useMemo(() => {
    if (!scope) return "all";
    const s = String(scope).toLowerCase();
    if (s === "my" || s === "personal" || s === "my_tasks" || s === "related" || s === "cua_toi") return "related";
    if (s === "unit" || s === "unit_tasks" || s === "department" || s === "don_vi") return "unit";
    if (s === "approval" || s === "waiting_approval") return "approval";
    if (s === "school" || s === "school_tasks" || s === "all" || s === "toan_truong") return "all";
    return "all";
  }, [scope]);

  // Normalize current scope to "school" | "unit" | "my"
  const normalizedScope: WorkspaceScope = React.useMemo(() => {
    if (normalizedTaskView === "related") return "my";
    if (normalizedTaskView === "unit") return "unit";
    return "school";
  }, [normalizedTaskView]);

  // 2. Global shortcuts for search and filter focus
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if a modal or dialog is open
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      const key = e.key.toLowerCase();
      const isFilterShortcut = key === "f" && !e.metaKey && !e.ctrlKey && !e.altKey;
      const isSearchShortcut = e.key === "/" || ((e.metaKey || e.ctrlKey) && key === "k");

      if (isFilterShortcut || isSearchShortcut) {
        // Do not intercept during active IME composition
        if (e.isComposing || e.keyCode === 229) return;

        const activeEl = document.activeElement as HTMLElement | null;
        const targetEl = e.target as HTMLElement | null;

        const isEditable = (el: HTMLElement | null) => {
          if (!el) return false;
          const tag = el.tagName.toLowerCase();
          return (
            tag === "input" ||
            tag === "textarea" ||
            tag === "select" ||
            el.isContentEditable ||
            el.getAttribute("role") === "textbox" ||
            el.getAttribute("contenteditable") === "true"
          );
        };

        if (isEditable(activeEl) || isEditable(targetEl)) {
          return;
        }

        e.preventDefault();
        if (isFilterShortcut) {
          setIsCollapsedFilterOpen(true);
          return;
        }

        setIsSearchOpen(true);
        requestAnimationFrame(() => {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Primary action callback
  const handlePrimaryAction = onNewTaskClick || onCreateTask || onAddTask;
  const primaryActionLabel = (createButtonLabel || "Tạo việc").replace(/^\+\s*/, "");

  // Scope badge counts calculation (supports numbers including 0)
  const effectiveScopeBadgeCounts = React.useMemo(() => {
    const getCount = (val: any) => (typeof val === "number" && !isNaN(val) ? val : undefined);

    const bRelated = getCount(badgeCounts?.related) ?? getCount(badgeCounts?.my) ?? getCount((badgeCounts as any)?.MY_TASKS);
    const bUnit = getCount(badgeCounts?.unit) ?? getCount((badgeCounts as any)?.UNIT_TASKS);
    const bAll = getCount(badgeCounts?.all) ?? getCount(badgeCounts?.school) ?? getCount((badgeCounts as any)?.SCHOOL_TASKS);
    const bApproval = getCount(badgeCounts?.approval) ?? getCount(badgeCounts?.waiting_approval) ?? tabCounts?.waiting_approval;

    return {
      related: bRelated !== undefined ? bRelated : tabCounts?.my ?? tabCounts?.my_tasks,
      unit: bUnit !== undefined ? bUnit : tabCounts?.unit,
      all: bAll !== undefined ? bAll : (tabCounts?.all ?? totalTasksCount),
      approval: bApproval !== undefined ? bApproval : tabCounts?.waiting_approval,
      my: bRelated !== undefined ? bRelated : tabCounts?.my ?? tabCounts?.my_tasks,
      school: bAll !== undefined ? bAll : (tabCounts?.all ?? totalTasksCount),
    };
  }, [badgeCounts, tabCounts, totalTasksCount]);

  const isExecutiveRole = Boolean(
    propIsExecutive ||
    (userRole as any) === "ADMIN" ||
    (userRole as any) === "EXECUTIVE" ||
    (userRole as any) === "MANAGER" ||
    (userRole as any) === "DEPT_HEAD" ||
    user?.role === "ADMIN" ||
    (user?.role as any) === "EXECUTIVE" ||
    (user?.role as any) === "MANAGER" ||
    (user?.role as any) === "DEPT_HEAD" ||
    isExecutive
  );

  const statusOptions = React.useMemo(() => [
    { value: "all", label: "Tất cả trạng thái" },
    { value: "new", label: "Mới" },
    { value: "in_progress", label: "Đang thực hiện" },
    { value: isExecutiveRole ? "waiting_approval" : "review", label: isExecutiveRole ? "Cần tôi duyệt" : "Cần chỉnh sửa" },
    { value: "completed", label: "Hoàn thành" },
  ], [isExecutiveRole]);

  const effectiveStatus = React.useMemo(() => {
    if (selectedStatus !== undefined) return selectedStatus;
    if (!activeTab || activeTab === "all" || activeTab === "today" || activeTab === "this_week" || activeTab === "overdue") {
      return "all";
    }
    return activeTab;
  }, [selectedStatus, activeTab]);

  const effectiveDeadline = React.useMemo(() => {
    if (selectedDeadline !== undefined) return selectedDeadline;
    if (activeTab === "today" || activeTab === "this_week" || activeTab === "overdue") {
      return activeTab;
    }
    return "all";
  }, [selectedDeadline, activeTab]);

  const deadlineOptions = React.useMemo(() => [
    { value: "all", label: "Tất cả thời hạn" },
    { value: "today", label: "Đến hạn hôm nay", count: tabCounts?.today },
    { value: "this_week", label: "Trong tuần này", count: tabCounts?.this_week },
    { value: "overdue", label: "Trễ hạn", count: tabCounts?.overdue },
  ], [tabCounts]);

  const showDepartmentFilter = React.useMemo(() => {
    return normalizedScope === "school" && availableDepartments.length > 1;
  }, [normalizedScope, availableDepartments.length]);

  const isMonthActive = effectiveTimeFilter.kind !== "none";
  const isStatusActive = Boolean(effectiveStatus && effectiveStatus.toLowerCase() !== "all");
  const isDeadlineActive = Boolean(effectiveDeadline && effectiveDeadline !== "all");
  const isPriorityActive = Boolean(selectedPriority && selectedPriority !== "ALL");
  const isCategoryActive = Boolean(selectedCategory && selectedCategory !== "ALL");
  const isDepartmentActive = Boolean(selectedDepartment && selectedDepartment !== "ALL");
  const isSearchActive = Boolean(localSearch && localSearch.trim().length > 0);
  const isHealthActive = Boolean(selectedHealth && selectedHealth !== "all");
  const isLeadActive = Boolean((selectedLead && selectedLead !== "all") || (selectedLead === "my" && activeTab === "my"));
  const isOriginActive = Boolean(selectedOrigin && selectedOrigin !== "all");
  const isCollaboratorActive = Boolean(selectedCollaborator && selectedCollaborator !== "all");
  const activeFilterCount = [
    isStatusActive,
    isPriorityActive,
    isDeadlineActive,
    isMonthActive,
    isCategoryActive,
    showDepartmentFilter && isDepartmentActive,
    isHealthActive,
    isLeadActive,
    isOriginActive,
    isCollaboratorActive,
  ].filter(Boolean).length;

  // Optional 12 month cycle list for year
  const academicMonths = React.useMemo(() => {
    return getAcademicMonthsForYear(academicYear);
  }, [academicYear]);

  // Reset all filters (Only clears supplementary filters, retains Scope & User Department)
  const handleResetFilters = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setLocalSearch("");
    setSelectedLead(null);
    handleHealthChange(null);
    handleOriginChange(null);
    handleCollaboratorChange(null);
    resetTaskToolbarFilters({
      onResetFilters, onSearchChange, onTabChange, onStatusChange,
      onDeadlineChange, onCategoryChange, onPriorityChange,
      onMonthChange: handleEffectiveMonthChange, onDepartmentChange,
    });
    setIsCollapsedFilterOpen(false);
  };

  const resolvedUnitDisplayName = React.useMemo(() => {
    if (isUnassigned) return "Chưa chọn đơn vị";
    if (selectedDepartment && selectedDepartment !== "ALL") {
      const found = availableDepartments.find((d) => d.code === selectedDepartment);
      if (found) return found.name;
    }
    return user?.department || user?.departmentCode || "Đơn vị";
  }, [isUnassigned, availableDepartments, selectedDepartment, user]);

  const filterCategories = React.useMemo(() => [
    // 1. Nhóm thuộc tính cốt lõi
    {
      key: "status",
      group: "core",
      label: "Trạng thái",
      isActive: isStatusActive,
      icon: FilterIconStatus,
    },
    {
      key: "priority",
      group: "core",
      label: "Mức ưu tiên",
      isActive: isPriorityActive,
      icon: FilterIconPriority,
    },
    {
      key: "category",
      group: "core",
      label: "Danh mục",
      isActive: isCategoryActive,
      icon: FilterIconCategory,
    },

    // 2. Nhóm đơn vị & nhân sự
    {
      key: "dept",
      group: "team",
      label: "Đơn vị",
      isActive: isDepartmentActive,
      icon: FilterIconDept,
    },
    {
      key: "lead",
      group: "team",
      label: "Người chủ trì",
      isActive: isLeadActive,
      icon: FilterIconLead,
    },
    {
      key: "collaborator",
      group: "team",
      label: "Người phối hợp",
      isActive: isCollaboratorActive,
      icon: FilterIconCollaborator,
    },

    // 3. Nhóm thời gian, tiến độ & nguồn gốc
    {
      key: "dates",
      group: "time",
      label: "Mốc thời gian",
      isActive: isDeadlineActive || isMonthActive,
      icon: FilterIconDeadline,
    },
    {
      key: "health",
      group: "time",
      label: "Tiến độ",
      isActive: isHealthActive,
      icon: FilterIconProgress,
    },
    {
      key: "origin",
      group: "time",
      label: "Nguồn gốc",
      isActive: isOriginActive,
      icon: FilterIconOrigin,
    },
  ], [
    isStatusActive,
    isPriorityActive,
    isCategoryActive,
    isDepartmentActive,
    isLeadActive,
    isCollaboratorActive,
    isDeadlineActive,
    isMonthActive,
    isHealthActive,
    isOriginActive,
  ]);

  const renderCategorySubmenuItems = (categoryKey: string) => {
    switch (categoryKey) {
      case "status": {
        const selectedList = (effectiveStatus || "all").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("all");

        return (
          <div className="space-y-px">
            {statusOptions.map((opt) => {
              const selected = opt.value === "all"
                ? isAll
                : opt.value === "new"
                  ? selectedList.includes("new") || selectedList.includes("not_started") || selectedList.includes("assigned")
                  : opt.value === "waiting_approval" || opt.value === "review"
                    ? selectedList.includes("waiting_approval") || selectedList.includes("review") || selectedList.includes("pending_executive_approval") || selectedList.includes("needs_review")
                    : selectedList.includes(opt.value);

              const handleToggle = () => {
                if (opt.value === "all") {
                  if (onStatusChange) onStatusChange("all");
                  else onTabChange?.("all");
                  return;
                }
                const nextList = toggleMultiValue(selectedList, isAll, selected, opt.value, "all");
                const nextStr = nextList.join(",");
                if (onStatusChange) onStatusChange(nextStr);
                else onTabChange?.(nextStr);
              };

              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={handleToggle}
                  selected={selected}
                  leading={opt.value === "all" ? (
                      <TaskIconStatus className="size-4 text-muted-foreground" />
                    ) : (
                      <TaskStatusCircle
                        status={
                          opt.value === "new"
                            ? "NOT_STARTED"
                            : opt.value === "in_progress"
                              ? "IN_PROGRESS"
                              : opt.value === "completed"
                                ? "COMPLETED"
                                : "WAITING_APPROVAL"
                        }
                      />
                    )}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "priority": {
        const selectedList = (selectedPriority || "ALL").split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");

        return (
          <div className="space-y-px">
            {PRIORITY_FILTER_OPTIONS.map((opt) => {
              const selected = opt.id === "ALL" ? isAll : selectedList.includes(opt.id);
              const level = opt.id === "URGENT" ? 3 : opt.id === "HIGH" ? 2 : opt.id === "NORMAL" ? 1 : 0;

              const handleToggle = () => {
                if (opt.id === "ALL") {
                  onPriorityChange?.("ALL");
                  return;
                }
                const nextList = toggleMultiValue(selectedList, isAll, selected, opt.id, "ALL");
                onPriorityChange?.(nextList.join(","));
              };

              return (
                <MenuOptionItem
                  key={opt.id}
                  onClick={handleToggle}
                  selected={selected}
                  leading={opt.id === "URGENT" ? (
                      <TaskIconPriorityUrgent className="size-4 text-destructive" />
                    ) : opt.id === "HIGH" ? (
                      <TaskIconPriorityHigh className="size-4 text-foreground/70" />
                    ) : opt.id === "NORMAL" ? (
                      <TaskIconPriorityNormal className="size-4 text-muted-foreground" />
                    ) : (
                      <TaskIconPriority className="size-4 text-muted-foreground" />
                    )}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "category": {
        const selectedList = (selectedCategory || "ALL").split(",").map((c) => c.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");

        return (
          <div className="space-y-px">
            {CATEGORY_FILTER_OPTIONS.map((cat) => {
              const selected = cat.id === "ALL" ? isAll : selectedList.includes(cat.id);

              const handleToggle = () => {
                if (cat.id === "ALL") {
                  onCategoryChange?.("ALL");
                  return;
                }
                const nextList = toggleMultiValue(selectedList, isAll, selected, cat.id, "ALL");
                onCategoryChange?.(nextList.join(","));
              };

              return (
                <MenuOptionItem
                  key={cat.id}
                  onClick={handleToggle}
                  selected={selected}
                >
                  {cat.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "dept": {
        const selectedList = (selectedDepartment || "ALL").split(",").map((d) => d.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");

        const facultyDepts = availableDepartments.filter(
          (d) => d.code !== "ALL" && (d.name.startsWith("Khoa") || ["CNTT", "KINH_TE", "KY_THUAT"].includes(d.code))
        );
        const adminDepts = availableDepartments.filter(
          (d) => d.code !== "ALL" && !d.name.startsWith("Khoa") && !["CNTT", "KINH_TE", "KY_THUAT"].includes(d.code)
        );

        const isFacultyActive = Boolean(
          !isAll && facultyDepts.some((d) => selectedList.includes(d.code))
        );
        const isAdminActive = Boolean(
          !isAll && adminDepts.some((d) => selectedList.includes(d.code))
        );

        const handleDeptToggle = (deptCode: string) => {
          if (deptCode === "ALL") {
            onDepartmentChange?.("ALL");
            return;
          }
          const nextList = toggleMultiValue(selectedList, isAll, selectedList.includes(deptCode), deptCode, "ALL");
          onDepartmentChange?.(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {/* Tất cả đơn vị */}
            <MenuOptionItem
              onClick={() => handleDeptToggle("ALL")}
              selected={isAll}
              leading={<FilterIconDept className="size-4 text-muted-foreground" />}
            >
              Tất cả đơn vị
            </MenuOptionItem>

            <MenuSeparator className="h-px bg-border/40 my-1" />

            {/* Sub-dropdown cấp 2: Khoa chuyên môn */}
            <MenuSubmenu
              icon={<TaskIconDepartment className="size-4 text-muted-foreground" />}
              label="Khoa đào tạo"
              active={isFacultyActive}
              popupClassName="min-w-[210px]"
            >
              <div className="space-y-px">
                {facultyDepts.map((dept) => (
                  <MenuOptionItem
                    key={dept.code}
                    onClick={() => handleDeptToggle(dept.code)}
                    selected={!isAll && selectedList.includes(dept.code)}
                    leading={<TaskIconDepartment className="size-4 text-muted-foreground" />}
                  >
                    {dept.name}
                  </MenuOptionItem>
                ))}
              </div>
            </MenuSubmenu>

            {/* Sub-dropdown cấp 2: Khối Hành chính & Phòng ban */}
            <MenuSubmenu
              icon={<TaskIconDepartment className="size-4 text-muted-foreground" />}
              label="Phòng ban hành chính"
              active={isAdminActive}
              popupClassName="min-w-[210px]"
            >
              <div className="space-y-px">
                {adminDepts.map((dept) => (
                  <MenuOptionItem
                    key={dept.code}
                    onClick={() => handleDeptToggle(dept.code)}
                    selected={!isAll && selectedList.includes(dept.code)}
                    leading={<TaskIconDepartment className="size-4 text-muted-foreground" />}
                  >
                    {dept.name}
                  </MenuOptionItem>
                ))}
              </div>
            </MenuSubmenu>
          </div>
        );
      }
      case "lead": {
        const leadOptions = [
          { value: "all", label: "Tất cả người chủ trì" },
          { value: "my", label: "Giao cho tôi (Tôi chủ trì)" },
          { value: "bgh", label: "Lãnh đạo / Ban Giám hiệu" },
          { value: "assigned", label: "Đã phân công người chủ trì" },
          { value: "unassigned", label: "Chưa phân công người chủ trì" },
        ];
        return (
          <div className="space-y-px">
            {leadOptions.map((opt) => {
              const selected = selectedLead === opt.value || (opt.value === "all" && !selectedLead && activeTab !== "my") || (opt.value === "my" && activeTab === "my");
              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={() => {
                    if (opt.value === "my") {
                      onTabChange?.("my");
                      setSelectedLead("my");
                    } else if (opt.value === "all") {
                      setSelectedLead(null);
                      if (activeTab === "my") onTabChange?.("all");
                    } else {
                      setSelectedLead(opt.value);
                    }
                  }}
                  selected={selected}
                  leading={opt.value === "my" ? (
                      <FilterIconLead className="size-4 text-muted-foreground" />
                    ) : opt.value === "bgh" ? (
                      <FilterIconDept className="size-4 text-muted-foreground" />
                    ) : opt.value === "assigned" ? (
                      <FilterIconLead className="size-4 text-muted-foreground" />
                    ) : opt.value === "unassigned" ? (
                      <TaskIconStatusNew className="size-4 text-muted-foreground" />
                    ) : (
                      <TaskIconCollaborators className="size-4 text-muted-foreground" />
                    )}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "collaborator": {
        const collabOptions = [
          { value: "all", label: "Tất cả nhiệm vụ" },
          { value: "has_collab", label: "Có đơn vị / người phối hợp" },
          { value: "single", label: "Đơn vị tự thực hiện (không phối hợp)" },
        ];
        return (
          <div className="space-y-px">
            {collabOptions.map((opt) => {
              const selected = selectedCollaborator === opt.value || (opt.value === "all" && !selectedCollaborator);
              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={() => {
                    handleCollaboratorChange(opt.value === "all" ? null : opt.value);
                  }}
                  selected={selected}
                  leading={opt.value === "has_collab" ? (
                      <FilterIconCollaborator className="size-4 text-muted-foreground" />
                    ) : opt.value === "single" ? (
                      <FilterIconLead className="size-4 text-muted-foreground" />
                    ) : (
                      <TaskIconCollaborators className="size-4 text-muted-foreground" />
                    )}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "dates": {
        // Cấp 2 theo menu "Đổi hạn hoàn thành": nhãn trái, gợi ý phải, hàng đang chọn nền accent đậm.
        // Cấp 3 là "Kỳ tháng" (lưới tháng) và "Chọn ngày khác" (lịch dùng chung với menu chuột phải).
        return (
          <div className="space-y-px">
            {deadlineOptions.map((opt) => (
              <MenuOptionItem
                key={opt.value}
                selected={
                  effectiveDeadline === opt.value ||
                  (opt.value === "all" && (!effectiveDeadline || effectiveDeadline === "all"))
                }
                hint={opt.count !== undefined && opt.count > 0 ? opt.count : undefined}
                onClick={() => {
                  if (onDeadlineChange) onDeadlineChange(opt.value);
                  else onTabChange?.(opt.value === "all" ? "all" : opt.value);
                }}
              >
                {opt.label}
              </MenuOptionItem>
            ))}

            <MenuSeparator className="my-1 border-t border-border/40" />

            <MenuSubmenu
              icon={<TaskIconTime className="size-4 text-muted-foreground" />}
              label="Kỳ tháng"
              hint={effectiveTimeFilter.kind === "month" ? `T${effectiveTimeFilter.month}` : undefined}
              title={`Năm học ${academicYear}`}
              popupClassName="w-52"
            >
              <MenuOptionItem
                selected={effectiveTimeFilter.kind === "none"}
                onClick={() => handleTimeFilterChange(NO_TASK_TIME_FILTER)}
              >
                Tất cả các tháng
              </MenuOptionItem>
              <div className="grid grid-cols-4 gap-0.5 pt-1">
                {academicMonths.map((period) => {
                  const selected = effectiveTimeFilter.kind === "month" && effectiveTimeFilter.month === period.monthNumber;
                  return (
                    <MenuItem
                      key={period.monthNumber}
                      closeOnClick={false}
                      aria-current={selected ? "true" : undefined}
                      aria-label={`Tháng ${period.monthNumber}`}
                      onClick={() => handleTimeFilterChange({ kind: "month", month: period.monthNumber })}
                      className={cn(MENU_ROW_CLASS, "justify-center px-0", selected && "bg-accent font-medium")}
                    >
                      T{period.monthNumber}
                    </MenuItem>
                  );
                })}
              </div>
            </MenuSubmenu>

            <MenuSubmenu
              icon={<TaskIconDeadline className="size-4 text-muted-foreground" />}
              label="Chọn ngày khác"
              hint={effectiveTimeFilter.kind === "range" ? getTaskTimeFilterLabel(effectiveTimeFilter) : undefined}
              popupClassName="w-56 p-2"
            >
              <VietnameseDayCalendar
                value={effectiveTimeFilter.kind === "range" && effectiveTimeFilter.from === effectiveTimeFilter.to ? effectiveTimeFilter.from : ""}
                onSelect={(iso) => handleTimeFilterChange({ kind: "range", from: iso, to: iso })}
              />
            </MenuSubmenu>
          </div>
        );
      }
      case "health": {
        const healthOptions = [
          { value: "all", label: "Tất cả tiến độ" },
          { value: "on_track", label: "Đúng tiến độ (Bình thường)" },
          { value: "at_risk", label: "Có nguy cơ trễ hạn (≤ 7 ngày)" },
          { value: "overdue", label: "Trễ hạn / Trễ hạn" },
          { value: "completed", label: "Đã hoàn thành 100%" },
        ];
        const selectedList = (selectedHealth || "all").toLowerCase().split(",").map((h) => h.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("all");

        const handleHealthToggle = (val: string) => {
          if (val === "all") {
            handleHealthChange("all");
            return;
          }
          const nextList = toggleMultiValue(selectedList, isAll, selectedList.includes(val), val, "all");
          handleHealthChange(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {healthOptions.map((opt) => {
              const selected = opt.value === "all" ? isAll : selectedList.includes(opt.value);
              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={() => handleHealthToggle(opt.value)}
                  selected={selected}
                  leading={opt.value === "on_track" ? (
                      <HealthSubOnTrack className="size-4 text-muted-foreground" />
                    ) : opt.value === "at_risk" ? (
                      <HealthSubAtRisk className="size-4 text-muted-foreground" />
                    ) : opt.value === "overdue" ? (
                      <HealthSubOverdue className="size-4 text-muted-foreground" />
                    ) : opt.value === "completed" ? (
                      <HealthSubCompleted className="size-4 text-muted-foreground" />
                    ) : (
                      <HealthSubAll className="size-4 text-muted-foreground" />
                    )}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "origin": {
        const originOptions = [
          { value: "all", label: "Tất cả nguồn gốc" },
          { value: "KE_HOACH_NAM", label: "Kế hoạch năm học" },
          { value: "NGHI_QUYET", label: "Nghị quyết Đảng ủy / BGH" },
          { value: "GIAO_BAN", label: "Kết luận họp giao ban" },
          { value: "DON_VI", label: "Đơn vị đề xuất" },
        ];
        const selectedList = (selectedOrigin || "all").split(",").map((o) => o.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("all");

        const handleOriginToggle = (val: string) => {
          if (val === "all") {
            handleOriginChange(null);
            return;
          }
          const nextList = toggleMultiValue(selectedList, isAll, selectedList.includes(val), val, "all");
          handleOriginChange(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {originOptions.map((opt) => {
              const selected = opt.value === "all" ? isAll : selectedList.includes(opt.value);
              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={() => handleOriginToggle(opt.value)}
                  selected={selected}
                  leading={<FilterIconOrigin className="size-4 text-muted-foreground" />}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const activeValueCount = (key: string, isActive: boolean): number => {
    switch (key) {
      case "status": return countFilterValues(effectiveStatus, "all");
      case "priority": return countFilterValues(selectedPriority, "ALL");
      case "category": return countFilterValues(selectedCategory, "ALL");
      case "dept": return countFilterValues(selectedDepartment, "ALL");
      case "dates": return (isDeadlineActive ? 1 : 0) + (isMonthActive ? 1 : 0);
      default: return isActive ? 1 : 0;
    }
  };

  const renderCategorySubmenu = (category: typeof filterCategories[0]) => {
    const activeCount = activeValueCount(category.key, category.isActive);
    return (
      <MenuSubmenu
        key={category.key}
        icon={<category.icon className="size-4 text-muted-foreground" />}
        label={category.label}
        active={category.isActive}
        hint={activeCount > 0 ? activeCount : undefined}
        title={category.label}
        popupClassName={category.key === "dates" ? "min-w-[232px]" : undefined}
      >
        {renderCategorySubmenuItems(category.key)}
      </MenuSubmenu>
    );
  };

  const searchExpanded = isSearchOpen || isSearchActive;
  const openSearch = () => {
    setIsSearchOpen(true);
    requestAnimationFrame(() => searchInputRef.current?.focus());
  };
  const createCta = (leftContent || !onScopeChange) && canCreateTask && handlePrimaryAction ? (
    <Pressable
      onClick={() => handlePrimaryAction()}
      title="Tạo việc mới"
      aria-label="Tạo việc mới"
      className={cn(listToolbarPrimaryButtonClass, "rounded-full border-transparent bg-transparent shadow-none max-md:size-8 max-md:px-0")}
    >
      <Plus className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="hidden md:inline">{primaryActionLabel}</span>
    </Pressable>
  ) : null;

  return (
    <div
      data-slot="unified-task-toolbar"
      className={cn(
        // z-20 trên điện thoại để cuộn xuống không đè lên thanh trên cùng (z-30)
        "flex items-center gap-x-1.5 gap-y-0 bg-transparent relative z-20 md:z-40 overflow-visible flex-wrap",
        !leftContent && "border-b border-border/60 pb-2",
        // Khung tiêu đề + toolbar đứng yên khi cuộn (88px = 44 tiêu đề + 44 hàng điều khiển; tiêu đề cột bảng dính ngay dưới)
        leftContent && "md:sticky md:top-0 md:bg-card md:mb-0",
        className
      )}
    >
      {/* ================================================================ */}
      {/* SINGLE ROW / TWO-ROW: Scope Tabs (Standalone) | Left Content | Controls */}
      {/* ================================================================ */}

      {/* Scope Switcher / Row 1 (when standalone with onScopeChange and no custom leftContent) */}
      {!leftContent && onScopeChange && (
        <div
          data-slot="unified-task-toolbar-row-1"
          className="flex items-center justify-between gap-2 w-full pb-1 border-b border-border/40"
        >
          <div className="flex items-center gap-1.5 shrink-0 min-w-0">
            <div
              data-slot="adaptive-scope-header"
              data-scope-switcher="true"
              className="inline-flex items-center gap-0.5 shrink-0"
              role="tablist"
              aria-label="Phạm vi công việc"
            >
              {[
                { id: "my", label: "Cá nhân", icon: TaskIconAssignee, count: (effectiveScopeBadgeCounts as any)?.my ?? (effectiveScopeBadgeCounts as any)?.related },
                { id: "unit", label: "Đơn vị", icon: TaskIconDepartment, count: (effectiveScopeBadgeCounts as any)?.unit },
                { id: "school", label: "Toàn trường", icon: TaskIconDepartment, count: (effectiveScopeBadgeCounts as any)?.school ?? (effectiveScopeBadgeCounts as any)?.all },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = normalizedScope === tab.id;
                const showBadge = typeof tab.count === "number" && !isNaN(tab.count);
                return (
                  <Pressable
                    key={tab.id}
                    role="tab"
                    data-scope={tab.id}
                    aria-selected={isActive}
                    onClick={() => {
                      if (onScopeChange) {
                        onScopeChange(tab.id as any);
                      }
                    }}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors select-none",
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span>{tab.label}</span>
                    {showBadge && (
                      <span
                        data-slot="scope-badge-count"
                        data-scope={tab.id}
                        className={cn(
                          "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-xs font-mono tabular-nums font-semibold",
                          isActive
                            ? "bg-background text-foreground border border-border/60 shadow-2xs"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </Pressable>
                );
              })}
            </div>

            {/* Unit Scope Clean Secondary Text (No border, no dropdown) */}
            {normalizedScope === "unit" && !isUnassigned && (
              <span
                className="text-xs text-muted-foreground font-normal truncate max-w-[240px] sm:max-w-[320px] select-none"
                title={resolvedUnitDisplayName}
              >
                ({resolvedUnitDisplayName})
              </span>
            )}
          </div>

          {/* Right: Primary Page Action Button (Tạo nhiệm vụ - Linear Understated Style) */}
          {canCreateTask && handlePrimaryAction && (
            <Pressable
              onClick={() => handlePrimaryAction()}
              title="Tạo nhiệm vụ"
              aria-label="Tạo nhiệm vụ"
              className={listToolbarPrimaryButtonClass}
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" />
              <span>{createButtonLabel || (onCreateTask ? "Tạo nhiệm vụ" : primaryActionLabel)}</span>
            </Pressable>
          )}
        </div>
      )}

      {/* Left Content (View Title / Summary Strip) */}
      {leftContent && (
        <div className="-mx-4 flex h-[calc(44px+env(safe-area-inset-top,0px))] w-[calc(100%+32px)] min-w-0 items-center justify-between gap-3 border-b border-border/60 px-4 pt-[env(safe-area-inset-top,0px)] md:-mx-[18px] md:h-11 md:w-[calc(100%+36px)] md:px-[18px] md:pt-0">
          <div className="flex min-w-0 items-center gap-2">
            {/* Điện thoại: nút mở sidebar thay cho thanh trên cùng (như Linear) */}
            <Pressable
              onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-mobile-menu"))}
              aria-label="Mở menu"
              className="-ml-1.5 flex size-8 shrink-0 items-center justify-center rounded-md text-foreground/80 hover:bg-accent hover:text-foreground md:hidden"
            >
              <IconSidebarPanel size={18} />
            </Pressable>
            {leftContent}
          </div>
          {createCta}
        </div>
      )}

      {!quiet && (
        <div className="flex h-11 w-full min-w-0 items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar py-0.5">{viewTabs}</div>
      {/* 1. Search: icon thu gọn, bấm hoặc nhấn "/" để mở ô */}
      {searchExpanded ? (
        <ListToolbarSearch
          ref={searchInputRef}
          value={localSearch}
          onChange={handleSearchInputChange}
          onClear={handleSearchClear}
          loading={loading}
          placeholder="Tìm nhiệm vụ… /"
          aria-label="Tìm nhiệm vụ"
          onBlur={() => {
            if (!localSearch.trim()) setIsSearchOpen(false);
          }}
        />
      ) : (
        <Pressable
          onClick={openSearch}
          aria-label="Tìm nhiệm vụ"
          title="Tìm nhiệm vụ (/)"
          className={listToolbarIconButtonClass(false)}
        >
          <TaskIconSearch size={14} className="shrink-0 text-muted-foreground" />
        </Pressable>
      )}

      {/* 2. Filter — icon-only trigger */}
      <MenuRoot open={isCollapsedFilterOpen} onOpenChange={setIsCollapsedFilterOpen}>
        <MenuTrigger
          render={
            <ListToolbarFilterButton
              activeCount={activeFilterCount}
              open={isCollapsedFilterOpen}
              aria-expanded={isCollapsedFilterOpen}
              className="rounded-full"
            />
          }
        />
        <MenuPortal>
          <MenuBackdrop className={SHEET_BACKDROP_CLASS} />
          <MenuPositioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className={cn("z-50 outline-none", SHEET_POSITIONER_CLASS)}>
            <MenuPopup
              data-slot="task-filter-menu"
              className={cn(MENU_POPUP_CLASS, "w-52", SHEET_POPUP_CLASS)}
            >
              <MenuSheetHeader title="Bộ lọc" />
              <div className="space-y-px">
                {filterCategories.map((category, index) => (
                  <React.Fragment key={category.key}>
                    {renderCategorySubmenu(category)}
                  </React.Fragment>
                ))}
              </div>

              {activeFilterCount > 0 && (
                <MenuOptionItem
                  closeOnClick
                  onClick={handleResetFilters}
                  leading={<RotateCcw className="size-4 text-muted-foreground" />}
                  hint={activeFilterCount}
                >
                  Xóa bộ lọc
                </MenuOptionItem>
              )}
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>

      {/* Active Filter Clear on Toolbar */}

      {/* 3. Linear Display / View Options Popover — Icon hiển thị kề bên Filter! */}
      <TaskTableViewOptionsPopover
        groupingField={groupingField}
        onGroupingChange={setGroupingField}
        sortField={sortField as any}
        sortDirection={sortDirection}
        onSort={onSort as any}
        visibleColumns={effectiveVisibleColumns}
        onVisibleColumnsChange={handleVisibleColumnsChange}
        isCustomized={isDisplayCustomized}
        onReset={handleResetDisplayProperties}
        triggerClassName="inline-flex h-7 w-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-full border border-border/80 bg-background text-foreground hover:bg-accent text-xs font-medium transition-colors touch-manipulation"
      />

        </div>
      )}

      {!leftContent && createCta}
    </div>
  );
}
