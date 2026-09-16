"use client";

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
} from "lucide-react";
import { cn } from "@/lib/utils";
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

  React.useEffect(() => {
    setLocalSearch(searchQuery || "");
  }, [searchQuery]);

  const handleSearchInputChange = React.useCallback((val: string) => {
    setLocalSearch(val);
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => {
      onSearchChange(val);
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

  const [isCategoryOpen, setIsCategoryOpen] = React.useState(false);
  const categoryMenuRef = React.useRef<HTMLDivElement>(null);

  const [isCollapsedFilterOpen, setIsCollapsedFilterOpen] = React.useState(false);
  const collapsedFilterRef = React.useRef<HTMLDivElement>(null);

  const closeAllMenus = React.useCallback(() => {
    setIsMonthOpen(false);
    setIsStatusOpen(false);
    setIsDeadlineOpen(false);
    setIsPriorityOpen(false);
    setIsDepartmentOpen(false);
    setIsCategoryOpen(false);
    setIsCollapsedFilterOpen(false);
    setIsDisplayOpen(false);
  }, []);

  // Resolve Month props (supporting compatibility aliases)
  const effectiveMonth = selectedMonth !== undefined ? selectedMonth : selectedAcademicMonth;
  const handleEffectiveMonthChange = onMonthChange || onAcademicMonthChange;

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

  // Normalize current scope to "school" | "unit" | "my"
  const normalizedScope: WorkspaceScope = React.useMemo(() => {
    if (scope === "SCHOOL_TASKS" || scope === "school") return "school";
    if (scope === "UNIT_TASKS" || scope === "unit") return "unit";
    return "my";
  }, [scope]);

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
  const handleScopeSelect = (scopeId: WorkspaceScope) => {
    if (typeof scope === "string" && scope.endsWith("_TASKS")) {
      const legacyMap: Record<WorkspaceScope, TaskScope> = {
        school: "SCHOOL_TASKS",
        unit: "UNIT_TASKS",
        my: "MY_TASKS",
      };
      onScopeChange(legacyMap[scopeId]);
    } else {
      onScopeChange(scopeId);
    }
  };

  // 1. Authorized Scope Options (Semantic data scopes: Cá nhân → Đơn vị → Toàn trường)
  const canViewSchoolScope = true;
  const canViewUnitScope = true;

  const scopeOptions: Array<{
    id: WorkspaceScope;
    legacyId: TaskScope;
    label: string;
    shortLabel: string;
    icon: typeof School;
    isAuthorized: boolean;
  }> = [
    {
      id: "my",
      legacyId: "MY_TASKS",
      label: "Cá nhân",
      shortLabel: "Cá nhân",
      icon: User,
      isAuthorized: true,
    },
    {
      id: "unit",
      legacyId: "UNIT_TASKS",
      label: "Đơn vị",
      shortLabel: "Đơn vị",
      icon: Building2,
      isAuthorized: true,
    },
    {
      id: "school",
      legacyId: "SCHOOL_TASKS",
      label: "Toàn trường",
      shortLabel: "Trường",
      icon: School,
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
      if (categoryMenuRef.current && !categoryMenuRef.current.contains(target)) {
        setIsCategoryOpen(false);
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

    const bMy = getCount(badgeCounts?.my) ?? getCount((badgeCounts as any)?.MY_TASKS);
    const bUnit = getCount(badgeCounts?.unit) ?? getCount((badgeCounts as any)?.UNIT_TASKS);
    const bSchool = getCount(badgeCounts?.school) ?? getCount((badgeCounts as any)?.SCHOOL_TASKS);

    return {
      my: bMy !== undefined ? bMy : tabCounts?.my ?? tabCounts?.my_tasks,
      unit: bUnit !== undefined ? bUnit : tabCounts?.unit,
      school: bSchool !== undefined ? bSchool : (tabCounts?.all ?? totalTasksCount),
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
    { value: "overdue", label: "Quá hạn" },
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

  const timeLabel = React.useMemo(() => {
    if (effectiveMonth === "ALL" || effectiveMonth === undefined) return "Thời gian";
    return `Tháng ${effectiveMonth}`;
  }, [effectiveMonth]);

  const statusLabel = React.useMemo(() => {
    if (!activeTab || activeTab === "all" || activeTab === "today" || activeTab === "this_week") return "Trạng thái";
    if (activeTab.includes(",")) {
      const parts = activeTab.split(",").filter(Boolean);
      return `Trạng thái · ${parts.length}`;
    }
    if (activeTab === "new") return "Mới";
    if (activeTab === "in_progress") return "Đang thực hiện";
    if (activeTab === "waiting_approval" || activeTab === "review") return isExecutiveRole ? "Cần tôi duyệt" : "Cần chỉnh sửa";
    if (activeTab === "pending_submission") return "Chờ nộp BC";
    if (activeTab === "overdue") return "Quá hạn";
    if (activeTab === "completed") return "Hoàn thành";
    return "Trạng thái";
  }, [activeTab, isExecutiveRole]);

  const deadlineOptions = React.useMemo(() => [
    { value: "all", label: "Tất cả thời hạn" },
    { value: "overdue", label: "Quá hạn", count: tabCounts?.overdue },
    { value: "today", label: "Đến hạn hôm nay", count: tabCounts?.today },
    { value: "this_week", label: "Trong tuần này", count: tabCounts?.this_week },
  ], [tabCounts]);

  const deadlineLabel = React.useMemo(() => {
    if (activeTab === "today") return "Đến hạn hôm nay";
    if (activeTab === "this_week") return "Trong tuần này";
    if (activeTab === "overdue") return "Quá hạn";
    return "Thời hạn";
  }, [activeTab]);

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

  const categoryLabel = React.useMemo(() => {
    if (!selectedCategory || selectedCategory === "ALL") return "Danh mục";
    if (selectedCategory.includes(",")) {
      const parts = selectedCategory.split(",").filter(Boolean);
      return `Danh mục · ${parts.length}`;
    }
    const found = CATEGORY_FILTER_OPTIONS.find((c) => c.id === selectedCategory);
    return found ? found.label : selectedCategory;
  }, [selectedCategory]);

  const secondaryFiltersActiveCount = React.useMemo(() => {
    let count = 0;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (showDepartmentFilter && selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedCategory && selectedCategory !== "ALL") count++;
    return count;
  }, [selectedPriority, showDepartmentFilter, selectedDepartment, selectedCategory]);

  const moreFiltersActiveCount = secondaryFiltersActiveCount;

  // Count active advanced filters (Department, Priority, Custom status)
  const activeAdvancedFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (
      activeTab === "today" ||
      (isExecutiveRole
        ? activeTab === "pending_submission"
        : activeTab === "waiting_approval" || activeTab === "review")
    ) {
      count++;
    }
    return count;
  }, [
    selectedDepartment,
    selectedPriority,
    activeTab,
    isExecutiveRole,
  ]);

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

    if (selectedCategory && selectedCategory !== "ALL") {
      const catLabel =
        CATEGORY_FILTER_OPTIONS.find((c) => c.id === selectedCategory)?.label ||
        selectedCategory;
      chips.push({
        id: "cat",
        label: `Danh mục: ${catLabel}`,
        onRemove: () => onCategoryChange?.("ALL"),
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

    if (effectiveMonth !== undefined && effectiveMonth !== "ALL") {
      chips.push({
        id: "month",
        label: `Tháng ${effectiveMonth}`,
        onRemove: () => handleEffectiveMonthChange?.("ALL"),
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
    selectedCategory,
    onCategoryChange,
    selectedPriority,
    onPriorityChange,
    effectiveMonth,
    handleEffectiveMonthChange,
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
    onSearchChange("");
    onTabChange?.("all");
    onCategoryChange?.("ALL");
    onPriorityChange?.("ALL");
    handleEffectiveMonthChange?.("ALL");
    onResetFilters?.();
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
        "flex flex-col gap-2 border-b border-border/60 pb-2.5 bg-transparent relative z-20 overflow-visible",
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
                const isActive = normalizedScope === opt.id;
                const count = effectiveScopeBadgeCounts[opt.id];
                const showBadge = typeof count === "number" && !isNaN(count);

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    data-scope={opt.id}
                    aria-selected={isActive}
                    onClick={() => handleScopeSelect(opt.id)}
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

        {/* Right: Primary Page Action Button (Quiet/Flat Neutral Style) */}
        {canCreateTask && handlePrimaryAction && (
          <button
            type="button"
            onClick={() => handlePrimaryAction()}
            title="Tạo nhiệm vụ (C)"
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md border border-transparent bg-transparent px-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 hover:border-border/80 transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer shrink-0"
          >
            <Plus className="size-3.5 sm:size-4 shrink-0 text-muted-foreground" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ</span>
            <kbd className="hidden sm:inline-flex items-center px-1 py-0.2 text-[10px] font-mono text-muted-foreground/70 bg-muted/60 border border-border/40 rounded select-none pointer-events-none ml-0.5">
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
        className="flex items-center gap-1.5 sm:gap-2 pt-1 flex-wrap sm:flex-nowrap relative z-30 overflow-visible"
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
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
              effectiveMonth !== "ALL" && effectiveMonth !== undefined && "bg-muted font-semibold border-border"
            )}
          >
            <span>{timeLabel}</span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isMonthOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isMonthOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground max-h-60 overflow-y-auto thin-scrollbar"
              role="dialog"
              aria-label="Chọn thời gian làm việc"
            >
              <button
                type="button"
                onClick={() => {
                  handleEffectiveMonthChange?.("ALL");
                  setIsMonthOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                  effectiveMonth === "ALL" || effectiveMonth === undefined
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-foreground"
                )}
              >
                <span>Tất cả thời gian (Cả năm)</span>
                {(effectiveMonth === "ALL" || effectiveMonth === undefined) && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
              {academicMonths.map((period) => (
                <button
                  key={period.monthNumber}
                  type="button"
                  onClick={() => {
                    handleEffectiveMonthChange?.(period.monthNumber);
                    setIsMonthOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                    effectiveMonth === period.monthNumber
                      ? "text-primary font-semibold bg-primary/10"
                      : "text-foreground"
                  )}
                >
                  <span>{period.label}</span>
                  {effectiveMonth === period.monthNumber && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </button>
              ))}
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
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
              activeTab && activeTab !== "all" && activeTab !== "today" && activeTab !== "this_week" && "bg-muted font-semibold border-border"
            )}
          >
            <span>{statusLabel}</span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isStatusOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isStatusOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground"
              role="dialog"
              aria-label="Chọn trạng thái"
            >
              {statusOptions.map((opt) => {
                const isSelected = (activeTab === opt.value || (!activeTab && opt.value === "all"));
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onTabChange?.(opt.value);
                      setIsStatusOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
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
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
              (activeTab === "today" || activeTab === "this_week" || activeTab === "overdue") && "bg-muted font-semibold border-border"
            )}
          >
            <span>{deadlineLabel}</span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isDeadlineOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isDeadlineOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground"
              role="dialog"
              aria-label="Chọn thời hạn"
            >
              {deadlineOptions.map((opt) => {
                const isSelected = (activeTab === opt.value || (!activeTab && opt.value === "all"));
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onTabChange?.(opt.value);
                      setIsDeadlineOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
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

        {/* 5. Ưu tiên Filter (Direct on desktop) */}
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
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
              selectedPriority && selectedPriority !== "ALL" && "bg-muted font-semibold border-border"
            )}
          >
            <span>{priorityLabel}</span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isPriorityOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isPriorityOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-48 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground"
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
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                  !selectedPriority || selectedPriority === "ALL"
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-foreground"
                )}
              >
                <span>Tất cả mức ưu tiên</span>
                {(!selectedPriority || selectedPriority === "ALL") && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
              {PRIORITY_FILTER_OPTIONS.map((prio) => {
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
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
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

        {/* 6. Đơn vị Filter (Direct on desktop - only when relevant to scope) */}
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
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
                selectedDepartment && selectedDepartment !== "ALL" && "bg-muted font-semibold border-border"
              )}
            >
              <span>{departmentLabel}</span>
              <ChevronDown
                className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isDepartmentOpen && "rotate-180")}
                strokeWidth={1.5}
              />
            </button>

            {isDepartmentOpen && (
              <div
                className="absolute left-0 top-full mt-1.5 z-50 w-56 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground max-h-60 overflow-y-auto thin-scrollbar"
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
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                    !selectedDepartment || selectedDepartment === "ALL"
                      ? "text-primary font-semibold bg-primary/10"
                      : "text-foreground"
                  )}
                >
                  <span>Tất cả đơn vị</span>
                  {(!selectedDepartment || selectedDepartment === "ALL") && (
                    <Check className="size-3.5 text-primary" />
                  )}
                </button>
                {availableDepartments.map((dept) => {
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
                        "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
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

        {/* 7. Danh mục Filter (Direct on desktop) */}
        <div className="hidden lg:block relative shrink-0" ref={categoryMenuRef}>
          <button
            type="button"
            aria-label="Lọc danh mục"
            aria-expanded={isCategoryOpen}
            onClick={() => {
              const next = !isCategoryOpen;
              closeAllMenus();
              setIsCategoryOpen(next);
            }}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium text-foreground hover:bg-accent transition-colors cursor-pointer select-none touch-manipulation",
              selectedCategory && selectedCategory !== "ALL" && "bg-muted font-semibold border-border"
            )}
          >
            <span>{categoryLabel}</span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isCategoryOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isCategoryOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground max-h-60 overflow-y-auto thin-scrollbar"
              role="dialog"
              aria-label="Chọn danh mục chuyên môn"
            >
              <button
                type="button"
                onClick={() => {
                  onCategoryChange?.("ALL");
                  setIsCategoryOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                  !selectedCategory || selectedCategory === "ALL"
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-foreground"
                )}
              >
                <span>Tất cả danh mục</span>
                {(!selectedCategory || selectedCategory === "ALL") && (
                  <Check className="size-3.5 text-primary" />
                )}
              </button>
              {CATEGORY_FILTER_OPTIONS.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      onCategoryChange?.(cat.id);
                      setIsCategoryOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-black/[0.04] dark:hover:bg-white/[0.05] cursor-pointer",
                      isSelected ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                    )}
                  >
                    <span>{cat.label}</span>
                    {isSelected && <Check className="size-3.5 text-primary" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Collapsed Secondary Filters on Narrower Screens (< 1024px) */}
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
              "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
              isCollapsedFilterOpen || secondaryFiltersActiveCount > 0
                ? "bg-muted text-foreground font-semibold border-border"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Plus className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
            <span>Bộ lọc</span>
            {secondaryFiltersActiveCount > 0 && (
              <span className="inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold bg-primary/10 text-primary">
                {secondaryFiltersActiveCount}
              </span>
            )}
          </button>

          {isCollapsedFilterOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-72 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 p-3 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground"
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
                            ? "bg-foreground text-background font-medium shadow-2xs"
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
                    {availableDepartments.map((dept) => (
                      <option key={dept.code} value={dept.code}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Category */}
              <div className="border-t border-border/60 pt-2 mb-2.5">
                <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                  Danh mục chuyên môn
                </div>
                <select
                  value={selectedCategory || "ALL"}
                  onChange={(e) => onCategoryChange?.(e.target.value)}
                  className="w-full h-8 px-2 rounded border border-border/80 bg-background text-xs text-foreground focus:outline-hidden cursor-pointer"
                >
                  {CATEGORY_FILTER_OPTIONS.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Reset */}
              {secondaryFiltersActiveCount > 0 && (
                <div className="pt-2 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      onPriorityChange?.("ALL");
                      onCategoryChange?.("ALL");
                      if (showDepartmentFilter) onDepartmentChange?.("ALL");
                    }}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 8. Hiển thị Menu Trigger (Right side - pinned) */}
        {onViewModeChange && (
          <div className="ml-auto relative shrink-0" ref={displayMenuRef}>
            <button
              type="button"
              aria-label="Tùy chọn hiển thị"
              aria-expanded={isDisplayOpen}
              onClick={() => {
                const next = !isDisplayOpen;
                closeAllMenus();
                setIsDisplayOpen(next);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md border border-border/80 bg-background px-2.5 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                isDisplayOpen ? "bg-muted text-foreground font-semibold border-border" : "text-foreground hover:bg-accent"
              )}
            >
              <SlidersHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>Hiển thị</span>
            </button>

            {isDisplayOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-xl border border-black/10 dark:border-white/10 bg-white dark:bg-zinc-900 py-1.5 shadow-xl animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-foreground"
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
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
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
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer hover:bg-black/[0.04] dark:hover:bg-white/[0.05]",
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
