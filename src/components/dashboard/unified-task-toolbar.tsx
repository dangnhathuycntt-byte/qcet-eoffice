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
  SavedViewsSelector,
  type SavedViewsSelectorProps,
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
  const popoverRef = React.useRef<HTMLDivElement>(null);

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

  // 1. Authorized Scope Options (Only render authorized options, zero disabled buttons)
  const unitLabel = isUnassigned
    ? "Chưa chọn đơn vị"
    : user?.department || user?.departmentCode || "Đơn vị";

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
      isAuthorized: isExecutive,
    },
    {
      id: "unit",
      legacyId: "UNIT_TASKS",
      label: unitLabel,
      shortLabel: isUnassigned
        ? "Chưa chọn đ/vị"
        : user?.departmentCode || (unitLabel.length > 18 ? "Đơn vị" : unitLabel),
      icon: isUnassigned ? AlertTriangle : Building2,
      isAuthorized: isManager || Boolean(user?.departmentCode) || isUnassigned,
    },
    {
      id: "my",
      legacyId: "MY_TASKS",
      label: "Của tôi",
      shortLabel: "Của tôi",
      icon: User,
      isAuthorized: true,
    },
  ];

  // Only keep authorized scopes
  const authorizedScopes = scopeOptions.filter((opt) => opt.isAuthorized);

  // 2. Global "/" Keyboard Shortcut for Search Focus
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === "/" &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA" &&
        !(document.activeElement as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault();
        searchInputRef.current?.focus();
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
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsFilterOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen]);

  // Primary action callback
  const handlePrimaryAction = onNewTaskClick || onCreateTask || onAddTask;
  const primaryActionLabel = createButtonLabel || "+ Giao việc";

  // Scope badge counts fallback to tabCounts for scopes if badgeCounts is omitted
  const effectiveScopeBadgeCounts = badgeCounts || {
    school: tabCounts?.all ?? totalTasksCount,
    unit: tabCounts?.unit,
    my: tabCounts?.my ?? tabCounts?.my_tasks,
  };

  // Count active advanced filters
  const activeAdvancedFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedCategory && selectedCategory !== "ALL") count++;
    if (selectedPriority && selectedPriority !== "ALL") count++;
    if (effectiveMonth !== undefined && effectiveMonth !== "ALL") count++;
    return count;
  }, [selectedDepartment, selectedCategory, selectedPriority, effectiveMonth]);

  // 4. Smart Filter Pills configuration ('Của tôi' strictly purged; exists exclusively in ScopeSwitcher)
  const smartFilterPills: SmartFilterPill[] = [
    {
      id: "all",
      label: "Tất cả",
      count: tabCounts?.all ?? totalTasksCount,
    },
    {
      id: "waiting_approval",
      label: "Chờ duyệt",
      count: tabCounts?.waiting_approval ?? tabCounts?.review,
    },
    ...(tabCounts?.pending_submission !== undefined && tabCounts.pending_submission > 0
      ? [
          {
            id: "pending_submission",
            label: "Chờ nộp BC",
            count: tabCounts.pending_submission,
          },
        ]
      : []),
    {
      id: "overdue",
      label: "Quá hạn",
      count: tabCounts?.overdue,
    },
    {
      id: "today",
      label: "Hôm nay",
      count: tabCounts?.today,
    },
  ];

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
        "flex flex-col gap-2.5 rounded-2xl border border-border/70 bg-card p-3 shadow-xs",
        className
      )}
    >
      {/* ==================================================================== */}
      {/* ROW 1: Scope Switcher, Search Input, and Primary Action Button       */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-1"
        className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Left: Scope Switcher (Only Authorized Scopes) */}
        <div
          data-slot="adaptive-scope-header"
          data-scope-switcher="true"
          className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-1 shadow-2xs shrink-0"
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
                  "inline-flex min-h-[44px] sm:min-h-[34px] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all cursor-pointer select-none",
                  isActive
                    ? opt.id === "school"
                      ? "bg-amber-50 text-amber-900 border border-amber-300 font-semibold shadow-2xs"
                      : opt.id === "unit"
                      ? "bg-blue-50 text-blue-900 border border-blue-300 font-semibold shadow-2xs"
                      : "bg-emerald-50 text-emerald-900 border border-emerald-300 font-semibold shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                )}
              >
                <Icon className="size-3.5 shrink-0" strokeWidth={1.5} />
                <span className="hidden sm:inline">{opt.label}</span>
                <span className="sm:hidden">{opt.shortLabel}</span>

                {typeof count === "number" && count > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-xs font-mono tabular-nums font-semibold",
                      isActive ? "bg-card/90 text-foreground" : "bg-muted text-muted-foreground"
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Center: Search Input Bar with "/" Keyboard Shortcut (min 44px on mobile) */}
        <div className="relative flex-1 min-w-[200px] max-w-xl">
          <Search
            className="size-4 sm:size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            strokeWidth={1.5}
          />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            aria-label="Tìm nhiệm vụ"
            className="h-11 sm:h-9 min-h-[44px] sm:min-h-[36px] w-full rounded-xl border border-border/80 bg-background pl-9 pr-14 text-xs sm:text-xs text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs transition-colors"
          />

          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {loading && (
              <Loader2
                className="size-3.5 animate-spin text-muted-foreground"
                aria-label="Đang tải dữ liệu"
              />
            )}
            {searchQuery ? (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                aria-label="Xóa từ khóa tìm kiếm"
                className="min-h-[36px] min-w-[36px] flex items-center justify-center text-muted-foreground hover:text-foreground p-1 sm:p-0.5 rounded cursor-pointer touch-manipulation"
              >
                <X className="size-4 sm:size-3.5" strokeWidth={1.5} />
              </button>
            ) : (
              <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs font-mono font-medium text-muted-foreground bg-muted border border-border/80 rounded select-none pointer-events-none">
                /
              </kbd>
            )}
          </div>
        </div>

        {/* Right: Primary Action Button */}
        {canCreateTask && handlePrimaryAction && (
          <button
            type="button"
            onClick={() => handlePrimaryAction()}
            className="inline-flex h-9 min-h-[44px] sm:min-h-[36px] items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 cursor-pointer shrink-0"
          >
            <Plus className="size-3.5 shrink-0" strokeWidth={1.5} />
            <span>{primaryActionLabel}</span>
          </button>
        )}
      </div>

      {/* Optional Academic Month Pills (Rendered when monthlyTaskCounts provided or explicitly requested) */}
      {(showAcademicMonthBar || Boolean(monthlyTaskCounts) || (selectedAcademicMonth !== undefined && academicYear !== undefined)) && (
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
      {/* ROW 2: Smart Filter Pills + Controls (Popover, View, Density)        */}
      {/* ==================================================================== */}
      <div
        data-slot="unified-task-toolbar-row-2"
        className="flex flex-col gap-2 pt-1 border-t border-border/50 sm:flex-row sm:items-center sm:justify-between"
      >
        {/* Left: Smart Filter Pills */}
        <div
          className="inline-flex items-center gap-1 overflow-x-auto overscroll-x-contain py-0.5 scrollbar-none"
          role="tablist"
          aria-label="Lọc nhanh trạng thái nhiệm vụ"
        >
          {smartFilterPills.map((pill) => {
            const isActive =
              activeTab === pill.id ||
              (pill.id === "all" &&
                (!activeTab || activeTab === "all" || activeTab === "my" || activeTab === "my_tasks")) ||
              (pill.id === "waiting_approval" &&
                (activeTab === "review" ||
                  activeTab === "waiting_approval" ||
                  activeTab === "my_pending_approval")) ||
              (pill.id === "pending_submission" &&
                (activeTab === "pending_submission" ||
                  activeTab === "my_pending_submission"));

            return (
              <button
                key={pill.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => onTabChange?.(pill.id)}
                className={cn(
                  "inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-1.5 rounded-xl px-3 sm:px-2.5 text-xs font-medium transition-all cursor-pointer select-none whitespace-nowrap touch-manipulation active:scale-95",
                  isActive
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/60"
                )}
              >
                <span>{pill.label}</span>
                {typeof pill.count === "number" && (
                  <span
                    className={cn(
                      "inline-flex items-center justify-center rounded-full px-1.5 py-0.2 text-xs font-mono tabular-nums font-semibold",
                      isActive
                        ? "bg-primary-foreground/20 text-primary-foreground"
                        : "bg-card text-muted-foreground border border-border/50"
                    )}
                  >
                    {pill.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Right: Advanced Filter Popover + View Switcher + Density Selector */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0 relative">
          {/* Quick Sort button for mobile */}
          {onSort && (
            <button
              type="button"
              onClick={() => {
                const nextSort =
                  sortField === "dueDate"
                    ? "title"
                    : sortField === "title"
                    ? "progress"
                    : "dueDate";
                onSort(nextSort);
              }}
              className="sm:hidden inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border/80 bg-background px-3 text-xs font-medium text-foreground hover:bg-muted/50 cursor-pointer shadow-2xs touch-manipulation active:scale-95"
              aria-label="Sắp xếp danh sách"
            >
              <ArrowUpDown className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>
                {sortField === "dueDate"
                  ? "Hạn"
                  : sortField === "title"
                  ? "Tên"
                  : sortField === "progress"
                  ? "Tiến độ"
                  : "Sắp xếp"}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {sortDirection === "asc" ? "▲" : "▼"}
              </span>
            </button>
          )}

          {/* Saved Views Selector (Role Presets & Custom Views) */}
          {showSavedViews && (
            <SavedViewsSelector
              user={user}
              activeViewId={activeViewId}
              onSelectView={onSelectView}
              currentCriteria={effectiveCriteria}
              onSaveView={onSaveView}
              onDeleteView={onDeleteView}
              onRenameView={onRenameView}
            />
          )}

          {/* 1. Advanced Filter Popover Trigger */}
          <div className="relative" ref={popoverRef}>
            <button
              type="button"
              aria-label="Bộ lọc nâng cao"
              aria-expanded={isFilterOpen}
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-1.5 rounded-xl border border-border/80 px-3 sm:px-2.5 text-xs font-medium transition-all cursor-pointer shadow-2xs touch-manipulation active:scale-95",
                isFilterOpen || activeAdvancedFilterCount > 0
                  ? "bg-primary/10 text-primary border-primary/40 font-semibold"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Filter className="size-3.5" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="inline-flex min-w-4.5 h-4.5 px-1 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground font-mono tabular-nums">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Desktop Popover Dropdown Panel (sm:block) */}
            {isFilterOpen && (
              <div
                className="hidden sm:block absolute right-0 top-full mt-1.5 z-50 w-72 rounded-2xl border border-border/80 bg-card p-4 shadow-lg animate-in fade-in-0 zoom-in-95 duration-100"
                role="dialog"
                aria-label="Bộ lọc nâng cao"
              >
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-border/60">
                  <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Filter className="size-3.5 text-primary" strokeWidth={1.5} />
                    Bộ lọc nâng cao
                  </span>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    aria-label="Đóng bộ lọc"
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3.5" strokeWidth={1.5} />
                  </button>
                </div>

                <div className="space-y-3">
                  {/* Department Select */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Đơn vị phòng ban
                    </label>
                    <select
                      value={selectedDepartment}
                      onChange={(e) => onDepartmentChange?.(e.target.value)}
                      aria-label="Lọc theo đơn vị phòng ban"
                      className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      {availableDepartments.map((dept) => (
                        <option key={dept.code} value={dept.code}>
                          {dept.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Category Select */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Danh mục DACUM
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => onCategoryChange?.(e.target.value)}
                      aria-label="Lọc theo danh mục DACUM"
                      className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      {CATEGORY_FILTER_OPTIONS.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {cat.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Priority Select */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Mức độ ưu tiên
                    </label>
                    <select
                      value={selectedPriority}
                      onChange={(e) => onPriorityChange?.(e.target.value)}
                      aria-label="Lọc theo mức độ ưu tiên"
                      className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      {PRIORITY_FILTER_OPTIONS.map((prio) => (
                        <option key={prio.id} value={prio.id}>
                          {prio.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Month Select */}
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Tháng học kỳ ({academicYear})
                    </label>
                    <select
                      value={effectiveMonth}
                      onChange={(e) =>
                        handleEffectiveMonthChange?.(
                          e.target.value === "ALL" ? "ALL" : Number(e.target.value)
                        )
                      }
                      aria-label="Lọc theo tháng học kỳ"
                      className="w-full rounded-lg border border-border/80 bg-background px-2.5 py-1.5 text-xs text-foreground font-medium outline-none focus:border-primary cursor-pointer"
                    >
                      <option value="ALL">Cả năm học ({academicYear})</option>
                      {academicMonths.map((period) => (
                        <option key={period.monthNumber} value={period.monthNumber}>
                          {period.label} ({period.shortDateSpan})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Reset Action */}
                <div className="mt-4 pt-2.5 border-t border-border/60 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleResetFilters}
                    className="text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer underline-offset-2 hover:underline"
                  >
                    Đặt lại bộ lọc
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFilterOpen(false)}
                    className="inline-flex h-7 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary/90 cursor-pointer"
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
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

          {/* 2. View Switcher [Bảng | Kanban] */}
          {onViewModeChange && (
            <div
              className="inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shadow-2xs"
              role="group"
              aria-label="Chế độ xem không gian làm việc"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                aria-pressed={viewMode === "table"}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all cursor-pointer select-none",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng Bảng danh sách"
              >
                <List className="size-3.5" strokeWidth={1.5} />
                <span className="hidden md:inline">Bảng</span>
              </button>

              <button
                type="button"
                onClick={() => onViewModeChange("kanban")}
                aria-pressed={viewMode === "kanban"}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition-all cursor-pointer select-none",
                  viewMode === "kanban"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Xem dạng Kanban"
              >
                <Kanban className="size-3.5" strokeWidth={1.5} />
                <span className="hidden md:inline">Kanban</span>
              </button>
            </div>
          )}

          {/* 3. Density Selector [Gọn | Chuẩn] (Desktop Only) */}
          {onDensityChange && (
            <div
              className="hidden sm:inline-flex items-center rounded-xl border border-border/80 bg-muted/40 p-0.5 shadow-2xs"
              role="group"
              aria-label="Mật độ hiển thị bảng"
            >
              <button
                type="button"
                onClick={() => onDensityChange("compact")}
                aria-pressed={density === "compact"}
                aria-label="Chế độ hiển thị gọn"
                className={cn(
                  "inline-flex h-7 items-center rounded-lg px-2 text-xs font-medium transition-all cursor-pointer select-none",
                  density === "compact"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Hiển thị gọn (Compact)"
              >
                <span>Gọn</span>
              </button>

              <button
                type="button"
                onClick={() => onDensityChange("comfortable")}
                aria-pressed={density === "comfortable"}
                aria-label="Chế độ hiển thị tiêu chuẩn"
                className={cn(
                  "inline-flex h-7 items-center rounded-lg px-2 text-xs font-medium transition-all cursor-pointer select-none",
                  density === "comfortable"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title="Hiển thị tiêu chuẩn (Comfortable)"
              >
                <span>Chuẩn</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
