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
  Building2,
  Calendar,
  AlertTriangle,
  School,
  User,
  Users,
  Activity,
  Flag,
  SlidersHorizontal,
  Loader2,
  Check,
  CircleDot,
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
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import {
  MenuRoot,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
  MenuSeparator,
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
  const [isDisplayOpen, setIsDisplayOpen] = React.useState(false);
  const [searchFocused, setSearchFocused] = React.useState(false);
  const [menuSearch, setMenuSearch] = React.useState("");
  const menuSearchInputRef = React.useRef<HTMLInputElement>(null);
  const [expandedCategory, setExpandedCategory] = React.useState<string | null>(null);
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
      icon: Building2,
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
    if (selectedHealth === "on_track") return "Đúng tiến độ";
    if (selectedHealth === "at_risk") return "Nguy cơ trễ";
    if (selectedHealth === "overdue") return "Trễ hạn";
    if (selectedHealth === "completed") return "Đạt 100%";
    return undefined;
  }, [selectedHealth]);

  const originLabel = React.useMemo(() => {
    if (selectedOrigin === "KE_HOACH_NAM") return "Kế hoạch năm";
    if (selectedOrigin === "NGHI_QUYET") return "Nghị quyết BGH";
    if (selectedOrigin === "GIAO_BAN") return "Giao ban";
    if (selectedOrigin === "DON_VI") return "Đơn vị đề xuất";
    return undefined;
  }, [selectedOrigin]);

  const categoryLabel = React.useMemo(() => {
    if (!selectedCategory || selectedCategory === "ALL") return undefined;
    const found = CATEGORY_FILTER_OPTIONS.find((c) => c.id === selectedCategory);
    return found ? found.label : selectedCategory;
  }, [selectedCategory]);

  const collaboratorLabel = React.useMemo(() => {
    if (selectedCollaborator === "has_collab") return "Có phối hợp";
    if (selectedCollaborator === "single") return "Tự thực hiện";
    return undefined;
  }, [selectedCollaborator]);

  // Active value labels for inline expand indicator (Fix #5)
  const getActiveValueLabel = React.useCallback((categoryKey: string): string | undefined => {
    switch (categoryKey) {
      case "status": return statusLabel !== "Trạng thái" ? statusLabel : undefined;
      case "priority": return priorityLabel !== "Ưu tiên" ? priorityLabel : undefined;
      case "category": return categoryLabel;
      case "dept": return departmentLabel !== "Đơn vị" ? departmentLabel : undefined;
      case "lead": return leadLabel;
      case "collaborator": return collaboratorLabel;
      case "dates": {
        if (isDeadlineActive && deadlineLabel !== "Thời hạn") return deadlineLabel;
        if (isMonthActive && timeLabel) return timeLabel;
        return undefined;
      }
      case "health": return healthLabel;
      case "origin": return originLabel;
      default: return undefined;
    }
  }, [statusLabel, priorityLabel, categoryLabel, departmentLabel, leadLabel, collaboratorLabel, isDeadlineActive, deadlineLabel, isMonthActive, timeLabel, healthLabel, originLabel]);

  const filterCategories = React.useMemo(() => [
    // 1. Nhóm thuộc tính cốt lõi
    {
      key: "status",
      group: "core",
      label: "Trạng thái",
      isActive: isStatusActive,
      icon: CircleDot,
    },
    {
      key: "priority",
      group: "core",
      label: "Mức ưu tiên",
      isActive: isPriorityActive,
      icon: AlertTriangle,
    },
    {
      key: "category",
      group: "core",
      label: "Danh mục",
      isActive: isCategoryActive,
      icon: Layers,
    },

    // 2. Nhóm đơn vị & nhân sự
    {
      key: "dept",
      group: "team",
      label: "Đơn vị",
      isActive: isDepartmentActive,
      icon: Building2,
    },
    {
      key: "lead",
      group: "team",
      label: "Người chủ trì",
      isActive: isLeadActive,
      icon: User,
    },
    {
      key: "collaborator",
      group: "team",
      label: "Người phối hợp",
      isActive: isCollaboratorActive,
      icon: Users,
    },

    // 3. Nhóm thời gian & SLA
    {
      key: "dates",
      group: "time",
      label: "Mốc thời gian",
      isActive: isDeadlineActive || isMonthActive,
      icon: Calendar,
    },
    {
      key: "health",
      group: "time",
      label: "Tiến độ",
      isActive: isHealthActive,
      icon: Activity,
    },

    // 4. Nhóm nguồn gốc
    {
      key: "origin",
      group: "origin",
      label: "Nguồn gốc",
      isActive: isOriginActive,
      icon: Flag,
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
        const norm = (effectiveStatus || "all").toLowerCase();
        return (
          <div className="space-y-0.5">
            {statusOptions.map((opt) => {
              const selected = opt.value === "all"
                ? !effectiveStatus || norm === "all"
                : opt.value === "new"
                  ? norm === "new" || norm === "not_started" || norm === "assigned"
                  : opt.value === "in_progress"
                    ? norm === "in_progress"
                    : opt.value === "waiting_approval" || opt.value === "review"
                      ? norm === "waiting_approval" || norm === "review" || norm === "pending_executive_approval" || norm === "needs_review"
                      : opt.value === "completed"
                        ? norm === "completed"
                        : norm === opt.value;
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    if (onStatusChange) onStatusChange(opt.value);
                    else onTabChange?.(opt.value);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "priority": {
        return (
          <div className="space-y-0.5">
            {PRIORITY_FILTER_OPTIONS.map((opt) => {
              const selected = (selectedPriority || "ALL").split(",").includes(opt.id);
              return (
                <MenuItem
                  key={opt.id}
                  onClick={() => {
                    onPriorityChange?.(opt.id);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "category": {
        return (
          <div className="space-y-0.5">
            {CATEGORY_FILTER_OPTIONS.map((cat) => {
              const selected = (selectedCategory || "ALL") === cat.id;
              return (
                <MenuItem
                  key={cat.id}
                  onClick={() => {
                    onCategoryChange?.(cat.id);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{cat.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "dept": {
        const depts = [
          { code: "ALL", name: "Tất cả đơn vị" },
          ...availableDepartments.filter((d) => d.code !== "ALL"),
        ];
        return (
          <div className="max-h-[min(320px,45vh)] overflow-y-auto space-y-0.5 pr-0.5">
            {depts.map((dept) => {
              const selected = (selectedDepartment || "ALL") === dept.code;
              return (
                <MenuItem
                  key={dept.code}
                  onClick={() => {
                    onDepartmentChange?.(dept.code);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{dept.code === "ALL" ? "Tất cả đơn vị" : dept.name}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
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
          <div className="space-y-0.5">
            {leadOptions.map((opt) => {
              const selected = selectedLead === opt.value || (opt.value === "all" && !selectedLead && activeTab !== "my") || (opt.value === "my" && activeTab === "my");
              return (
                <MenuItem
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
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
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
          <div className="space-y-0.5">
            {collabOptions.map((opt) => {
              const selected = selectedCollaborator === opt.value || (opt.value === "all" && !selectedCollaborator);
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    handleCollaboratorChange(opt.value === "all" ? null : opt.value);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "dates": {
        return (
          <div className="space-y-2">
            {/* Section 1: Hạn chốt nhiệm vụ */}
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground/70">
                Hạn chốt nhiệm vụ
              </p>
              <div className="space-y-0.5">
                {deadlineOptions.map((opt) => {
                  const selected = effectiveDeadline === opt.value || (opt.value === "all" && (!effectiveDeadline || effectiveDeadline === "all"));
                  return (
                    <MenuItem
                      key={opt.value}
                      onClick={() => {
                        if (onDeadlineChange) onDeadlineChange(opt.value);
                        else onTabChange?.(opt.value === "all" ? "all" : opt.value);
                        setIsCollapsedFilterOpen(false);
                      }}
                      className={cn(
                        "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                        selected
                          ? "bg-accent/80 font-medium text-foreground"
                          : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate">{opt.label}</span>
                        {opt.count !== undefined && opt.count > 0 && (
                          <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">({opt.count})</span>
                        )}
                      </div>
                      {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                    </MenuItem>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border/40 mx-2" />

            {/* Section 2: Kỳ tháng công tác */}
            <div>
              <p className="px-2 pb-1 text-[10px] font-semibold text-muted-foreground/70">
                Kỳ tháng công tác
              </p>
              <div className="space-y-0.5">
                <MenuItem
                  onClick={() => {
                    handleTimeFilterChange(NO_TASK_TIME_FILTER);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    effectiveTimeFilter.kind === "none"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span>Tất cả thời gian</span>
                  {effectiveTimeFilter.kind === "none" && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
                <MenuItem
                  onClick={() => {
                    handleTimeFilterChange({ kind: "preset", preset: "this_month" });
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    effectiveTimeFilter.kind === "preset" && effectiveTimeFilter.preset === "this_month"
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span>Tháng hiện tại</span>
                  {effectiveTimeFilter.kind === "preset" && effectiveTimeFilter.preset === "this_month" && (
                    <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />
                  )}
                </MenuItem>
              </div>

              {/* Month grid */}
              <div className="px-2 pt-1.5">
                <p className="mb-1 text-[10px] font-medium text-muted-foreground">
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
                          setIsCollapsedFilterOpen(false);
                        }}
                        className={cn(
                          "flex h-6.5 items-center justify-center rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
                          selected
                            ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
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
          </div>
        );
      }
      case "deadline": {
        return (
          <div className="space-y-0.5">
            {deadlineOptions.map((opt) => {
              const selected = effectiveDeadline === opt.value ||
                (opt.value === "all" && (!effectiveDeadline || effectiveDeadline === "all"));
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    if (onDeadlineChange) onDeadlineChange(opt.value);
                    else onTabChange?.(opt.value === "all" ? "all" : opt.value);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate">{opt.label}</span>
                    {opt.count !== undefined && opt.count > 0 && (
                      <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">({opt.count})</span>
                    )}
                  </div>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
          </div>
        );
      }
      case "time": {
        const timePresets: Array<{ value: TaskTimePreset | "none"; label: string }> = [
          { value: "none", label: "Tất cả thời gian" },
          { value: "today", label: "Hôm nay" },
          { value: "this_week", label: "Tuần này" },
          { value: "this_month", label: "Tháng này" },
          { value: "overdue", label: "Quá hạn" },
        ];
        return (
          <div className="space-y-0.5">
            {timePresets.map((opt) => {
              const selected = opt.value === "none"
                ? effectiveTimeFilter.kind === "none"
                : effectiveTimeFilter.kind === "preset" && effectiveTimeFilter.preset === opt.value;
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    handleTimeFilterChange(opt.value === "none" ? NO_TASK_TIME_FILTER : { kind: "preset", preset: opt.value });
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
                </MenuItem>
              );
            })}
            <MenuSeparator className="h-px bg-border/60 my-1.5" />
            <div className="px-2 py-1">
              <p className="mb-1 text-[11px] font-semibold text-muted-foreground">
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
                        setIsCollapsedFilterOpen(false);
                      }}
                      className={cn(
                        "flex h-6.5 items-center justify-center rounded-md text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
                        selected
                          ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
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
        );
      }
      case "health": {
        const healthOptions = [
          { value: "all", label: "Tất cả tiến độ" },
          { value: "on_track", label: "Đúng tiến độ (Bình thường)" },
          { value: "at_risk", label: "Có nguy cơ trễ hạn (≤ 7 ngày)" },
          { value: "overdue", label: "Trễ hạn / Quá hạn" },
          { value: "completed", label: "Đã hoàn thành 100%" },
        ];
        return (
          <div className="space-y-0.5">
            {healthOptions.map((opt) => {
              const selected = selectedHealth === opt.value || (opt.value === "all" && !selectedHealth);
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    handleHealthChange(opt.value === "all" ? null : opt.value);
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
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
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
        return (
          <div className="space-y-0.5">
            {originOptions.map((opt) => {
              const selected = selectedOrigin === opt.value || (opt.value === "all" && !selectedOrigin);
              return (
                <MenuItem
                  key={opt.value}
                  onClick={() => {
                    handleOriginChange(opt.value === "all" ? null : opt.value);
                    setIsCollapsedFilterOpen(false);
                  }}
                  className={cn(
                    "flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none",
                    selected
                      ? "bg-accent/80 font-medium text-foreground"
                      : "text-foreground/80 hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground"
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
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
        const norm = (effectiveStatus || "all").toLowerCase();
        const selected = opt.value === "all" ? !effectiveStatus || norm === "all" : norm === opt.value;
        results.push({
          id: `status-${opt.value}`,
          categoryLabel: "Trạng thái",
          label: opt.label,
          icon: CircleDot,
          selected,
          onSelect: () => {
            if (onStatusChange) onStatusChange(opt.value);
            else onTabChange?.(opt.value);
            setIsCollapsedFilterOpen(false);
          },
        });
      }
    });

    // Match Priority
    PRIORITY_FILTER_OPTIONS.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = (selectedPriority || "ALL").split(",").includes(opt.id);
        results.push({
          id: `prio-${opt.id}`,
          categoryLabel: "Mức ưu tiên",
          label: opt.label,
          icon: AlertTriangle,
          selected,
          onSelect: () => {
            onPriorityChange?.(opt.id);
            setIsCollapsedFilterOpen(false);
          },
        });
      }
    });

    // Match Category
    CATEGORY_FILTER_OPTIONS.forEach((cat) => {
      if (normalizeFilterSearchText(cat.label).includes(query)) {
        const selected = (selectedCategory || "ALL") === cat.id;
        results.push({
          id: `cat-${cat.id}`,
          categoryLabel: "Danh mục",
          label: cat.label,
          icon: Layers,
          selected,
          onSelect: () => {
            onCategoryChange?.(cat.id);
            setIsCollapsedFilterOpen(false);
          },
        });
      }
    });

    // Match Department
    availableDepartments.forEach((dept) => {
      if (normalizeFilterSearchText(dept.name).includes(query) || normalizeFilterSearchText(dept.code).includes(query)) {
        const selected = (selectedDepartment || "ALL") === dept.code;
        results.push({
          id: `dept-${dept.code}`,
          categoryLabel: "Đơn vị",
          label: dept.name,
          icon: Building2,
          selected,
          onSelect: () => {
            onDepartmentChange?.(dept.code);
            setIsCollapsedFilterOpen(false);
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
            setIsCollapsedFilterOpen(false);
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
            setIsCollapsedFilterOpen(false);
          },
        });
      }
    });

    // Match Health / Tiến độ
    const healthOptions = [
      { value: "on_track", label: "Đ��ng tiến độ (Bình thường)" },
      { value: "at_risk", label: "Có nguy cơ trễ hạn (≤ 7 ngày)" },
      { value: "overdue", label: "Trễ hạn / Quá hạn" },
      { value: "completed", label: "Đã hoàn thành 100%" },
    ];
    healthOptions.forEach((opt) => {
      if (normalizeFilterSearchText(opt.label).includes(query)) {
        const selected = selectedHealth === opt.value;
        results.push({
          id: `health-${opt.value}`,
          categoryLabel: "Tiến độ",
          label: opt.label,
          icon: Activity,
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
            setIsCollapsedFilterOpen(false);
          },
        });
      }
    });

    // Match Origin / Nguồn gốc
    const originOptions = [
      { value: "KE_HOACH_NAM", label: "Kế hoạch năm học" },
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
          icon: Flag,
          selected,
          onSelect: () => {
            handleOriginChange(opt.value);
            setIsCollapsedFilterOpen(false);
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
            setIsCollapsedFilterOpen(false);
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
            setIsCollapsedFilterOpen(false);
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
    const isExpanded = expandedCategory === category.key;
    const activeValue = getActiveValueLabel(category.key);
    return (
      <div key={category.key} data-slot="filter-category">
        {/* Category trigger — click to toggle inline expand */}
        <MenuItem
          onClick={(e: React.MouseEvent) => {
            e.preventDefault();
            setExpandedCategory(isExpanded ? null : category.key);
          }}
          className={cn(
            "group flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors hover:bg-accent text-foreground/90 hover:text-foreground cursor-pointer select-none outline-none focus-visible:bg-accent focus-visible:text-foreground",
            isExpanded && "bg-accent/60 text-foreground"
          )}
        >
          <div className="flex items-center gap-2 min-w-0">
            <category.icon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
            <span className={cn("truncate font-normal", category.isActive && "font-medium text-foreground")}>
              {category.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {category.isActive && activeValue && (
              <span className="text-[10px] text-primary font-medium truncate max-w-[72px]">
                {activeValue}
              </span>
            )}
            {category.isActive && !activeValue && (
              <span className="size-2 rounded-full bg-primary shrink-0" />
            )}
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground/60 group-hover:text-foreground transition-transform duration-150",
                isExpanded && "rotate-180"
              )}
              strokeWidth={1.5}
            />
          </div>
        </MenuItem>

        {/* Inline expand — collapsible content via grid rows */}
        <div
          className="grid transition-[grid-template-rows] duration-150 ease-out"
          style={{ gridTemplateRows: isExpanded ? "1fr" : "0fr" }}
        >
          <div className="overflow-hidden">
            {isExpanded && (
              <div className="pl-2 pr-1 py-1">
                {renderCategorySubmenuItems(category.key)}
              </div>
            )}
          </div>
        </div>
      </div>
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
      {/* SINGLE ROW: Search | Bộ lọc | [chips] | Hiển thị | + Giao việc  */}
      {/* ================================================================ */}

      {/* 1. Search (pushed right via ml-auto) */}
      <div
        className={cn(
          "relative shrink-0 transition-all duration-200 ml-auto",
          searchFocused ? "w-[240px]" : "w-[140px] sm:w-[180px]"
        )}
      >
        <Search
          className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
          strokeWidth={1.5}
        />
        <input
          ref={searchInputRef}
          type="text"
          value={localSearch}
          onChange={(e) => handleSearchInputChange(e.target.value)}
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
          placeholder="Tìm nhiệm vụ… /"
          aria-label="Tìm nhiệm vụ"
          className="h-7 w-full rounded-md border border-border/80 bg-background pl-8 pr-8 text-[11px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
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

      {/* 2. Bộ lọc — Cascading fly-out menu */}
      <MenuRoot open={isCollapsedFilterOpen} onOpenChange={(open) => { setIsCollapsedFilterOpen(open); if (!open) { setExpandedCategory(null); setMenuSearch(""); } }}>
        <MenuTrigger
          render={
            <button
              type="button"
              aria-label="Bộ lọc"
              aria-expanded={isCollapsedFilterOpen}
              className={cn(
                "inline-flex h-7 shrink-0 cursor-pointer select-none items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors",
                isCollapsedFilterOpen || activeFilterCount > 0
                  ? "border-border bg-accent/60 font-semibold text-foreground hover:bg-accent"
                  : "border-border/80 bg-background text-foreground hover:bg-accent"
              )}
            >
              <Filter className="size-3.5 shrink-0" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeFilterCount > 0 && (
                <span className="inline-flex size-4 items-center justify-center rounded-full bg-foreground/75 font-mono text-[10px] font-semibold tabular-nums text-background">
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                className={cn("size-3 shrink-0 text-muted-foreground transition-transform", isCollapsedFilterOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            </button>
          }
        />
        <MenuPortal>
          <MenuPositioner side="bottom" align="start" sideOffset={6} collisionPadding={12} className="z-50 outline-none">
            <MenuPopup
              data-slot="task-filter-menu"
              className="w-64 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-dropdown outline-none z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {/* Header: Add Filter... [F] */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/60 mb-1">
                <Search className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <input
                  ref={menuSearchInputRef}
                  type="text"
                  value={menuSearch}
                  onChange={(e) => setMenuSearch(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder="Thêm bộ lọc... F"
                  aria-label="Tìm hoặc thêm bộ lọc"
                  className="h-6 w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none"
                />
                {menuSearch ? (
                  <button
                    type="button"
                    onClick={() => setMenuSearch("")}
                    className="size-4 flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
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
                          onClick={match.onSelect}
                          className="flex h-7.5 w-full items-center justify-between rounded-lg px-2 text-xs transition-colors cursor-pointer select-none outline-none hover:bg-accent text-foreground/90 hover:text-foreground"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <match.icon className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                            <span className="text-muted-foreground text-[11px]">{match.categoryLabel}:</span>
                            <span className="truncate font-medium text-foreground">{match.label}</span>
                          </div>
                          {match.selected && <Check className="size-3.5 text-primary shrink-0 ml-1.5" strokeWidth={1.5} />}
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
                /* Grouped Categories with headings */
                <div className="max-h-[min(450px,65vh)] overflow-y-auto space-y-0.5">
                  {/* Group 1: Thuộc tính cốt lõi */}
                  <div className="px-2.5 pt-1 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                    Thuộc tính
                  </div>
                  {filterCategories.filter((c) => c.group === "core").map(renderCategorySubmenu)}
                  <MenuSeparator className="h-px bg-border/60 my-1.5" />

                  {/* Group 2: Đơn vị & Nhân sự */}
                  <div className="px-2.5 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                    Đơn vị & Nhân sự
                  </div>
                  {filterCategories.filter((c) => c.group === "team").map(renderCategorySubmenu)}
                  <MenuSeparator className="h-px bg-border/60 my-1.5" />

                  {/* Group 3: Thời gian & SLA */}
                  <div className="px-2.5 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                    Thời gian
                  </div>
                  {filterCategories.filter((c) => c.group === "time").map(renderCategorySubmenu)}
                  <MenuSeparator className="h-px bg-border/60 my-1.5" />

                  {/* Group 4: Nguồn gốc */}
                  <div className="px-2.5 pt-0.5 pb-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
                    Nguồn gốc
                  </div>
                  {filterCategories.filter((c) => c.group === "origin").map(renderCategorySubmenu)}
                </div>
              )}

              {activeFilterCount > 0 && (
                <>
                  <MenuSeparator className="h-px bg-border/60 my-1" />
                  <MenuItem
                    onClick={handleResetFilters}
                    className="flex h-7.5 w-full items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer select-none outline-none"
                  >
                    <RotateCcw className="size-3" strokeWidth={1.5} />
                    <span>Xóa toàn bộ bộ lọc ({activeFilterCount})</span>
                  </MenuItem>
                </>
              )}
            </MenuPopup>
          </MenuPositioner>
        </MenuPortal>
      </MenuRoot>

      {/* 3. Result count (Fix #3) */}
      {activeFilterCount > 0 && effectiveTotalTasksCount > 0 && (
        <span className="text-muted-foreground text-[11px] font-mono tabular-nums shrink-0 hidden sm:inline">
          {effectiveFilteredTasksCount} / {effectiveTotalTasksCount}
        </span>
      )}

      {/* 4. Hiển thị */}
      {onViewModeChange && (
        <PopoverRoot open={isDisplayOpen} onOpenChange={setIsDisplayOpen}>
          <PopoverTrigger
            render={
              <button
                type="button"
                title="Hiển thị"
                aria-label="Tùy chọn hiển thị"
                className={cn(
                  "inline-flex h-7 items-center justify-center gap-1 rounded-md border border-border/80 bg-background px-2 text-[11px] font-medium transition-colors cursor-pointer touch-manipulation shrink-0",
                  isDisplayOpen ? "bg-muted text-foreground font-semibold border-border" : "text-foreground hover:bg-accent"
                )}
              >
                <SlidersHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span className="hidden sm:inline">Hiển thị</span>
              </button>
            }
          />

          <PopoverContent
            align="end"
            side="bottom"
            sideOffset={6}
            className="w-36 rounded-xl border border-border/80 bg-popover p-1 shadow-dropdown z-50 text-xs text-popover-foreground"
          >
            <div className="space-y-0.5">
              <button
                type="button"
                onClick={() => { onViewModeChange("table"); setIsDisplayOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer select-none",
                  viewMode === "table"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <List className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Bảng</span>
                </div>
                {viewMode === "table" && <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />}
              </button>

              <button
                type="button"
                onClick={() => { onViewModeChange("kanban"); setIsDisplayOpen(false); }}
                className={cn(
                  "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer select-none",
                  viewMode === "kanban"
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <div className="flex items-center gap-2">
                  <Kanban className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Kanban</span>
                </div>
                {viewMode === "kanban" && <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />}
              </button>
            </div>
          </PopoverContent>
        </PopoverRoot>
      )}

      {/* Divider trước CTA */}
      {canCreateTask && handlePrimaryAction && (
        <div className="h-4 w-px bg-border/60 shrink-0" />
      )}

      {/* 5. + Giao việc CTA */}
      {canCreateTask && handlePrimaryAction && (
        <button
          type="button"
          onClick={() => handlePrimaryAction()}
          title="Giao việc mới (C)"
          aria-label="Giao việc mới (Phím C)"
          className="inline-flex h-7 items-center justify-center gap-1.5 rounded-lg border border-border/80 bg-background px-2 sm:px-2.5 text-[11px] font-medium text-foreground transition-all duration-150 hover:bg-accent hover:border-border active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none cursor-pointer shrink-0 shadow-none"
        >
          <Plus className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
          <span>{primaryActionLabel}</span>
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/80 bg-muted/60 border border-border/50 rounded select-none pointer-events-none ml-0.5">
            C
          </kbd>
        </button>
      )}
    </div>
  );
}
