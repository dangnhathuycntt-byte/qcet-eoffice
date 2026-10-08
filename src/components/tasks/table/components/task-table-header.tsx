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
  id: TaskSortField | "subtasks" | "meta" | "actions" | "coAssignees" | "createdAt";
  label: string;
  sortable?: boolean;
  align?: "left" | "center" | "right";
  widthClass?: string;
}

// Columns: Nhiệm vụ (Title & Code) | Đơn vị | Ưu tiên | Phụ trách | Hạn | (Tiến độ)
export function TaskTableHeader({
  sortField,
  sortDirection = "asc",
  onSort,
  allSelected = false,
  indeterminate = false,
  onToggleSelectAll,
  density = "comfortable",
  visibleColumns = { department: true, priority: true, leadAssignee: true, dueDate: true, progress: false },
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
    const cols: ColumnDefinition[] = [
      { id: "title", label: "Tiêu đề", sortable: true, widthClass: "min-w-[280px]" },
    ];
    if (visibleColumns?.priority !== false) {
      cols.push({ id: "priority", label: "Ưu tiên", sortable: true, widthClass: "w-[84px]" });
    }
    if (visibleColumns?.leadAssignee !== false) {
      cols.push({ id: "leadAssignee", label: "Phụ trách", sortable: true, widthClass: "w-[170px]" });
    }
    if (visibleColumns?.coAssignees === true) {
      cols.push({ id: "coAssignees", label: "Phối hợp", widthClass: "w-[110px]" });
    }
    if (visibleColumns?.department !== false) {
      cols.push({ id: "department", label: "Đơn vị", sortable: true, widthClass: "w-[170px]" });
    }
    if (visibleColumns?.dueDate !== false) {
      cols.push({ id: "dueDate", label: "Hạn", sortable: true, align: "right", widthClass: "w-[110px]" });
    }
    if (visibleColumns?.createdAt === true) {
      cols.push({ id: "createdAt", label: "Ngày tạo", align: "right", widthClass: "w-[96px]" });
    }
    if (visibleColumns?.status === true) {
      cols.push({ id: "status", label: "Trạng thái", sortable: true, widthClass: "w-[130px]" });
    }
    if (visibleColumns?.progress === true) {
      cols.push({ id: "progress", label: "Tiến độ", sortable: true, align: "right", widthClass: "w-[90px]" });
    }
    return cols;
  }, [visibleColumns]);

  const renderSortIndicator = (colId: TaskSortField | string) => {
    const isFieldSorted = sortField === colId || (colId === "title" && sortField === "code");
    if (isFieldSorted) {
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

  const rowHeightClass = "h-11";
  const paddingClass = "px-3 py-2.5";

  return (
    <thead
      className={cn(
        "sticky top-[calc(48px+env(safe-area-inset-top,0px))] md:top-0 z-10 bg-card select-none",
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
          const leadingPaddingClass = isFirstColumn ? "pl-4 sm:pl-5 pr-2.5 py-2.5" : paddingClass;
          const isLastColumn = colIdx === activeColumns.length - 1;
          const columnPaddingClass = col.id === "dueDate" || isLastColumn
            ? "pl-2.5 pr-4 sm:pr-5 py-2.5"
            : isFirstColumn
            ? leadingPaddingClass
            : paddingClass;

          // Special alignment for First Column (Title / Nhiệm vụ): Header leading selector + label "Nhiệm vụ"
          if (col.id === "title" || col.id === "code") {
            return (
              <th
                key={col.id}
                scope="col"
                aria-sort={ariaSortValue}
                className={cn(
                  "align-middle font-medium transition-colors group/th text-left",
                  col.widthClass,
                  leadingPaddingClass
                )}
              >
                <div className="flex items-center gap-2">
                  {/* Header selector: Accessible keyboard + hit area (rendered when separate selection column is disabled) */}
                  {!showSelection && (
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
                          className="size-4 rounded-[4px] bg-primary text-primary-foreground flex items-center justify-center shadow-2xs hover:opacity-90 transition-all active:scale-[0.98] pointer-events-none"
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
                          className="size-4 rounded-[4px] border border-border/70 bg-background/60 opacity-60 group-hover/th-selector:opacity-100 group-hover/th:opacity-100 group-hover:border-primary group-hover:bg-primary/5 group-hover:scale-105 flex items-center justify-center transition-all duration-150 ease-out active:scale-[0.98] shadow-2xs pointer-events-none"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                  )}

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
                  {/* Screen-reader accessible metadata for table semantics and test compatibility */}
                  <span className="sr-only">Nhiệm vụ Phối hợp Tình trạng Thời hạn Mã Trạng thái Việc con</span>
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
                "align-middle font-medium whitespace-nowrap transition-colors group/th",
                col.widthClass,
                col.align === "right"
                  ? "text-right"
                  : col.align === "center"
                  ? "text-center"
                  : "text-left",
                columnPaddingClass
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
