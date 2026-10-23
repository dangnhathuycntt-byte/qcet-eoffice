"use client";

// Unified Task Toolbar Component — Unified control toolbar for task views
import * as React from "react";
import { Plus, RotateCcw } from "lucide-react";
import {
  HealthSubOnTrack,
  HealthSubAtRisk,
  HealthSubOverdue,
  HealthSubCompleted,
  FilterIconStatus,
  FilterIconPriority,
  FilterIconProgress,
  FilterIconLead,
  FilterIconCollaborator,
  FilterIconDeadline,
} from "./task-filter-icons";
import type { TaskView } from "@qcet/shared/domain/tasks";
import { cn } from "@/lib/utils";
import { MENU_POPUP_CLASS, MENU_ROW_CLASS } from "@/components/ui/menu";
import { TaskStatusCircle } from "@/components/tasks/task-status-circle";
import {
  TaskIconAssignee,
  TaskIconDepartment,
  TaskIconDeadline,
  TaskIconTime,
  TaskIconStatusNew,
} from "@qcet/shared/lib/icons/task-icons";
import { VietnameseDayCalendar } from "@/components/ui/vietnamese-day-calendar";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/ui/user-avatar";
import { PrioritySignalBars } from "@/components/tasks/priority-signal-bars";
import { foldVietnamese } from "@qcet/shared/lib/search/vietnamese-search";
import {
  parsePersonFilter,
  PERSON_FILTER_ME,
  PERSON_FILTER_NONE,
  type FilterPersonOption,
  type TaskFilterFacetKey,
  type TaskFilterFacets,
} from "@qcet/shared/domain/tasks/task-filter-facets";
import { ListToolbarFilterButton, ListToolbarSearchToggle, listToolbarPrimaryButtonClass } from "@/components/ui/list-toolbar";
import { ListPageCreateButton, ListPageHeader } from "@/components/workspace/list-page-header";
import {
  NO_TASK_TIME_FILTER,
  getTaskTimeFilterLabel,
  type TaskTimeFilter,
} from "@/lib/task-time-filter";
import type { AuthUser } from "@qcet/contracts/types/auth";
import type { SchoolTask } from "@qcet/contracts/types/dashboard";
import { isUserUnassignedDepartment } from "@/lib/auth-context";
import {
  getAcademicMonthsForYear,
  getAcademicYear,
  getSystemReferenceDate,
} from "@qcet/shared/lib/academic-calendar";
import { isAdminTierUser } from "@/lib/role-task-filter";
import type { TaskScope, TaskViewMode } from "@/lib/unified-task-hub";
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

export type WorkspaceScope = "school" | "unit" | "my";
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
  /** View đang chọn trống khi chưa lọc gì: giữ các view để chuyển, ẩn tìm kiếm, bộ lọc và tùy chọn hiển thị. */
  hideListControls?: boolean;
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

  selectedCollaborator?: string | null;
  onCollaboratorChange?: (collaborator: string | null) => void;

  /** Người chủ trì: token `me`, `none` hoặc khóa người (xem `task-filter-facets`) */
  selectedLead?: string | null;
  onLeadChange?: (lead: string | null) => void;
  /** Danh sách người và số đếm cho menu lọc (tính ở workspace bằng chính hàm lọc của bảng) */
  filterFacets?: TaskFilterFacets;

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
  { id: "NONE", label: "Không ưu tiên" },
  { id: "URGENT", label: "Khẩn cấp" },
  { id: "HIGH", label: "Cao" },
  { id: "NORMAL", label: "Bình thường" },
  { id: "LOW", label: "Thấp" },
];

/** Số giá trị đang lọc của một nhóm (0 khi đang là "Tất cả"). */
function countFilterValues(raw: string | undefined | null, allToken: string): number {
  if (!raw) return 0;
  return raw.split(",").map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== allToken.toLowerCase()).length;
}

