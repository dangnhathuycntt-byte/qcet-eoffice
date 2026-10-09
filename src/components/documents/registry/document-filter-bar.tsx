"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import {
  Search,
  X,
  ChevronDown,
  Check,
  Building2,
  Calendar,
  AlertCircle,
  Clock,
  RotateCcw,
  FileSpreadsheet,
  Loader2,
  Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { DensityToggle } from "@/components/ui/density-toggle";
import { useDepartmentList } from "@/hooks/use-department-list";
import { cn } from "@/lib/utils";

export interface DocumentFilterBarProps {
  /** Search query string */
  searchQuery: string;
  /** Search change handler */
  onSearchChange: (value: string) => void;

  /** Urgency filter value ('ALL', 'flash', 'top_urgent', 'urgent', 'normal', etc.) */
  urgencyFilter: string;
  /** Urgency change handler */
  onUrgencyChange: (urgency: string) => void;

  /** Status filter value ('ALL', 'pending_assignment', 'processing', 'delegated', 'approved', 'completed', etc.) */
  statusFilter: string;
  /** Status change handler */
  onStatusChange: (status: string) => void;

  /** Department/Lead Unit ID filter value ('ALL' or department ID) */
  departmentFilter?: string;
  /** Department change handler */
  onDepartmentChange?: (departmentId: string) => void;

  /** Year filter value ('ALL' or year as string e.g. '2026') */
  yearFilter?: string;
  /** Year change handler */
  onYearChange?: (year: string) => void;

  /** Optional department list override; if omitted, automatically uses `useDepartmentList()` */
  departments?: Array<{ id: string; name: string; code?: string }>;

  /** Optional custom year options */
  years?: Array<{ value: string; label: string }>;

  /** Export Excel handler */
  onExportExcel?: () => void;
  /** Is Excel export currently loading */
  isExporting?: boolean;

  /** Reset all filters handler */
  onResetFilters?: () => void;

  /** Whether to show the density toggle (default: true) */
  showDensityToggle?: boolean;

  /** Additional CSS class names */
  className?: string;
}

export const URGENCY_FILTER_OPTIONS: Array<{
  value: string;
  label: string;
  badgeClass?: string;
}> = [
  { value: "ALL", label: "Độ khẩn: Tất cả" },
  { value: "flash", label: "Hỏa tốc", badgeClass: "text-red-700 bg-red-500/10" },
  { value: "top_urgent", label: "Thượng khẩn", badgeClass: "text-amber-700 bg-amber-500/10" },
  { value: "urgent", label: "Khẩn", badgeClass: "text-amber-700 bg-amber-500/10" },
  { value: "normal", label: "Thường", badgeClass: "text-muted-foreground bg-muted" },
];

export const STATUS_FILTER_OPTIONS: Array<{
  value: string;
  label: string;
  dotClass?: string;
}> = [
  { value: "ALL", label: "Trạng thái: Tất cả" },
  { value: "pending_assignment", label: "Chờ phân công / Bút phê", dotClass: "bg-amber-500" },
  { value: "processing", label: "Đang xử lý", dotClass: "bg-blue-500" },
  { value: "delegated", label: "Đã giao việc", dotClass: "bg-emerald-500" },
  { value: "approved", label: "Chờ phê duyệt", dotClass: "bg-indigo-500" },
  { value: "completed", label: "Đã hoàn thành", dotClass: "bg-emerald-500" },
];

const currentYear = new Date().getFullYear();
export const DEFAULT_YEAR_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "ALL", label: "Năm ban hành: Tất cả" },
  { value: String(currentYear), label: `Năm ${currentYear}` },
  { value: String(currentYear - 1), label: `Năm ${currentYear - 1}` },
  { value: String(currentYear - 2), label: `Năm ${currentYear - 2}` },
  { value: String(currentYear - 3), label: `Năm ${currentYear - 3}` },
];

