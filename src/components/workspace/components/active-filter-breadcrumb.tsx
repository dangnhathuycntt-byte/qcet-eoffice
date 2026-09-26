"use client";

import * as React from "react";
import { Filter, X, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ActiveFilterSummaryParams {
  dept?: string;
  workbox?: string;
  search?: string;
  scope?: string;
  status?: string;
  overdue?: boolean;
}

export function getWorkboxDisplayLabel(workbox: string): string {
  switch (workbox) {
    case "my_pending_approval":
      return "Chờ tôi duyệt";
    case "my_pending_submission":
      return "Chờ nộp báo cáo";
    case "my_tasks":
      return "Việc của tôi";
    case "waiting_approval":
      return "Chờ duyệt";
    case "pending_submission":
      return "Chờ nộp BC";
    default:
      return workbox;
  }
}

export function getStatusDisplayLabel(status: string): string {
  switch (status.toUpperCase()) {
    case "WAITING_APPROVAL":
    case "PENDING_EXECUTIVE_APPROVAL":
      return "Chờ duyệt";
    case "NEEDS_REVIEW":
      return "Cần chỉnh sửa";
    case "IN_PROGRESS":
      return "Đang thực hiện";
    case "COMPLETED":
      return "Hoàn thành";
    case "CANCELLED":
    case "CANCELED":
      return "Đã hủy";
    case "TODO":
    case "NOT_STARTED":
    case "ASSIGNED":
    case "NEW":
      return "Mới";
    case "OVERDUE":
      return "Quá hạn";
    default:
      return status;
  }
}


export function getActiveFilterSummary(params: ActiveFilterSummaryParams): string[] {
  const parts: string[] = [];
  if (params.dept && params.dept !== "ALL") {
    parts.push(`Đơn vị: ${params.dept}`);
  }
  if (params.workbox && params.workbox !== "ALL") {
    parts.push(`Hộp việc: ${getWorkboxDisplayLabel(params.workbox)}`);
  }
  if (params.search && params.search.trim()) {
    parts.push(`Từ khóa: "${params.search.trim()}"`);
  }
  if (params.status && params.status !== "ALL") {
    parts.push(`Trạng thái: ${params.status}`);
  }
  if (params.overdue) {
    parts.push("Quá hạn");
  }
  if (params.scope && params.scope !== "ALL") {
    const scopeLabel =
      params.scope === "school"
        ? "Toàn trường"
        : params.scope === "unit"
        ? "Đơn vị"
        : params.scope === "my"
        ? "Việc của tôi"
        : params.scope;
    parts.push(`Phạm vi: ${scopeLabel}`);
  }
  return parts;
}

// ─── Chip styling per filter type ─────────────────────────���──
const chipStyles = {
  base: "inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-md text-xs font-medium transition-colors",
  department: "bg-blue-50 text-blue-700 border border-blue-200/80",
  status: "bg-amber-50 text-amber-800 border border-amber-200/80",
  search: "bg-slate-100 text-slate-700 border border-slate-200",
  overdue: "bg-rose-50 text-rose-700 border border-rose-200/80",
  workbox: "bg-violet-50 text-violet-700 border border-violet-200/80",
  dismiss: "size-4 flex items-center justify-center rounded-sm hover:bg-black/8 cursor-pointer transition-colors ml-0.5",
} as const;

export interface ActiveFilterBreadcrumbProps {
  scope?: string;
  department?: string;
  workbox?: string;
  status?: string;
  search?: string;
  overdue?: boolean;
  totalFilteredCount?: number;
  totalCount?: number;
  onResetFilters?: () => void;
  onClearAll?: () => void;
  onRemoveScope?: () => void;
  onRemoveDepartment?: () => void;
  onRemoveWorkbox?: () => void;
  onRemoveStatus?: () => void;
  onRemoveSearch?: () => void;
  onRemoveOverdue?: () => void;
  onRemoveFilter?: (filterType: string) => void;
  className?: string;
}

export function ActiveFilterBreadcrumb({
  scope,
  department,
  workbox,
  status,
  search,
  overdue,
  totalFilteredCount,
  totalCount,
  onResetFilters,
  onClearAll,
  onRemoveScope,
  onRemoveDepartment,
  onRemoveWorkbox,
  onRemoveStatus,
  onRemoveSearch,
  onRemoveOverdue,
  onRemoveFilter,
  className = "",
}: ActiveFilterBreadcrumbProps) {
  const hasDept = Boolean(department && department !== "ALL");
  const hasWorkbox = Boolean(workbox && workbox !== "ALL");
  const hasSearch = Boolean(search && search.trim().length > 0);
  const hasStatus = Boolean(status && status !== "ALL" && status !== "all");
  const hasOverdue = Boolean(overdue);

  const hasAnySecondaryFilter =
    hasDept || hasWorkbox || hasSearch || hasStatus || hasOverdue;

  if (!hasAnySecondaryFilter) {
    return null;
  }

  const handleClearAll = () => {
    if (onResetFilters) onResetFilters();
    else if (onClearAll) onClearAll();
  };

  const handleRemove = (
    specific?: () => void,
    fallbackType?: string
  ) => {
    if (specific) specific();
    else if (onRemoveFilter && fallbackType) onRemoveFilter(fallbackType);
  };

  return (
    <div
      data-slot="active-filter-breadcrumb"
      className={cn(
        "flex flex-wrap items-center gap-1.5 py-1.5 text-xs",
        className
      )}
    >
      {/* Label */}
      <div className="flex items-center gap-1 text-muted-foreground shrink-0 mr-0.5">
        <Filter className="size-3 text-muted-foreground/70" strokeWidth={1.5} />
        <span className="text-[11px] font-medium">Đang lọc:</span>
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {hasStatus && (
          <span data-slot="filter-chip" className={cn(chipStyles.base, chipStyles.status)}>
            <span>Trạng thái: <strong className="font-semibold">{getStatusDisplayLabel(status!)}</strong></span>
            {(onRemoveStatus || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveStatus, "status")}
                aria-label={`Xóa lọc Trạng thái: ${status}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={2} />
              </button>
            )}
          </span>
        )}

        {hasDept && (
          <span data-slot="filter-chip" className={cn(chipStyles.base, chipStyles.department)}>
            <span>Đơn vị: <strong className="font-semibold">{department}</strong></span>
            {(onRemoveDepartment || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveDepartment, "department")}
                aria-label={`Xóa lọc Đơn vị: ${department}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={2} />
              </button>
            )}
          </span>
        )}

        {hasOverdue && (
          <span data-slot="filter-chip" className={cn(chipStyles.base, chipStyles.overdue)}>
            <span>Quá hạn</span>
            {(onRemoveOverdue || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveOverdue, "overdue")}
                aria-label="Xóa lọc Quá hạn" className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={2} />
              </button>
            )}
          </span>
        )}

        {hasWorkbox && (
          <span data-slot="filter-chip" className={cn(chipStyles.base, chipStyles.workbox)}>
            <span>Hộp việc: <strong className="font-semibold">{getWorkboxDisplayLabel(workbox!)}</strong></span>
            {(onRemoveWorkbox || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveWorkbox, "workbox")}
                aria-label={`Xóa lọc Hộp việc: ${getWorkboxDisplayLabel(workbox!)}`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={2} />
              </button>
            )}
          </span>
        )}

        {hasSearch && (
          <span data-slot="filter-chip" className={cn(chipStyles.base, chipStyles.search)}>
            <span>Từ khóa: <strong className="font-semibold">&quot;{search!.trim()}&quot;</strong></span>
            {(onRemoveSearch || onRemoveFilter) && (
              <button type="button" onClick={() => handleRemove(onRemoveSearch, "search")}
                aria-label={`Xóa lọc từ khóa "${search!.trim()}"`} className={chipStyles.dismiss}>
                <X className="size-2.5" strokeWidth={2} />
              </button>
            )}
          </span>
        )}

        {/* Clear all */}
        {(onResetFilters || onClearAll) && (
          <button
            type="button"
            data-slot="clear-all-filters"
            onClick={handleClearAll}
            aria-label="Xóa tất cả bộ lọc"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors ml-0.5 cursor-pointer rounded px-1 py-0.5 hover:bg-muted"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Result count — pushed right */}
      {totalFilteredCount !== undefined && (
        <span className="text-muted-foreground text-[11px] font-mono tabular-nums ml-auto shrink-0">
          {totalFilteredCount} kết quả{totalCount !== undefined ? ` / ${totalCount}` : ""}
        </span>
      )}
    </div>
  );
}
