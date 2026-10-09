"use client";

// Unified Task Toolbar Component — Unified control toolbar for task views
import * as React from "react";
import {
  Search,
  X,
  Plus,
  Filter,
  List,
  Kanban,
  Building,
  Calendar,
  School,
  User,
  Users,
  Tag,
  Flag,
  Loader2,
  Check,
  CheckCircle2,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  FileText,
  Clock,
  Circle,
  AlertCircle,
  Layers,
  Activity,
} from "lucide-react";
import {
  StatusSubAll,
  StatusSubNew,
  StatusSubInProgress,
  StatusSubReview,
  StatusSubCompleted,
  PrioritySubBars,
  HealthSubAll,
  HealthSubOnTrack,
  HealthSubAtRisk,
  HealthSubOverdue,
  HealthSubCompleted,
  FilterIconStatus,
  FilterIconPriority,
  FilterIconHealth,
  FilterIconProgress,
  FilterIconLead,
  FilterIconCollaborator,
  FilterIconCategory,
  FilterIconDept,
  FilterIconDeadline,
  FilterIconMonth,
  FilterIconOrigin,
} from "./task-filter-icons";
import type { TaskView } from "@/domain/tasks";
import { cn } from "@/lib/utils";
import { ListToolbarSearch, listToolbarIconButtonClass, listToolbarPrimaryButtonClass } from "@/components/ui/list-toolbar";
import {
  getTaskTimeFilterLabel,
  NO_TASK_TIME_FILTER,
  type TaskTimeFilter,
  type TaskTimePreset,
} from "@/lib/task-time-filter";
import type { AuthUser } from "@/types/auth";
import type { SchoolTask, StaffTask, TaskCategory } from "@/types/dashboard";
import {
  isExecutiveUser,
  isManagerUser,
} from "@/components/layout/scope-switcher";
import { isUserUnassignedDepartment } from "@/lib/auth-context";
import {
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthInfo,
  getAcademicMonthsForYear,
} from "@/lib/academic-calendar";
import { filterTasksForTable } from "@/components/tasks/cascading-task-table";
import { filterTasksByRole, matchesUser } from "@/lib/role-task-filter";
import {
  SavedViewsSelector,
  type SavedViewsSelectorProps,
} from "@/components/tasks/saved-views-selector";
import {
  MenuRoot,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
  MenuSeparator,
  MenuSubmenuRoot,
  MenuSubmenuTrigger,
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

export interface SmartFilterPill {
  id: string;
  label: string;
  count?: number;
}

export interface UnifiedTaskToolbarProps {
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

  // View Mode
  viewMode?: TaskViewMode | "table" | "kanban";
  onViewModeChange?: (view: any) => void;

  // Density
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

export const SCOPE_TABS: ScopeTab[] = [
  { id: "MY_TASKS", label: "Việc của tôi", shortLabel: "Cá nhân" },
  { id: "SCHOOL_TASKS", label: "Nhiệm vụ cấp Trường", shortLabel: "Cấp Trường" },
  { id: "UNIT_TASKS", label: "Công việc Đơn vị", shortLabel: "Đơn vị" },
];

export const VIEW_MODE_OPTIONS: ViewModeOption[] = [
  { id: "table", label: "Bảng", icon: List },
  { id: "kanban", label: "Kanban", icon: Kanban },
  { id: "calendar", label: "Lịch", icon: Calendar },
  { id: "department", label: "Theo đơn vị", icon: Building },
  { id: "executive", label: "Chỉ huy BGH", icon: School },
];

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

function normalizeFilterSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

export const PRIORITY_FILTER_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả mức độ" },
  { id: "URGENT", label: "Khẩn cấp" },
  { id: "HIGH", label: "Ưu tiên cao" },
  { id: "NORMAL", label: "Bình thường" },
];

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

export function buildRoleActionPill(
  isExecutiveRole: boolean,
  tabCounts: UnifiedTaskToolbarProps["tabCounts"],
  activeTab: string
): QuickFilterPill {
  if (isExecutiveRole) {
    return {
      id: "waiting_approval",
      label: "Cần tôi duyệt",
      count: tabCounts?.waiting_approval ?? tabCounts?.review ?? 0,
      isActive: activeTab === "waiting_approval" || activeTab === "review",
    };
  }
  return {
    id: "pending_submission",
    label: "Chờ tôi nộp",
    count: tabCounts?.pending_submission ?? 0,
    isActive: activeTab === "pending_submission",
  };
}

export function buildQuickFilterPills(
  isExecutiveRole: boolean,
  tabCounts: UnifiedTaskToolbarProps["tabCounts"],
  activeTab: string,
  totalTasksCount?: number
): QuickFilterPill[] {
  const isPendingActive =
    activeTab === "waiting_approval" ||
    activeTab === "review" ||
    activeTab === "pending_submission";

  return [
    {
      id: "all",
      label: "Tất cả",
      count: tabCounts?.all ?? totalTasksCount,
      isActive: activeTab === "all" || !activeTab,
    },
    {
      id: "overdue",
      label: "Trễ hạn",
      count: tabCounts?.overdue ?? 0,
      isActive: activeTab === "overdue",
    },
    {
      id: "this_week",
      label: "Đến hạn tuần này",
      count: tabCounts?.this_week ?? tabCounts?.today ?? 0,
      isActive: activeTab === "this_week" || activeTab === "today",
    },
    {
      id: isExecutiveRole ? "waiting_approval" : "review",
      label: isExecutiveRole ? "Chờ duyệt" : "Chờ nộp/duyệt",
      count: tabCounts?.waiting_approval ?? tabCounts?.review ?? tabCounts?.pending_submission ?? 0,
      isActive: isPendingActive,
    },
  ];
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
  viewMode = "table",
  onViewModeChange,
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
  const [menuSearch, setMenuSearch] = React.useState("");
  const menuSearchInputRef = React.useRef<HTMLInputElement>(null);
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

  React.useEffect(() => {
    if (isCollapsedFilterOpen) {
      const timer = setTimeout(() => {
        menuSearchInputRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => clearTimeout(timer);
    } else {
      setMenuSearch("");
    }
  }, [isCollapsedFilterOpen]);

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
  const isManager =
    userRole === "MANAGER" || isManagerUser(user) || isExecutive;
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

  // Synthesize criteria for saved views if not explicitly provided
  const synthesizedCriteria: TaskViewCriteria = React.useMemo(() => {
    return {
      scope: normalizedScope,
      dept: selectedDepartment,
      status: activeTab,
      category: selectedCategory,
      priority: selectedPriority,
      academicMonth: effectiveMonth,
      q: searchQuery,
      viewMode: viewMode === "kanban" ? "kanban" : "table",
      density: density,
      sortField,
      sortDirection,
    };
  }, [
    normalizedScope,
    selectedDepartment,
    activeTab,
    selectedCategory,
    selectedPriority,
    effectiveMonth,
    searchQuery,
    viewMode,
    density,
    sortField,
    sortDirection,
  ]);

  const effectiveCriteria = currentCriteria ?? synthesizedCriteria;

  // Handle scope change, preserving the caller's format preference
  const handleScopeSelect = (scopeId: TaskView, legacyScope: WorkspaceScope) => {
    if (!onScopeChange) return;
    if (typeof scope === "string" && scope.endsWith("_TASKS")) {
      const legacyMap: Record<WorkspaceScope, TaskScope> = {
        school: "SCHOOL_TASKS",
        unit: "UNIT_TASKS",
        my: "MY_TASKS",
      };
      onScopeChange(legacyMap[legacyScope]);
    } else {
      onScopeChange(scopeId as any);
    }
  };

  // 1. Authorized Scope Options (Canonical Query Views: Issue #26)
  const canViewSchoolScope = true;
  const canViewUnitScope = true;

  const scopeOptions: Array<{
    id: TaskView;
    legacyScope: WorkspaceScope;
    legacyId: TaskScope;
    label: string;
    shortLabel: string;
    icon: typeof School;
    isAuthorized: boolean;
  }> = [
    {
      id: "related",
      legacyScope: "my",
      legacyId: "MY_TASKS",
      label: "Của tôi",
      shortLabel: "Của tôi",
      icon: User,
      isAuthorized: true,
    },
    {
      id: "unit",
      legacyScope: "unit",
      legacyId: "UNIT_TASKS",
      label: "Đơn vị",
      shortLabel: "Đơn vị",
      icon: Building,
      isAuthorized: canViewUnitScope,
    },
    {
      id: "all",
      legacyScope: "school",
      legacyId: "SCHOOL_TASKS",
      label: "Toàn trường",
      shortLabel: "Toàn trường",
      icon: School,
      isAuthorized: canViewSchoolScope,
    },
    {
      id: "approval",
      legacyScope: "school",
      legacyId: "SCHOOL_TASKS",
      label: "Chờ duyệt",
      shortLabel: "Chờ duyệt",
      icon: Clock,
      isAuthorized: true,
    },
  ];

  // Only keep authorized scopes
  const authorizedScopes = scopeOptions.filter((opt) => opt.isAuthorized);

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

        searchInputRef.current?.focus();
        searchInputRef.current?.select();
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

  const roleActionPill = React.useMemo(
    () => buildRoleActionPill(isExecutiveRole, tabCounts, activeTab),
    [isExecutiveRole, tabCounts, activeTab]
  );

  const quickFilterPills = React.useMemo(
    () => buildQuickFilterPills(isExecutiveRole, tabCounts, activeTab, totalTasksCount),
    [isExecutiveRole, tabCounts, activeTab, totalTasksCount]
  );

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

  const timeLabel = React.useMemo(() => getTaskTimeFilterLabel(effectiveTimeFilter), [effectiveTimeFilter]);

  const statusLabel = React.useMemo(() => {
    if (!effectiveStatus || effectiveStatus === "all" || effectiveStatus === "ALL") {
      return "Trạng thái";
    }
    const norm = effectiveStatus.toLowerCase();
    if (norm === "new" || norm === "not_started" || norm === "assigned") return "Mới";
    if (norm === "in_progress") return "Đang thực hiện";
    if (
      norm === "waiting_approval" ||
      norm === "review" ||
      norm === "pending_executive_approval" ||
      norm === "needs_review"
    ) {
      return isExecutiveRole ? "Cần tôi duyệt" : "Cần chỉnh sửa";
    }
    if (norm === "pending_submission" || norm === "waiting_submission") return "Chờ nộp BC";
    if (norm === "completed") return "Hoàn thành";
    if (effectiveStatus.includes(",")) {
      const parts = effectiveStatus
        .split(",")
        .filter((p) => p !== "today" && p !== "this_week" && p !== "overdue");
      if (parts.length === 0) return "Trạng thái";
      return `Trạng thái · ${parts.length}`;
    }
    return "Trạng thái";
  }, [effectiveStatus, isExecutiveRole]);

  const deadlineOptions = React.useMemo(() => [
    { value: "all", label: "Tất cả thời hạn" },
    { value: "today", label: "Đến hạn hôm nay", count: tabCounts?.today },
    { value: "this_week", label: "Trong tuần này", count: tabCounts?.this_week },
    { value: "overdue", label: "Trễ hạn", count: tabCounts?.overdue },
  ], [tabCounts]);

  const deadlineLabel = React.useMemo(() => {
    if (effectiveDeadline === "today") return "Đến hạn hôm nay";
    if (effectiveDeadline === "this_week") return "Trong tuần này";
    if (effectiveDeadline === "overdue") return "Trễ hạn";
    return "Thời hạn";
  }, [effectiveDeadline]);

  const priorityLabel = React.useMemo(() => {
    if (!selectedPriority || selectedPriority === "ALL") return "Ưu tiên";
    if (selectedPriority.includes(",")) {
      const parts = selectedPriority.split(",").filter(Boolean);
      return `Ưu tiên · ${parts.length}`;
    }
    const found = PRIORITY_FILTER_OPTIONS.find((p) => p.id === selectedPriority);
    return found ? found.label : selectedPriority;
  }, [selectedPriority]);

  const showDepartmentFilter = React.useMemo(() => {
    return normalizedScope === "school" && availableDepartments.length > 1;
  }, [normalizedScope, availableDepartments.length]);

  const departmentLabel = React.useMemo(() => {
    if (!selectedDepartment || selectedDepartment === "ALL") return "Đơn vị";
    if (selectedDepartment.includes(",")) {
      const parts = selectedDepartment.split(",").filter(Boolean);
      return `Đơn vị · ${parts.length}`;
    }
    const found = availableDepartments.find((d) => d.code === selectedDepartment);
    return found ? found.name : selectedDepartment;
  }, [selectedDepartment, availableDepartments]);

  const secondaryFiltersActiveCount = React.useMemo(() => {
    let count = 0;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (showDepartmentFilter && selectedDepartment && selectedDepartment !== "ALL") count++;
    return count;
  }, [selectedPriority, showDepartmentFilter, selectedDepartment]);

  const moreFiltersActiveCount = secondaryFiltersActiveCount;

  // Count active advanced filters (Department, Priority, Custom status)
  const activeAdvancedFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (
      effectiveDeadline === "today" ||
      (isExecutiveRole
        ? effectiveStatus === "pending_submission"
        : effectiveStatus === "waiting_approval" || effectiveStatus === "review")
    ) {
      count++;
    }
    return count;
  }, [
    selectedDepartment,
    selectedPriority,
    effectiveDeadline,
    effectiveStatus,
    isExecutiveRole,
  ]);

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

  const isAnyFilterActive = Boolean(
    isSearchActive ||
    isMonthActive ||
    isStatusActive ||
    isDeadlineActive ||
    isPriorityActive ||
    isCategoryActive ||
    (showDepartmentFilter && isDepartmentActive)
  );

  const effectiveTotalTasksCount = totalTasksCount !== undefined ? totalTasksCount : 0;
  const effectiveFilteredTasksCount =
    filteredTasksCount !== undefined ? filteredTasksCount : effectiveTotalTasksCount;

  // Check if active view ID should be retained or cleared due to criteria divergence
  const effectiveActiveViewId = React.useMemo(() => {
    if (!activeViewId) return null;
    const view =
      ALL_ROLE_PRESETS.find((p) => p.id === activeViewId) ||
      getCustomSavedViews(user?.id).find((v) => v.id === activeViewId);
    if (!view) return null;
    if (effectiveCriteria && !areCriteriaEqual(view.criteria, effectiveCriteria)) {
      return null;
    }
    return activeViewId;
  }, [activeViewId, effectiveCriteria, user?.id]);

  const hasCustomFilters = React.useMemo(() => {
    return Boolean(
      (searchQuery && searchQuery.trim().length > 0) ||
      (selectedDepartment && selectedDepartment !== "ALL") ||
      (selectedCategory && selectedCategory !== "ALL") ||
      (selectedPriority && selectedPriority !== "ALL") ||
      (effectiveMonth !== undefined && effectiveMonth !== "ALL") ||
      (activeTab && activeTab !== "all")
    );
  }, [
    searchQuery,
    selectedDepartment,
    selectedCategory,
    selectedPriority,
    effectiveMonth,
    activeTab,
  ]);

  // Active filter chips for individual criterion removal
  const activeFilterChips = React.useMemo(() => {
    const chips: Array<{ id: string; label: string; onRemove: () => void }> = [];

    if (searchQuery && searchQuery.trim().length > 0) {
      chips.push({
        id: "search",
        label: `Từ khóa: "${searchQuery}"`,
        onRemove: () => onSearchChange(""),
      });
    }

    if (activeTab && activeTab !== "all") {
      let tabLabel = "";
      if (activeTab === "overdue") tabLabel = "Trễ hạn";
      else if (activeTab === "waiting_approval" || activeTab === "review") {
        tabLabel = isExecutiveRole ? "Cần tôi duyệt" : "Chờ duyệt";
      } else if (activeTab === "pending_submission") {
        tabLabel = !isExecutiveRole ? "Chờ tôi nộp" : "Chờ nộp BC";
      } else if (activeTab === "today") tabLabel = "Hôm nay";
      else tabLabel = activeTab;

      chips.push({
        id: "tab",
        label: tabLabel,
        onRemove: () => onTabChange?.("all"),
      });
    }

    if (selectedDepartment && selectedDepartment !== "ALL") {
      const deptName =
        availableDepartments.find((d) => d.code === selectedDepartment)?.name ||
        selectedDepartment;
      chips.push({
        id: "dept",
        label: `Đơn vị: ${deptName}`,
        onRemove: () => onDepartmentChange?.("ALL"),
      });
    }

    if (selectedPriority && selectedPriority !== "ALL") {
      const prioLabel =
        PRIORITY_FILTER_OPTIONS.find((p) => p.id === selectedPriority)?.label ||
        selectedPriority;
      chips.push({
        id: "prio",
        label: `Ưu tiên: ${prioLabel}`,
        onRemove: () => onPriorityChange?.("ALL"),
      });
    }

    if (effectiveTimeFilter.kind !== "none") {
      chips.push({
        id: "month",
        label: getTaskTimeFilterLabel(effectiveTimeFilter),
        onRemove: () => handleTimeFilterChange(NO_TASK_TIME_FILTER),
      });
    }

    return chips;
  }, [
    searchQuery,
    onSearchChange,
    activeTab,
    isExecutiveRole,
    onTabChange,
    selectedDepartment,
    availableDepartments,
    onDepartmentChange,
    selectedPriority,
    onPriorityChange,
    effectiveTimeFilter,
  ]);

  // Optional 12 month cycle list for year
  const academicMonths = React.useMemo(() => {
    return getAcademicMonthsForYear(academicYear);
  }, [academicYear]);

  const allYearCount = React.useMemo(() => {
    if (monthlyTaskCounts) {
      return Object.values(monthlyTaskCounts).reduce((acc, c) => acc + (c || 0), 0);
    }
    return totalTasksCount;
  }, [monthlyTaskCounts, totalTasksCount]);

  // Reset all filters (Only clears supplementary filters, retains Scope & User Department)
  const handleResetFilters = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setLocalSearch("");
    setSelectedLead(null);
    handleHealthChange(null);
    handleOriginChange(null);
    handleCollaboratorChange(null);
    setMenuSearch("");
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

  const leadLabel = React.useMemo(() => {
    if (selectedLead === "my" || activeTab === "my") return "Của tôi";
    if (selectedLead === "bgh") return "Lãnh đạo BGH";
    if (selectedLead === "assigned") return "Đã phân công";
    if (selectedLead === "unassigned") return "Chưa phân công";
    return undefined;
  }, [selectedLead, activeTab]);

  const healthLabel = React.useMemo(() => {
    if (!selectedHealth || selectedHealth === "all") return undefined;
    if (selectedHealth.includes(",")) {
      const parts = selectedHealth.split(",").filter(Boolean);
      return `Tiến độ · ${parts.length}`;
    }
    if (selectedHealth === "on_track") return "Đúng tiến độ";
    if (selectedHealth === "at_risk") return "Nguy cơ trễ";
    if (selectedHealth === "overdue") return "Trễ hạn";
    if (selectedHealth === "completed") return "Đạt 100%";
    return undefined;
  }, [selectedHealth]);

  const originLabel = React.useMemo(() => {
    if (!selectedOrigin || selectedOrigin === "all") return undefined;
    if (selectedOrigin.includes(",")) {
      const parts = selectedOrigin.split(",").filter(Boolean);
      return `Nguồn gốc · ${parts.length}`;
    }
    if (selectedOrigin === "KE_HOACH_NAM") return "Kế hoạch năm";
    if (selectedOrigin === "NGHI_QUYET") return "Nghị quyết BGH";
    if (selectedOrigin === "GIAO_BAN") return "Giao ban";
    if (selectedOrigin === "DON_VI") return "Đơn vị đề xuất";
    return undefined;
  }, [selectedOrigin]);

  const categoryLabel = React.useMemo(() => {
    if (!selectedCategory || selectedCategory === "ALL") return undefined;
    if (selectedCategory.includes(",")) {
      const parts = selectedCategory.split(",").filter(Boolean);
      return `Danh mục · ${parts.length}`;
    }
    const found = CATEGORY_FILTER_OPTIONS.find((c) => c.id === selectedCategory);
    return found ? found.label : selectedCategory;
  }, [selectedCategory]);

  const collaboratorLabel = React.useMemo(() => {
    if (selectedCollaborator === "has_collab") return "Có phối hợp";
    if (selectedCollaborator === "single") return "Tự thực hiện";
    return undefined;
  }, [selectedCollaborator]);

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
                let nextList: string[];
                if (isAll) {
                  nextList = [opt.value];
                } else if (selected) {
                  nextList = selectedList.filter((v) => v !== opt.value && v !== "all");
                  if (nextList.length === 0) nextList = ["all"];
                } else {
                  nextList = [...selectedList.filter((v) => v !== "all"), opt.value];
                }
                const nextStr = nextList.join(",");
                if (onStatusChange) onStatusChange(nextStr);
                else onTabChange?.(nextStr);
              };

              return (
                <MenuItem
                  key={opt.value}
                  closeOnClick={false}
                  onClick={handleToggle}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.value === "all" ? (
                      <StatusSubAll className="size-3.5 text-muted-foreground/60 shrink-0" />
                    ) : opt.value === "new" ? (
                      <StatusSubNew className="size-3.5 text-muted-foreground/70 shrink-0" />
                    ) : opt.value === "in_progress" ? (
                      <StatusSubInProgress className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "waiting_approval" || opt.value === "review" ? (
                      <StatusSubReview className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "completed" ? (
                      <StatusSubCompleted className="size-3.5 text-foreground/90 shrink-0" />
                    ) : (
                      <Circle className="size-2.5 text-muted-foreground/40 shrink-0 ml-0.5" strokeWidth={1.5} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
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
                let nextList: string[];
                if (isAll) {
                  nextList = [opt.id];
                } else if (selected) {
                  nextList = selectedList.filter((p) => p !== opt.id && p !== "ALL");
                  if (nextList.length === 0) nextList = ["ALL"];
                } else {
                  nextList = [...selectedList.filter((p) => p !== "ALL"), opt.id];
                }
                onPriorityChange?.(nextList.join(","));
              };

              return (
                <MenuItem
                  key={opt.id}
                  closeOnClick={false}
                  onClick={handleToggle}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <PrioritySubBars
                      level={level as 0 | 1 | 2 | 3}
                      className={cn(
                        "size-3.5 shrink-0",
                        selected ? "text-foreground" : "text-muted-foreground/70"
                      )}
                    />
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "category": {
        const selectedList = (selectedCategory || "ALL").split(",").map((c) => c.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");

        return (
          <div className="space-y-px max-h-56 overflow-y-auto">
            {CATEGORY_FILTER_OPTIONS.map((cat) => {
              const selected = cat.id === "ALL" ? isAll : selectedList.includes(cat.id);

              const handleToggle = () => {
                if (cat.id === "ALL") {
                  onCategoryChange?.("ALL");
                  return;
                }
                let nextList: string[];
                if (isAll) {
                  nextList = [cat.id];
                } else if (selected) {
                  nextList = selectedList.filter((c) => c !== cat.id && c !== "ALL");
                  if (nextList.length === 0) nextList = ["ALL"];
                } else {
                  nextList = [...selectedList.filter((c) => c !== "ALL"), cat.id];
                }
                onCategoryChange?.(nextList.join(","));
              };

              return (
                <MenuItem
                  key={cat.id}
                  closeOnClick={false}
                  onClick={handleToggle}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FilterIconCategory className="size-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{cat.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
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
          let nextList: string[];
          if (isAll) {
            nextList = [deptCode];
          } else if (selectedList.includes(deptCode)) {
            nextList = selectedList.filter((d) => d !== deptCode && d !== "ALL");
            if (nextList.length === 0) nextList = ["ALL"];
          } else {
            nextList = [...selectedList.filter((d) => d !== "ALL"), deptCode];
          }
          onDepartmentChange?.(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {/* Tất cả đơn vị */}
            <MenuItem
              closeOnClick={false}
              onClick={() => handleDeptToggle("ALL")}
              className={cn(
                "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                isAll
                  ? "bg-accent font-medium text-foreground"
                  : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <FilterIconDept className="size-3.5 text-muted-foreground/60 shrink-0" />
                <span>Tất cả đơn vị</span>
              </div>
              <div
                className={cn(
                  "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                  isAll
                    ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                    : "border-border/80 bg-background group-hover/item:border-neutral-400"
                )}
              >
                {isAll && <Check className="size-2.5 stroke-[2.5]" />}
              </div>
            </MenuItem>

            <MenuSeparator className="h-px bg-border/40 my-1" />

            {/* Sub-dropdown cấp 2: Khoa chuyên môn */}
            <MenuSubmenuRoot>
              <MenuSubmenuTrigger
                openOnHover
                delay={60}
                closeDelay={180}
                className="group flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors hover:bg-accent text-foreground/80 hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground data-[open]:bg-accent data-[open]:text-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <School className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground/80 transition-colors" strokeWidth={1.5} />
                  <span className={cn("truncate", isFacultyActive ? "font-medium text-foreground" : "font-normal")}>
                    Khoa đào tạo
                  </span>
                </div>
                <ChevronRight
                  className="size-2.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors ml-auto"
                  strokeWidth={1.5}
                />
              </MenuSubmenuTrigger>
              <MenuPortal>
                <MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none">
                  <MenuPopup className="min-w-[210px] w-auto max-w-[320px] rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="space-y-px">
                      {facultyDepts.map((dept) => {
                        const selected = !isAll && selectedList.includes(dept.code);
                        return (
                          <MenuItem
                            key={dept.code}
                            closeOnClick={false}
                            onClick={() => handleDeptToggle(dept.code)}
                            className={cn(
                              "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                              selected
                                ? "bg-accent font-medium text-foreground"
                                : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <School className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
                              <span className="truncate">{dept.name}</span>
                            </div>
                            <div
                              className={cn(
                                "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                                selected
                                  ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                                  : "border-border/80 bg-background group-hover/item:border-neutral-400"
                              )}
                            >
                              {selected && <Check className="size-2.5 stroke-[2.5]" />}
                            </div>
                          </MenuItem>
                        );
                      })}
                    </div>
                  </MenuPopup>
                </MenuPositioner>
              </MenuPortal>
            </MenuSubmenuRoot>

            {/* Sub-dropdown cấp 2: Khối Hành chính & Phòng ban */}
            <MenuSubmenuRoot>
              <MenuSubmenuTrigger
                openOnHover
                delay={60}
                closeDelay={180}
                className="group flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors hover:bg-accent text-foreground/80 hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground data-[open]:bg-accent data-[open]:text-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Building className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground/80 transition-colors" strokeWidth={1.5} />
                  <span className={cn("truncate", isAdminActive ? "font-medium text-foreground" : "font-normal")}>
                    Phòng ban hành chính
                  </span>
                </div>
                <ChevronRight
                  className="size-2.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors ml-auto"
                  strokeWidth={1.5}
                />
              </MenuSubmenuTrigger>
              <MenuPortal>
                <MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none">
                  <MenuPopup className="min-w-[210px] w-auto max-w-[320px] rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="space-y-px">
                      {adminDepts.map((dept) => {
                        const selected = !isAll && selectedList.includes(dept.code);
                        return (
                          <MenuItem
                            key={dept.code}
                            closeOnClick={false}
                            onClick={() => handleDeptToggle(dept.code)}
                            className={cn(
                              "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                              selected
                                ? "bg-accent font-medium text-foreground"
                                : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Building className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
                              <span className="truncate">{dept.name}</span>
                            </div>
                            <div
                              className={cn(
                                "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                                selected
                                  ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                                  : "border-border/80 bg-background group-hover/item:border-neutral-400"
                              )}
                            >
                              {selected && <Check className="size-2.5 stroke-[2.5]" />}
                            </div>
                          </MenuItem>
                        );
                      })}
                    </div>
                  </MenuPopup>
                </MenuPositioner>
              </MenuPortal>
            </MenuSubmenuRoot>
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
                <MenuItem
                  key={opt.value}
                  closeOnClick={false}
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
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.value === "my" ? (
                      <FilterIconLead className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "bgh" ? (
                      <FilterIconDept className="size-3.5 text-muted-foreground/70 shrink-0" />
                    ) : opt.value === "assigned" ? (
                      <FilterIconLead className="size-3.5 text-muted-foreground/70 shrink-0" />
                    ) : opt.value === "unassigned" ? (
                      <Circle className="size-3 text-muted-foreground/40 shrink-0 ml-0.5" strokeDasharray="2 2" />
                    ) : (
                      <Users className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
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
                <MenuItem
                  key={opt.value}
                  closeOnClick={false}
                  onClick={() => {
                    handleCollaboratorChange(opt.value === "all" ? null : opt.value);
                  }}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.value === "has_collab" ? (
                      <FilterIconCollaborator className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "single" ? (
                      <FilterIconLead className="size-3.5 text-muted-foreground/70 shrink-0" />
                    ) : (
                      <Users className="size-3.5 text-muted-foreground/50 shrink-0" strokeWidth={1.5} />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "dates": {
        return (
          <div className="space-y-px">
            {/* Sub-dropdown cấp 2: Hạn chốt */}
            <MenuSubmenuRoot>
              <MenuSubmenuTrigger
                openOnHover
                delay={60}
                closeDelay={180}
                className="group flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors hover:bg-accent text-foreground/80 hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground data-[open]:bg-accent data-[open]:text-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground/80 transition-colors" strokeWidth={1.5} />
                  <span className={cn("truncate", isDeadlineActive ? "font-medium text-foreground" : "font-normal")}>
                    Hạn chốt
                  </span>
                </div>
                <ChevronRight
                  className="size-2.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors ml-auto"
                  strokeWidth={1.5}
                />
              </MenuSubmenuTrigger>
              <MenuPortal>
                <MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none">
                  <MenuPopup className="min-w-[210px] w-auto max-w-[320px] rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="space-y-px">
                      {deadlineOptions.map((opt) => {
                        const selected = effectiveDeadline === opt.value ||
                          (opt.value === "all" && (!effectiveDeadline || effectiveDeadline === "all"));
                        return (
                          <MenuItem
                            key={opt.value}
                            closeOnClick={false}
                            onClick={() => {
                              if (onDeadlineChange) onDeadlineChange(opt.value);
                              else onTabChange?.(opt.value === "all" ? "all" : opt.value);
                            }}
                            className={cn(
                              "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                              selected
                                ? "bg-accent font-medium text-foreground"
                                : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Calendar className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
                              <span>{opt.label}</span>
                              {opt.count !== undefined && opt.count > 0 && (
                                <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">({opt.count})</span>
                              )}
                            </div>
                            <div
                              className={cn(
                                "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                                selected
                                  ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                                  : "border-border/80 bg-background group-hover/item:border-neutral-400"
                              )}
                            >
                              {selected && <Check className="size-2.5 stroke-[2.5]" />}
                            </div>
                          </MenuItem>
                        );
                      })}
                    </div>
                  </MenuPopup>
                </MenuPositioner>
              </MenuPortal>
            </MenuSubmenuRoot>

            {/* Sub-dropdown cấp 2: Kỳ tháng */}
            <MenuSubmenuRoot>
              <MenuSubmenuTrigger
                openOnHover
                delay={60}
                closeDelay={180}
                className="group flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors hover:bg-accent text-foreground/80 hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground data-[open]:bg-accent data-[open]:text-foreground"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="size-3.5 shrink-0 text-muted-foreground/70 group-hover:text-foreground/80 transition-colors" strokeWidth={1.5} />
                  <span className={cn("truncate", isMonthActive ? "font-medium text-foreground" : "font-normal")}>
                    Kỳ tháng
                  </span>
                </div>
                <ChevronRight
                  className="size-2.5 shrink-0 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors ml-auto"
                  strokeWidth={1.5}
                />
              </MenuSubmenuTrigger>
              <MenuPortal>
                <MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none">
                  <MenuPopup className="min-w-[190px] w-auto max-w-[260px] rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                    <div className="space-y-px">
                      <MenuItem
                        closeOnClick={false}
                        onClick={() => {
                          handleTimeFilterChange(NO_TASK_TIME_FILTER);
                        }}
                        className={cn(
                          "flex h-7 w-full items-center gap-2 rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                          effectiveTimeFilter.kind === "none"
                            ? "bg-accent font-medium text-foreground"
                            : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                        )}
                      >
                        <Clock className="size-3.5 text-muted-foreground/60 shrink-0" strokeWidth={1.5} />
                        <span>Tất cả các tháng</span>
                      </MenuItem>

                      <MenuSeparator className="h-px bg-border/40 my-1" />

                      <div className="px-1.5 py-1">
                        <p className="mb-1.5 text-[10px] font-medium text-muted-foreground select-none">
                          Năm học {academicYear}
                        </p>
                        <div className="grid grid-cols-4 gap-1">
                          {academicMonths.map((period) => {
                            const selected = effectiveTimeFilter.kind === "month" && effectiveTimeFilter.month === period.monthNumber;
                            return (
                              <button
                                key={period.monthNumber}
                                type="button"
                                aria-pressed={selected}
                                onClick={() => {
                                  handleTimeFilterChange({ kind: "month", month: period.monthNumber });
                                }}
                                className={cn(
                                  "flex h-6 items-center justify-center rounded text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer select-none touch-manipulation",
                                  selected
                                    ? "bg-neutral-800 text-white font-semibold shadow-2xs"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                )}
                              >
                                T{period.monthNumber}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </MenuPopup>
                </MenuPositioner>
              </MenuPortal>
            </MenuSubmenuRoot>
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
          let nextList: string[];
          if (isAll) {
            nextList = [val];
          } else if (selectedList.includes(val)) {
            nextList = selectedList.filter((h) => h !== val && h !== "all");
            if (nextList.length === 0) nextList = ["all"];
          } else {
            nextList = [...selectedList.filter((h) => h !== "all"), val];
          }
          handleHealthChange(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {healthOptions.map((opt) => {
              const selected = opt.value === "all" ? isAll : selectedList.includes(opt.value);
              return (
                <MenuItem
                  key={opt.value}
                  closeOnClick={false}
                  onClick={() => handleHealthToggle(opt.value)}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {opt.value === "on_track" ? (
                      <HealthSubOnTrack className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "at_risk" ? (
                      <HealthSubAtRisk className="size-3.5 text-foreground/80 shrink-0" />
                    ) : opt.value === "overdue" ? (
                      <HealthSubOverdue className="size-3.5 text-foreground/90 shrink-0" />
                    ) : opt.value === "completed" ? (
                      <HealthSubCompleted className="size-3.5 text-foreground/90 shrink-0" />
                    ) : (
                      <HealthSubAll className="size-3.5 text-muted-foreground/60 shrink-0" />
                    )}
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
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
          let nextList: string[];
          if (isAll) {
            nextList = [val];
          } else if (selectedList.includes(val)) {
            nextList = selectedList.filter((o) => o !== val && o !== "all");
            if (nextList.length === 0) nextList = ["all"];
          } else {
            nextList = [...selectedList.filter((o) => o !== "all"), val];
          }
          handleOriginChange(nextList.join(","));
        };

        return (
          <div className="space-y-px">
            {originOptions.map((opt) => {
              const selected = opt.value === "all" ? isAll : selectedList.includes(opt.value);
              return (
                <MenuItem
                  key={opt.value}
                  closeOnClick={false}
                  onClick={() => handleOriginToggle(opt.value)}
                  className={cn(
                    "group/item flex h-7 w-full items-center justify-between rounded-md px-2 text-[12px] transition-colors cursor-pointer select-none outline-none whitespace-nowrap",
                    selected
                      ? "bg-muted/70 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FilterIconOrigin className="size-3.5 text-muted-foreground/60 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </div>

                  <div
                    className={cn(
                      "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                      selected
                        ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                        : "border-border/80 bg-background group-hover/item:border-neutral-400"
                    )}
                  >
                    {selected && <Check className="size-2.5 stroke-[2.5]" />}
                  </div>
                </MenuItem>
              );
            })}
          </div>
        );
      }
      default:
        return null;
    }
  };

  const matchingSearchOptions = React.useMemo(() => {
    if (!menuSearch.trim()) return [];
    const query = normalizeFilterSearchText(menuSearch);
    const results: Array<{
      id: string;
      categoryLabel: string;
      label: string;
      icon: any;
      selected: boolean;
      onSelect: () => void;
    }> = [];

    // Match Status
    statusOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selectedList = (effectiveStatus || "all").toLowerCase().split(",").map((s) => s.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("all");
        const selected = opt.value === "all"
          ? isAll
          : opt.value === "new"
            ? selectedList.includes("new") || selectedList.includes("not_started") || selectedList.includes("assigned")
            : opt.value === "waiting_approval" || opt.value === "review"
              ? selectedList.includes("waiting_approval") || selectedList.includes("review") || selectedList.includes("pending_executive_approval") || selectedList.includes("needs_review")
              : selectedList.includes(opt.value);
        results.push({
          id: `status-${opt.value}`,
          categoryLabel: "Trạng thái",
          label: opt.label,
          icon: CheckCircle2,
          selected,
          onSelect: () => {
            if (opt.value === "all") {
              if (onStatusChange) onStatusChange("all");
              else onTabChange?.("all");
              return;
            }
            let nextList: string[];
            if (isAll) {
              nextList = [opt.value];
            } else if (selected) {
              nextList = selectedList.filter((v) => v !== opt.value && v !== "all");
              if (nextList.length === 0) nextList = ["all"];
            } else {
              nextList = [...selectedList.filter((v) => v !== "all"), opt.value];
            }
            const nextStr = nextList.join(",");
            if (onStatusChange) onStatusChange(nextStr);
            else onTabChange?.(nextStr);
          },
        });
      }
    });

    // Match Priority
    PRIORITY_FILTER_OPTIONS.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selectedList = (selectedPriority || "ALL").split(",").map((p) => p.trim().toUpperCase()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");
        const selected = opt.id === "ALL" ? isAll : selectedList.includes(opt.id);
        results.push({
          id: `prio-${opt.id}`,
          categoryLabel: "Mức ưu tiên",
          label: opt.label,
          icon: Flag,
          selected,
          onSelect: () => {
            if (opt.id === "ALL") {
              onPriorityChange?.("ALL");
              return;
            }
            let nextList: string[];
            if (isAll) {
              nextList = [opt.id];
            } else if (selected) {
              nextList = selectedList.filter((p) => p !== opt.id && p !== "ALL");
              if (nextList.length === 0) nextList = ["ALL"];
            } else {
              nextList = [...selectedList.filter((p) => p !== "ALL"), opt.id];
            }
            onPriorityChange?.(nextList.join(","));
          },
        });
      }
    });

    // Match Category
    CATEGORY_FILTER_OPTIONS.forEach((cat) => {
      if (normalizeFilterSearchText(cat.label).includes(query)) {
        const selectedList = (selectedCategory || "ALL").split(",").map((c) => c.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");
        const selected = cat.id === "ALL" ? isAll : selectedList.includes(cat.id);
        results.push({
          id: `cat-${cat.id}`,
          categoryLabel: "Danh mục",
          label: cat.label,
          icon: Tag,
          selected,
          onSelect: () => {
            if (cat.id === "ALL") {
              onCategoryChange?.("ALL");
              return;
            }
            let nextList: string[];
            if (isAll) {
              nextList = [cat.id];
            } else if (selected) {
              nextList = selectedList.filter((c) => c !== cat.id && c !== "ALL");
              if (nextList.length === 0) nextList = ["ALL"];
            } else {
              nextList = [...selectedList.filter((c) => c !== "ALL"), cat.id];
            }
            onCategoryChange?.(nextList.join(","));
          },
        });
      }
    });

    // Match Department
    availableDepartments.forEach((dept) => {
      if (normalizeFilterSearchText(dept.name).includes(query) || normalizeFilterSearchText(dept.code).includes(query)) {
        const selectedList = (selectedDepartment || "ALL").split(",").map((d) => d.trim()).filter(Boolean);
        const isAll = selectedList.length === 0 || selectedList.includes("ALL");
        const selected = dept.code === "ALL" ? isAll : selectedList.includes(dept.code);
        results.push({
          id: `dept-${dept.code}`,
          categoryLabel: "Đơn vị",
          label: dept.name,
          icon: Building,
          selected,
          onSelect: () => {
            if (dept.code === "ALL") {
              onDepartmentChange?.("ALL");
              return;
            }
            let nextList: string[];
            if (isAll) {
              nextList = [dept.code];
            } else if (selectedList.includes(dept.code)) {
              nextList = selectedList.filter((d) => d !== dept.code && d !== "ALL");
              if (nextList.length === 0) nextList = ["ALL"];
            } else {
              nextList = [...selectedList.filter((d) => d !== "ALL"), dept.code];
            }
            onDepartmentChange?.(nextList.join(","));
          },
        });
      }
    });

    // Match Deadline
    deadlineOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = effectiveDeadline === opt.value;
        results.push({
          id: `deadline-${opt.value}`,
          categoryLabel: "Thời hạn",
          label: opt.label,
          icon: Calendar,
          selected,
          onSelect: () => {
            if (onDeadlineChange) onDeadlineChange(opt.value);
            else onTabChange?.(opt.value === "all" ? "all" : opt.value);
          },
        });
      }
    });

    // Match Lead / Người chủ trì
    const leadOptions = [
      { value: "my", label: "Giao cho tôi (Tôi chủ trì)" },
      { value: "bgh", label: "Lãnh đạo / Ban Giám hiệu" },
      { value: "assigned", label: "Đã phân công người chủ trì" },
      { value: "unassigned", label: "Chưa phân công người chủ trì" },
    ];
    leadOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = selectedLead === opt.value || (opt.value === "my" && activeTab === "my");
        results.push({
          id: `lead-${opt.value}`,
          categoryLabel: "Người chủ trì",
          label: opt.label,
          icon: User,
          selected,
          onSelect: () => {
            if (opt.value === "my") {
              onTabChange?.("my");
              setSelectedLead("my");
            } else {
              setSelectedLead(opt.value);
            }
          },
        });
      }
    });

    // Match Health / Tiến độ
    const healthOptions = [
      { value: "on_track", label: "Đúng tiến độ (Bình thường)" },
      { value: "at_risk", label: "Có nguy cơ trễ hạn (≤ 7 ngày)" },
      { value: "overdue", label: "Trễ hạn / Trễ hạn" },
      { value: "completed", label: "Đã hoàn thành 100%" },
    ];
    healthOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = selectedHealth === opt.value;
        results.push({
          id: `health-${opt.value}`,
          categoryLabel: "Tiến độ",
          label: opt.label,
          icon:
            opt.value === "on_track"
              ? HealthSubOnTrack
              : opt.value === "at_risk"
                ? HealthSubAtRisk
                : opt.value === "overdue"
                  ? HealthSubOverdue
                  : opt.value === "completed"
                    ? HealthSubCompleted
                    : FilterIconProgress,
          selected,
          onSelect: () => {
            handleHealthChange(opt.value);
            if (opt.value === "overdue") {
              if (onDeadlineChange) onDeadlineChange("overdue");
              else onTabChange?.("overdue");
            } else if (opt.value === "at_risk") {
              if (onDeadlineChange) onDeadlineChange("this_week");
              else onTabChange?.("this_week");
            } else if (opt.value === "completed") {
              if (onStatusChange) onStatusChange("completed");
              else onTabChange?.("completed");
            } else if (opt.value === "on_track") {
              if (onStatusChange) onStatusChange("in_progress");
              else onTabChange?.("in_progress");
            }
          },
        });
      }
    });

    // Match Origin / Nguồn gốc
    const originOptions = [
      { value: "KE_HOACH_NAM", label: "Kế ho���ch năm học" },
      { value: "NGHI_QUYET", label: "Nghị quyết Đảng ủy / BGH" },
      { value: "GIAO_BAN", label: "Kết luận họp giao ban" },
      { value: "DON_VI", label: "Đơn vị đề xuất" },
    ];
    originOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = selectedOrigin === opt.value;
        results.push({
          id: `origin-${opt.value}`,
          categoryLabel: "Nguồn gốc",
          label: opt.label,
          icon: FileText,
          selected,
          onSelect: () => {
            handleOriginChange(opt.value);
          },
        });
      }
    });

    // Match Collaborator / Người phối hợp
    const collabOptions = [
      { value: "has_collab", label: "Có đơn vị / người phối hợp" },
      { value: "single", label: "Đơn vị tự thực hiện (không phối hợp)" },
    ];
    collabOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = selectedCollaborator === opt.value;
        results.push({
          id: `collab-${opt.value}`,
          categoryLabel: "Phối hợp",
          label: opt.label,
          icon: Users,
          selected,
          onSelect: () => {
            handleCollaboratorChange(opt.value);
          },
        });
      }
    });

    // Match Months
    academicMonths.forEach((period) => {
      const label = `Tháng ${period.monthNumber}`;
      if (normalizeFilterSearchText(label).includes(query)) {
        const selected =
          effectiveTimeFilter.kind === "month" && effectiveTimeFilter.month === period.monthNumber;
        results.push({
          id: `month-${period.monthNumber}`,
          categoryLabel: "Kỳ tháng",
          label,
          icon: Clock,
          selected,
          onSelect: () => {
            handleTimeFilterChange({ kind: "month", month: period.monthNumber });
          },
        });
      }
    });

    return results.slice(0, 10);
  }, [
    menuSearch,
    statusOptions,
    effectiveStatus,
    onStatusChange,
    onTabChange,
    selectedPriority,
    onPriorityChange,
    selectedCategory,
    onCategoryChange,
    availableDepartments,
    selectedDepartment,
    onDepartmentChange,
    deadlineOptions,
    effectiveDeadline,
    onDeadlineChange,
    selectedLead,
    activeTab,
    selectedHealth,
    handleHealthChange,
    selectedOrigin,
    handleOriginChange,
    selectedCollaborator,
    handleCollaboratorChange,
    academicMonths,
    effectiveTimeFilter,
    handleTimeFilterChange,
  ]);

  const matchingCategories = React.useMemo(() => {
    if (!menuSearch.trim()) return filterCategories;
    const query = normalizeFilterSearchText(menuSearch);
    return filterCategories.filter((cat) => normalizeFilterSearchText(cat.label).includes(query));
  }, [menuSearch, filterCategories]);

  const renderCategorySubmenu = (category: typeof filterCategories[0]) => {
    return (
      <MenuSubmenuRoot key={category.key}>
        <MenuSubmenuTrigger
          openOnHover
          delay={60}
          closeDelay={180}
          className="group flex h-7 w-full items-center justify-between rounded-md px-2 text-xs font-medium transition-colors hover:bg-accent text-foreground hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground data-[open]:bg-accent data-[open]:text-foreground"
        >
          <div className="flex items-center gap-2 min-w-0">
            <category.icon className="size-3.5 shrink-0 text-foreground/80 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
            <span className="truncate font-medium text-foreground">
              {category.label}
            </span>
          </div>
          <ChevronRight
            className="size-2.5 shrink-0 text-foreground/60 group-hover:text-foreground transition-colors ml-auto"
            strokeWidth={1.5}
          />
        </MenuSubmenuTrigger>
        <MenuPortal>
          <MenuPositioner side="left" align="start" sideOffset={2} alignOffset={-4} collisionPadding={12} className="z-50 outline-none">
            <MenuPopup className="min-w-[210px] w-auto max-w-[320px] rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100">
              {renderCategorySubmenuItems(category.key)}
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuSubmenuRoot>
    );
  };

  return (
    <div
      data-slot="unified-task-toolbar"
      className={cn(
        "flex items-center gap-1.5 border-b border-border/60 pb-2 bg-transparent relative z-40 overflow-visible flex-wrap",
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
                { id: "my", label: "Cá nhân", icon: User, count: (effectiveScopeBadgeCounts as any)?.my ?? (effectiveScopeBadgeCounts as any)?.related },
                { id: "unit", label: "Đơn vị", icon: Building, count: (effectiveScopeBadgeCounts as any)?.unit },
                { id: "school", label: "Toàn trường", icon: School, count: (effectiveScopeBadgeCounts as any)?.school ?? (effectiveScopeBadgeCounts as any)?.all },
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = normalizedScope === tab.id;
                const showBadge = typeof tab.count === "number" && !isNaN(tab.count);
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    data-scope={tab.id}
                    aria-selected={isActive}
                    onClick={() => {
                      if (onScopeChange) {
                        onScopeChange(tab.id as any);
                      }
                    }}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer select-none",
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
                          "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold",
                          isActive
                            ? "bg-background text-foreground border border-border/60 shadow-2xs"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
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
            <button
              type="button"
              onClick={() => handlePrimaryAction()}
              title="Tạo nhiệm vụ"
              aria-label="Tạo nhiệm vụ"
              className={listToolbarPrimaryButtonClass}
            >
              <Plus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
              <span>{createButtonLabel || (onCreateTask ? "Tạo nhiệm vụ" : primaryActionLabel)}</span>
            </button>
          )}
        </div>
      )}

      {/* Left Content (View Title / Summary Strip) */}
      {leftContent && (
        <div className="flex-1 min-w-0 flex items-center pr-4">
          {leftContent}
        </div>
      )}

      {/* 1. Search */}
      <ListToolbarSearch
        ref={searchInputRef}
        value={localSearch}
        onChange={handleSearchInputChange}
        onClear={handleSearchClear}
        loading={loading}
        placeholder="Tìm nhiệm vụ… /"
        aria-label="Tìm nhiệm vụ"
        wrapperClassName={!leftContent && !onScopeChange ? "ml-auto" : undefined}
        collapsedWidthClassName="w-[140px] sm:w-[180px]"
        expandedWidthClassName="w-[240px]"
      />

      {/* 2. Filter — icon-only trigger */}
      <MenuRoot open={isCollapsedFilterOpen} onOpenChange={(open) => { setIsCollapsedFilterOpen(open); if (!open) setMenuSearch(""); }}>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label="Bộ lọc"
              aria-expanded={isCollapsedFilterOpen}
              title="Bộ lọc (F)"
              className={listToolbarIconButtonClass(isCollapsedFilterOpen || activeFilterCount > 0)}
            >
              <Filter className="size-3.5 shrink-0" strokeWidth={1.5} />
              {activeFilterCount > 0 && (
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-muted text-foreground/80 border border-border/80 font-mono text-[10px] font-semibold tabular-nums">
                  {activeFilterCount}
                </span>
              )}
            </button>
          }
        />
        <MenuPortal>
          <MenuPositioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50 outline-none">
            <MenuPopup
              data-slot="task-filter-menu"
              className="w-56 rounded-lg border border-border/70 bg-popover/98 backdrop-blur-xs p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {/* Header: Add Filter... [F] */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/40 mb-1">
                <Search className="size-3.5 shrink-0 text-muted-foreground/50" strokeWidth={1.5} />
                <input
                  ref={menuSearchInputRef}
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Thêm bộ lọc..."
                  aria-label="Tìm hoặc thêm bộ lọc"
                  className="h-5 w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground/50 outline-none"
                />
                {menuSearch ? (
                  <button
                    type="button"
                    onClick={() => setMenuSearch("")}
                    className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer touch-manipulation"
                  >
                    <X className="size-3" strokeWidth={1.5} />
                  </button>
                ) : (
                  <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 font-mono text-[9px] text-muted-foreground bg-muted/80 border border-border/60 rounded select-none pointer-events-none">
                    F
                  </kbd>
                )}
              </div>

              {menuSearch.trim() ? (
                <div className="space-y-1">
                  {/* Matching options */}
                  {matchingSearchOptions.length > 0 && (
                    <div className="space-y-0.5">
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        Giá trị phù hợp
                      </div>
                      {matchingSearchOptions.map((match) => (
                        <MenuItem
                          key={match.id}
                          closeOnClick={false}
                          onClick={match.onSelect}
                          className="group/item flex h-7.5 w-full items-center justify-between rounded-md px-2 text-xs transition-colors cursor-pointer select-none outline-none hover:bg-accent text-foreground/90 hover:text-foreground"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <match.icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-muted-foreground text-[11px]">{match.categoryLabel}:</span>
                            <span className="truncate font-medium text-foreground">{match.label}</span>
                          </div>
                          <div
                            className={cn(
                              "size-3.5 rounded-[3px] border flex items-center justify-center transition-colors shrink-0 ml-2",
                              match.selected
                                ? "bg-neutral-800 text-white border-neutral-800 shadow-2xs"
                                : "border-border/80 bg-background group-hover/item:border-neutral-400"
                            )}
                          >
                            {match.selected && <Check className="size-2.5 stroke-[2.5]" />}
                          </div>
                        </MenuItem>
                      ))}
                    </div>
                  )}

                  {/* Matching categories */}
                  {matchingCategories.length > 0 && (
                    <div className="space-y-0.5">
                      {matchingSearchOptions.length > 0 && <MenuSeparator className="h-px bg-border/60 my-1" />}
                      <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
                        Nhóm bộ lọc
                      </div>
                      {matchingCategories.map(renderCategorySubmenu)}
                    </div>
                  )}

                  {matchingSearchOptions.length === 0 && matchingCategories.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      Không tìm thấy bộ lọc phù hợp.
                    </p>
                  )}
                </div>
              ) : (
                /* Categories — Seamless, compact Linear list */
                <div className="space-y-px">
                  {filterCategories.map(renderCategorySubmenu)}
                </div>
              )}

              {activeFilterCount > 0 && (
                <>
                  <MenuSeparator className="h-px bg-border/50 my-1" />
                  <MenuItem
                    onClick={handleResetFilters}
                    className="flex h-7 w-full items-center justify-between rounded-md px-2 text-[11.5px] font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer select-none outline-none"
                  >
                    <div className="flex items-center gap-1.5">
                      <RotateCcw className="size-3 text-destructive/80" strokeWidth={1.5} />
                      <span>Xóa bộ lọc</span>
                    </div>
                    <span className="text-[10px] font-mono tabular-nums bg-destructive/15 text-destructive px-1.5 py-0.2 rounded-full">
                      {activeFilterCount}
                    </span>
                  </MenuItem>
                </>
              )}
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>

      {/* Active Filter Clear on Toolbar */}
      {isAnyFilterActive && (
        <button
          type="button"
          onClick={handleResetFilters}
          title="Xóa tất cả bộ lọc"
          aria-label="Xóa tất cả bộ lọc"
          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md px-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation"
        >
          <RotateCcw className="size-3 shrink-0" strokeWidth={1.5} />
          <span className="hidden sm:inline">Xóa bộ lọc</span>
        </button>
      )}

      {/* 3. Linear Display / View Options Popover — Icon hiển thị kề bên Filter! */}
      <TaskTableViewOptionsPopover
        viewMode={viewMode === "kanban" ? "kanban" : "table"}
        onViewModeChange={onViewModeChange}
        groupingField={groupingField}
        onGroupingChange={setGroupingField}
        sortField={sortField as any}
        sortDirection={sortDirection}
        onSort={onSort as any}
        visibleColumns={effectiveVisibleColumns}
        onVisibleColumnsChange={handleVisibleColumnsChange}
        isCustomized={isDisplayCustomized}
        onReset={handleResetDisplayProperties}
        triggerClassName="inline-flex h-7 w-7 shrink-0 cursor-pointer select-none items-center justify-center rounded-md border border-border/80 bg-background text-foreground hover:bg-accent text-xs font-medium transition-colors touch-manipulation"
      />

      {/* 4. + Tạo việc CTA (Linear Understated Style) */}
      {(leftContent || !onScopeChange) && canCreateTask && handlePrimaryAction && (
        <button
          type="button"
          onClick={() => handlePrimaryAction()}
          title="Tạo việc mới"
          aria-label="Tạo việc mới"
          className={listToolbarPrimaryButtonClass}
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span>{primaryActionLabel}</span>
        </button>
      )}
    </div>
  );
}
