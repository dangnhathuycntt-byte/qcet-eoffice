"use client";

import * as React from "react";
import {
  Search,
  X,
  SlidersHorizontal,
  ChevronDown,
  Building2,
  Calendar,
  AlertCircle,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getAcademicMonthsForYear } from "@/lib/academic-calendar";

// ============================================================================
// 1. Interfaces & Types
// ============================================================================

export type SimplifiedTaskStatus = "ALL" | "ACTION_REQUIRED" | "IN_PROGRESS" | "COMPLETED";

export interface StatusPillOption {
  id: SimplifiedTaskStatus;
  label: string;
}

export interface FilterState {
  selectedDepartment?: string;
  selectedAcademicMonth?: number | "ALL";
  selectedPriority?: string;
}

export interface SimplifiedTaskFilterBarProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  activeStatus: SimplifiedTaskStatus;
  onStatusChange: (status: SimplifiedTaskStatus) => void;
  selectedDepartment: string;
  onDepartmentChange: (dept: string) => void;
  selectedAcademicMonth: number | "ALL";
  onAcademicMonthChange: (month: number | "ALL") => void;
  selectedPriority: string;
  onPriorityChange: (p: string) => void;
  totalCount: number;
  availableDepartments?: { code: string; name: string }[];
  onResetFilters?: () => void;
  className?: string;
  placeholder?: string;
}

// ============================================================================
// 2. Constants
// ============================================================================

export const CORE_STATUS_PILLS: StatusPillOption[] = [
  { id: "ALL", label: "Tất cả" },
  { id: "ACTION_REQUIRED", label: "Cần làm ngay" },
  { id: "COMPLETED", label: "Hoàn thành" },
];

