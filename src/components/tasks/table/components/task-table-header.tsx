"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SortDirection,
  TableDensity,
  TableColumnVisibility,
  TaskSortField,
} from "../types";

export interface TaskTableHeaderProps {
  sortField?: TaskSortField;
  sortDirection?: SortDirection;
  onSort?: (field: TaskSortField) => void;
  allSelected?: boolean;
  indeterminate?: boolean;
  onToggleSelectAll?: (selected: boolean) => void;
  density?: TableDensity;
  visibleColumns?: TableColumnVisibility;
  className?: string;
  showSelection?: boolean;
  showExpandAll?: boolean;
  isAllExpanded?: boolean;
  onToggleExpandAll?: () => void;
  hasTasks?: boolean;
}

interface ColumnDefinition {
  id: TaskSortField | "subtasks" | "actions";
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

// Linear Columns: Checkbox | Name | Status | Priority (opt) | Lead | Target date | Subtasks (opt) | Progress (opt) | Actions
const ALL_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: "title", label: "Nhiệm vụ", sortable: true, widthClass: "min-w-[320px] md:min-w-[400px] flex-1" },
  { id: "status", label: "Tình trạng", sortable: true, widthClass: "w-28 min-w-[100px]" },
  { id: "priority", label: "Ưu tiên", sortable: true, widthClass: "w-20 min-w-[72px]" },
  { id: "leadAssignee", label: "Chủ trì / Đơn vị", sortable: true, widthClass: "w-44 lg:w-52 min-w-[160px]" },
  { id: "dueDate", label: "Hạn chót", sortable: true, widthClass: "w-32 min-w-[110px]" },
  { id: "subtasks", label: "Việc con", sortable: false, widthClass: "w-20 min-w-[70px]", align: "center" },
  { id: "progress", label: "Tiến độ", sortable: true, widthClass: "w-24 min-w-[92px]" },
  { id: "actions", label: "", sortable: false, align: "right", widthClass: "w-8 min-w-[32px]" },
];

export function TaskTableHeader({
  sortField,
  sortDirection = "asc",
  onSort,
  allSelected = false,
  indeterminate = false,
  onToggleSelectAll,
  density = "comfortable",
  visibleColumns = { priority: true, subtasks: true, progress: true },
  className,
  showSelection = false,
  showExpandAll = false,
  isAllExpanded = false,
  onToggleExpandAll,
  hasTasks = true,
}: TaskTableHeaderProps) {
  const checkboxRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  const activeColumns = React.useMemo(() => {
    return ALL_TABLE_COLUMNS.filter((col) => {
      if (col.id === "priority" && visibleColumns.priority === false) return false;
      if (col.id === "subtasks" && visibleColumns.subtasks === false) return false;
      if (col.id === "progress" && visibleColumns.progress === false) return false;
      return true;
    });
  }, [visibleColumns]);

  const renderSortIndicator = (colId: TaskSortField) => {
    if (sortField === colId) {
      return sortDirection === "asc" ? (
        <ChevronUp className="size-3 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      ) : (
        <ChevronDown className="size-3 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      );
    }
    return (
      <ArrowUpDown
        className="size-3 text-slate-400 opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0"
        strokeWidth={1.5}
      />
    );
  };

  const rowHeightClass = "h-9";
  const paddingClass = "px-2.5 py-1.5";

  return (
    <thead
      className={cn(
        "sticky top-[calc(48px+env(safe-area-inset-top,0px))] md:top-0 z-20 border-b border-border/40 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xs select-none",
        className
      )}
    >
      <tr className={cn(rowHeightClass, "text-xs font-medium text-muted-foreground")}>
        {/* Optional Selection Checkbox (only rendered when explicitly enabled for batch ops) */}
        {showSelection && (
          <th
            scope="col"
            className={cn("w-10 text-center align-middle", paddingClass)}
          >
            <div className="flex items-center justify-center">
              <input
                ref={checkboxRef}
                type="checkbox"
                checked={allSelected}
                disabled={!hasTasks}
                onChange={(e) => onToggleSelectAll?.(e.target.checked)}
                className="size-4 rounded border-border/80 text-primary focus:ring-1 focus:ring-primary/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Chọn tất cả nhiệm vụ hiển thị"
              />
            </div>
          </th>
        )}

        {/* Data Columns */}
        {activeColumns.map((col, colIdx) => {
          const isSortable = col.sortable && col.id !== "actions" && col.id !== "subtasks";
          const isSorted = isSortable && sortField === col.id;
          const ariaSortValue = isSorted
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : isSortable
            ? "none"
            : undefined;

          // First column padding alignment when selection checkbox is absent
          const isFirstColumn = !showSelection && colIdx === 0;
          const titlePaddingClass = isFirstColumn ? "pl-3 sm:pl-3.5 pr-2.5 py-1.5" : paddingClass;

          // Special alignment for Title column: Linear Header Leading Selector + Label
          if (col.id === "title") {
            return (
              <th
                key={col.id}
                scope="col"
                aria-sort={ariaSortValue}
                className={cn(
                  "align-middle font-medium transition-colors group/th text-left",
                  col.widthClass,
                  titlePaddingClass
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Linear Header Selector: Large hit area (~32px) for effortless clicking */}
                  <div
                    className="size-7 sm:size-8 -my-1.5 -ml-1 shrink-0 flex items-center justify-center relative select-none cursor-pointer group/th-selector"
                    onClick={() => onToggleSelectAll?.(!allSelected)}
                    title={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                  >
                    {indeterminate || allSelected ? (
                      <div
                        className="size-4 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xs hover:opacity-90 transition-all active:scale-95 pointer-events-none"
                        aria-label={allSelected ? "Bỏ chọn tất cả" : "Chọn tất cả"}
                      >
                        {allSelected ? (
                          <Check className="size-3 text-primary-foreground" strokeWidth={2.5} />
                        ) : (
                          <span className="w-2 h-0.5 bg-primary-foreground rounded-full" />
                        )}
                      </div>
                    ) : (
                      <div
                        className="size-4 rounded-[4px] border border-border/80 bg-background/80 hover:border-primary hover:bg-primary/10 opacity-0 group-hover/th-selector:opacity-100 group-hover/th:opacity-100 flex items-center justify-center transition-all active:scale-95 shadow-2xs pointer-events-none"
                        aria-label="Chọn tất cả nhiệm vụ hiển thị"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(col.id as TaskSortField)}
                        className="group/sort inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none"
                      >
                        <span>{col.label}</span>
                        {renderSortIndicator(col.id as TaskSortField)}
                      </button>
                    ) : (
                      <span>{col.label}</span>
                    )}
                  </div>
                </div>
              </th>
            );
          }

          return (
            <th
              key={col.id}
              scope="col"
              aria-sort={ariaSortValue}
              className={cn(
                "align-middle font-medium transition-colors group/th",
                col.widthClass,
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left",
                paddingClass
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  col.align === "right" && "justify-end",
                  col.align === "center" && "justify-center"
                )}
              >
                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.id as TaskSortField)}
                    className="group/sort inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none"
                  >
                    <span>{col.label}</span>
                    {renderSortIndicator(col.id as TaskSortField)}
                  </button>
                ) : (
                  <span>{col.label}</span>
                )}
              </div>
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
