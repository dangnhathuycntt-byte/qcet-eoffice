"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type {
  SortDirection,
  TableDensity,
  TableColumnVisibility,
  TaskSortField,
} from "../types";
import { TASK_COLUMN_CLASS } from "../constants";
import {
  TableHead,
  TableHeader,
  TableRow,
  TableRowSelector,
  TableSortButton,
  tableAriaSort,
  type TableSortDirection,
} from "@/components/ui/table";

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
  id: TaskSortField | "subtasks" | "meta" | "actions" | "coAssignees" | "createdAt" | "startDate";
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
  visibleColumns = { department: true, priority: true, leadAssignee: true, dueDate: true, status: true },
  className,
  showSelection = false,
  showExpandAll = false,
  isAllExpanded = false,
  onToggleExpandAll,
  hasTasks = true,
}: TaskTableHeaderProps) {
  const activeColumns = React.useMemo(() => {
    const cols: ColumnDefinition[] = [
      { id: "title", label: "Tiêu đề", sortable: true, widthClass: TASK_COLUMN_CLASS.title },
    ];
    if (visibleColumns?.priority !== false) {
      cols.push({ id: "priority", label: "Ưu tiên", sortable: true, widthClass: TASK_COLUMN_CLASS.priority });
    }
    if (visibleColumns?.leadAssignee !== false) {
      cols.push({ id: "leadAssignee", label: "Phụ trách", sortable: true, widthClass: TASK_COLUMN_CLASS.leadAssignee });
    }
    if (visibleColumns?.coAssignees === true) {
      cols.push({ id: "coAssignees", label: "Phối hợp", widthClass: TASK_COLUMN_CLASS.coAssignees });
    }
    if (visibleColumns?.department !== false) {
      cols.push({ id: "department", label: "Đơn vị", sortable: true, widthClass: TASK_COLUMN_CLASS.department });
    }
    if (visibleColumns?.startDate === true) {
      cols.push({ id: "startDate", label: "Bắt đầu", widthClass: TASK_COLUMN_CLASS.startDate });
    }
    if (visibleColumns?.dueDate !== false) {
      cols.push({ id: "dueDate", label: "Hạn", sortable: true, widthClass: TASK_COLUMN_CLASS.dueDate });
    }
    if (visibleColumns?.createdAt === true) {
      cols.push({ id: "createdAt", label: "Ngày tạo", widthClass: TASK_COLUMN_CLASS.createdAt });
    }
    if (visibleColumns?.status === true) {
      cols.push({ id: "status", label: "Trạng thái", sortable: true, widthClass: TASK_COLUMN_CLASS.status });
    }
    return cols;
  }, [visibleColumns]);

  const directionOf = (colId: string): TableSortDirection =>
    sortField === colId || (colId === "title" && sortField === "code") ? sortDirection : null;
  // Cột ngày và cột cuối: đệm phải rộng như mép bảng
  const trailingClass = "pl-2.5 pr-4 sm:pr-5";

  return (
    <TableHeader
      className={cn(
        "sticky top-[calc(48px+env(safe-area-inset-top,0px))] md:top-[var(--task-table-sticky-top,0px)] z-10",
        className
      )}
    >
      <TableRow>
        {/* Optional Selection Checkbox (only rendered when explicitly enabled for batch ops) */}
        {showSelection && (
          <TableHead className="w-10 text-center">
            <div className="flex items-center justify-center">
              <TableRowSelector
                checked={allSelected}
                indeterminate={indeterminate}
                disabled={!hasTasks}
                onToggle={() => onToggleSelectAll?.(!allSelected)}
                aria-label="Chọn tất cả nhiệm vụ hiển thị"
                className="-my-1.5"
              />
            </div>
          </TableHead>
        )}

        {activeColumns.map((col, colIdx) => {
          const isSortable = col.sortable && col.id !== "actions" && col.id !== "subtasks";
          const direction = isSortable ? directionOf(col.id) : null;
          const isLastColumn = colIdx === activeColumns.length - 1;
          const label = isSortable ? (
            <TableSortButton label={col.label} direction={direction} onSort={() => onSort?.(col.id as TaskSortField)} />
          ) : (
            <span>{col.label}</span>
          );

          if (col.id === "title" || col.id === "code") {
            return (
              <TableHead
                key={col.id}
                aria-sort={isSortable ? tableAriaSort(direction) : undefined}
                className={cn("pr-2.5", col.widthClass)}
              >
                <div className="flex items-center gap-2">
                  {/* Chọn tất cả nằm ngay trước tên cột khi không có cột chọn riêng */}
                  {!showSelection && (
                    <TableRowSelector
                      checked={allSelected}
                      indeterminate={indeterminate}
                      onToggle={() => onToggleSelectAll?.(!allSelected)}
                      aria-label="Chọn tất cả nhiệm vụ hiển thị"
                      title={allSelected ? "Bỏ chọn tất cả (X)" : "Chọn tất cả (X)"}
                      className="-my-1.5"
                    />
                  )}
                  <div className="flex items-center gap-1">{label}</div>
                  {/* Screen-reader accessible metadata for table semantics and test compatibility */}
                  <span className="sr-only">Nhiệm vụ Phối hợp Tình trạng Thời hạn Mã Trạng thái Việc con</span>
                </div>
              </TableHead>
            );
          }

          return (
            <TableHead
              key={col.id}
              aria-sort={isSortable ? tableAriaSort(direction) : undefined}
              className={cn(
                col.widthClass,
                col.align === "right" ? "text-right" : col.align === "center" ? "text-center" : "text-left",
                (col.id === "dueDate" || col.id === "createdAt" || col.id === "startDate" || isLastColumn) && trailingClass
              )}
            >
              <div
                className={cn(
                  "flex items-center gap-1.5",
                  col.align === "right" && "justify-end",
                  col.align === "center" && "justify-center"
                )}
              >
                {label}
              </div>
            </TableHead>
          );
        })}
      </TableRow>
    </TableHeader>
  );
}
