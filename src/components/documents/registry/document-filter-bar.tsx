"use client";

import * as React from "react";
import { Select } from "@base-ui/react/select";
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
import { useDepartmentList, type DepartmentOption } from "@/hooks/use-department-list";
import { cn } from "@/lib/utils";
import { motionDuration, motionEase } from "@/lib/motion/tokens";

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
  { value: "flash", label: "Hỏa tốc", badgeClass: "text-red-600 bg-red-500/10" },
  { value: "top_urgent", label: "Thượng khẩn", badgeClass: "text-amber-600 bg-amber-500/10" },
  { value: "urgent", label: "Khẩn", badgeClass: "text-amber-600 bg-amber-500/10" },
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
  { value: "delegated", label: "Đã giao việc", dotClass: "bg-indigo-500" },
  { value: "approved", label: "Chờ phê duyệt", dotClass: "bg-purple-500" },
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

  // Compute active filters count
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

  const motionPopupStyle: React.CSSProperties = {
    "--popup-enter-duration": `${motionDuration.dropdownEnter * 1000}ms`,
    "--popup-exit-duration": `${motionDuration.dropdownExit * 1000}ms`,
    "--popup-ease": `cubic-bezier(${motionEase.enter.join(",")})`,
  } as React.CSSProperties;

  return (
    <div
      className={cn(
        "p-3 sm:p-4 rounded-2xl border border-border/70 bg-card/90 backdrop-blur-xs space-y-3",
        className
      )}
      data-slot="document-filter-bar"
    >
      {/* Top row: Search input + Actions (Reset, Density, Export) */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
        {/* Search input with search icon & clear button */}
        <div className="relative flex-1 min-w-[240px]">
          <Search
            className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            strokeWidth={1.5}
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Tìm theo số ký hiệu, trích yếu nội dung, cơ quan ban hành..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full min-h-[40px] pl-10 pr-9 text-xs rounded-xl border border-border/70 bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            aria-label="Tìm kiếm văn bản và công văn"
          />
          {searchQuery.trim().length > 0 && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 size-6 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted active:scale-95 transition-all cursor-pointer"
              aria-label="Xóa nội dung tìm kiếm"
            >
              <X className="size-3.5" strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          {/* Reset Filters button */}
          {hasActiveFilters && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground rounded-xl gap-1.5 cursor-pointer active:scale-98"
              aria-label="Xóa tất cả bộ lọc đang áp dụng"
              title="Xóa bộ lọc"
            >
              <RotateCcw className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Đặt lại bộ lọc</span>
              <span className="inline-flex sm:hidden">Đặt lại</span>
              <span className="size-4 rounded-full bg-primary/10 text-primary text-[10px] font-bold inline-flex items-center justify-center font-mono">
                {activeFiltersCount}
              </span>
            </Button>
          )}

          {/* Density Toggle */}
          {showDensityToggle && (
            <DensityToggle className="h-9 rounded-xl border-border/70 shadow-2xs shrink-0" />
          )}

          {/* Export Excel Button */}
          {onExportExcel && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              disabled={isExporting}
              className="h-9 px-3 text-xs rounded-xl border-border/70 shadow-2xs hover:bg-muted/60 text-foreground cursor-pointer shrink-0 gap-1.5 active:scale-98"
              aria-label="Xuất sổ văn bản ra tệp Excel"
              title="Xuất danh sách văn bản sang định dạng Excel"
            >
              {isExporting ? (
                <Loader2 className="size-3.5 animate-spin text-primary" strokeWidth={1.5} />
              ) : (
                <FileSpreadsheet className="size-3.5 text-emerald-600" strokeWidth={1.5} />
              )}
              <span className="font-medium">Xuất Excel</span>
            </Button>
          )}
        </div>
      </div>

      {/* Bottom row: Filter Dropdowns (Status, Urgency, Department, Year) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none flex-wrap sm:flex-nowrap">
        {/* Status Select */}
        <div className="shrink-0 min-w-[150px]">
          <Select.Root
            value={statusFilter}
            onValueChange={(val) => {
              if (val) onStatusChange(val);
            }}
          >
            <Select.Trigger
              aria-label="Bộ lọc trạng thái xử lý"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer select-none",
                statusFilter !== "ALL"
                  ? "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
                  : "border-border/70 bg-background text-foreground hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <Clock className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <Select.Value className="truncate">
                  {selectedStatusObj.label.replace("Trạng thái: ", "")}
                </Select.Value>
              </div>
              <Select.Icon>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                <Select.Popup
                  style={motionPopupStyle}
                  className="min-w-[210px] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-hidden transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
                >
                  <Select.List>
                    {STATUS_FILTER_OPTIONS.map((opt) => (
                      <Select.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-hidden data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {opt.dotClass && (
                            <span className={cn("size-2 rounded-full shrink-0", opt.dotClass)} />
                          )}
                          <Select.ItemText>{opt.label}</Select.ItemText>
                        </div>
                        <Select.ItemIndicator>
                          <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Urgency Select */}
        <div className="shrink-0 min-w-[140px]">
          <Select.Root
            value={urgencyFilter}
            onValueChange={(val) => {
              if (val) onUrgencyChange(val);
            }}
          >
            <Select.Trigger
              aria-label="Bộ lọc độ khẩn"
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer select-none",
                urgencyFilter !== "ALL"
                  ? "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400 font-semibold shadow-2xs"
                  : "border-border/70 bg-background text-foreground hover:bg-muted/30"
              )}
            >
              <div className="flex items-center gap-1.5 truncate">
                <AlertCircle className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                <Select.Value className="truncate">
                  {selectedUrgencyObj.label.replace("Độ khẩn: ", "")}
                </Select.Value>
              </div>
              <Select.Icon>
                <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
              </Select.Icon>
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                <Select.Popup
                  style={motionPopupStyle}
                  className="min-w-[180px] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-hidden transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
                >
                  <Select.List>
                    {URGENCY_FILTER_OPTIONS.map((opt) => (
                      <Select.Item
                        key={opt.value}
                        value={opt.value}
                        className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-hidden data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                      >
                        <Select.ItemText>{opt.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    ))}
                  </Select.List>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* Department Select (if onDepartmentChange provided) */}
        {onDepartmentChange && (
          <div className="shrink-0 min-w-[160px] flex-1 max-w-xs">
            <Select.Root
              value={departmentFilter}
              onValueChange={(val) => {
                if (val) onDepartmentChange(val);
              }}
            >
              <Select.Trigger
                aria-label="Bộ lọc đơn vị chủ trì"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer select-none",
                  departmentFilter !== "ALL"
                    ? "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
                    : "border-border/70 bg-background text-foreground hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Building2 className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <Select.Value className="truncate">
                    {selectedDeptObj.label.replace("Đơn vị: ", "")}
                  </Select.Value>
                </div>
                <Select.Icon>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                  <Select.Popup
                    style={motionPopupStyle}
                    className="w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-hidden transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
                  >
                    <Select.List>
                      {departmentOptions.map((opt) => (
                        <Select.Item
                          key={opt.value}
                          value={opt.value}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-hidden data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <Select.ItemText>{opt.label}</Select.ItemText>
                            {opt.code && (
                              <span className="px-1.5 py-0.2 rounded-md bg-muted text-[10px] font-mono text-muted-foreground font-semibold">
                                {opt.code}
                              </span>
                            )}
                          </div>
                          <Select.ItemIndicator>
                            <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        )}

        {/* Year Select (if onYearChange provided) */}
        {onYearChange && (
          <div className="shrink-0 min-w-[130px]">
            <Select.Root
              value={yearFilter}
              onValueChange={(val) => {
                if (val) onYearChange(val);
              }}
            >
              <Select.Trigger
                aria-label="Bộ lọc năm ban hành"
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs transition-all cursor-pointer select-none",
                  yearFilter !== "ALL"
                    ? "border-primary/40 bg-primary/5 text-primary font-semibold shadow-2xs"
                    : "border-border/70 bg-background text-foreground hover:bg-muted/30"
                )}
              >
                <div className="flex items-center gap-1.5 truncate">
                  <Calendar className="size-3.5 shrink-0 text-muted-foreground" strokeWidth={1.5} />
                  <Select.Value className="truncate">
                    {selectedYearObj.label.replace("Năm ban hành: ", "")}
                  </Select.Value>
                </div>
                <Select.Icon>
                  <ChevronDown className="size-3.5 shrink-0 text-muted-foreground/60" strokeWidth={1.5} />
                </Select.Icon>
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner className="z-50" side="bottom" align="start" sideOffset={4}>
                  <Select.Popup
                    style={motionPopupStyle}
                    className="min-w-[160px] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-hidden transition-[opacity,transform] duration-150 data-[starting-style]:opacity-0 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[ending-style]:scale-95"
                  >
                    <Select.List>
                      {years.map((opt) => (
                        <Select.Item
                          key={opt.value}
                          value={opt.value}
                          className="flex w-full cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs outline-hidden data-[highlighted]:bg-muted data-[selected]:bg-primary/10 data-[selected]:text-primary"
                        >
                          <Select.ItemText>{opt.label}</Select.ItemText>
                          <Select.ItemIndicator>
                            <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.List>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>
        )}
      </div>
    </div>
  );
}