/** Giá trị đang chọn của một nhóm lọc nhiều lựa chọn, bỏ token "tất cả" */
function splitFilterTokens(raw: string | undefined | null, allToken: string): string[] {
  if (!raw) return [];
  return raw.split(",").map((v) => v.trim()).filter((v) => v && v.toLowerCase() !== allToken.toLowerCase());
}

/** Bật/tắt một lựa chọn; bỏ hết thì trả `null` (không lọc nhóm này) */
function toggleFilterToken(selectedList: string[], value: string): string | null {
  const next = selectedList.includes(value) ? selectedList.filter((v) => v !== value) : [...selectedList, value];
  return next.length > 0 ? next.join(",") : null;
}

const STATUS_FILTER_ALIASES: Record<string, string[]> = {
  new: ["new", "not_started", "assigned"],
  waiting_approval: ["waiting_approval", "review", "pending_executive_approval", "needs_review"],
  review: ["waiting_approval", "review", "pending_executive_approval", "needs_review"],
};

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

/**
 * Menu con lọc theo người (kiểu Linear): ô tìm ở đầu, "Tôi", "chưa có ai", rồi từng người kèm avatar và số nhiệm vụ.
 * Chọn nhiều người (HOẶC); đang chọn = nền accent + chữ đậm. Bỏ hết thì không lọc nhóm này.
 */
function PersonFilterOptions({
  facet,
  value,
  onChange,
  people,
  counts,
  viewer,
  noneLabel,
  searchLabel,
}: {
  facet: "lead" | "collaborator";
  value?: string | null;
  onChange: (next: string | null) => void;
  people: FilterPersonOption[];
  counts?: Record<string, number>;
  viewer?: AuthUser | null;
  noneLabel: string;
  searchLabel: string;
}) {
  const [query, setQuery] = React.useState("");
  const selected = parsePersonFilter(value);
  const toggle = (token: string) => onChange(toggleFilterToken(selected, token));
  const q = foldVietnamese(query.trim());
  const matches = (name: string) => !q || foldVietnamese(name).includes(q);
  const visiblePeople = people.filter((person) => matches(person.name));
  const showMe = Boolean(viewer) && matches(`Tôi ${viewer?.name ?? ""}`);
  const showNone = matches(noneLabel);

  return (
    <div data-slot={`person-filter-${facet}`}>
      <Input
        variant="menu"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        // Không để menu bắt phím gõ (typeahead); mũi tên, Esc, Enter vẫn điều hướng menu
        onKeyDown={(e) => {
          if (!["ArrowDown", "ArrowUp", "Escape", "Enter", "Tab"].includes(e.key)) e.stopPropagation();
        }}
        placeholder="Tìm người…"
        aria-label={searchLabel}
        className="mb-1 border-b border-border/60"
      />
      <div className="max-h-72 space-y-px overflow-y-auto">
        {showMe && viewer ? (
          <MenuOptionItem
            onClick={() => toggle(PERSON_FILTER_ME)}
            selected={selected.includes(PERSON_FILTER_ME)}
            hint={counts?.[PERSON_FILTER_ME]}
            leading={<UserAvatar name={viewer.name} avatarUrl={viewer.avatar} size="sm" />}
          >
            Tôi
          </MenuOptionItem>
        ) : null}
        {showNone ? (
          <MenuOptionItem
            onClick={() => toggle(PERSON_FILTER_NONE)}
            selected={selected.includes(PERSON_FILTER_NONE)}
            hint={counts?.[PERSON_FILTER_NONE]}
            leading={<TaskIconStatusNew className="size-4 text-muted-foreground" />}
          >
            {noneLabel}
          </MenuOptionItem>
        ) : null}
        {visiblePeople.length > 0 && (showMe || showNone) ? <MenuSeparator /> : null}
        {visiblePeople.map((person) => (
          <MenuOptionItem
            key={person.key}
            onClick={() => toggle(person.key)}
            selected={selected.includes(person.key)}
            hint={counts?.[person.key]}
            title={person.name}
            leading={<UserAvatar name={person.name} avatarUrl={person.avatarUrl} size="sm" />}
          >
            {person.name}
          </MenuOptionItem>
        ))}
        {!showMe && !showNone && visiblePeople.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Không tìm thấy người phù hợp</div>
        ) : null}
      </div>
    </div>
  );
}

