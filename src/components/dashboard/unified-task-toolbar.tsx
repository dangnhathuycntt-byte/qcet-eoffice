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

// Helper: filterTasksByScope (backward compatibility)
export function filterTasksByScope(
  tasks: SchoolTask[],
  scope: TaskScope,
  user?: AuthUser | null,
  departmentCode?: string
): SchoolTask[] {
  if (scope === "MY_TASKS") {
    if (!user) return tasks;
    return tasks.filter((t) => {
      const isLead =
        t.leadAssigneeName === user.name || matchesUser(t.leadAssigneeName, user);
      const hasSub = t.subTasks?.some(
        (s) => s.assigneeName === user.name || matchesUser(s.assigneeName, user)
      );
      return isLead || hasSub;
    });
  }

  if (scope === "SCHOOL_TASKS") {
    if (!user || user.role === "ADMIN") {
      return [...tasks];
    }
    return filterTasksByRole(tasks, user);
  }

  if (scope === "UNIT_TASKS") {
    const targetDept =
      departmentCode && departmentCode !== "ALL"
        ? departmentCode
        : user && user.role !== "ADMIN"
        ? user.departmentCode
        : undefined;

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
  const roleActionPill = buildRoleActionPill(isExecutiveRole, tabCounts, activeTab);
  return [
    {
      id: "all",
      label: "Tất cả",
      count: tabCounts?.all ?? totalTasksCount,
      isActive: activeTab === "all" || !activeTab,
    },
    roleActionPill,
    {
      id: "overdue",
      label: "Quá hạn",
      count: tabCounts?.overdue ?? 0,
      isActive: activeTab === "overdue",
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

  // 1. Authorized Scope Options (Semantic data scopes: Toàn trường | [Phòng/Khoa trực thuộc] | Cá nhân)
  const canViewSchoolScope = Boolean(isExecutive);
  const canViewUnitScope = Boolean(
    !isUnassigned &&
    (isExecutive ||
      isManager ||
      Boolean((user as any)?.departmentId) ||
      (Boolean(user?.departmentCode) && user?.departmentCode !== "QCET" && user?.departmentCode !== "UNASSIGNED"))
  );

  const unitLabel = React.useMemo(() => {
    if (isUnassigned) return "Chưa chọn đ/v";
    const dept = user?.department || (user as any)?.departmentName;
    if (dept) return dept;
    if (user?.departmentCode) return user.departmentCode;
    if (isExecutive) return "Ban Giám hiệu";
    return "Đơn vị";
  }, [isUnassigned, user?.department, (user as any)?.departmentName, user?.departmentCode, isExecutive]);

  const unitShortLabel = React.useMemo(() => {
    if (isUnassigned) return "Chưa chọn đ/v";
    const dept = user?.department || (user as any)?.departmentName;
    if (dept) {
      return dept.length > 16 ? dept.slice(0, 14) + "..." : dept;
    }
    if (isExecutive) return "Ban Giám hiệu";
    return "Đơn vị";
  }, [isUnassigned, user?.department, (user as any)?.departmentName, isExecutive]);

  const scopeOptions: Array<{
    id: WorkspaceScope;
    legacyId: TaskScope;
    label: string;
    shortLabel: string;
    icon: typeof School;
    isAuthorized: boolean;
  }> = [
    {
      id: "school",
      legacyId: "SCHOOL_TASKS",
      label: "Toàn trường",
      shortLabel: "Trường",
      icon: School,
      isAuthorized: canViewSchoolScope,
    },
    {
      id: "unit",
      legacyId: "UNIT_TASKS",
      label: unitLabel,
      shortLabel: unitShortLabel,
      icon: Building2,
      isAuthorized: canViewUnitScope,
    },
    {
      id: "my",
      legacyId: "MY_TASKS",
      label: "Cá nhân",
      shortLabel: "Cá nhân",
      icon: User,
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

  // Scope badge counts fallback to tabCounts for scopes if badgeCounts is omitted
  const effectiveScopeBadgeCounts = badgeCounts || {
    school: tabCounts?.all ?? totalTasksCount,
    unit: tabCounts?.unit,
    my: tabCounts?.my ?? tabCounts?.my_tasks,
  };

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

  // Count active advanced filters
  const activeAdvancedFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedCategory && selectedCategory !== "ALL") count++;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (effectiveMonth !== undefined && effectiveMonth !== "ALL") count++;
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
    selectedCategory,
    selectedPriority,
    effectiveMonth,
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

  // Reset all filters
  const handleResetFilters = () => {
    onSearchChange("");
    onTabChange?.("all");
    onDepartmentChange?.("ALL");
    onCategoryChange?.("ALL");
    onPriorityChange?.("ALL");
    handleEffectiveMonthChange?.("ALL");
    onResetFilters?.();
    setIsFilterOpen(false);
  };

  return (
    <div
      data-slot="unified-task-toolbar"
      className={cn(
        "flex flex-col gap-2.5 border-b border-border/60 pb-3 bg-transparent",
        className
      )}
    >
      {/* ==================================================================== */}
      {/* ROW 1: Scope Switcher + Primary Action Button (VIEW-FIRST)           */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-1"
        className="flex items-center justify-between gap-2"
      >
        {/* Left: Scope Switcher (Only Authorized Scopes; hidden if <= 1) */}
        <div className="flex items-center gap-0.5 shrink-0">
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
                const count = effectiveScopeBadgeCounts?.[opt.id];

                return (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    data-scope={opt.id}
                    aria-selected={isActive}
                    onClick={() => handleScopeSelect(opt.id)}
                    className={cn(
                      "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer select-none",
                      isActive
                        ? "bg-slate-100 text-slate-900 font-semibold"
                        : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-slate-400" strokeWidth={1.5} />
                    <span>{opt.label}</span>

                    {typeof count === "number" && count > 0 && (
                      <span
                        className={cn(
                          "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums",
                          isActive ? "bg-slate-200/80 text-slate-700 font-semibold" : "text-slate-400"
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
        </div>

        {/* Right: Primary Action Button */}
        {canCreateTask && handlePrimaryAction && (
          <button
            type="button"
            onClick={() => handlePrimaryAction()}
            title="Tạo việc mới (N P)"
            className="inline-flex h-7 items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground shadow-2xs transition-colors hover:bg-primary/90 cursor-pointer shrink-0"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>{primaryActionLabel}</span>
          </button>
        )}
      </div>

      {/* Optional Academic Month Pills (Rendered only when explicitly requested or intentionally supplied monthlyTaskCounts) */}
      {(showAcademicMonthBar || Boolean(monthlyTaskCounts)) && (
        <div
          className="flex items-center gap-2 overflow-x-auto overscroll-x-contain pt-1 pb-0.5 border-t border-border/50 scrollbar-none"
          role="tablist"
          aria-label="Chu kỳ 12 tháng công tác năm học"
        >
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground whitespace-nowrap pr-0.5 shrink-0 select-none">
            <Calendar className="size-3.5 text-primary" strokeWidth={1.5} />
            <span className="hidden sm:inline">Năm học {academicYear}:</span>
            <span className="sm:hidden">{academicYear}:</span>
          </div>

          <div className="inline-flex items-center gap-1 rounded-xl border border-border/80 bg-muted/30 p-1 shadow-2xs shrink-0">
            <button
              type="button"
              role="tab"
              aria-selected={effectiveMonth === "ALL"}
              onClick={() => handleEffectiveMonthChange?.("ALL")}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                effectiveMonth === "ALL"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-card/40"
              )}
              title={`Tất cả các tháng công tác trong năm học ${academicYear}`}
            >
              <span>Cả năm</span>
              {allYearCount !== undefined && (
                <span
                  className={cn(
                    "inline-flex items-center justify-center rounded-md px-1.5 py-0.2 text-xs tabular-nums font-semibold font-mono",
                    effectiveMonth === "ALL"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {allYearCount}
                </span>
              )}
            </button>

            {academicMonths.map((period) => {
              const isSelected = effectiveMonth === period.monthNumber;
              const count = monthlyTaskCounts ? monthlyTaskCounts[period.monthNumber] : undefined;

              return (
                <button
                  key={period.monthNumber}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => handleEffectiveMonthChange?.(period.monthNumber)}
                  className={cn(
                    "group inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                    isSelected
                      ? "bg-card text-foreground shadow-xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                  )}
                  title={period.fullLabel}
                >
                  <span>{period.label}</span>
                  {typeof count === "number" && (
                    <span
                      className={cn(
                        "inline-flex items-center justify-center rounded-md px-1.5 py-0.2 text-xs tabular-nums font-semibold font-mono",
                        isSelected
                          ? "bg-primary/10 text-primary"
                          : count > 0
                          ? "bg-muted text-muted-foreground"
                          : "bg-muted/40 text-muted-foreground/50"
                      )}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
      {/* ==================================================================== */}
      {/* ROW 2: Saved Views, Search, Filter, Display (Linear IA)              */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-2"
        className="flex items-center gap-2 pt-1 border-t border-border/50"
      >
        {/* Leftmost: Saved View Selector — primary work navigation trigger */}
        {showSavedViews && (
          <div className="shrink-0">
            <SavedViewsSelector
              user={user}
              activeViewId={effectiveActiveViewId}
              onSelectView={onSelectView}
              currentCriteria={effectiveCriteria}
              onSaveView={onSaveView}
              onDeleteView={onDeleteView}
              onRenameView={onRenameView}
              defaultLabel={hasCustomFilters ? "Góc nhìn: Tùy chỉnh" : "Góc nhìn: Tất cả nhiệm vụ"}
            />
          </div>
        )}

        {/* Center: Search Input (Responsive with desktop max-width 640-760px) */}
        <div className="relative flex-1 max-w-[640px] md:max-w-[720px] lg:max-w-[760px] min-w-[160px]">
          <Search
            className="size-3.5 text-slate-400 pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={localSearch}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            placeholder={
              searchPlaceholder && searchPlaceholder !== "Tìm nhiệm vụ... /"
                ? searchPlaceholder
                : typeof totalTasksCount === "number" && totalTasksCount > 0
                ? `Tìm trong ${totalTasksCount} nhiệm vụ... /`
                : searchPlaceholder || "Tìm nhiệm vụ... /"
            }
            aria-label="Tìm nhiệm vụ"
            className="h-7.5 w-full rounded-md border border-slate-200/80 bg-white pl-8 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none transition-colors"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && (
              <Loader2
                className="size-3.5 animate-spin text-slate-400"
                aria-label="Đang tải dữ liệu"
              />
            )}
            {localSearch ? (
              <button
                type="button"
                onClick={handleSearchClear}
                aria-label="Xóa từ khóa tìm kiếm"
                className="size-5 flex items-center justify-center text-slate-400 hover:text-slate-700 p-0.5 rounded cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.2 text-[10px] font-mono text-slate-400 bg-slate-50 border border-slate-200/60 rounded select-none pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Right: Filter + Display controls (Anchored to right edge) */}
        <div className="ml-auto flex items-center gap-1 shrink-0 relative">
          {/* 1. Advanced Filter Popover Trigger */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              aria-label="Bộ lọc nâng cao"
              aria-expanded={isFilterOpen}
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                isFilterOpen || activeAdvancedFilterCount > 0
                  ? "bg-slate-100 text-slate-900 font-semibold"
                  : "text-slate-500 hover:text-slate-900 hover:bg-slate-50"
              )}
            >
              <Filter className="size-3.5 text-slate-400" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="inline-flex items-center justify-center rounded px-1.5 py-0.2 text-[10px] font-mono tabular-nums font-semibold bg-slate-200/80 text-slate-700">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Desktop Popover Dropdown Panel (sm:block) - Flat Property Rows with Custom Clean Menus */}
            {isFilterOpen && (
              <div
                className="hidden sm:block absolute right-0 top-full mt-1.5 z-50 w-80 rounded-md border border-slate-200/90 bg-white p-3 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
                role="dialog"
                aria-label="Bộ lọc nâng cao"
              >
                <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-100">
                  <span className="text-xs font-semibold text-slate-900">Bộ lọc</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterOpen(false);
                      setActiveFilterField(null);
                    }}
                    aria-label="Đóng bộ lọc"
                    className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="divide-y divide-slate-100">
                  {/* 1. Trạng thái */}
                  <div className="relative">
                    <div
                      onClick={() =>
                        setActiveFilterField(activeFilterField === "status" ? null : "status")
                      }
                      className="flex items-center justify-between h-8.5 px-1 text-xs rounded hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 shrink-0">Trạng thái</span>
                      <div className="flex items-center gap-1 text-slate-800 font-medium max-w-[190px]">
                        <span className="truncate">
                          {statusOptions.find((o) => o.value === (activeTab || "all"))?.label ||
                            "Tất cả trạng thái"}
                        </span>
                        <ChevronDown className="size-3 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    {activeFilterField === "status" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        {statusOptions.map((opt) => {
                          const isSelected = (activeTab || "all") === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                onTabChange?.(opt.value);
                                setActiveFilterField(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                                isSelected ? "text-primary font-semibold bg-primary/5" : "text-slate-700"
                              )}
                            >
                              <span className="truncate">{opt.label}</span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 2. Đơn vị */}
                  <div className="relative">
                    <div
                      onClick={() =>
                        setActiveFilterField(activeFilterField === "dept" ? null : "dept")
                      }
                      className="flex items-center justify-between h-8.5 px-1 text-xs rounded hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 shrink-0">Đơn vị</span>
                      <div className="flex items-center gap-1 text-slate-800 font-medium max-w-[190px]">
                        <span className="truncate">
                          {availableDepartments.find((d) => d.code === selectedDepartment)?.name ||
                            "Tất cả đơn vị"}
                        </span>
                        <ChevronDown className="size-3 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    {activeFilterField === "dept" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-64 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        {availableDepartments.map((dept) => {
                          const isSelected = (selectedDepartment || "ALL") === dept.code;
                          return (
                            <button
                              key={dept.code}
                              type="button"
                              onClick={() => {
                                onDepartmentChange?.(dept.code);
                                setActiveFilterField(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                                isSelected ? "text-primary font-semibold bg-primary/5" : "text-slate-700"
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

                  {/* 3. Danh mục DACUM */}
                  <div className="relative">
                    <div
                      onClick={() =>
                        setActiveFilterField(activeFilterField === "cat" ? null : "cat")
                      }
                      className="flex items-center justify-between h-8.5 px-1 text-xs rounded hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 shrink-0">Danh mục DACUM</span>
                      <div className="flex items-center gap-1 text-slate-800 font-medium max-w-[190px]">
                        <span className="truncate">
                          {CATEGORY_FILTER_OPTIONS.find((c) => c.id === selectedCategory)?.label ||
                            "Tất cả danh mục"}
                        </span>
                        <ChevronDown className="size-3 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    {activeFilterField === "cat" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-56 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        {CATEGORY_FILTER_OPTIONS.map((cat) => {
                          const isSelected = (selectedCategory || "ALL") === cat.id;
                          return (
                            <button
                              key={cat.id}
                              type="button"
                              onClick={() => {
                                onCategoryChange?.(cat.id);
                                setActiveFilterField(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                                isSelected ? "text-primary font-semibold bg-primary/5" : "text-slate-700"
                              )}
                            >
                              <span className="truncate">{cat.label}</span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 4. Độ ưu tiên */}
                  <div className="relative">
                    <div
                      onClick={() =>
                        setActiveFilterField(activeFilterField === "prio" ? null : "prio")
                      }
                      className="flex items-center justify-between h-8.5 px-1 text-xs rounded hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 shrink-0">Độ ưu tiên</span>
                      <div className="flex items-center gap-1 text-slate-800 font-medium max-w-[190px]">
                        <span className="truncate">
                          {PRIORITY_FILTER_OPTIONS.find((p) => p.id === selectedPriority)?.label ||
                            "Tất cả mức độ"}
                        </span>
                        <ChevronDown className="size-3 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    {activeFilterField === "prio" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-52 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        {PRIORITY_FILTER_OPTIONS.map((prio) => {
                          const isSelected = (selectedPriority || "ALL") === prio.id;
                          return (
                            <button
                              key={prio.id}
                              type="button"
                              onClick={() => {
                                onPriorityChange?.(prio.id);
                                setActiveFilterField(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                                isSelected ? "text-primary font-semibold bg-primary/5" : "text-slate-700"
                              )}
                            >
                              <span className="truncate">{prio.label}</span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 5. Tháng học kỳ */}
                  <div className="relative">
                    <div
                      onClick={() =>
                        setActiveFilterField(activeFilterField === "month" ? null : "month")
                      }
                      className="flex items-center justify-between h-8.5 px-1 text-xs rounded hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 shrink-0">Tháng học kỳ</span>
                      <div className="flex items-center gap-1 text-slate-800 font-medium max-w-[190px]">
                        <span className="truncate">
                          {effectiveMonth === "ALL" || effectiveMonth === undefined
                            ? `Cả năm học (${academicYear})`
                            : academicMonths.find((m) => m.monthNumber === effectiveMonth)?.label ||
                              `Tháng ${effectiveMonth}`}
                        </span>
                        <ChevronDown className="size-3 text-slate-400 shrink-0" />
                      </div>
                    </div>

                    {activeFilterField === "month" && (
                      <div className="absolute right-0 top-full mt-1 z-30 w-60 rounded-md border border-slate-200 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100 max-h-56 overflow-y-auto">
                        <button
                          type="button"
                          onClick={() => {
                            handleEffectiveMonthChange?.("ALL");
                            setActiveFilterField(null);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                            effectiveMonth === "ALL" || effectiveMonth === undefined
                              ? "text-primary font-semibold bg-primary/5"
                              : "text-slate-700"
                          )}
                        >
                          <span className="truncate">Cả năm học ({academicYear})</span>
                          {(effectiveMonth === "ALL" || effectiveMonth === undefined) && (
                            <Check className="size-3.5 text-primary shrink-0" />
                          )}
                        </button>
                        {academicMonths.map((period) => {
                          const isSelected = effectiveMonth === period.monthNumber;
                          return (
                            <button
                              key={period.monthNumber}
                              type="button"
                              onClick={() => {
                                handleEffectiveMonthChange?.(period.monthNumber);
                                setActiveFilterField(null);
                              }}
                              className={cn(
                                "w-full flex items-center justify-between px-3 py-1.5 text-xs text-left hover:bg-slate-50 transition-colors cursor-pointer",
                                isSelected ? "text-primary font-semibold bg-primary/5" : "text-slate-700"
                              )}
                            >
                              <span className="truncate">
                                {period.label} ({period.shortDateSpan})
                              </span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Reset & Apply */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      handleResetFilters();
                      setActiveFilterField(null);
                    }}
                    className="text-xs font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                  >
                    Đặt lại
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsFilterOpen(false);
                      setActiveFilterField(null);
                    }}
                    className="h-6.5 px-3 rounded bg-slate-900 text-xs font-medium text-white hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    Áp dụng
                  </button>
                </div>
              </div>
            )}

            {/* Mobile Filter Bottom Sheet Dialog (< 640px / sm:hidden) */}
            {isFilterOpen && (
              <div
                className="sm:hidden fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
                role="dialog"
                aria-modal="true"
                aria-label="Bộ lọc nâng cao"
              >
                <div
                  className="absolute inset-0"
                  onClick={() => setIsFilterOpen(false)}
                  aria-hidden="true"
                />
                <div className="relative z-10 w-full max-w-lg rounded-t-2xl border-t border-border/80 bg-card p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
                  <div className="mx-auto w-12 h-1.5 rounded-full bg-border/80 mb-1 shrink-0" aria-hidden="true" />
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <span className="text-base font-semibold text-foreground flex items-center gap-2">
                      <SlidersHorizontal className="size-4.5 text-primary" strokeWidth={1.5} />
                      Bộ lọc nâng cao
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="inline-flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                      aria-label="Đóng bảng bộ lọc"
                    >
                      <X className="size-5" strokeWidth={1.5} />
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Department */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Đơn vị phòng ban
                      </label>
                      <div className="relative">
                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" strokeWidth={1.5} />
                        <select
                          value={selectedDepartment}
                          onChange={(e) => onDepartmentChange?.(e.target.value)}
                          className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        >
                          {availableDepartments.map((dept) => (
                            <option key={dept.code} value={dept.code}>
                              {dept.name}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Month */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Tháng học kỳ ({academicYear})
                      </label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <select
                          value={effectiveMonth}
                          onChange={(e) =>
                            handleEffectiveMonthChange?.(
                              e.target.value === "ALL" ? "ALL" : Number(e.target.value)
                            )
                          }
                          className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        >
                          <option value="ALL">Cả năm học ({academicYear})</option>
                          {academicMonths.map((period) => (
                            <option key={period.monthNumber} value={period.monthNumber}>
                              {period.label} ({period.shortDateSpan})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Category */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Danh mục DACUM
                      </label>
                      <div className="relative">
                        <Layers className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <select
                          value={selectedCategory}
                          onChange={(e) => onCategoryChange?.(e.target.value)}
                          className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        >
                          {CATEGORY_FILTER_OPTIONS.map((cat) => (
                            <option key={cat.id} value={cat.id}>
                              {cat.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">
                        Mức độ ưu tiên
                      </label>
                      <div className="relative">
                        <AlertTriangle className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        <select
                          value={selectedPriority}
                          onChange={(e) => onPriorityChange?.(e.target.value)}
                          className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                        >
                          {PRIORITY_FILTER_OPTIONS.map((prio) => (
                            <option key={prio.id} value={prio.id}>
                              {prio.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                      </div>
                    </div>

                    {/* Sort option if onSort */}
                    {onSort && (
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">
                          Sắp xếp theo
                        </label>
                        <div className="relative">
                          <ArrowUpDown className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                          <select
                            value={`${sortField || "dueDate"}_${sortDirection || "asc"}`}
                            onChange={(e) => {
                              const [field] = e.target.value.split("_");
                              onSort(field);
                            }}
                            className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                          >
                            <option value="dueDate_asc">Hạn chót (Tăng dần - Sớm nhất)</option>
                            <option value="dueDate_desc">Hạn chót (Giảm dần - Muộn nhất)</option>
                            <option value="title_asc">Tên nhiệm vụ (A-Z)</option>
                            <option value="title_desc">Tên nhiệm vụ (Z-A)</option>
                            <option value="progress_desc">Tiến độ cao nhất</option>
                            <option value="progress_asc">Tiến độ thấp nhất</option>
                          </select>
                          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-border/60 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleResetFilters}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-border bg-muted/40 text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer active:scale-98"
                    >
                      <RotateCcw className="size-3.5 text-muted-foreground" />
                      <span>Đặt lại</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsFilterOpen(false)}
                      className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/95 transition-colors cursor-pointer active:scale-98"
                    >
                      Áp dụng
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2. Display / Presentation Options Popover (Hiển thị: Bảng / Kanban) */}
          {onViewModeChange && (
            <div className="relative" ref={displayMenuRef}>
              <button
                type="button"
                aria-label="Tùy chọn hiển thị"
                aria-expanded={isDisplayOpen}
                onClick={() => setIsDisplayOpen((prev) => !prev)}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors cursor-pointer touch-manipulation",
                  isDisplayOpen
                    ? "bg-slate-100 text-slate-900 font-semibold"
                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                )}
              >
                <SlidersHorizontal className="size-3.5 text-slate-400" strokeWidth={1.5} />
                <span>Hiển thị</span>
                <ChevronDown
                  className={cn("size-3 text-slate-400 transition-transform", isDisplayOpen && "rotate-180")}
                  strokeWidth={1.5}
                />
              </button>

              {/* Display Controls Dropdown Panel - Minimal Clean List */}
              <div
                className={cn(
                  "absolute right-0 top-full mt-1.5 z-50 w-40 rounded-md border border-slate-200/90 bg-white py-1 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100",
                  !isDisplayOpen && "hidden"
                )}
                role="dialog"
                aria-label="Tùy chọn hiển thị"
              >
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Hiển thị
                </div>
                <div className="h-px bg-slate-100 my-0.5" />
                <button
                  type="button"
                  onClick={() => {
                    onViewModeChange("table");
                    setIsDisplayOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer",
                    viewMode === "table"
                      ? "text-slate-900 font-semibold bg-slate-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <List className="size-3.5 text-slate-400" strokeWidth={1.5} />
                    <span>Bảng</span>
                  </div>
                  {viewMode === "table" && <Check className="size-3.5 text-slate-700" strokeWidth={2} />}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    onViewModeChange("kanban");
                    setIsDisplayOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-1.5 text-xs transition-colors text-left cursor-pointer",
                    viewMode === "kanban"
                      ? "text-slate-900 font-semibold bg-slate-50"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Kanban className="size-3.5 text-slate-400" strokeWidth={1.5} />
                    <span>Kanban</span>
                  </div>
                  {viewMode === "kanban" && <Check className="size-3.5 text-slate-700" strokeWidth={2} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips row removed to eliminate duplicate stacked banner with ActiveFilterBreadcrumb */}
    </div>
  );
}
