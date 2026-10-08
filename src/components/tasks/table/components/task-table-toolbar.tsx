"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import {
  Search,
  X,
  Building2,
  Calendar,
  Layers,
  Rows3,
  Rows4,
  List,
  Kanban,
  Plus,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
  Filter,
  RotateCcw,
  SlidersHorizontal,
  ArrowUpDown,
  Check,
} from "lucide-react";
import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORY_TABS,
  DEPARTMENT_OPTIONS,
  SMART_FILTER_TABS,
} from "../constants";

export const DISPLAY_PROPERTY_OPTIONS: Array<{
  id: keyof TableColumnVisibility;
  label: string;
}> = [
  // Thứ tự khớp thứ tự cột trên bảng: ô Nhiệm vụ (mã, việc con, danh mục) → mức độ → người → đơn vị → thời gian → trạng thái, tiến độ
  { id: "code", label: "Mã" },
  { id: "subtasks", label: "Việc con" },
  { id: "category", label: "Danh mục" },
  { id: "priority", label: "Ưu tiên" },
  { id: "leadAssignee", label: "Phụ trách" },
  { id: "coAssignees", label: "Phối hợp" },
  { id: "department", label: "Đơn vị" },
  { id: "dueDate", label: "Hạn" },
  { id: "createdAt", label: "Ngày tạo" },
  { id: "status", label: "Trạng thái" },
  { id: "progress", label: "Tiến độ" },
];

export const DEFAULT_DISPLAY_PROPERTIES: TableColumnVisibility = {
  code: false,
  department: true,
  priority: true,
  leadAssignee: true,
  dueDate: true,
  subtasks: true,
  progress: true,
  coAssignees: true,
  status: false,
  createdAt: false,
  category: false,
};
import { isInputElement } from "../hooks/use-task-keyboard-nav";
import type {
  CategoryTab,
  DepartmentOption,
  SmartFilterTab,
  SmartFilterTabOption,
  TableDensity,
  TableColumnVisibility,
  TaskViewMode,
  TaskSortField,
  SortDirection,
} from "../types";
import { getSystemReferenceDate } from "../utils/table-date-helpers";
import {
  isTaskAssignedToUser,
  isTaskOrSubtaskDueToday,
  isTaskOrSubtaskOverdue,
  isTaskOrSubtaskPendingReview,
} from "../utils/table-filter-engine";
import {
  filterTasksByAcademicMonthStrict,
  ACADEMIC_MONTH_ORDER,
  getAcademicMonthInfo,
} from "@/lib/academic-calendar";

/**
 * Kiểm tra xem phím tắt có phải là shortcut tìm kiếm (/ hoặc Cmd+K / Ctrl+K) hay không
 */
export function isSearchShortcut(e: {
  key: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  target?: unknown;
}): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key?.toLowerCase() === "k") {
    return true;
  }
  if (e.key === "/" && !isInputElement(e.target)) {
    return true;
  }
  return false;
}

/**
 * Tổng hợp số lượng công việc theo từng thẻ lọc thông minh (Smart Filter Tabs)
 */
export function aggregateFilterCounts(
  tasks: SchoolTask[],
  options?: {
    currentUserId?: string;
    currentUserName?: string;
    referenceDate?: string | Date;
    month?: number | "ALL";
    academicYear?: string;
  }
): Record<SmartFilterTab, number> {
  const refDate = options?.referenceDate || getSystemReferenceDate();
  const sourceTasks =
    options?.month !== undefined &&
    options?.month !== "ALL" &&
    typeof options.month === "number"
      ? filterTasksByAcademicMonthStrict(tasks, options.month, options.academicYear)
      : tasks;

  const counts: Record<SmartFilterTab, number> = {
    all: sourceTasks.length,
    my_tasks: 0,
    overdue: 0,
    review: 0,
    today: 0,
    in_progress: 0,
    completed: 0,
  };

  for (const task of sourceTasks) {
    if (
      isTaskAssignedToUser(
        task,
        options?.currentUserId,
        options?.currentUserName
      )
    ) {
      counts.my_tasks++;
    }
    if (isTaskOrSubtaskOverdue(task, refDate)) {
      counts.overdue++;
    }
    if (isTaskOrSubtaskPendingReview(task)) {
      counts.review++;
    }
    if (isTaskOrSubtaskDueToday(task, refDate)) {
      counts.today++;
    }
    if (task.status === "IN_PROGRESS") {
      counts.in_progress++;
    }
    if (task.status === "COMPLETED") {
      counts.completed++;
    }
  }

  return counts;
}

export interface TaskTableToolbarProps {
  // Tìm kiếm
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder?: string;
  debounceMs?: number;