export function UnifiedTaskToolbar({
  quiet = false,
  hideListControls = false,
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
  selectedCollaborator: propSelectedCollaborator,
  onCollaboratorChange,
  selectedLead = null,
  onLeadChange,
  filterFacets,
  selectedAcademicMonth = "ALL",
  onAcademicMonthChange,
  selectedMonth,
  onMonthChange,
  selectedTimeFilter,
  onTimeFilterChange,
  // Mặc định năm học của hôm nay (giờ Việt Nam), trùng với năm học mà bộ lọc tháng dùng để khớp hạn
  academicYear = getAcademicYear(getSystemReferenceDate()),
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
  const [internalHealth, setInternalHealth] = React.useState<string | null>(null);
  const selectedHealth = propSelectedHealth !== undefined ? propSelectedHealth : internalHealth;
  const handleHealthChange = React.useCallback((val: string | null) => {
    if (onHealthChange) onHealthChange(val);
    else setInternalHealth(val);
  }, [onHealthChange]);

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
      : userRole === "ADMIN" || isAdminTierUser(user);
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

  const deadlineOptions = [
    { value: "overdue", label: "Trễ hạn" },
    { value: "today", label: "Đến hạn hôm nay" },
    { value: "this_week", label: "Trong tuần này" },
  ];
  /** Số nhiệm vụ của một lựa chọn (đã tính ở workspace); không có dữ liệu thì không hiện */
  const facetHint = (facet: TaskFilterFacetKey, value: string) => filterFacets?.counts[facet]?.[value];

  const isMonthActive = effectiveTimeFilter.kind !== "none";
  const isStatusActive = Boolean(effectiveStatus && effectiveStatus.toLowerCase() !== "all");
  const isDeadlineActive = Boolean(effectiveDeadline && effectiveDeadline !== "all");
  const isPriorityActive = Boolean(selectedPriority && selectedPriority !== "ALL");
  const isHealthActive = Boolean(selectedHealth && selectedHealth !== "all");
  const isLeadActive = parsePersonFilter(selectedLead).length > 0;
  const isCollaboratorActive = parsePersonFilter(selectedCollaborator).length > 0;
  const activeFilterCount = [
    isStatusActive,
    isPriorityActive,
    isDeadlineActive,
    isMonthActive,
    isHealthActive,
    isLeadActive,
    isCollaboratorActive,
  ].filter(Boolean).length;

  // Lưới "Kỳ tháng" chia theo năm dương lịch của năm học: T9–T12 năm đầu, T1–T8 năm sau (khớp `matchesDueDate`)
  const academicMonthGroups = React.useMemo(() => {
    const startYear = Number(academicYear.slice(0, 4));
    return [
      { year: startYear, months: [9, 10, 11, 12] },
      { year: startYear + 1, months: [1, 2, 3, 4, 5, 6, 7, 8] },
    ];
  }, [academicYear]);
  const currentMonthKey = getSystemReferenceDate().slice(0, 7);

  // Reset all filters (Only clears supplementary filters, retains Scope & User Department)
  const handleResetFilters = () => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    setLocalSearch("");
    onLeadChange?.(null);
    handleHealthChange(null);
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

    // 2. Nhóm nhân sự (người trong phạm vi đang xem)
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
  ], [
    isStatusActive,
    isPriorityActive,
    isLeadActive,
    isCollaboratorActive,
    isDeadlineActive,
    isMonthActive,
    isHealthActive,
  ]);

  const renderCategorySubmenuItems = (categoryKey: string) => {
    switch (categoryKey) {
      case "status": {
        const selectedList = splitFilterTokens(effectiveStatus, "all");
        return (
          <div className="space-y-px">
            {statusOptions.map((opt) => {
              const aliases = STATUS_FILTER_ALIASES[opt.value] ?? [opt.value];
              const selected = aliases.some((alias) => selectedList.includes(alias));
              const handleToggle = () => {
                const next = selected
                  ? selectedList.filter((value) => !aliases.includes(value))
                  : [...selectedList, opt.value];
                const nextStr = next.length > 0 ? next.join(",") : "all";
                if (onStatusChange) onStatusChange(nextStr);
                else onTabChange?.(nextStr);
              };
              return (
                <MenuOptionItem
                  key={opt.value}
                  onClick={handleToggle}
                  selected={selected}
                  hint={facetHint("status", opt.value)}
                  leading={
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
                  }
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}
          </div>
        );
      }
      case "priority": {
        const selectedList = splitFilterTokens(selectedPriority, "ALL").map((p) => p.toUpperCase());
        return (
          <div className="space-y-px">
            {PRIORITY_FILTER_OPTIONS.filter((opt) => opt.id !== "ALL").map((opt) => (
              <MenuOptionItem
                key={opt.id}
                onClick={() => onPriorityChange?.(toggleFilterToken(selectedList, opt.id) ?? "ALL")}
                selected={selectedList.includes(opt.id)}
                hint={facetHint("priority", opt.id)}
                leading={<PrioritySignalBars priority={opt.id} />}
              >
                {opt.label}
              </MenuOptionItem>
            ))}
          </div>
        );
      }
      case "lead":
        return (
          <PersonFilterOptions
            facet="lead"
            value={selectedLead}
            onChange={(next) => onLeadChange?.(next)}
            people={filterFacets?.leadPeople ?? []}
            counts={filterFacets?.counts.lead}
            viewer={user}
            noneLabel="Chưa có người chủ trì"
            searchLabel="Tìm người chủ trì"
          />
        );
      case "collaborator":
        return (
          <PersonFilterOptions
            facet="collaborator"
            value={selectedCollaborator}
            onChange={handleCollaboratorChange}
            people={filterFacets?.collaboratorPeople ?? []}
            counts={filterFacets?.counts.collaborator}
            viewer={user}
            noneLabel="Không có người phối hợp"
            searchLabel="Tìm người phối hợp"
          />
        );
      case "dates": {
        // Hạn theo mốc (chọn một; bấm lại để bỏ), rồi Kỳ tháng và Chọn ngày khác ở cấp 3
        return (
          <div className="space-y-px">
            {deadlineOptions.map((opt) => {
              const selected = effectiveDeadline === opt.value;
              return (
                <MenuOptionItem
                  key={opt.value}
                  selected={selected}
                  hint={facetHint("deadline", opt.value)}
                  onClick={() => {
                    const next = selected ? "all" : opt.value;
                    if (onDeadlineChange) onDeadlineChange(next);
                    else onTabChange?.(next);
                  }}
                >
                  {opt.label}
                </MenuOptionItem>
              );
            })}

            <MenuSeparator />

            <MenuSubmenu
              icon={<TaskIconTime className="size-4 text-muted-foreground" />}
              label="Kỳ tháng"
              hint={effectiveTimeFilter.kind === "month" ? `T${effectiveTimeFilter.month}` : undefined}
              title={`Năm học ${academicYear}`}
            >
              {academicMonthGroups.map((group) => (
                <div key={group.year} role="group" aria-label={`Năm ${group.year}`}>
                  <div className="px-2 pt-1 pb-1 text-xs text-muted-foreground tabular-nums select-none" aria-hidden="true">
                    {group.year}
                  </div>
                  <div className="grid grid-cols-4 gap-0.5">
                    {group.months.map((month) => {
                      const selected = effectiveTimeFilter.kind === "month" && effectiveTimeFilter.month === month;
                      // Tháng hiện tại: chữ màu chính (khác nền accent của tháng đang chọn)
                      const isCurrent = currentMonthKey === `${group.year}-${String(month).padStart(2, "0")}`;
                      const label = `Tháng ${month}/${group.year}${isCurrent ? " (tháng này)" : ""}`;
                      return (
                        <MenuItem
                          key={month}
                          closeOnClick={false}
                          aria-current={selected ? "true" : undefined}
                          aria-label={label}
                          title={label}
                          onClick={() => handleTimeFilterChange(selected ? NO_TASK_TIME_FILTER : { kind: "month", month })}
                          className={cn(
                            MENU_ROW_CLASS,
                            "justify-center px-0 tabular-nums",
                            isCurrent && "font-medium text-primary",
                            selected && "bg-accent font-medium"
                          )}
                        >
                          T{month}
                        </MenuItem>
                      );
                    })}
                  </div>
                </div>
              ))}
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
          { value: "on_track", label: "Đúng tiến độ", icon: HealthSubOnTrack },
          { value: "at_risk", label: "Sắp tới hạn (≤ 7 ngày)", icon: HealthSubAtRisk },
          { value: "overdue", label: "Trễ hạn", icon: HealthSubOverdue },
          { value: "completed", label: "Hoàn thành", icon: HealthSubCompleted },
        ];
        const selectedList = splitFilterTokens(selectedHealth, "all").map((h) => h.toLowerCase());
        return (
          <div className="space-y-px">
            {healthOptions.map((opt) => (
              <MenuOptionItem
                key={opt.value}
                onClick={() => handleHealthChange(toggleFilterToken(selectedList, opt.value))}
                selected={selectedList.includes(opt.value)}
                hint={facetHint("health", opt.value)}
                leading={<opt.icon className="size-4 text-muted-foreground" />}
              >
                {opt.label}
              </MenuOptionItem>
            ))}
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
      case "lead": return parsePersonFilter(selectedLead).length;
      case "collaborator": return parsePersonFilter(selectedCollaborator).length;
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
        popupClassName={
          category.key === "dates" ? "min-w-[232px]" : category.key === "lead" || category.key === "collaborator" ? "w-60" : undefined
        }
      >
        {renderCategorySubmenuItems(category.key)}
      </MenuSubmenu>
    );
  };

  const createCta = (leftContent || !onScopeChange) && canCreateTask && handlePrimaryAction ? (
    <ListPageCreateButton label={primaryActionLabel} ariaLabel="Tạo việc mới" onClick={() => handlePrimaryAction()} />
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
                        ? "bg-selected text-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                    <span>{tab.label}</span>
                    {showBadge && (
                      <span
                        data-slot="scope-badge-count"
                        data-scope={tab.id}
                        className={cn(
                          "inline-flex items-center justify-center rounded px-1.5 py-0.2 text-xs font-mono tabular-nums font-semibold",
                          isActive
                            ? "bg-background text-foreground border border-border/60 shadow-low"
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
              data-slot="list-toolbar-create"
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
        <ListPageHeader title={leftContent} action={createCta} />
      )}

      {!quiet && (
        <div className="flex h-11 w-full min-w-0 items-center gap-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-2 overflow-x-auto overflow-y-hidden no-scrollbar py-0.5">{viewTabs}</div>
      {!hideListControls && (
        <>
      {/* 1. Search: icon thu gọn, bấm hoặc nhấn "/" để mở ô */}
      <ListToolbarSearchToggle
        ref={searchInputRef}
        open={isSearchOpen}
        onOpenChange={setIsSearchOpen}
        label="Tìm nhiệm vụ"
        value={localSearch}
        onChange={handleSearchInputChange}
        onClear={handleSearchClear}
        loading={loading}
        placeholder="Tìm nhiệm vụ…"
      />

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
              className={cn(MENU_POPUP_CLASS, "w-56", SHEET_POPUP_CLASS)}
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
        </>
      )}

        </div>
      )}

      {!leftContent && createCta}
    </div>
  );
}
