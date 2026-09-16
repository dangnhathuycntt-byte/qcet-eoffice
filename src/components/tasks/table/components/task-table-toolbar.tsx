"use client";

import * as React from "react";
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
} from "lucide-react";
import type { SchoolTask, TaskCategory } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  CATEGORY_TABS,
  DEPARTMENT_OPTIONS,
  SMART_FILTER_TABS,
} from "../constants";
import { isInputElement } from "../hooks/use-task-keyboard-nav";
import type {
  CategoryTab,
  DepartmentOption,
  SmartFilterTab,
  SmartFilterTabOption,
  TableDensity,
  TableColumnVisibility,
  TaskViewMode,
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
  const [isDesktopDisplayOpen, setIsDesktopDisplayOpen] = React.useState(false);

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
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95",
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
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95",
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
              "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95",
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

          {/* Chip Quá hạn nếu có */}
          {(computedPillCounts?.overdue ?? 0) > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "overdue"}
              onClick={() => onTabChange("overdue")}
              className={cn(
                "inline-flex items-center gap-1.5 min-h-[44px] px-3.5 rounded-xl text-xs transition-all touch-manipulation cursor-pointer shrink-0 active:scale-95",
                activeTab === "overdue"
                  ? "bg-rose-600 text-white font-semibold shadow-2xs"
                  : "border border-rose-200 bg-rose-50/70 text-rose-700 font-medium"
              )}
            >
              <span>Quá hạn</span>
              <span className="font-mono tabular-nums text-xs font-bold">
                ({computedPillCounts?.overdue ?? 0})
              </span>
            </button>
          )}
        </div>

        {/* Hàng 3: Thanh nút bấm chức năng di động (min 44px touch targets) */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-2">
            {/* Nút Bộ lọc mở Bottom Sheet */}
            <button
              type="button"
              onClick={() => setIsMobileFilterOpen(true)}
              className={cn(
                "inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl border text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-95 shadow-2xs",
                activeAdvancedFilterCount > 0
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-border/80 bg-card text-foreground hover:bg-muted/60"
              )}
              aria-label={`Mở bộ lọc nâng cao, hiện có ${activeAdvancedFilterCount} bộ lọc đang chọn`}
            >
              <Filter className="size-4" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeAdvancedFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground font-mono text-xs font-bold">
                  {activeAdvancedFilterCount}
                </span>
              )}
            </button>

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
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 rounded-xl border border-border/80 bg-card text-foreground text-xs font-medium touch-manipulation cursor-pointer active:scale-95 shadow-2xs"
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
            {/* Nút Tạo nhiệm vụ mới */}
            {canCreateTask && onAddTask && (
              <button
                type="button"
                onClick={onAddTask}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs active:scale-95 transition-all touch-manipulation cursor-pointer"
              >
                <Plus className="size-4" strokeWidth={1.5} />
                <span>Tạo nhiệm vụ</span>
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
                        "inline-flex items-center justify-between min-h-[44px] px-3 rounded-xl border text-xs font-medium transition-all touch-manipulation cursor-pointer active:scale-98",
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
                  className="flex-1 inline-flex items-center justify-center gap-1.5 min-h-[44px] px-4 rounded-xl border border-border bg-muted/40 text-foreground text-xs font-medium hover:bg-muted transition-colors cursor-pointer active:scale-98"
                >
                  <RotateCcw className="size-3.5 text-muted-foreground" />
                  <span>Đặt lại bộ lọc</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsMobileFilterOpen(false)}
                  className="flex-1 inline-flex items-center justify-center min-h-[44px] px-4 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-xs hover:bg-primary/95 transition-colors cursor-pointer active:scale-98"
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
              className="w-full h-9 pl-9 pr-14 rounded-lg border border-border bg-card text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors disabled:opacity-60"
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
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-muted/60 px-1.5 py-0.5 font-mono text-xs text-muted-foreground select-none">
                  /
                </kbd>
              )}
            </div>
          </div>

          {/* Plan T10: Filter is one first-row control; period, unit and category
              are disclosed on this secondary surface instead of standing open. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={isDesktopFilterOpen}
            onClick={() => {
              setIsDesktopFilterOpen((v) => !v);
              setIsDesktopDisplayOpen(false);
            }}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <Filter className="size-4" strokeWidth={1.5} />
            <span>Lọc</span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                isDesktopFilterOpen && "rotate-180"
              )}
              strokeWidth={1.5}
            />
          </Button>

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

        {/* Nhóm bên phải: Mật độ + Chế độ xem + Xuất Excel + Thêm công việc */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Plan T10: Display is one first-row control; density, view mode and
              export are disclosed here rather than standing open. */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-expanded={isDesktopDisplayOpen}
            onClick={() => {
              setIsDesktopDisplayOpen((v) => !v);
              setIsDesktopFilterOpen(false);
            }}
            className="h-9 gap-1.5 text-xs font-medium cursor-pointer"
          >
            <SlidersHorizontal className="size-4" strokeWidth={1.5} />
            <span>Hiển thị</span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                isDesktopDisplayOpen && "rotate-180"
              )}
              strokeWidth={1.5}
            />
          </Button>

          {isDesktopDisplayOpen && (
            <div
              data-slot="desktop-display-panel"
              className="flex items-center gap-2"
            >
          {/* Điều khiển mật độ hiển thị hàng (Compact / Comfortable) */}
          {onDensityChange && (
            <div
              role="group"
              aria-label="Mật độ hiển thị bảng"
              className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => onDensityChange("compact")}
                aria-pressed={density === "compact"}
                aria-label="Chế độ hiển thị gọn"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  density === "compact"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rows3 className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Gọn</span>
              </button>
              <button
                type="button"
                onClick={() => onDensityChange("comfortable")}
                aria-pressed={density === "comfortable"}
                aria-label="Chế độ hiển thị chuẩn"
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  density === "comfortable"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Rows4 className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Chuẩn</span>
              </button>
            </div>
          )}

          {/* Bộ chuyển đổi chế độ xem (Bảng / Kanban) */}
          {onViewModeChange && (
            <div
              role="group"
              aria-label="Chế độ xem không gian làm việc"
              className="inline-flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs"
            >
              <button
                type="button"
                onClick={() => onViewModeChange("table")}
                aria-pressed={viewMode === "table"}
                aria-label="Chế độ xem bảng"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "table"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <List className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Bảng</span>
              </button>
              <button
                type="button"
                onClick={() => onViewModeChange("kanban")}
                aria-pressed={viewMode === "kanban"}
                aria-label="Chế độ xem Kanban"
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer",
                  viewMode === "kanban"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Kanban className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Kanban</span>
              </button>
            </div>
          )}

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

          {/* Tùy chọn ẩn/hiển thị các cột phụ */}
          {onVisibleColumnsChange && (
            <div className="flex items-center gap-2 border-l border-border/70 pl-2.5 text-xs py-0.5">
              <span className="text-slate-500 text-[11px] font-medium select-none">Cột phụ:</span>
              <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                <input
                  type="checkbox"
                  checked={visibleColumns.priority !== false}
                  onChange={(e) =>
                    onVisibleColumnsChange({
                      ...visibleColumns,
                      priority: e.target.checked,
                    })
                  }
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/25 cursor-pointer"
                />
                <span className="text-xs">Ưu tiên</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                <input
                  type="checkbox"
                  checked={visibleColumns.subtasks !== false}
                  onChange={(e) =>
                    onVisibleColumnsChange({
                      ...visibleColumns,
                      subtasks: e.target.checked,
                    })
                  }
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/25 cursor-pointer"
                />
                <span className="text-xs">Việc con</span>
              </label>
              <label className="inline-flex items-center gap-1 cursor-pointer text-slate-700 hover:text-slate-900 select-none">
                <input
                  type="checkbox"
                  checked={visibleColumns.progress !== false}
                  onChange={(e) =>
                    onVisibleColumnsChange({
                      ...visibleColumns,
                      progress: e.target.checked,
                    })
                  }
                  className="size-3.5 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/25 cursor-pointer"
                />
                <span className="text-xs">Tiến độ</span>
              </label>
            </div>
          )}
            </div>
          )}

          {/* Nút Tạo nhiệm vụ mới */}
          {onAddTask && canCreateTask && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onAddTask}
              className="h-9 px-3.5 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
              aria-label="Tạo nhiệm vụ mới"
            >
              <Plus className="size-4" strokeWidth={1.5} />
              <span>Tạo nhiệm vụ</span>
            </Button>
          )}
        </div>
      </div>

      {/* Hàng 2 (Desktop): Dải thẻ lọc thông minh (Smart Filter Pills) */}
      <div
        role="tablist"
        aria-label="Bộ lọc thông minh theo ngữ cảnh"
        className="hidden sm:flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
      >
        {availableTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          const count = computedPillCounts?.[tab.id];
          const hasCount = typeof count === "number" && count >= 0;

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-pressed={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all cursor-pointer whitespace-nowrap shrink-0",
                isActive
                  ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "bg-card text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/80 font-medium"
              )}
            >
              <span>{tab.label}</span>
              {hasCount && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded-full font-mono text-xs tabular-nums",
                    isActive
                      ? "bg-primary-foreground/20 text-primary-foreground font-bold"
                      : "bg-muted text-muted-foreground font-medium"
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