export function DocumentFilterBar({
  searchQuery,
  onSearchChange,
  urgencyFilter,
  onUrgencyChange,
  statusFilter,
  onStatusChange,
  departmentFilter = "ALL",
  onDepartmentChange,
  yearFilter = "ALL",
  onYearChange,
  departments: customDepartments,
  years = DEFAULT_YEAR_OPTIONS,
  onExportExcel,
  isExporting = false,
  onResetFilters,
  showDensityToggle = true,
  className,
}: DocumentFilterBarProps) {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const { departments: fetchedDepartments } = useDepartmentList();
  const departmentList = customDepartments || fetchedDepartments;

  const departmentOptions = React.useMemo(() => {
    const list: Array<{ value: string; label: string; code?: string }> = [
      { value: "ALL", label: "Đơn vị: Tất cả", code: undefined },
    ];
    departmentList.forEach((dept) => {
      list.push({
        value: dept.id,
        label: dept.name,
        code: dept.code,
      });
    });
    return list;
  }, [departmentList]);

  // Compute active filters
  const hasActiveFilters = React.useMemo(() => {
    return (
      searchQuery.trim().length > 0 ||
      urgencyFilter !== "ALL" ||
      statusFilter !== "ALL" ||
      departmentFilter !== "ALL" ||
      yearFilter !== "ALL"
    );
  }, [searchQuery, urgencyFilter, statusFilter, departmentFilter, yearFilter]);

  const activeFiltersCount = React.useMemo(() => {
    let count = 0;
    if (searchQuery.trim().length > 0) count++;
    if (urgencyFilter !== "ALL") count++;
    if (statusFilter !== "ALL") count++;
    if (departmentFilter !== "ALL") count++;
    if (yearFilter !== "ALL") count++;
    return count;
  }, [searchQuery, urgencyFilter, statusFilter, departmentFilter, yearFilter]);

  const handleReset = () => {
    if (onResetFilters) {
      onResetFilters();
    } else {
      onSearchChange("");
      onUrgencyChange("ALL");
      onStatusChange("ALL");
      if (onDepartmentChange) onDepartmentChange("ALL");
      if (onYearChange) onYearChange("ALL");
    }
  };

  const selectedUrgencyObj =
    URGENCY_FILTER_OPTIONS.find((o) => o.value === urgencyFilter) ?? URGENCY_FILTER_OPTIONS[0];
  const selectedStatusObj =
    STATUS_FILTER_OPTIONS.find((o) => o.value === statusFilter) ?? STATUS_FILTER_OPTIONS[0];
  const selectedDeptObj =
    departmentOptions.find((o) => o.value === departmentFilter) ?? departmentOptions[0];
  const selectedYearObj =
    years.find((o) => o.value === yearFilter) ?? years[0];

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 p-3 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs",
        className
      )}
      data-slot="document-filter-bar"
    >
      {/* 1. Unified Toolbar Row */}
      <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center justify-between">
        <div className="flex items-center gap-2 flex-1">
          {/* Search input with search icon & clear button */}
          <div className="relative flex-1 min-w-[200px]">
            <Search
              className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
              aria-hidden="true"
            />
            <input
              type="text"
              placeholder="Tìm kiếm số hiệu, trích yếu, cơ quan ban hành..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full min-h-[44px] sm:min-h-7 sm:h-7 pl-10 pr-9 text-xs rounded-xl border border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              aria-label="Tìm kiếm văn bản và công văn"
            />
            {searchQuery.trim().length > 0 && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-[0.98] transition-all cursor-pointer"
                aria-label="Xóa nội dung tìm kiếm"
              >
                <X className="size-3.5" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Unified Popover Bộ lọc duy nhất */}
          <Popover.Root open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <Popover.Trigger
              type="button"
              className={cn(
                "min-h-[44px] sm:min-h-7 sm:h-7 px-3 text-xs rounded-xl border border-border/70 bg-background hover:bg-muted/50 flex items-center gap-1.5 active:scale-[0.98] cursor-pointer shrink-0 transition-all select-none",
                (isFilterOpen || activeFiltersCount > 0) && "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
              )}
              aria-label="Mở bảng bộ lọc"
            >
              <Filter className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              <span>Bộ lọc</span>
              {activeFiltersCount > 0 && (
                <span className="size-4 rounded-full bg-primary/10 text-primary text-xs font-mono tabular-nums font-bold flex items-center justify-center">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown
                className={cn(
                  "size-3 text-muted-foreground/70 transition-transform duration-150",
                  isFilterOpen && "rotate-180 text-foreground"
                )}
                strokeWidth={1.5}
              />
            </Popover.Trigger>

            <Popover.Portal>
              <Popover.Positioner className="z-50" side="bottom" align="start" sideOffset={6} collisionPadding={12}>
                <Popover.Popup
                  style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
                  className="w-[320px] sm:w-[380px] p-3.5 rounded-2xl border border-border/80 bg-popover text-popover-foreground shadow-xl backdrop-blur-md space-y-3.5 outline-hidden animate-in fade-in-0 zoom-in-95 duration-100"
                  aria-label="Bảng điều khiển bộ lọc văn bản"
                >
                  {/* Popover Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-border/60">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                      <Filter className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                      <span>Bộ lọc văn bản</span>
                      {activeFiltersCount > 0 && (
                        <span className="size-4 rounded-full bg-primary/10 text-primary text-xs font-mono tabular-nums font-bold flex items-center justify-center">
                          {activeFiltersCount}
                        </span>
                      )}
                    </div>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={handleReset}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer active:scale-[0.98] transition-all"
                      >
                        <RotateCcw className="size-3" strokeWidth={1.5} />
                        <span>Đặt lại</span>
                      </button>
                    )}
                  </div>

                  {/* 1. Status Filter Section */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <Clock className="size-3" strokeWidth={1.5} />
                      <span>Trạng thái xử lý:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {STATUS_FILTER_OPTIONS.map((opt) => {
                        const isSelected = statusFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onStatusChange(opt.value)}
                            className={cn(
                              "min-h-[28px] px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]",
                              isSelected
                                ? "bg-foreground/85 text-background border-foreground/85 font-medium shadow-2xs"
                                : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/80 hover:text-foreground"
                            )}
                          >
                            {opt.dotClass && (
                              <span
                                className={cn(
                                  "size-1.5 rounded-full shrink-0",
                                  isSelected ? "bg-background" : opt.dotClass
                                )}
                              />
                            )}
                            <span>{opt.label.replace("Trạng thái: ", "")}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Urgency Filter Section */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                      <AlertCircle className="size-3" strokeWidth={1.5} />
                      <span>Độ khẩn:</span>
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {URGENCY_FILTER_OPTIONS.map((opt) => {
                        const isSelected = urgencyFilter === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => onUrgencyChange(opt.value)}
                            className={cn(
                              "min-h-[28px] px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer flex items-center gap-1.5 active:scale-[0.98]",
                              isSelected
                                ? "bg-foreground/85 text-background border-foreground/85 font-medium shadow-2xs"
                                : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/80 hover:text-foreground"
                            )}
                          >
                            <span>{opt.label.replace("Độ khẩn: ", "")}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 3. Department Filter Section */}
                  {onDepartmentChange && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Building2 className="size-3" strokeWidth={1.5} />
                        <span>Đơn vị chủ trì:</span>
                      </span>
                      <div className="relative">
                        <select
                          value={departmentFilter}
                          onChange={(e) => onDepartmentChange(e.target.value)}
                          className="w-full min-h-[32px] px-2.5 py-1 text-xs rounded-lg border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all cursor-pointer"
                        >
                          {departmentOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label} {opt.code ? `(${opt.code})` : ""}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  )}

                  {/* 4. Year Filter Section */}
                  {onYearChange && (
                    <div className="space-y-1.5">
                      <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                        <Calendar className="size-3" strokeWidth={1.5} />
                        <span>Năm ban hành:</span>
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {years.map((opt) => {
                          const isSelected = yearFilter === opt.value;
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => onYearChange(opt.value)}
                              className={cn(
                                "min-h-[28px] px-2.5 py-1 text-xs rounded-lg border transition-all cursor-pointer font-mono tabular-nums active:scale-[0.98]",
                                isSelected
                                  ? "bg-foreground/85 text-background border-foreground/85 font-medium shadow-2xs"
                                  : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/80 hover:text-foreground"
                              )}
                            >
                              {opt.label.replace("Năm ban hành: ", "")}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>

        {/* Right controls: Reset, Density, Export Excel */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="min-h-[44px] sm:min-h-7 sm:h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1.5 cursor-pointer active:scale-[0.98]"
              aria-label="Xóa tất cả bộ lọc đang áp dụng"
              title="Xóa bộ lọc"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Đặt lại</span>
              <span className="size-4 rounded-full bg-primary/10 text-primary text-xs font-bold inline-flex items-center justify-center font-mono tabular-nums">
                {activeFiltersCount}
              </span>
            </Button>
          )}

          {showDensityToggle && (
            <DensityToggle className="min-h-[44px] sm:min-h-7 sm:h-7 rounded-xl border-border/70 shadow-2xs shrink-0" />
          )}

          {onExportExcel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              disabled={isExporting}
              className="min-h-[44px] sm:min-h-7 sm:h-7 px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 text-foreground cursor-pointer shrink-0 gap-1.5 active:scale-[0.98]"
              aria-label="Xuất sổ văn bản ra tệp Excel"
              title="Xuất danh sách văn bản sang định dạng Excel"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin text-primary" strokeWidth={1.5} />
              ) : (
                <FileSpreadsheet className="size-3.5 text-emerald-700" strokeWidth={1.5} />
              )}
              <span className="font-medium">Xuất Excel</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Flat Informational Pills (Active Filter Breadcrumbs) */}
      {hasActiveFilters && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1 text-xs">
          <span className="text-muted-foreground/70 font-mono tabular-nums text-xs">Đang lọc:</span>

          {searchQuery.trim().length > 0 && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 transition-colors select-none">
              <Search className="size-3.5 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">Tìm:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">&quot;{searchQuery}&quot;</span>
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa từ khóa tìm kiếm"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            </span>
          )}

          {statusFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 transition-colors select-none">
              <Clock className="size-3.5 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">Trạng thái:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {selectedStatusObj.label.replace("Trạng thái: ", "")}
              </span>
              <button
                type="button"
                onClick={() => onStatusChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc trạng thái"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            </span>
          )}

          {urgencyFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 transition-colors select-none">
              <AlertCircle className="size-3.5 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">Độ khẩn:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {selectedUrgencyObj.label.replace("Độ khẩn: ", "")}
              </span>
              <button
                type="button"
                onClick={() => onUrgencyChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc độ khẩn"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            </span>
          )}

          {departmentFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 transition-colors select-none">
              <Building2 className="size-3.5 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">Đơn vị:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {selectedDeptObj.label.replace("Đơn vị: ", "")}
              </span>
              <button
                type="button"
                onClick={() => onDepartmentChange && onDepartmentChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc đơn vị"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            </span>
          )}

          {yearFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 transition-colors select-none">
              <Calendar className="size-3.5 text-muted-foreground/75 shrink-0" strokeWidth={1.5} />
              <span className="text-muted-foreground text-xs whitespace-nowrap">Năm:</span>
              <span className="font-medium text-xs truncate max-w-[200px] font-mono tabular-nums">
                {selectedYearObj.label.replace("Năm ban hành: ", "")}
              </span>
              <button
                type="button"
                onClick={() => onYearChange && onYearChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc năm"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-primary hover:underline ml-1 cursor-pointer flex items-center gap-1 active:scale-[0.98] transition-all"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa tất cả</span>
          </button>
        </div>
      )}
    </div>
  );
}
