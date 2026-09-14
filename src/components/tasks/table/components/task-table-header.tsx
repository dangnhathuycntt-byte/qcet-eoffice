"use client";

import * as React from "react";
import {
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  SortDirection,
  TableDensity,
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
  className?: string;
  showSelection?: boolean;
  showExpandAll?: boolean;
  isAllExpanded?: boolean;
  onToggleExpandAll?: () => void;
  hasTasks?: boolean;
}

interface ColumnDefinition {
  id: TaskSortField | "actions";
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

// Plan T12 (table hierarchy): Task | Owner | Unit | Due | Status | Progress | Actions.
const TABLE_COLUMNS: ColumnDefinition[] = [
  { id: "title", label: "Nhiệm vụ", sortable: true },
  { id: "leadAssignee", label: "Người chủ trì", sortable: true, widthClass: "w-36" },
  { id: "department", label: "Đơn vị", sortable: true, widthClass: "w-36 sm:w-40" },
  { id: "dueDate", label: "Hạn", sortable: true, widthClass: "w-32" },
  { id: "status", label: "Trạng thái", sortable: true, widthClass: "w-28" },
  { id: "progress", label: "Tiến độ", sortable: true, widthClass: "w-28" },
  { id: "actions", label: "Thao tác", sortable: false, align: "right", widthClass: "w-24 sm:w-28" },
];

export function TaskTableHeader({
  sortField,
  sortDirection = "asc",
  onSort,
  allSelected = false,
  indeterminate = false,
  onToggleSelectAll,
  density = "comfortable",
  className,
  showSelection = true,
  showExpandAll = true,
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

  const renderSortIndicator = (colId: TaskSortField) => {
    if (sortField === colId) {
      return sortDirection === "asc" ? (
        <ChevronUp className="size-3.5 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      ) : (
        <ChevronDown className="size-3.5 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      );
    }
    return (
      <ArrowUpDown
        className="size-3 text-muted-foreground/40 opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0"
        strokeWidth={1.5}
      />
    );
  };

  const rowHeightClass = density === "compact" ? "h-9" : "h-11";
  const paddingClass = density === "compact" ? "px-2.5 py-1.5" : "px-3.5 py-2.5";

  return (
    <thead
      className={cn(
        "sticky top-0 z-10 border-b border-border/70 bg-card/95 select-none",
        className
      )}
    >
      <tr className={cn(rowHeightClass, "text-xs font-semibold text-muted-foreground")}>
        {/* Selection Checkbox */}
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
                className="size-4 rounded border-slate-300 text-primary focus:ring-2 focus:ring-primary/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Chọn tất cả nhiệm vụ hiển thị"
              />
            </div>
          </th>
        )}

        {/* Data Columns */}
        {TABLE_COLUMNS.map((col) => {
          const isSortable = col.sortable && col.id !== "actions";
          const isSorted = isSortable && sortField === col.id;
          const ariaSortValue = isSorted
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : isSortable
            ? "none"
            : undefined;

          return (
            <th
              key={col.id}
              scope="col"
              aria-sort={ariaSortValue}
              className={cn(
                "align-middle font-semibold transition-colors group/th",
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
                  col.align === "right" && "justify-end"
                )}
              >
                {col.id === "title" && showExpandAll && onToggleExpandAll && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleExpandAll();
                    }}
                    disabled={!hasTasks}
                    className="inline-flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-slate-200/70 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors mr-1 shrink-0"
                    title={isAllExpanded ? "Thu gọn tất cả việc con" : "Mở rộng tất cả việc con"}
                    aria-label={isAllExpanded ? "Thu gọn tất cả việc con" : "Mở rộng tất cả việc con"}
                  >
                    {isAllExpanded ? (
                      <ChevronDown className="size-3.5" strokeWidth={1.5} />
                    ) : (
                      <ChevronRight className="size-3.5" strokeWidth={1.5} />
                    )}
                  </button>
                )}

                {isSortable ? (
                  <button
                    type="button"
                    onClick={() => onSort?.(col.id as TaskSortField)}
                    className="group/sort inline-flex items-center gap-1.5 hover:text-foreground transition-colors cursor-pointer select-none"
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