  // Thẻ lọc thông minh (Pills)
  activeTab: SmartFilterTab;
  onTabChange: (tab: SmartFilterTab) => void;
  pillCounts?: Partial<Record<SmartFilterTab, number>>;
  tasks?: SchoolTask[];
  availableTabs?: SmartFilterTabOption[];

  // Bộ lọc Kỳ học / Tháng vận hành (Academic Month)
  selectedAcademicMonth?: number | "ALL";
  onAcademicMonthChange?: (month: number | "ALL") => void;
  selectedMonth?: number | "ALL";
  onMonthChange?: (month: number | "ALL") => void;

  // Bộ lọc Dropdown
  selectedDepartment?: string;
  onDepartmentChange?: (department: string) => void;
  departmentOptions?: DepartmentOption[];

  selectedCategory?: TaskCategory | "ALL" | string;
  onCategoryChange?: (category: TaskCategory | "ALL") => void;
  categoryOptions?: CategoryTab[];

  // Mật độ và Chế độ hiển thị
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  visibleColumns?: TableColumnVisibility;
  onVisibleColumnsChange?: (cols: TableColumnVisibility) => void;
  viewMode?: TaskViewMode;
  onViewModeChange?: (mode: TaskViewMode) => void;

  // Tiêu chí nhóm (Linear-style Grouping)
  groupingField?: string;
  onGroupingChange?: (field: string) => void;

  // Sắp xếp
  sortField?: string;
  sortDirection?: "asc" | "desc";
  onSort?: (field: string) => void;

  // Thao tác chính
  onAddTask?: () => void;
  onExportExcel?: () => void;
  canCreateTask?: boolean;
  totalTasksCount?: number;
  loading?: boolean;

  // Ngữ cảnh người dùng
  currentUserId?: string;
  currentUserName?: string;

  className?: string;
}

export interface TaskTableViewOptionsPopoverProps {
  viewMode?: TaskViewMode;
  onViewModeChange?: (mode: TaskViewMode) => void;
  groupingField: string;
  onGroupingChange: (field: string) => void;
  sortField?: TaskSortField | string;
  sortDirection?: SortDirection;
  onSort?: (field: any) => void;
  density?: TableDensity;
  onDensityChange?: (density: TableDensity) => void;
  visibleColumns: TableColumnVisibility;
  onVisibleColumnsChange?: (columns: TableColumnVisibility) => void;
  isCustomized: boolean;
  onReset: () => void;
  triggerClassName?: string;
  ariaLabel?: string;
}

/**
 * Popover tùy chọn hiển thị và thuộc tính bảng theo phong cách Linear (View Options)
 */
