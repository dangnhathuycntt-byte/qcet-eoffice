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

// Columns: Checkbox | Name | Status | Priority (opt) | Lead | Target date | Subtasks (opt) | Progress (opt) | Actions
const ALL_TABLE_COLUMNS: ColumnDefinition[] = [
  { id: "title", label: "Nhiệm vụ", sortable: true, widthClass: "min-w-[320px] md:min-w-[400px] flex-1" },
  { id: "leadAssignee", label: "Phụ trách", sortable: true, widthClass: "w-48 lg:w-56 min-w-[160px]" },
  { id: "subtasks", label: "Phối hợp", sortable: false, widthClass: "w-36 min-w-[120px]" },
  { id: "dueDate", label: "Thời hạn", sortable: true, widthClass: "w-32 min-w-[110px]" },
  { id: "status", label: "Tình trạng", sortable: true, widthClass: "w-36 min-w-[120px]" },
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
  visibleColumns = { priority: false, subtasks: false, progress: true },
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

  const activeColumns = ALL_TABLE_COLUMNS;

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
        className="size-3 text-muted-foreground opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0"
        strokeWidth={1.5}
      />
    );
  };

  const rowHeightClass = "h-9";
  const paddingClass = "px-2.5 py-1.5";

  return (
    <thead
      className={cn(
        "sticky top-[calc(48px+env(safe-area-inset-top,0px))] md:top-0 z-10 border-b border-border/60 bg-white/95 backdrop-blur-xs select-none",
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
                className="size-4 rounded border-border/80 text-primary focus:ring-2 focus:ring-primary/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
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
          const titlePaddingClass = isFirstColumn ? "pl-3.5 sm:pl-4 pr-2.5 py-1.5" : paddingClass;

          // Special alignment for Title column: Header leading selector + label
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
                  {/* Header selector: Accessible keyboard + hit area */}
                  <div
                    role="checkbox"
                    aria-checked={indeterminate ? "mixed" : allSelected}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === " " || e.key === "Enter") {
                        e.preventDefault();
                        onToggleSelectAll?.(!allSelected);
                      }
                    }}
                    className="size-7 sm:size-8 -my-1.5 ml-0 shrink-0 flex items-center justify-center relative select-none cursor-pointer group/th-selector focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
                    onClick={() => onToggleSelectAll?.(!allSelected)}
                    title={allSelected ? "Bỏ chọn tất cả (X)" : "Chọn tất cả (X)"}
                  >
                    {indeterminate || allSelected ? (
                      <div
                        className="size-4 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xs hover:opacity-90 transition-all active:scale-95 pointer-events-none"
                        aria-hidden="true"
                      >
                        {allSelected ? (
                          <Check className="size-3 text-primary-foreground" strokeWidth={2.5} />
                        ) : (
                          <span className="w-2 h-0.5 bg-primary-foreground rounded-full" />
                        )}
                      </div>
                    ) : (
                      <div
                        className="size-4 rounded-[4px] border border-border/70 bg-background/60 opacity-60 group-hover/th-selector:opacity-100 group-hover/th:opacity-100 group-hover:border-primary group-hover:bg-primary/5 group-hover:scale-105 flex items-center justify-center transition-all duration-150 ease-out active:scale-95 shadow-2xs pointer-events-none"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => onSort?.(col.id as TaskSortField)}
                        className="group/sort inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
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
                    className="group/sort inline-flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer select-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none rounded"
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
