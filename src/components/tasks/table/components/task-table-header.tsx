"use client";

import * as React from "react";
import {
  ArrowUpDown,
  ChevronDown,
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
  id: TaskSortField;
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

const TABLE_COLUMNS: ColumnDefinition[] = [
  { id: "code", label: "Mã NV", sortable: true, widthClass: "w-[105px]" },
  { id: "title", label: "Nhiệm vụ cấp Trường", sortable: true },
  { id: "department", label: "Đơn vị & Danh mục", sortable: true, widthClass: "w-36" },
  { id: "leadAssignee", label: "Chủ trì (DRI)", sortable: true, widthClass: "w-40 min-w-[150px]" },
  { id: "dueDate", label: "Thời hạn & SLA", sortable: true, widthClass: "w-32" },
  { id: "priority", label: "Ưu tiên", sortable: true, widthClass: "w-20" },
  { id: "progress", label: "Tiến độ & Thao tác", sortable: true, align: "right", widthClass: "w-48" },
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
        "sticky top-0 z-10 border-b border-slate-200/80 bg-slate-50/95 backdrop-blur-xs select-none",
        className
      )}
    >
      <tr className={cn(rowHeightClass, "text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground")}>
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

        {/* Expand/Collapse All Caret */}
        <th
          scope="col"
          className={cn("w-9 text-center align-middle", paddingClass)}
        >
          {showExpandAll && onToggleExpandAll ? (
            <button
              type="button"
              onClick={onToggleExpandAll}
              disabled={!hasTasks}
              className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-slate-200/60 hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
              title={isAllExpanded ? "Thu gọn tất cả việc con" : "Mở rộng tất cả việc con"}
              aria-label={isAllExpanded ? "Thu gọn tất cả việc con" : "Mở rộng tất cả việc con"}
            >
              {isAllExpanded ? (
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              ) : (
                <ChevronUp className="size-3.5 rotate-90" strokeWidth={1.5} />
              )}
            </button>
          ) : (
            <span className="sr-only">Mở rộng</span>
          )}
        </th>

        {/* Data Columns */}
        {TABLE_COLUMNS.map((col) => {
          const isSorted = sortField === col.id;
          const ariaSortValue = isSorted
            ? sortDirection === "asc"
              ? "ascending"
              : "descending"
            : "none";

          return (
            <th
              key={col.id}
              scope="col"
              aria-sort={ariaSortValue}
              className={cn(
                "group/th align-middle whitespace-nowrap",
                col.widthClass,
                paddingClass,
                col.align === "right" ? "text-right" : "text-left"
              )}
            >
              {col.sortable && onSort ? (
                <button
                  type="button"
                  onClick={() => onSort(col.id)}
                  className={cn(
                    "inline-flex items-center gap-1.5 text-xs sm:text-[12.5px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-95",
                    col.align === "right" && "justify-end w-full",
                    isSorted && "text-foreground font-bold"
                  )}
                  title={`Sắp xếp theo ${col.label}`}
                >
                  <span>{col.label}</span>
                  {renderSortIndicator(col.id)}
                </button>
              ) : (
                <span className={cn(col.align === "right" && "block text-right")}>
                  {col.label}
                </span>
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
