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
  const hasStatus = Boolean(status && status !== "ALL");
  const hasOverdue = Boolean(overdue);
  const hasScope = Boolean(scope && scope !== "ALL");

  const hasAnyFilter =
    hasDept || hasWorkbox || hasSearch || hasStatus || hasOverdue || hasScope;

  if (!hasAnyFilter) {
    return null;
  }

  const handleClearAll = () => {
    if (onResetFilters) onResetFilters();
    else if (onClearAll) onClearAll();
  };

  const scopeLabel =
    scope === "school"
      ? "Toàn trường"
      : scope === "unit"
      ? "Đơn vị"
      : scope === "my"
      ? "Việc của tôi"
      : scope;

  return (
    <div
      data-slot="active-filter-breadcrumb"
      className={`flex flex-wrap items-center gap-2 p-2.5 rounded-xl bg-muted/40 border border-border/60 text-xs font-sans ${className}`}
    >
      <div className="flex items-center gap-1.5 text-muted-foreground font-medium shrink-0">
        <Filter className="size-3.5 text-primary" strokeWidth={1.5} />
        <span>Bộ lọc:</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {/* Scope chip */}
        {hasScope && (
          <div
            data-slot="filter-chip-scope"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-medium shadow-2xs"
          >
            <span>
              Phạm vi: <strong className="font-semibold">{scopeLabel}</strong>
            </span>
            {(onRemoveScope || onRemoveFilter) && (
              <button
                type="button"
                onClick={() => {
                  if (onRemoveScope) onRemoveScope();
                  else if (onRemoveFilter) onRemoveFilter("scope");
                }}
                aria-label={`Xóa lọc Phạm vi: ${scopeLabel}`}
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden touch-manipulation"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}

        {/* Department chip */}
        {hasDept && (
          <div
            data-slot="filter-chip-department"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-medium shadow-2xs"
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
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden touch-manipulation"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-medium shadow-2xs"
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
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden touch-manipulation"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-medium shadow-2xs"
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
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden touch-manipulation"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 font-medium shadow-2xs"
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
                className="hover:text-rose-950 text-rose-700 p-0.5 rounded hover:bg-rose-100 transition-colors focus:outline-hidden touch-manipulation"
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
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-background border border-border/80 text-foreground font-medium shadow-2xs"
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
                className="hover:text-foreground text-muted-foreground p-0.5 rounded hover:bg-muted transition-colors focus:outline-hidden touch-manipulation"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* Match count badge */}
      {totalFilteredCount !== undefined && (
        <span className="text-muted-foreground text-xs font-medium font-mono tabular-nums">
          ({totalFilteredCount} kết quả{totalCount !== undefined ? ` / ${totalCount}` : ""})
        </span>
      )}

      {/* Clear all filters button */}
      {(onResetFilters || onClearAll) && (
        <button
          type="button"
          data-slot="clear-all-filters"
          onClick={handleClearAll}
          className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 active:bg-rose-200 active:scale-[0.96] border border-rose-200/80 transition-all focus:outline-hidden touch-manipulation cursor-pointer"
        >
          <RotateCcw className="size-3" strokeWidth={1.5} />
          <span>Xóa lọc</span>
        </button>
      )}
    </div>
  );
}
