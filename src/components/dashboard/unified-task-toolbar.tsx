"use client";

// Unified Task Toolbar Component - Linear-inspired unified control toolbar for task views
import * as React from "react";
import {
  Search,
  X,
  Plus,
  Filter,
  List,
  Kanban,
  Building2,
  Calendar,
  AlertTriangle,
  School,
  User,
  SlidersHorizontal,
  Loader2,
  Check,
  ArrowUpDown,
  ChevronDown,
  RotateCcw,
  Layers,
  Clock,
} from "lucide-react";
import type { TaskView } from "@/domain/tasks";
import { cn } from "@/lib/utils";
import {
  getTaskTimeFilterLabel,
  isValidTaskDateRange,
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

  // Sorting (Mobile & Adaptive support)
  sortField?: string;
  sortDirection?: "asc" | "desc";
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
  { id: "department", label: "Theo đơn vị", icon: Building2 },
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
      return Boolean(isLead || hasSub || isCo);
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
        : user?.departmentCode || user?.department || (isExecutiveUser(user) ? "BGH" : undefined);

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
      label: "Quá hạn",
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
  tabCounts,
  selectedDepartment = "ALL",
  onDepartmentChange,
  availableDepartments = DEFAULT_AVAILABLE_DEPARTMENTS,
  selectedCategory = "ALL",
  onCategoryChange,
  selectedPriority = "ALL",
  onPriorityChange,
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
  sortField,
  sortDirection,
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

  // Popover state
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [activeFilterField, setActiveFilterField] = React.useState<string | null>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

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

  // Display / Presentation options menu state
  const [isDisplayOpen, setIsDisplayOpen] = React.useState(false);
  const displayMenuRef = React.useRef<HTMLDivElement>(null);

  // Filter dropdown states
  const [isMonthOpen, setIsMonthOpen] = React.useState(false);
  const monthMenuRef = React.useRef<HTMLDivElement>(null);

  const [isStatusOpen, setIsStatusOpen] = React.useState(false);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

  const [isDeadlineOpen, setIsDeadlineOpen] = React.useState(false);
  const deadlineMenuRef = React.useRef<HTMLDivElement>(null);

  const [isPriorityOpen, setIsPriorityOpen] = React.useState(false);
  const priorityMenuRef = React.useRef<HTMLDivElement>(null);

  const [isDepartmentOpen, setIsDepartmentOpen] = React.useState(false);
  const departmentMenuRef = React.useRef<HTMLDivElement>(null);

  const [isCollapsedFilterOpen, setIsCollapsedFilterOpen] = React.useState(false);
  const collapsedFilterRef = React.useRef<HTMLDivElement>(null);

  const closeAllMenus = React.useCallback(() => {
    setIsMonthOpen(false);
    setIsStatusOpen(false);
    setIsDeadlineOpen(false);
    setIsPriorityOpen(false);
    setIsDepartmentOpen(false);
    setIsCollapsedFilterOpen(false);
    setIsDisplayOpen(false);
  }, []);

  // Resolve Month props (supporting compatibility aliases)
  const effectiveMonth = selectedMonth !== undefined ? selectedMonth : selectedAcademicMonth;
  const handleEffectiveMonthChange = onMonthChange || onAcademicMonthChange;
  const effectiveTimeFilter: TaskTimeFilter = selectedTimeFilter ??
    (typeof effectiveMonth === "number" ? { kind: "month", month: effectiveMonth } : NO_TASK_TIME_FILTER);
  const handleTimeFilterChange = (filter: TaskTimeFilter) => {
    if (onTimeFilterChange) onTimeFilterChange(filter);
    else handleEffectiveMonthChange?.(filter.kind === "month" ? filter.month : "ALL");
  };
  const [showDateRange, setShowDateRange] = React.useState(false);
  const [rangeFrom, setRangeFrom] = React.useState("");
  const [rangeTo, setRangeTo] = React.useState("");

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
      label: "Liên quan đến tôi",
      shortLabel: "Của tôi",
      icon: User,
      isAuthorized: true,
    },
    {
      id: "unit",
      legacyScope: "unit",
      legacyId: "UNIT_TASKS",
      label: "Đơn vị tôi",
      shortLabel: "Đơn vị",
      icon: Building2,
      isAuthorized: canViewUnitScope,
    },
    {
      id: "all",
      legacyScope: "school",
      legacyId: "SCHOOL_TASKS",
      label: "Tất cả",
      shortLabel: "Tất cả",
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

  // 2. Global "/" and "⌘K" Keyboard Shortcut for Search Focus
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Do not intercept if a modal or dialog is open
      if (document.querySelector('[role="dialog"]')) {
        return;
      }

      if (e.key === "/" || ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k")) {
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
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // 3. Dropdowns outside click and Esc listener
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (monthMenuRef.current && !monthMenuRef.current.contains(target)) {
        setIsMonthOpen(false);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(target)) {
        setIsStatusOpen(false);
      }
      if (deadlineMenuRef.current && !deadlineMenuRef.current.contains(target)) {
        setIsDeadlineOpen(false);
      }
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(target)) {
        setIsPriorityOpen(false);
      }
      if (departmentMenuRef.current && !departmentMenuRef.current.contains(target)) {
        setIsDepartmentOpen(false);
      }
      if (collapsedFilterRef.current && !collapsedFilterRef.current.contains(target)) {
        setIsCollapsedFilterOpen(false);
      }
      if (displayMenuRef.current && !displayMenuRef.current.contains(target)) {
        setIsDisplayOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeAllMenus();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeAllMenus]);

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
    { value: "overdue", label: "Quá hạn", count: tabCounts?.overdue },
  ], [tabCounts]);

  const deadlineLabel = React.useMemo(() => {
    if (effectiveDeadline === "today") return "Đến hạn hôm nay";
    if (effectiveDeadline === "this_week") return "Trong tuần này";
    if (effectiveDeadline === "overdue") return "Quá hạn";
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
  const isStatusActive = Boolean(effectiveStatus && effectiveStatus !== "all");
  const isDeadlineActive = Boolean(effectiveDeadline && effectiveDeadline !== "all");
  const isPriorityActive = Boolean(selectedPriority && selectedPriority !== "ALL");
  const isCategoryActive = Boolean(selectedCategory && selectedCategory !== "ALL");
  const isDepartmentActive = Boolean(selectedDepartment && selectedDepartment !== "ALL");
  const isSearchActive = Boolean(localSearch && localSearch.trim().length > 0);

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
      if (activeTab === "overdue") tabLabel = "Quá hạn";
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
    resetTaskToolbarFilters({
      onResetFilters, onSearchChange, onTabChange, onStatusChange,
      onDeadlineChange, onCategoryChange, onPriorityChange,
      onMonthChange: handleEffectiveMonthChange, onDepartmentChange,
    });
    closeAllMenus();
    setIsFilterOpen(false);
  };

  const resolvedUnitDisplayName = React.useMemo(() => {
    if (isUnassigned) return "Chưa chọn đơn vị";
    if (selectedDepartment && selectedDepartment !== "ALL") {
      const found = availableDepartments.find((d) => d.code === selectedDepartment);
      if (found) return found.name;
    }
    return user?.department || user?.departmentCode || "Đơn vị";
  }, [isUnassigned, availableDepartments, selectedDepartment, user]);

  return (
    <div
      data-slot="unified-task-toolbar"
      className={cn(
        "flex flex-col gap-2 border-b border-border/60 pb-2.5 bg-transparent relative z-40 overflow-visible",
        className
      )}
    >
      {/* ==================================================================== */}
      {/* ROW 1: Scope Switcher + Unit Name (text only) + Primary Action       */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-1"
        className="flex items-center justify-between gap-2"
      >
        {/* Left: Scope Switcher + Unit Name */}
        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
          {authorizedScopes.length > 1 && (
            <div
              data-slot="adaptive-scope-header"
              data-scope-switcher="true"
              className="inline-flex items-center gap-0.5 shrink-0"
              role="tablist"
              aria-label="Phạm vi công việc"
            >
              {authorizedScopes.map((opt) => {
                const Icon = opt.icon;
                const isActive = normalizedTaskView === opt.id;
                const count = (effectiveScopeBadgeCounts as any)[opt.id];
                const showBadge = typeof count === "number" && !isNaN(count) && (opt.id !== "approval" || count > 0);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    data-scope={opt.id}
                    aria-selected={isActive}
                    onClick={() => handleScopeSelect(opt.id, opt.legacyScope)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors cursor-pointer select-none",
                      isActive
                        ? "bg-muted text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                    <span>{opt.label}</span>
                    {showBadge && (
                      <span
                        data-slot="scope-badge-count"
                        data-scope={opt.id}
                        className={cn(
                          "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold",
                          isActive
                            ? "bg-background text-foreground border border-border/60 shadow-2xs"
                            : "bg-muted text-muted-foreground"
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}

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

        {/* Right: Primary Page Action Button (Compact Neutral Style) */}
        {canCreateTask && handlePrimaryAction && (
          <button
            type="button"
            onClick={() => handlePrimaryAction()}
            title="Giao việc mới (C)"
            aria-label="Giao việc mới (Phím C)"
            className="inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 sm:px-3 text-xs font-medium text-foreground transition-all duration-150 hover:bg-accent hover:border-border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 shadow-none"
          >
            <Plus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span>{primaryActionLabel}</span>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 bg-muted/60 border border-border/50 rounded select-none pointer-events-none ml-1">
              C
            </kbd>
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* ROW 2: Search → Thời gian → Trạng thái → Thời hạn → Ưu tiên → Đơn vị → Danh mục ··· Hiển thị */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-2"
        className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap sm:flex-nowrap relative z-40 overflow-visible"
      >
        {/* 1. Search Input: Scoped to Current Scope */}
        <div className="relative w-full max-w-[180px] sm:max-w-[220px] md:max-w-[260px] shrink-0">
          <Search
            className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            placeholder="Tìm nhiệm vụ… /"
            aria-label="Tìm nhiệm vụ"
            className="h-8 w-full rounded-md border border-border/80 bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Đang tải dữ liệu"
              />
            )}
            {localSearch ? (
              <button
                type="button"
                onClick={handleSearchClear}
                aria-label="Xóa từ khóa tìm kiếm"
                className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground bg-muted border border-border/60 rounded select-none pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* 2. Thời gian Filter */}
        <div className="relative shrink-0" ref={monthMenuRef}>
          <button
            type="button"
            aria-label="Chọn kỳ tháng"
            aria-expanded={isMonthOpen}
            onClick={() => {
              const next = !isMonthOpen;
              closeAllMenus();
              setIsMonthOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
              isMonthActive
                ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                : "border-border/80 bg-background text-foreground hover:bg-accent"
            )}
          >
            <span>{timeLabel}</span>
            {isMonthActive ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  handleTimeFilterChange(NO_TASK_TIME_FILTER);
                }}
                title="Xóa lọc thời gian"
                aria-label="Xóa lọc thời gian"
                className="size-3.5 flex items-center justify-center rounded-xs hover:bg-primary/20 text-primary transition-colors cursor-pointer -mr-0.5"
              >
                <X className="size-3" strokeWidth={2} />
              </span>
            ) : (
              <ChevronDown
                className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isMonthOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )}
          </button>

          {isMonthOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-popover p-2 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              role="dialog"
              aria-label="Chọn thời gian làm việc"
            >
              <div className="space-y-0.5">
                {([
                  ["today", "Hôm nay"],
                  ["this_week", "Tuần này"],
                  ["this_month", "Tháng này"],
                  ["overdue", "Quá hạn"],
                ] as Array<[TaskTimePreset, string]>).map(([preset, label]) => {
                  const selected = effectiveTimeFilter.kind === "preset" && effectiveTimeFilter.preset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => { handleTimeFilterChange({ kind: "preset", preset }); setIsMonthOpen(false); }}
                      className={cn("w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-left transition-colors", selected ? "bg-primary/10 text-primary font-semibold" : "hover:bg-accent")}
                    >
                      <span>{label}</span>
                      {selected && <Check className="size-3.5" />}
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border/60 my-2" />

              <div className="grid grid-cols-3 gap-1">
                {academicMonths.map((period) => {
                  const isSelected = effectiveTimeFilter.kind === "month" && effectiveTimeFilter.month === period.monthNumber;
                  return (
                    <button
                      key={period.monthNumber}
                      type="button"
                      onClick={() => {
                        handleTimeFilterChange({ kind: "month", month: period.monthNumber });
                        setIsMonthOpen(false);
                      }}
                      className={cn(
                        "h-7 px-1.5 rounded-md text-xs font-medium transition-colors cursor-pointer flex items-center justify-center text-center",
                        isSelected
                          ? "bg-primary/10 text-primary font-semibold"
                          : "hover:bg-accent text-foreground"
                      )}
                    >
                      <span>{period.label}</span>
                    </button>
                  );
                })}
              </div>

              <div className="border-t border-border/60 my-2" />
              {!showDateRange ? (
                <button
                  type="button"
                  onClick={() => setShowDateRange(true)}
                  className="w-full px-2.5 py-1.5 rounded-md text-left font-medium hover:bg-accent transition-colors"
                >
                  Chọn khoảng ngày…
                </button>
              ) : (
                <div className="space-y-2 px-1 pb-1">
                  <div className="grid grid-cols-2 gap-1.5">
                    <label className="space-y-1 text-[10px] text-muted-foreground">Từ ngày
                      <input type="date" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground" />
                    </label>
                    <label className="space-y-1 text-[10px] text-muted-foreground">Đến ngày
                      <input type="date" value={rangeTo} min={rangeFrom || undefined} onChange={(e) => setRangeTo(e.target.value)} className="h-8 w-full rounded-md border border-border bg-background px-2 text-[11px] text-foreground" />
                    </label>
                  </div>
                  <div className="flex justify-end gap-1.5">
                    <button type="button" onClick={() => setShowDateRange(false)} className="h-7 px-2 rounded-md hover:bg-accent">Hủy</button>
                    <button
                      type="button"
                      disabled={!isValidTaskDateRange(rangeFrom, rangeTo)}
                      onClick={() => {
                        if (!isValidTaskDateRange(rangeFrom, rangeTo)) return;
                        handleTimeFilterChange({ kind: "range", from: rangeFrom, to: rangeTo });
                        setShowDateRange(false);
                        setIsMonthOpen(false);
                      }}
                      className="h-7 px-2.5 rounded-md bg-primary text-primary-foreground disabled:opacity-40"
                    >Áp dụng</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 3. Trạng thái Filter */}
        <div className="relative shrink-0" ref={statusMenuRef}>
          <button
            type="button"
            aria-label="Lọc trạng thái"
            aria-expanded={isStatusOpen}
            onClick={() => {
              const next = !isStatusOpen;
              closeAllMenus();
              setIsStatusOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
              isStatusActive
                ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                : "border-border/80 bg-background text-foreground hover:bg-accent"
            )}
          >
            <span>{statusLabel}</span>
            {isStatusActive ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onStatusChange) {
                    onStatusChange("all");
                  } else {
                    onTabChange?.("all");
                  }
                }}
                title="Xóa lọc trạng thái"
                aria-label="Xóa lọc trạng thái"
                className="size-3.5 flex items-center justify-center rounded-xs hover:bg-primary/20 text-primary transition-colors cursor-pointer -mr-0.5"
              >
                <X className="size-3" strokeWidth={2} />
              </span>
            ) : (
              <ChevronDown
                className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isStatusOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )}
          </button>

          {isStatusOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-border bg-popover py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              role="dialog"
              aria-label="Chọn trạng thái"
            >
              {statusOptions.map((opt) => {
                const norm = (effectiveStatus || "all").toLowerCase();
                const isSelected =
                  opt.value === "new"
                    ? norm === "new" || norm === "not_started" || norm === "assigned"
                    : opt.value === "in_progress"
                    ? norm === "in_progress"
                    : opt.value === "waiting_approval" || opt.value === "review"
                    ? norm === "waiting_approval" || norm === "review" || norm === "pending_executive_approval" || norm === "needs_review"
                    : opt.value === "completed"
                    ? norm === "completed"
                    : opt.value === "all"
                    ? !effectiveStatus || norm === "all"
                    : norm === opt.value.toLowerCase();
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (onStatusChange) {
                        onStatusChange(opt.value);
                      } else {
                        onTabChange?.(opt.value);
                      }
                      setIsStatusOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                      isSelected ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 4. Thời hạn Filter */}
        <div className="relative shrink-0" ref={deadlineMenuRef}>
          <button
            type="button"
            aria-label="Lọc thời hạn"
            aria-expanded={isDeadlineOpen}
            onClick={() => {
              const next = !isDeadlineOpen;
              closeAllMenus();
              setIsDeadlineOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
              isDeadlineActive
                ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                : "border-border/80 bg-background text-foreground hover:bg-accent"
            )}
          >
            <span>{deadlineLabel}</span>
            {isDeadlineActive ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onDeadlineChange) {
                    onDeadlineChange("all");
                  } else {
                    onTabChange?.("all");
                  }
                }}
                title="Xóa lọc thời hạn"
                aria-label="Xóa lọc thời hạn"
                className="size-3.5 flex items-center justify-center rounded-xs hover:bg-primary/20 text-primary transition-colors cursor-pointer -mr-0.5"
              >
                <X className="size-3" strokeWidth={2} />
              </span>
            ) : (
              <ChevronDown
                className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isDeadlineOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )}
          </button>

          {isDeadlineOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-border bg-popover py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              role="dialog"
              aria-label="Chọn thời hạn"
            >
              {deadlineOptions.map((opt) => {
                const isSelected = (effectiveDeadline === opt.value || (!effectiveDeadline && opt.value === "all"));
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      if (onDeadlineChange) {
                        onDeadlineChange(opt.value);
                      } else {
                        onTabChange?.(opt.value);
                      }
                      setIsDeadlineOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                      isSelected ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                    )}
                  >
                    <span>{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 5. Ưu tiên Filter (Direct on desktop >= lg) */}
        <div className="hidden lg:block relative shrink-0" ref={priorityMenuRef}>
          <button
            type="button"
            aria-label="Lọc mức độ ưu tiên"
            aria-expanded={isPriorityOpen}
            onClick={() => {
              const next = !isPriorityOpen;
              closeAllMenus();
              setIsPriorityOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
              isPriorityActive
                ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                : "border-border/80 bg-background text-foreground hover:bg-accent"
            )}
          >
            <span>{priorityLabel}</span>
            {isPriorityActive ? (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onPriorityChange?.("ALL");
                }}
                title="Xóa lọc mức ưu tiên"
                aria-label="Xóa lọc mức ưu tiên"
                className="size-3.5 flex items-center justify-center rounded-xs hover:bg-primary/20 text-primary transition-colors cursor-pointer -mr-0.5"
              >
                <X className="size-3" strokeWidth={2} />
              </span>
            ) : (
              <ChevronDown
                className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isPriorityOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            )}
          </button>

          {isPriorityOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-border bg-popover py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              role="dialog"
              aria-label="Chọn mức độ ưu tiên"
            >
              <button
                type="button"
                onClick={() => {
                  onPriorityChange?.("ALL");
                  setIsPriorityOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                  !isPriorityActive
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-foreground"
                )}
              >
                <span>Tất cả mức ưu tiên</span>
                {!isPriorityActive && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
              {PRIORITY_FILTER_OPTIONS.filter((p) => p.id !== "ALL").map((prio) => {
                const isSelected = selectedPriority === prio.id;
                return (
                  <button
                    key={prio.id}
                    type="button"
                    onClick={() => {
                      onPriorityChange?.(prio.id);
                      setIsPriorityOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                      isSelected ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                    )}
                  >
                    <span>{prio.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. Đơn vị Filter (Direct on desktop >= lg - only when relevant to scope) */}
        {showDepartmentFilter && (
          <div className="hidden lg:block relative shrink-0" ref={departmentMenuRef}>
            <button
              type="button"
              aria-label="Lọc đơn vị"
              aria-expanded={isDepartmentOpen}
              onClick={() => {
                const next = !isDepartmentOpen;
                closeAllMenus();
                setIsDepartmentOpen(next);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
                isDepartmentActive
                  ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                  : "border-border/80 bg-background text-foreground hover:bg-accent"
              )}
            >
              <span>{departmentLabel}</span>
              {isDepartmentActive ? (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation();
                    onDepartmentChange?.("ALL");
                  }}
                  title="Xóa lọc đơn vị"
                  aria-label="Xóa lọc đơn vị"
                  className="size-3.5 flex items-center justify-center rounded-xs hover:bg-primary/20 text-primary transition-colors cursor-pointer -mr-0.5"
                >
                  <X className="size-3" strokeWidth={2} />
                </span>
              ) : (
                <ChevronDown
                  className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isDepartmentOpen && "rotate-180")}
                  strokeWidth={1.5}
                />
              )}
            </button>

            {isDepartmentOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-border bg-popover py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground max-h-60 overflow-y-auto"
                role="dialog"
                aria-label="Chọn đơn vị"
              >
                <button
                  type="button"
                  onClick={() => {
                    onDepartmentChange?.("ALL");
                    setIsDepartmentOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                    !isDepartmentActive
                      ? "text-primary font-semibold bg-primary/10"
                      : "text-foreground"
                  )}
                >
                  <span>Tất cả đơn vị</span>
                  {!isDepartmentActive && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </button>
                {availableDepartments
                  .filter((d) => d.code !== "ALL")
                  .map((dept) => {
                    const isSelected = selectedDepartment === dept.code;
                    return (
                      <button
                        key={dept.code}
                        type="button"
                        onClick={() => {
                          onDepartmentChange?.(dept.code);
                          setIsDepartmentOpen(false);
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                          isSelected ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                        )}
                      >
                        <span className="truncate">{dept.name}</span>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                      </button>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Collapsed Secondary Filters on Narrower Screens (< 1024px / lg:hidden) */}
        <div className="lg:hidden relative shrink-0" ref={collapsedFilterRef}>
          <button
            type="button"
            aria-label="Bộ lọc bổ sung"
            aria-expanded={isCollapsedFilterOpen}
            onClick={() => {
              const next = !isCollapsedFilterOpen;
              closeAllMenus();
              setIsCollapsedFilterOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
              isCollapsedFilterOpen || secondaryFiltersActiveCount > 0
                ? "bg-primary/10 border-primary/30 text-primary font-semibold hover:bg-primary/15 hover:border-primary/40 shadow-2xs"
                : "border-border/80 bg-background text-foreground hover:bg-accent"
            )}
          >
            <Plus className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Bộ lọc</span>
            {secondaryFiltersActiveCount > 0 && (
              <span className="inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold bg-primary text-primary-foreground">
                {secondaryFiltersActiveCount}
              </span>
            )}
          </button>

          {isCollapsedFilterOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-border bg-popover p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
              role="dialog"
              aria-label="Bảng chọn bộ lọc bổ sung"
            >
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                <span className="font-semibold text-foreground">Bộ lọc</span>
                <button
                  type="button"
                  onClick={() => setIsCollapsedFilterOpen(false)}
                  aria-label="Đóng bộ lọc"
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Priority */}
              <div className="mb-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  Mức độ ưu tiên
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {PRIORITY_FILTER_OPTIONS.map((prio) => {
                    const isSelected = (selectedPriority || "ALL") === prio.id;
                    return (
                      <button
                        key={prio.id}
                        type="button"
                        onClick={() => onPriorityChange?.(prio.id)}
                        className={cn(
                          "px-2 py-1.5 rounded text-left transition-colors cursor-pointer text-xs",
                          isSelected
                            ? "bg-primary/10 text-primary font-semibold"
                            : "hover:bg-accent text-foreground"
                        )}
                      >
                        {prio.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Department */}
              {showDepartmentFilter && (
                <div className="border-t border-border/60 pt-2 mb-2.5">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                    Đơn vị
                  </div>
                  <select
                    value={selectedDepartment || "ALL"}
                    onChange={(e) => onDepartmentChange?.(e.target.value)}
                    className="w-full h-8 px-2 rounded border border-border/80 bg-background text-xs text-foreground focus:outline-hidden cursor-pointer"
                  >
                    <option value="ALL">Tất cả đơn vị</option>
                    {availableDepartments
                      .filter((d) => d.code !== "ALL")
                      .map((dept) => (
                        <option key={dept.code} value={dept.code}>
                          {dept.name}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              {/* Reset */}
              {secondaryFiltersActiveCount > 0 && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Xóa tất cả
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Active Filter Summary & Xóa tất cả Action */}
        {isAnyFilterActive && (
          <div className="flex items-center gap-1.5 shrink-0 pl-1">
            <span className="text-xs text-muted-foreground font-medium tabular-nums select-none whitespace-nowrap">
              ({effectiveFilteredTasksCount} / {effectiveTotalTasksCount} nhiệm vụ)
            </span>
            <button
              type="button"
              onClick={handleResetFilters}
              title="Xóa tất cả bộ lọc"
              aria-label="Xóa tất cả bộ lọc"
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer select-none"
            >
              <RotateCcw className="size-3 shrink-0" strokeWidth={1.5} />
              <span>Xóa tất cả</span>
            </button>
          </div>
        )}

        {/* 8. Hiển thị Menu Trigger (Right side - pinned, compact icon + tooltip) */}
        {onViewModeChange && (
          <div className="ml-auto relative shrink-0" ref={displayMenuRef}>
            <button
              type="button"
              title="Hiển thị"
              aria-label="Tùy chọn hiển thị"
              aria-expanded={isDisplayOpen}
              onClick={() => {
                const next = !isDisplayOpen;
                closeAllMenus();
                setIsDisplayOpen(next);
              }}
              className={cn(
                "inline-flex h-8 items-center justify-center gap-1 rounded-md border border-border/80 bg-background px-2 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                isDisplayOpen ? "bg-muted text-foreground font-semibold border-border" : "text-foreground hover:bg-accent"
              )}
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span className="hidden sm:inline">Hiển thị</span>
            </button>

            {isDisplayOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-xl border border-border bg-popover py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
                role="dialog"
                aria-label="Tùy chọn hiển thị"
              >
                <button
                  type="button"
                  onClick={() => {
                    onViewModeChange("table");
                    setIsDisplayOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer hover:bg-accent",
                    viewMode === "table" ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <List className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span>Bảng</span>
                  </div>
                  {viewMode === "table" && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onViewModeChange("kanban");
                    setIsDisplayOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer hover:bg-accent",
                    viewMode === "kanban" ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Kanban className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    <span>Kanban</span>
                  </div>
                  {viewMode === "kanban" && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
