"use client";

import * as React from "react";
import { Filter, X, RotateCcw } from "lucide-react";

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

  // If there are no secondary filters applied, render nothing to maintain a seamless flush layout
  const hasAnySecondaryFilter =
    hasDept || hasWorkbox || hasSearch || hasStatus || hasOverdue;

  if (!hasAnySecondaryFilter) {
    return null;
  }

  const handleClearAll = () => {
    if (onResetFilters) onResetFilters();
    else if (onClearAll) onClearAll();
  };

  return (
    <div
      data-slot="active-filter-breadcrumb"
      className={`flex flex-wrap items-center gap-1.5 py-1 text-xs font-sans ${className}`}
    >
      <div className="flex items-center gap-1 text-muted-foreground font-medium shrink-0 mr-1">
        <Filter className="size-3 text-primary" strokeWidth={1.5} />
        <span className="text-[11px]">Đang lọc:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Department chip */}
        {hasDept && (
          <div
            data-slot="filter-chip-department"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/70 border border-border/70 text-foreground text-xs font-medium"
          >
            <span>
              Đơn vị: <strong className="font-semibold">{department}</strong>
            </span>
            {(onRemoveDepartment || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveDepartment) onRemoveDepartment();
                  else if (onRemoveFilter) onRemoveFilter("department");
                }}
                aria-label={`Xóa lọc Đơn vị: ${department}`}
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Status chip */}
        {hasStatus && (
          <div
            data-slot="filter-chip-status"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/70 border border-border/70 text-foreground text-xs font-medium"
          >
            <span>
              Trạng thái: <strong className="font-semibold">{status}</strong>
            </span>
            {(onRemoveStatus || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveStatus) onRemoveStatus();
                  else if (onRemoveFilter) onRemoveFilter("status");
                }}
                aria-label={`Xóa lọc Trạng thái: ${status}`}
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Search chip */}
        {hasSearch && (
          <div
            data-slot="filter-chip-search"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/70 border border-border/70 text-foreground text-xs font-medium"
          >
            <span>
              Từ khóa: <strong className="font-semibold">&quot;{search!.trim()}&quot;</strong>
            </span>
            {(onRemoveSearch || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveSearch) onRemoveSearch();
                  else if (onRemoveFilter) onRemoveFilter("search");
                }}
                aria-label={`Xóa lọc từ khóa "${search!.trim()}"`}
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Overdue chip */}
        {hasOverdue && (
          <div
            data-slot="filter-chip-overdue"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium"
          >
            <span>Quá hạn</span>
            {(onRemoveOverdue || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveOverdue) onRemoveOverdue();
                  else if (onRemoveFilter) onRemoveFilter("overdue");
                }}
                aria-label="Xóa lọc Quá hạn"
                className="hover:text-rose-950 text-rose-700 p-0.5 rounded hover:bg-rose-100 transition-colors focus:outline-hidden cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Workbox chip */}
        {hasWorkbox && (
          <div
            data-slot="filter-chip-workbox"
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/70 border border-border/70 text-foreground text-xs font-medium"
          >
            <span>
              Hộp việc: <strong className="font-semibold">{getWorkboxDisplayLabel(workbox!)}</strong>
            </span>
            {(onRemoveWorkbox || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveWorkbox) onRemoveWorkbox();
                  else if (onRemoveFilter) onRemoveFilter("workbox");
                }}
                aria-label={`Xóa lọc Hộp việc: ${getWorkboxDisplayLabel(workbox!)}`}
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden cursor-pointer"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Clear all filters button */}
        {(onResetFilters || onClearAll) && (
          <button
            type="button"
            data-slot="clear-all-filters"
            onClick={handleClearAll}
            aria-label="Xóa tất cả bộ lọc bổ sung"
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground hover:underline ml-1 cursor-pointer transition-colors"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa lọc</span>
          </button>
        )}
      </div>

      {/* Match count badge */}
      {totalFilteredCount !== undefined && (
        <span className="text-muted-foreground text-[11px] font-mono tabular-nums ml-auto">
          {totalFilteredCount} kết quả{totalCount !== undefined ? ` / ${totalCount}` : ""}
        </span>
      )}
    </div>
  );
}
