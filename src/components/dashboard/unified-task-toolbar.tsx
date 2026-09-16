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

  // Month selector dropdown menu state
  const [isMonthOpen, setIsMonthOpen] = React.useState(false);
  const monthMenuRef = React.useRef<HTMLDivElement>(null);

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

  // 3. Popover outside click and Esc listener
  React.useEffect(() => {
    if (!isFilterOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
        setActiveFilterField(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFilterOpen(false);
        setActiveFilterField(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  // Display options popover outside click and Esc listener
  React.useEffect(() => {
    if (!isDisplayOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (displayMenuRef.current && !displayMenuRef.current.contains(e.target as Node)) {
        setIsDisplayOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsDisplayOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isDisplayOpen]);

  // Month options popover outside click and Esc listener
  React.useEffect(() => {
    if (!isMonthOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (monthMenuRef.current && !monthMenuRef.current.contains(e.target as Node)) {
        setIsMonthOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMonthOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMonthOpen]);

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
        "flex flex-col gap-2 border-b border-border/60 pb-2.5 bg-transparent",
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

        {/* Right: Primary Action Button */}
        {canCreateTask && handlePrimaryAction && (
          <button
            type="button"
            onClick={() => handlePrimaryAction()}
            title="Tạo nhiệm vụ mới (N P)"
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 cursor-pointer shrink-0"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>Tạo nhiệm vụ</span>
          </button>
        )}
      </div>

      {/* ==================================================================== */}
      {/* ROW 2: Search + Month Selector + Filter Menu + Display Menu          */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-2"
        className="flex items-center gap-2 pt-1 flex-wrap sm:flex-nowrap"
      >
        {/* 1. Search Input: Always Scoped to Current Scope (440–500px) */}
        <div className="relative w-full max-w-[440px] sm:max-w-[480px] shrink">
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
            className="h-9 w-full rounded-md border border-border/80 bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none transition-colors"
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
                className="size-5 flex items-center justify-center text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
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

        {/* 2. Month Filter Selector Outside Toolbar (Linear style) */}
        <div className="relative shrink-0" ref={monthMenuRef}>
          <button
            type="button"
            aria-label="Chọn kỳ tháng"
            aria-expanded={isMonthOpen}
            onClick={() => setIsMonthOpen((prev) => !prev)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-medium transition-colors cursor-pointer select-none touch-manipulation",
              effectiveMonth !== "ALL" && effectiveMonth !== undefined
                ? "border-primary/40 bg-primary/5 text-primary font-semibold"
                : "text-foreground hover:bg-accent"
            )}
          >
            <Calendar className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            <span>
              {effectiveMonth === "ALL" || effectiveMonth === undefined
                ? "Cả năm học"
                : `Tháng ${effectiveMonth}`}
            </span>
            <ChevronDown
              className={cn("size-3 text-muted-foreground shrink-0 transition-transform", isMonthOpen && "rotate-180")}
              strokeWidth={1.5}
            />
          </button>

          {isMonthOpen && (
            <div
              className="absolute left-0 top-full mt-1.5 z-50 w-52 rounded-md border border-border bg-popover py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground max-h-60 overflow-y-auto"
              role="dialog"
              aria-label="Chọn tháng làm việc"
            >
              <button
                type="button"
                onClick={() => {
                  handleEffectiveMonthChange?.("ALL");
                  setIsMonthOpen(false);
                }}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                  effectiveMonth === "ALL" || effectiveMonth === undefined
                    ? "text-primary font-semibold bg-primary/10"
                    : "text-foreground"
                )}
              >
                <span>Cả năm học (2026-2027)</span>
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
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
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

        {/* 3. Filter Menu Trigger & Popover (Contains Status, Priority, Saved Filters) */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0 relative">
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              aria-label="Bộ lọc nhiệm vụ"
              aria-expanded={isFilterOpen}
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                isFilterOpen || activeAdvancedFilterCount > 0 || (activeTab && activeTab !== "all")
                  ? "bg-muted text-foreground font-semibold border-border"
                  : "text-foreground hover:bg-accent"
              )}
            >
              <Filter className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {(activeAdvancedFilterCount > 0 || (activeTab && activeTab !== "all")) && (
                <span className="inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold bg-primary/10 text-primary">
                  {activeAdvancedFilterCount + (activeTab && activeTab !== "all" ? 1 : 0)}
                </span>
              )}
            </button>

            {/* Compact Filter Popover Panel */}
            {isFilterOpen && (
              <div
                className="absolute right-0 top-full mt-1.5 z-50 w-80 rounded-md border border-border bg-popover p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
                role="dialog"
                aria-label="Bảng chọn bộ lọc"
              >
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/60">
                  <span className="font-semibold text-foreground">Bộ lọc nhiệm vụ</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterOpen(false);
                      setActiveFilterField(null);
                    }}
                    aria-label="Đóng bộ lọc"
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                {/* Section 1: Quick Status Options */}
                <div className="mb-2.5">
                  <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                    Trạng thái & Hạn chót
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { id: "all", label: "Tất cả", count: tabCounts?.all },
                      { id: "overdue", label: "Quá hạn", count: tabCounts?.overdue },
                      { id: "this_week", label: "Đến hạn tuần này", count: tabCounts?.this_week ?? tabCounts?.today },
                      {
                        id: isExecutiveRole ? "waiting_approval" : "review",
                        label: isExecutiveRole ? "Chờ duyệt" : "Chờ nộp/duyệt",
                        count: tabCounts?.waiting_approval ?? tabCounts?.review ?? tabCounts?.pending_submission,
                      },
                    ].map((opt) => {
                      const isSelected = (activeTab || "all") === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onTabChange?.(opt.id)}
                          className={cn(
                            "flex items-center justify-between px-2 py-1.5 rounded text-left transition-colors cursor-pointer",
                            isSelected
                              ? "bg-foreground text-background font-medium shadow-2xs"
                              : "hover:bg-accent text-foreground"
                          )}
                        >
                          <span className="truncate">{opt.label}</span>
                          {typeof opt.count === "number" && (
                            <span
                              className={cn(
                                "text-[10px] font-mono tabular-nums px-1 rounded ml-1",
                                isSelected ? "bg-background/20 text-background" : "text-muted-foreground"
                              )}
                            >
                              {opt.count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Section 2: Priority Filter */}
                <div className="border-t border-border/60 pt-2 mb-2.5">
                  <div className="relative">
                    <div
                      onClick={() => setActiveFilterField(activeFilterField === "prio" ? null : "prio")}
                      className="flex items-center justify-between py-1.5 px-1 rounded hover:bg-accent cursor-pointer"
                    >
                      <span className="text-muted-foreground">Độ ưu tiên</span>
                      <div className="flex items-center gap-1 text-foreground font-medium max-w-[180px]">
                        <span className="truncate">
                          {PRIORITY_FILTER_OPTIONS.find((p) => p.id === selectedPriority)?.label || "Tất cả mức độ"}
                        </span>
                        <ChevronDown className="size-3 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                    {activeFilterField === "prio" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-md border border-border bg-popover py-1 shadow-lg max-h-48 overflow-y-auto">
                        {PRIORITY_FILTER_OPTIONS.map((prio) => (
                          <button
                            key={prio.id}
                            type="button"
                            onClick={() => {
                              onPriorityChange?.(prio.id);
                              setActiveFilterField(null);
                            }}
                            className={cn(
                              "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-accent cursor-pointer",
                              (selectedPriority || "ALL") === prio.id ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                            )}
                          >
                            <span className="truncate">{prio.label}</span>
                            {(selectedPriority || "ALL") === prio.id && <Check className="size-3.5 text-primary" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Section 3: Saved Filters & Save Current Filter */}
                {showSavedViews && (
                  <div className="border-t border-border/60 pt-2 mb-2">
                    <div className="text-[11px] font-semibold text-muted-foreground mb-1.5">
                      Bộ lọc của bạn
                    </div>
                    <SavedViewsSelector
                      user={user}
                      activeViewId={effectiveActiveViewId}
                      onSelectView={(v) => {
                        onSelectView?.(v);
                        setIsFilterOpen(false);
                      }}
                      currentCriteria={effectiveCriteria}
                      onSaveView={onSaveView}
                      onDeleteView={onDeleteView}
                      onRenameView={onRenameView}
                      availableDepartments={availableDepartments}
                    />
                  </div>
                )}

                {/* Footer Action: Reset & Apply */}
                <div className="mt-2.5 pt-2 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterOpen(false);
                      setActiveFilterField(null);
                    }}
                    className="h-6.5 px-3 rounded bg-foreground text-xs font-medium text-background hover:opacity-90 cursor-pointer transition-opacity"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 4. Display Options Popover */}
          {onViewModeChange && (
            <div className="relative" ref={displayMenuRef}>
              <button
                type="button"
                aria-label="Tùy chọn hiển thị"
                aria-expanded={isDisplayOpen}
                onClick={() => setIsDisplayOpen((prev) => !prev)}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-md border border-border/80 bg-background px-3 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                  isDisplayOpen
                    ? "bg-muted text-foreground font-semibold border-border"
                    : "text-foreground hover:bg-accent"
                )}
              >
                <SlidersHorizontal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>Hiển thị</span>
              </button>

              {isDisplayOpen && (
                <div
                  className="absolute right-0 top-full mt-1.5 z-50 w-36 rounded-md border border-border bg-popover py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 text-xs text-popover-foreground"
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
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer",
                      viewMode === "table" ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <List className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Bảng</span>
                    </div>
                    {viewMode === "table" && <Check className="size-3.5 text-foreground" strokeWidth={1.5} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onViewModeChange("kanban");
                      setIsDisplayOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer",
                      viewMode === "kanban" ? "text-foreground font-semibold bg-accent" : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Kanban className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Kanban</span>
                    </div>
                    {viewMode === "kanban" && <Check className="size-3.5 text-foreground" strokeWidth={1.5} />}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