export function TaskTableViewOptionsPopover({
  viewMode = "table",
  onViewModeChange,
  groupingField,
  onGroupingChange,
  sortField,
  sortDirection = "asc",
  onSort,
  density = "comfortable",
  onDensityChange,
  visibleColumns,
  onVisibleColumnsChange,
  isCustomized,
  onReset,
  triggerClassName,
  ariaLabel = "Tùy chọn hiển thị và thuộc tính bảng",
}: TaskTableViewOptionsPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Popover.Root open={isOpen} onOpenChange={setIsOpen}>
      <Popover.Trigger
        type="button"
        className={cn(
          "cursor-pointer relative shadow-2xs transition-all",
          isOpen || isCustomized
            ? "border-primary/50 bg-primary/5 text-primary"
            : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
          triggerClassName
        )}
        aria-label={ariaLabel}
        title="Tùy chọn hiển thị (View options)"
      >
        <SlidersHorizontal className="size-3.5 sm:size-4" strokeWidth={1.5} />
        <span className="sr-only">Hiển thị</span>
        {isCustomized && (
          <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        )}
      </Popover.Trigger>

      {isOpen && (
        <Popover.Portal>
          <Popover.Positioner side="bottom" align="start" sideOffset={8} className="z-50">
            <Popover.Popup className="w-[280px] rounded-2xl border border-border/80 bg-card p-0 overflow-hidden shadow-xl select-none animate-in fade-in-0 zoom-in-95 duration-150">
              <div data-slot="desktop-display-panel">
                {/* 1. Layout View Mode Switcher */}
                {onViewModeChange && (
                  <div
                    aria-label="Chế độ xem không gian làm việc"
                    className="grid grid-cols-2 gap-1.5 px-3 pt-3 pb-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => onViewModeChange("table")}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        viewMode === "table"
                          ? "bg-muted text-foreground font-medium border border-border"
                          : "bg-card text-muted-foreground border border-border/70 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <List className="size-3.5" strokeWidth={1.5} />
                      <span>Danh sách</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onViewModeChange("kanban")}
                      className={cn(
                        "inline-flex items-center justify-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium transition-colors cursor-pointer",
                        viewMode === "kanban"
                          ? "bg-muted text-foreground font-medium border border-border"
                          : "bg-card text-muted-foreground border border-border/70 hover:text-foreground hover:bg-muted/50"
                      )}
                    >
                      <Kanban className="size-3.5" strokeWidth={1.5} />
                      <span>Bảng Kanban</span>
                    </button>
                  </div>
                )}

                {/* Density Options */}
                {onDensityChange && (
                  <div
                    aria-label="Mật độ hiển thị bảng"
                    className="flex items-center justify-between text-xs px-3 py-2.5 border-t border-border/50"
                  >
                    <span className="text-muted-foreground font-medium">Mật độ dòng</span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        aria-label="Chế độ hiển thị gọn"
                        onClick={() => onDensityChange("compact")}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                          density === "compact"
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        Gọn
                      </button>
                      <button
                        type="button"
                        aria-label="Chế độ hiển thị thoải mái"
                        onClick={() => onDensityChange("comfortable")}
                        className={cn(
                          "px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                          density === "comfortable"
                            ? "bg-primary/10 text-primary font-semibold"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        )}
                      >
                        Vừa
                      </button>
                    </div>
                  </div>
                )}

                {/* 2. Grouping & Ordering */}
                <div className="space-y-2 px-3 py-2.5 border-t border-border/50">
                  {/* Grouping */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Nhóm theo</span>
                    <CustomSelectMenu
                      value={groupingField}
                      onChange={(val) => onGroupingChange(val)}
                      options={GROUPING_OPTIONS}
                      ariaLabel="Nhóm theo tiêu chí"
                    />
                  </div>

                  {/* Ordering */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground font-medium">Sắp xếp</span>
                    <div className="flex items-center gap-1.5">
                      {onSort && (
                        <button
                          type="button"
                          onClick={() => {
                            if (sortField) {
                              onSort(sortField);
                            }
                          }}
                          className="size-7 inline-flex items-center justify-center rounded-md border border-border/70 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
                          title={sortDirection === "asc" ? "Đang tăng dần (Bấm để đổi)" : "Đang giảm dần (Bấm để đổi)"}
                          aria-label="Đổi chiều sắp xếp"
                        >
                          <ArrowUpDown className="size-3.5" strokeWidth={1.5} />
                        </button>
                      )}
                      <CustomSelectMenu
                        value={sortField || "dueDate"}
                        onChange={(val) => onSort?.(val)}
                        options={SORT_OPTIONS}
                        ariaLabel="Tiêu chí sắp xếp"
                      />
                    </div>
                  </div>
                </div>

                {/* 3. List options: Display properties */}
                <div className="space-y-2 px-3 py-2.5 border-t border-border/50">
                  <div className="text-xs font-medium text-muted-foreground">
                    Thuộc tính hiển thị
                  </div>

                  {/* Chips toggle: bật = nền xám + viền + chữ đậm vừa, tắt = chữ nhạt không viền */}
                  <div className="flex flex-wrap gap-1.5">
                    {DISPLAY_PROPERTY_OPTIONS.map((prop) => {
                      const isEnabled = visibleColumns[prop.id] !== false;
                      return (
                        <button
                          key={prop.id}
                          type="button"
                          onClick={() => {
                            onVisibleColumnsChange?.({
                              ...visibleColumns,
                              [prop.id]: !isEnabled,
                            });
                          }}
                          aria-pressed={isEnabled}
                          className={cn(
                            "px-2.5 h-6 inline-flex items-center rounded-full text-xs border transition-colors cursor-pointer select-none",
                            isEnabled
                              ? "bg-muted border-border text-foreground font-medium"
                              : "bg-card border-border/70 text-muted-foreground font-normal hover:bg-muted/50 hover:text-foreground"
                          )}
                        >
                          {prop.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Footer: Reset & Default */}
                <div className="flex items-center justify-end px-3 py-2.5 border-t border-border/50 text-xs">
                  <button
                    type="button"
                    onClick={onReset}
                    className="text-foreground/80 hover:text-foreground transition-colors cursor-pointer"
                  >
                    Đặt lại
                  </button>
                </div>
              </div>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      )}
    </Popover.Root>
  );
}

interface CustomSelectOption<T extends string> {
  value: T;
  label: string;
}

function CustomSelectMenu<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (val: T) => void;
  options: CustomSelectOption<T>[];
  ariaLabel: string;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) || options[0];

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        aria-label={ariaLabel}
        className="h-7 px-2.5 rounded-lg border border-border/70 bg-card text-xs font-medium text-foreground hover:bg-muted/70 transition-colors inline-flex items-center justify-between gap-1.5 cursor-pointer shadow-2xs select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary min-w-[105px]"
      >
        <span className="truncate">{selected.label}</span>
        <ChevronDown className="size-3 text-muted-foreground/70 shrink-0" strokeWidth={1.5} />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={4} className="z-50">
          <Popover.Popup className="min-w-[130px] rounded-xl border border-border/80 bg-card p-1 shadow-lg select-none text-xs animate-in fade-in-0 zoom-in-95 duration-100 flex flex-col">
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md text-left transition-colors cursor-pointer",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted/70 text-foreground font-normal"
                  )}
                >
                  <span>{opt.label}</span>
                  {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                </button>
              );
            })}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

