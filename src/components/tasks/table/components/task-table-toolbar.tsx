"use client";

import * as React from "react";
import {
  Search,
  X,
  Building2,
  Layers,
  Rows3,
  Rows4,
  List,
  Kanban,
  Plus,
  FileSpreadsheet,
  ChevronDown,
  Loader2,
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
  TaskViewMode,
} from "../types";
import { getSystemReferenceDate } from "../utils/table-date-helpers";
import {
  isTaskAssignedToUser,
  isTaskOrSubtaskDueToday,
  isTaskOrSubtaskOverdue,
  isTaskOrSubtaskPendingReview,
} from "../utils/table-filter-engine";

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
  }
): Record<SmartFilterTab, number> {
  const refDate = options?.referenceDate || getSystemReferenceDate();
  const counts: Record<SmartFilterTab, number> = {
    all: tasks.length,
    my_tasks: 0,
    overdue: 0,
    review: 0,
    today: 0,
    in_progress: 0,
    completed: 0,
  };

  for (const task of tasks) {
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
  viewMode?: TaskViewMode;
  onViewModeChange?: (mode: TaskViewMode) => void;

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
  selectedDepartment = "ALL",
  onDepartmentChange,
  departmentOptions = DEPARTMENT_OPTIONS,
  selectedCategory = "ALL",
  onCategoryChange,
  categoryOptions = CATEGORY_TABS,
  density = "comfortable",
  onDensityChange,
  viewMode = "table",
  onViewModeChange,
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

  // Lắng nghe phím tắt toàn cục: '/' và 'Cmd+K' / 'Ctrl+K'
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isSearchShortcut(e)) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClearSearch = React.useCallback(() => {
    setLocalQuery("");
    onSearchChange("");
    searchInputRef.current?.focus();
  }, [onSearchChange]);

  // Tính toán số lượng thẻ lọc nếu không được truyền trực tiếp
  const computedPillCounts = React.useMemo(() => {
    let counts = pillCounts;
    if (!counts && tasks && tasks.length > 0) {
      counts = aggregateFilterCounts(tasks, {
        currentUserId,
        currentUserName,
      });
    }
    // Tự động bổ sung số lượng tổng "Tất cả" khi có totalTasksCount
    if (totalTasksCount !== undefined && (!counts || counts.all === undefined)) {
      counts = { ...counts, all: totalTasksCount };
    }
    return counts;
  }, [pillCounts, tasks, currentUserId, currentUserName, totalTasksCount]);

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      {/* Hàng 1: Ô tìm kiếm + Bộ lọc Dropdowns + Điều khiển Chế độ & Mật độ + Nút hành động */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
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

          {/* Dropdown Danh mục DACUM */}
          {onCategoryChange && (
            <div className="relative inline-flex items-center">
              <Layers
                className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
                strokeWidth={1.5}
              />
              <select
                value={selectedCategory}
                onChange={(e) =>
                  onCategoryChange(e.target.value as TaskCategory | "ALL")
                }
                aria-label="Lọc theo danh mục DACUM"
                className="h-9 pl-8 pr-7 rounded-lg border border-border bg-card text-xs font-medium text-foreground hover:bg-muted/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-colors cursor-pointer appearance-none max-w-[170px] truncate"
              >
                {categoryOptions.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.label}
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

        {/* Nhóm bên phải: Mật độ + Chế độ xem + Xuất Excel + Thêm công việc */}
        <div className="flex items-center gap-2 shrink-0">
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

          {/* Nút Thêm công việc mới */}
          {onAddTask && canCreateTask && (
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={onAddTask}
              className="h-9 px-3 gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
              aria-label="Thêm công việc mới"
            >
              <Plus className="size-4" strokeWidth={2} />
              <span>Thêm công việc</span>
            </Button>
          )}
        </div>
      </div>

      {/* Hàng 2: Dải thẻ lọc thông minh (Smart Filter Pills) */}
      <div
        role="tablist"
        aria-label="Bộ lọc thông minh theo ngữ cảnh"
        className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none"
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
