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
  id: TaskSortField | "subtasks" | "actions";
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

// Linear Columns: Checkbox | Name & Code | Health | Priority | Lead | Target date | Subtasks | Progress | Actions
const TABLE_COLUMNS: ColumnDefinition[] = [
  { id: "title", label: "Nhiệm vụ", sortable: true, widthClass: "min-w-[340px] md:min-w-[440px] flex-1" },
  { id: "status", label: "Tình trạng", sortable: true, widthClass: "w-28" },
  { id: "priority", label: "Ưu tiên", sortable: true, widthClass: "w-20" },
  { id: "leadAssignee", label: "Chủ trì", sortable: true, widthClass: "w-32" },
  { id: "dueDate", label: "Hạn chót", sortable: true, widthClass: "w-28" },
  { id: "subtasks", label: "Việc con", sortable: false, widthClass: "w-20", align: "center" },
  { id: "progress", label: "Tiến độ", sortable: true, widthClass: "w-20" },
  { id: "actions", label: "", sortable: false, align: "right", widthClass: "w-8" },
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
        <ChevronUp className="size-3 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      ) : (
        <ChevronDown className="size-3 text-primary shrink-0 transition-transform" strokeWidth={1.5} />
      );
    }
    return (
      <ArrowUpDown
        className="size-3 text-muted-foreground/30 opacity-0 group-hover/th:opacity-100 transition-opacity shrink-0"
        strokeWidth={1.5}
      />
    );
  };

  const rowHeightClass = "h-8";
  const paddingClass = "px-2 py-1";

  return (
    <thead
      className={cn(
        "sticky top-0 z-10 border-b border-border/40 bg-white/95 backdrop-blur-xs select-none",
        className
      )}
    >
      <tr className={cn(rowHeightClass, "text-xs font-medium text-slate-500")}>
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
                className="size-3.5 rounded border-slate-300 text-primary focus:ring-1 focus:ring-primary/25 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                aria-label="Chọn tất cả nhiệm vụ hiển thị"
              />
            </div>
          </th>
        )}

        {/* Data Columns */}
        {TABLE_COLUMNS.map((col) => {
          const isSortable = col.sortable && col.id !== "actions" && col.id !== "subtasks";
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