const GROUPING_OPTIONS = [
  { value: "none", label: "Không nhóm" },
  { value: "department", label: "Đơn vị" },
  { value: "priority", label: "Ưu tiên" },
  { value: "status", label: "Trạng thái" },
];

const SORT_OPTIONS: Array<{ value: TaskSortField; label: string }> = [
  { value: "dueDate", label: "Hạn" },
  { value: "priority", label: "Ưu tiên" },
  { value: "status", label: "Trạng thái" },
  { value: "title", label: "Tên" },
  { value: "progress", label: "Tiến độ" },
];

export function TaskTableToolbar({
  searchQuery,
  onSearchChange,
  searchPlaceholder = "Tìm kiếm nhiệm vụ, mã, người thực hiện... (/ hoặc ⌘K)",
  debounceMs = 250,
  activeTab,
  onTabChange,
  pillCounts,
  tasks,
  availableTabs = SMART_FILTER_TABS,
  selectedAcademicMonth,
  onAcademicMonthChange,
  selectedMonth,
  onMonthChange,
  selectedDepartment = "ALL",
  onDepartmentChange,
  departmentOptions = DEPARTMENT_OPTIONS,
  selectedCategory = "ALL",
  onCategoryChange,
  categoryOptions = CATEGORY_TABS,
  density = "comfortable",
  onDensityChange,
  visibleColumns = { priority: true, subtasks: true, progress: true },
  onVisibleColumnsChange,
  viewMode = "table",
  onViewModeChange,
  groupingField: propGroupingField,
  onGroupingChange: propOnGroupingChange,
  sortField,
  sortDirection,
  onSort,
  onAddTask,
  onExportExcel,
  canCreateTask = true,
  totalTasksCount,
  loading = false,
  currentUserId,
  currentUserName,
  className,
}: TaskTableToolbarProps) {
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const [localQuery, setLocalQuery] = React.useState<string>(searchQuery);

  // Đồng bộ giá trị tìm kiếm khi prop thay đổi từ ngoài
  React.useEffect(() => {
    setLocalQuery(searchQuery);
  }, [searchQuery]);

  // Debounce gửi từ khóa tìm kiếm
  React.useEffect(() => {
    if (localQuery === searchQuery) return;
    const timer = setTimeout(() => {
      onSearchChange(localQuery);
    }, debounceMs);
    return () => clearTimeout(timer);
  }, [localQuery, searchQuery, onSearchChange, debounceMs]);

  // Lắng nghe phím tắt toàn cục: '/' và sự kiện focus tìm kiếm từ bàn phím
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // '/' focuses table search when not already inside an input/textarea
      if (e.key === "/" && !isInputElement(e.target) && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    const handleFocusSearch = () => {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("qcet:focus-task-search", handleFocusSearch);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("qcet:focus-task-search", handleFocusSearch);
    };
  }, []);

  const activeMonth =
    selectedMonth !== undefined
      ? selectedMonth
      : selectedAcademicMonth ?? "ALL";
  const hasMonthHandler = Boolean(onMonthChange || onAcademicMonthChange);
  const activeOnMonthChange = React.useCallback(
    (month: number | "ALL") => {
      if (onMonthChange) onMonthChange(month);
      if (onAcademicMonthChange && onAcademicMonthChange !== onMonthChange) {
        onAcademicMonthChange(month);
      }
    },
    [onMonthChange, onAcademicMonthChange]
  );

  const handleClearSearch = React.useCallback(() => {
    setLocalQuery("");
    onSearchChange("");
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  const [isMobileFilterOpen, setIsMobileFilterOpen] = React.useState(false);
  // Plan T10: the desktop first row is the north star
  //   [Scope] [Search........] [Filter] [Display] [Giao việc]
  // Period, unit, category, density, sort and export live on secondary
  // surfaces, so the bar does not dominate the viewport (R-D1).
  const [isDesktopFilterOpen, setIsDesktopFilterOpen] = React.useState(false);
  const [internalGroupingField, setInternalGroupingField] = React.useState<string>("none");
  const groupingField = propGroupingField ?? internalGroupingField;
  const setGroupingField = propOnGroupingChange ?? setInternalGroupingField;

  const isDisplayCustomized = React.useMemo(() => {
    return (
      visibleColumns.code !== DEFAULT_DISPLAY_PROPERTIES.code ||
      visibleColumns.department !== DEFAULT_DISPLAY_PROPERTIES.department ||
      visibleColumns.priority !== DEFAULT_DISPLAY_PROPERTIES.priority ||
      visibleColumns.leadAssignee !== DEFAULT_DISPLAY_PROPERTIES.leadAssignee ||
      visibleColumns.dueDate !== DEFAULT_DISPLAY_PROPERTIES.dueDate ||
      visibleColumns.progress !== DEFAULT_DISPLAY_PROPERTIES.progress ||
      visibleColumns.subtasks !== DEFAULT_DISPLAY_PROPERTIES.subtasks ||
      visibleColumns.coAssignees !== DEFAULT_DISPLAY_PROPERTIES.coAssignees ||
      visibleColumns.status !== DEFAULT_DISPLAY_PROPERTIES.status ||
      visibleColumns.category !== DEFAULT_DISPLAY_PROPERTIES.category ||
      visibleColumns.createdAt !== DEFAULT_DISPLAY_PROPERTIES.createdAt
    );
  }, [visibleColumns]);

  const handleResetDisplayProperties = React.useCallback(() => {
    onVisibleColumnsChange?.(DEFAULT_DISPLAY_PROPERTIES);
  }, [onVisibleColumnsChange]);

  // Tính toán số lượng thẻ lọc nếu không được truyền trực tiếp
  const computedPillCounts = React.useMemo(() => {
    let counts = pillCounts;
    if (!counts && tasks && tasks.length > 0) {
      counts = aggregateFilterCounts(tasks, {
        currentUserId,
        currentUserName,
        month: activeMonth,
      });
    }
    // Tự động bổ sung số lượng tổng "Tất cả" khi có totalTasksCount
    if (totalTasksCount !== undefined && (!counts || counts.all === undefined)) {
      counts = { ...counts, all: totalTasksCount };
    }
    return counts;
  }, [pillCounts, tasks, currentUserId, currentUserName, totalTasksCount, activeMonth]);

  const activeAdvancedFilterCount = React.useMemo(() => {
    let count = 0;
    if (selectedDepartment && selectedDepartment !== "ALL") count++;
    if (selectedCategory && selectedCategory !== "ALL") count++;
    if (activeMonth !== undefined && activeMonth !== "ALL") count++;
    return count;
  }, [selectedDepartment, selectedCategory, activeMonth]);

  const handleResetMobileFilters = React.useCallback(() => {
    onDepartmentChange?.("ALL");
    onCategoryChange?.("ALL");
    activeOnMonthChange("ALL");
    onTabChange("all");
  }, [onDepartmentChange, onCategoryChange, activeOnMonthChange, onTabChange]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* ========================================================================= */}
      {/* 1. GIAO DIỆN DI ĐỘNG (< 768px / md:hidden): Streamlined Mobile Task Bar  */}
      {/* ========================================================================= */}
      <div className="md:hidden flex flex-col gap-2.5">
        {/* Hàng 1: Ô tìm kiếm di động tối ưu cảm ứng (min-h-[44px]) */}
        <div className="relative w-full">
          {loading ? (
            <Loader2
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin pointer-events-none"
              strokeWidth={1.5}
            />
          ) : (
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
          )}
          <input
            type="search"
            value={localQuery}
            onChange={(e) => setLocalQuery(e.target.value)}
            placeholder="Tìm theo tên, mã nhiệm vụ..."
            disabled={loading}
            aria-label="Tìm kiếm nhiệm vụ"
            className="w-full min-h-[44px] h-11 pl-9.5 pr-12 rounded-xl border border-border/80 bg-card text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all disabled:opacity-60 shadow-2xs"
          />
          {localQuery && (
            <button
              type="button"
              onClick={handleClearSearch}
              aria-label="Xóa từ khóa tìm kiếm"
              className="absolute right-1 top-1/2 -translate-y-1/2 inline-flex size-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* Hàng 2: Quick Filter Chips cuộn ngang mượt mà (Apple HIG / WCAG 2.2 min 44px) */}
        <div
          role="tablist"
          aria-label="Lọc nhanh nhiệm vụ trên di động"
          className="flex items-center gap-2 overflow-x-auto scrollbar-none overscroll-x-contain py-1 -mx-1 px-1 touch-pan-x"
        >
          {/* Chip Tất cả */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "all"}
            onClick={() => onTabChange("all")}
            className={cn(
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-[0.98]",
              activeTab === "all"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "border border-border/70 bg-card text-muted-foreground hover:bg-muted/60 font-medium"
            )}
          >
            <span>Tất cả</span>
            <span className="font-mono tabular-nums text-xs opacity-90">
              ({computedPillCounts?.all ?? 0})
            </span>
          </button>

          {/* Chip Của tôi */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "my_tasks"}
            onClick={() => onTabChange("my_tasks")}
            className={cn(
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-[0.98]",
              activeTab === "my_tasks"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "border border-border/70 bg-card text-muted-foreground hover:bg-muted/60 font-medium"
            )}
          >
            <span>Của tôi</span>
            <span className="font-mono tabular-nums text-xs opacity-90">
              ({computedPillCounts?.my_tasks ?? 0})
            </span>
          </button>

          {/* Chip Chờ duyệt */}
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "review"}
            onClick={() => onTabChange("review")}
            className={cn(
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-[0.98]",
              activeTab === "review"
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "border border-border/70 bg-card text-muted-foreground hover:bg-muted/60 font-medium"
            )}
          >
            <span>Chờ duyệt</span>
            <span className="font-mono tabular-nums text-xs opacity-90">
              ({computedPillCounts?.review ?? 0})
            </span>
          </button>

          {/* Chip Trễ hạn nếu có */}
          {(computedPillCounts?.overdue ?? 0) > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overdue"}
              onClick={() => onTabChange("overdue")}
              className={cn(
                "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-[0.98]",
                activeTab === "overdue"
                  ? "bg-rose-600 text-white font-semibold shadow-2xs"
                  : "border border-rose-200 bg-rose-50/70 text-rose-700 font-medium"
              )}
            >
              <span>Trễ hạn</span>
              <span className="font-mono tabular-nums text-xs font-bold">
                ({computedPillCounts?.overdue ?? 0})
              </span>
            </button>
          )}
        </div>

        {/* Hàng 3: Thanh nút bấm chức năng di động (min 44px touch targets) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            {/* Nút Bộ lọc mở Bottom Sheet */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98] shadow-2xs",
                activeAdvancedFilterCount > 0
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-border/80 bg-card text-foreground hover:bg-muted"
              )}
              aria-label={`Mở bộ lọc nâng cao, hiện có ${activeAdvancedFilterCount} bộ lọc đang chọn`}
            >
              <Filter className="size-4 text-muted-foreground" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

            {/* Nút Tùy chọn hiển thị di động (kề bên nút Bộ lọc theo phong cách Linear) */}
            <TaskTableViewOptionsPopover
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              groupingField={groupingField}
              onGroupingChange={setGroupingField}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              density={density}
              onDensityChange={onDensityChange}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={onVisibleColumnsChange}
              isCustomized={isDisplayCustomized}
              onReset={handleResetDisplayProperties}
              ariaLabel="Tùy chọn hiển thị"
              triggerClassName="inline-flex size-[44px] min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98] shadow-2xs relative"
            />

            {/* Nút Sắp xếp nhanh di động */}
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
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border/80 bg-card text-foreground text-xs font-medium touch-manipulation cursor-pointer active:scale-[0.98] shadow-2xs hover:bg-muted"
                aria-label="Sắp xếp danh sách công việc"
              >
                <ArrowUpDown className="size-4 text-muted-foreground" strokeWidth={1.5} />
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
          </div>

          <div className="flex items-center gap-1.5">
            {/* Nút Tạo việc mới (Linear style: thanh lịch, tối giản) */}
            {canCreateTask && onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border border-border/80 bg-card text-foreground text-xs font-medium shadow-2xs active:scale-[0.98] transition-colors hover:bg-muted touch-manipulation cursor-pointer"
                aria-label="Tạo việc mới"
              >
                <Plus className="size-4 text-muted-foreground" strokeWidth={1.5} />
                <span>Tạo việc</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Filter Bottom Sheet Dialog */}
        {isMobileFilterOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-xs animate-in fade-in duration-200"
            role="dialog"
            aria-modal="true"
            aria-label="Bộ lọc công việc nâng cao"
          >
            {/* Backdrop click dismiss */}
            <div
              className="absolute inset-0"
              onClick={() => setIsMobileFilterOpen(false)}
              aria-hidden="true"
            />

            {/* Drawer Surface */}
            <div className="relative z-10 w-full max-w-lg rounded-t-2xl border-t border-border/80 bg-card p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl max-h-[85vh] overflow-y-auto space-y-4 animate-in slide-in-from-bottom duration-200">
              {/* Drag Handle Indicator */}
              <div className="mx-auto w-12 h-1.5 rounded-full bg-border/80 mb-1 shrink-0" aria-hidden="true" />

              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/60 pb-3">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="size-4.5 text-primary" strokeWidth={1.5} />
                  <h3 className="text-base font-semibold text-foreground">Bộ lọc công việc</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="inline-flex size-9 min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                  aria-label="Đóng bảng bộ lọc"
                >
                  <X className="size-5" strokeWidth={1.5} />
                </button>
              </div>

              {/* Filter: Trạng thái nhiệm vụ */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">
                  Trạng thái nhiệm vụ
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => onTabChange(tab.id)}
                      className={cn(
                        "inline-flex items-center justify-between min-h-[44px] px-3 rounded-xl border text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-[0.98]",
                        activeTab === tab.id
                          ? "border-primary bg-primary/10 text-primary font-semibold shadow-2xs"
                          : "border-border/70 bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span>{tab.label}</span>
                      {typeof computedPillCounts?.[tab.id] === "number" && (
                        <span className="font-mono tabular-nums text-xs opacity-80">
                          {computedPillCounts[tab.id]}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter: Đơn vị phòng ban */}
              {onDepartmentChange && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Đơn vị / Phòng ban
                  </label>
                  <div className="relative">
                    <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={selectedDepartment}
                      onChange={(e) => onDepartmentChange(e.target.value)}
                      className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    >
                      {departmentOptions.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {dept.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Filter: Tháng học kỳ */}
              {hasMonthHandler && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Kỳ học / Tháng học vụ (2026-2027)
                  </label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                    <select
                      value={activeMonth}
                      onChange={(e) => {
                        const val = e.target.value;
                        activeOnMonthChange(val === "ALL" ? "ALL" : Number(val));
                      }}
                      className="w-full min-h-[44px] pl-9.5 pr-8 rounded-xl border border-border/80 bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary"
                    >
                      <option value="ALL">Cả năm học (Tất cả các tháng)</option>
                      {ACADEMIC_MONTH_ORDER.map((m) => {
                        const info = getAcademicMonthInfo(m);
                        return (
                          <option key={`academic-month-mobile-${m}`} value={m}>
                            {info.label} ({info.shortDateSpan})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              )}

              {/* Filter: Sắp xếp theo */}
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

              {/* Footer Actions */}
              <div className="flex items-center gap-2 pt-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={handleResetMobileFilters}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-border bg-muted/40 text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <RotateCcw className="size-3.5 text-muted-foreground" />
                  <span>Đặt lại bộ lọc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/95 transition-colors cursor-pointer active:scale-[0.98]"
                >
                  <span>Áp dụng</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 2. GIAO DIỆN DESKTOP (>= 768px / hidden md:flex): Rich Desktop Toolbar     */}
      {/* ========================================================================= */}
      <div className="hidden md:flex flex-wrap items-center justify-between gap-2.5">
        {/* Nhóm bên trái: Tìm kiếm + Lọc Đơn vị + Lọc DACUM */}
        <div className="flex flex-1 flex-wrap items-center gap-2 min-w-0">
          {/* Ô tìm kiếm Debounced */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            {loading ? (
              <Loader2
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-primary animate-spin pointer-events-none"
                strokeWidth={1.5}
                aria-label="Đang tải dữ liệu"
              />
            ) : (
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
            )}
            <input
              ref={searchInputRef}
              type="text"
              value={localQuery}
              onChange={(e) => setLocalQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.preventDefault();
                  if (localQuery) {
                    setLocalQuery("");
                    onSearchChange("");
                  }
                  searchInputRef.current?.blur();
                }
              }}
              placeholder={searchPlaceholder}
              disabled={loading}
              aria-label="Tìm kiếm nhiệm vụ"
              className="w-full h-8.5 pl-8.5 pr-14 rounded-lg border border-border/70 bg-card text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary/50 focus:border-primary/80 transition-all disabled:opacity-60 shadow-2xs"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {localQuery ? (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Xóa từ khóa tìm kiếm"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors cursor-pointer"
                >
                  <X className="size-3.5" strokeWidth={1.5} />
                </button>
              ) : (
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/70 select-none">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Plan T10: Filter is one first-row control; period, unit and category
              are disclosed on this secondary surface instead of standing open. */}
          {/* Cặp công cụ: Lọc & Hiển thị (Linear View Options kề bên nhau) */}
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-expanded={isDesktopFilterOpen}
              onClick={() => {
                setIsDesktopFilterOpen((v) => !v);
              }}
              className={cn(
                "h-8.5 gap-1.5 text-xs font-medium cursor-pointer border-border/80 bg-card text-foreground hover:bg-muted shadow-2xs transition-all",
                isDesktopFilterOpen && "border-primary/50 bg-primary/5 text-primary"
              )}
            >
              <Filter className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>Lọc</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="flex size-4.5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-[10px] font-bold">
                  {activeAdvancedFilterCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "size-3 text-muted-foreground transition-transform",
                  isDesktopFilterOpen && "rotate-180 text-primary"
                )}
                strokeWidth={1.5}
              />
            </Button>

            {/* Linear-style View Options & Display Properties Popover (Kề bên nút Filter) */}
            <TaskTableViewOptionsPopover
              viewMode={viewMode}
              onViewModeChange={onViewModeChange}
              groupingField={groupingField}
              onGroupingChange={setGroupingField}
              sortField={sortField}
              sortDirection={sortDirection}
              onSort={onSort}
              density={density}
              onDensityChange={onDensityChange}
              visibleColumns={visibleColumns}
              onVisibleColumnsChange={onVisibleColumnsChange}
              isCustomized={isDisplayCustomized}
              onReset={handleResetDisplayProperties}
              triggerClassName="inline-flex h-8.5 w-8.5 items-center justify-center rounded-lg border border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground text-xs font-medium transition-all cursor-pointer relative shadow-2xs"
            />
          </div>

          {isDesktopFilterOpen && (
            <div
              data-slot="desktop-filter-panel"
              className="flex flex-1 flex-wrap items-center gap-2 min-w-0"
            >
          {/* Dropdown Bộ lọc Tháng (Academic Month) */}
          {hasMonthHandler && (
            <div className="relative inline-flex items-center">
              <Calendar
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              {/* Backward compatibility comment for aria-label="Lọc theo tháng học kỳ" */}
              <select
                value={activeMonth}
                onChange={(e) => {
                  const val = e.target.value;
                  activeOnMonthChange(val === "ALL" ? "ALL" : Number(val));
                }}
                aria-label="Lọc theo tháng học vụ"
                className="h-9 pl-8 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none max-w-[170px] truncate"
              >
                <option value="ALL">Tất cả các tháng</option>
                {ACADEMIC_MONTH_ORDER.map((m) => {
                  const info = getAcademicMonthInfo(m);
                  return (
                    <option key={`academic-month-${m}`} value={m}>
                      {info.label} ({info.shortDateSpan})
                    </option>
                  );
                })}
              </select>
              <ChevronDown
                className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
            </div>
          )}

          {/* Dropdown Đơn vị / Phòng ban */}
          {onDepartmentChange && (
            <div className="relative inline-flex items-center">
              <Building2
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              <select
                value={selectedDepartment}
                onChange={(e) => onDepartmentChange(e.target.value)}
                aria-label="Lọc theo đơn vị phòng ban"
                className="h-9 pl-8 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none max-w-[190px] truncate"
              >
                {departmentOptions.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {dept.label}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
            </div>
          )}
            </div>
          )}
        </div>

        {/* Nhóm bên phải: Xuất Excel + Thêm công việc */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Nút Xuất file Excel */}
          {onExportExcel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              className="h-9 px-3 gap-1.5 text-xs font-medium border-border hover:bg-muted/80 text-foreground cursor-pointer"
              aria-label="Xuất dữ liệu Excel"
            >
              <FileSpreadsheet
                className="size-4 text-emerald-600"
                strokeWidth={1.5}
              />
              <span className="hidden md:inline">Xuất Excel</span>
            </Button>
          )}

          {/* Nút Tạo việc mới (Phong cách Linear: nhẹ nhàng, thanh lịch) */}
          {onAddTask && canCreateTask && (
            <button
              type="button"
              onClick={onAddTask}
              className="inline-flex items-center gap-1.5 h-8.5 px-3 rounded-lg border border-border/80 bg-card text-xs font-medium text-foreground hover:bg-muted transition-colors shadow-2xs cursor-pointer active:scale-[0.98]"
              aria-label="Tạo việc mới"
            >
              <Plus className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>Tạo việc</span>
              <span className="sr-only">Tạo nhiệm vụ</span>
            </button>
          )}
        </div>
      </div>

      {/* Hàng 2 (Desktop): Dải thẻ lọc thông minh (Smart Filter Tabs - Linear Segmented Style) */}
      <div
        role="tablist"
        aria-label="Bộ lọc thông minh theo ngữ cảnh"
        className="hidden sm:inline-flex items-center p-0.5 rounded-lg bg-muted/40 border border-border/40 gap-0.5 overflow-x-auto max-w-full scrollbar-none"
      >
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = computedPillCounts?.[tab.id];
          const hasCount = typeof count === "number" && count >= 0;
          const isOverdueTab = tab.id === "overdue" && (count ?? 0) > 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs transition-all cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? isOverdueTab
                    ? "bg-card text-rose-600 font-semibold shadow-2xs border border-rose-200/80"
                    : "bg-card text-foreground font-semibold shadow-2xs border border-border/50"
                  : isOverdueTab
                  ? "text-rose-600/90 hover:bg-card/60 hover:text-rose-700 font-medium"
                  : "text-muted-foreground hover:bg-card/60 hover:text-foreground font-medium"
              )}
            >
              <span>{tab.label}</span>
              {hasCount && (
                <span
                  className={cn(
                    "px-1 py-0.2 rounded font-mono text-[11px] tabular-nums",
                    isActive
                      ? isOverdueTab
                        ? "bg-rose-50 text-rose-700 font-bold"
                        : "bg-muted text-foreground font-bold"
                      : isOverdueTab
                      ? "bg-rose-50/60 text-rose-600/90 font-medium"
                      : "text-muted-foreground/70 font-normal"
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
  );
}