export const DEFAULT_DEPARTMENTS: { code: string; name: string }[] = [
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

export const DEFAULT_PRIORITY_OPTIONS: { id: string; label: string }[] = [
  { id: "ALL", label: "Tất cả mức độ" },
  { id: "URGENT", label: "Khẩn cấp" },
  { id: "HIGH", label: "Ưu tiên cao" },
  { id: "NORMAL", label: "Bình thường" },
];

// ============================================================================
// 3. Helper Functions
// ============================================================================

/**
 * Calculates active advanced filters count.
 */
export function countActiveFilters(filters: FilterState): number {
  let count = 0;
  if (filters.selectedDepartment && filters.selectedDepartment !== "ALL") {
    count++;
  }
  if (filters.selectedAcademicMonth !== undefined && filters.selectedAcademicMonth !== "ALL") {
    count++;
  }
  if (filters.selectedPriority && filters.selectedPriority !== "ALL") {
    count++;
  }
  return count;
}

export const countActiveAdvancedFilters = countActiveFilters;

/**
 * Resets advanced filters to default "ALL" state and calls optional onResetFilters.
 */
export function resetAdvancedFilters(callbacks: {
  onDepartmentChange?: (dept: string) => void;
  onAcademicMonthChange?: (month: number | "ALL") => void;
  onPriorityChange?: (priority: string) => void;
  onResetFilters?: () => void;
}): void {
  callbacks.onDepartmentChange?.("ALL");
  callbacks.onAcademicMonthChange?.("ALL");
  callbacks.onPriorityChange?.("ALL");
  callbacks.onResetFilters?.();
}

// ============================================================================
// 4. Main Component: SimplifiedTaskFilterBar
// ============================================================================

export function SimplifiedTaskFilterBar({
  searchQuery,
  onSearchChange,
  activeStatus,
  onStatusChange,
  selectedDepartment,
  onDepartmentChange,
  selectedAcademicMonth,
  onAcademicMonthChange,
  selectedPriority,
  onPriorityChange,
  totalCount,
  availableDepartments = DEFAULT_DEPARTMENTS,
  onResetFilters,
  className,
  placeholder = "Tìm theo tên việc, mã số, người phụ trách...",
}: SimplifiedTaskFilterBarProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);

  const academicMonths = React.useMemo(() => {
    try {
      return getAcademicMonthsForYear("2026-2027");
    } catch {
      return [];
    }
  }, []);

  const activeFilterCount = React.useMemo(() => {
    return countActiveFilters({
      selectedDepartment,
      selectedAcademicMonth,
      selectedPriority,
    });
  }, [selectedDepartment, selectedAcademicMonth, selectedPriority]);

  // Click-outside and keyboard dismissal
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleReset = () => {
    resetAdvancedFilters({
      onDepartmentChange,
      onAcademicMonthChange,
      onPriorityChange,
      onResetFilters,
    });
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-card border border-border/80 rounded-xl p-3 shadow-xs",
        className
      )}
    >
      {/* Search Input & Status Pills */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 min-w-0">
        {/* Search input with search & clear icons */}
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.5}
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-9 py-1.5 text-xs bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              aria-label="Xóa tìm kiếm"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground rounded-md transition-colors"
            >
              <X className="w-3.5 h-3.5" strokeWidth={1.5} />
            </button>
          )}
        </div>

        {/* 3 Core status filter pills */}
        <div
          className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/40 shrink-0 self-start sm:self-auto"
          role="group"
          aria-label="Lọc theo trạng thái"
        >
          {CORE_STATUS_PILLS.map((pill) => {
            const isActive = activeStatus === pill.id;
            return (
              <button
                key={pill.id}
                type="button"
                onClick={() => onStatusChange(pill.id)}
                aria-pressed={isActive}
                className={cn(
                  "px-3 py-1 text-xs font-medium rounded-md transition-all",
                  isActive
                    ? "bg-background text-foreground shadow-xs font-heading font-bold"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                )}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right Controls: Task counter & Progressive Disclosure Filter Popover */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
        {/* Total count */}
        <div className="text-xs text-muted-foreground font-mono tabular-nums whitespace-nowrap">
          <span>{totalCount}</span>
          <span className="ml-1 text-muted-foreground/70">nhiệm vụ</span>
        </div>

        {/* Advanced Filters Popover Container */}
        <div className="relative" ref={popoverRef}>
          <button
            type="button"
            ref={buttonRef}
            onClick={() => setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors",
              isOpen || activeFilterCount > 0
                ? "bg-primary/10 border-primary/30 text-primary font-heading font-bold"
                : "bg-background border-input text-foreground hover:bg-muted/50"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>Bộ lọc nâng cao</span>
            {activeFilterCount > 0 && (
              <span
                data-testid="badge-filter-count"
                className="badge-filter-count inline-flex items-center justify-center min-w-[1.25rem] h-4.5 px-1 rounded-full bg-primary text-primary-foreground text-xs font-mono tabular-nums"
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground transition-transform duration-200",
                isOpen && "rotate-180 text-primary"
              )}
              strokeWidth={1.5}
            />
          </button>

          {/* Popover Sheet */}
          <div
            role="dialog"
            aria-label="Bộ lọc nâng cao"
            className={cn(
              "absolute right-0 top-full mt-2 z-50 w-80 sm:w-88 rounded-xl border border-border bg-popover p-4 text-popover-foreground shadow-lg transition-all",
              !isOpen && "hidden"
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-border/60">
              <div className="flex items-center gap-2">
                <span className="font-heading font-bold text-xs text-foreground">
                  Bộ lọc nâng cao
                </span>
                {activeFilterCount > 0 && (
                  <span className="px-1.5 py-0.5 rounded text-xs bg-primary/15 text-primary font-mono tabular-nums font-semibold">
                    {activeFilterCount} đang chọn
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                aria-label="Đóng bộ lọc"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.5} />
              </button>
            </div>

            {/* Filter Fields */}
            <div className="space-y-3.5 py-3.5">
              {/* Department */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Đơn vị chủ trì</span>
                </label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => onDepartmentChange(e.target.value)}
                  className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                >
                  {availableDepartments.map((dept) => (
                    <option key={dept.code} value={dept.code}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Academic Month */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Tháng học trong năm</span>
                </label>
                <select
                  value={selectedAcademicMonth}
                  onChange={(e) =>
                    onAcademicMonthChange(
                      e.target.value === "ALL" ? "ALL" : Number(e.target.value)
                    )
                  }
                  className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                >
                  <option value="ALL">Tất cả các tháng</option>
                  {academicMonths.map((month) => (
                    <option key={month.monthNumber} value={month.monthNumber}>
                      {month.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Mức độ ưu tiên</span>
                </label>
                <select
                  value={selectedPriority}
                  onChange={(e) => onPriorityChange(e.target.value)}
                  className="w-full text-xs bg-background border border-input rounded-lg px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                >
                  {DEFAULT_PRIORITY_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-3 border-t border-border/60">
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" strokeWidth={1.5} />
                <span>Đặt lại bộ lọc</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
