"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZES } from "../constants";

export interface TaskPaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  className?: string;
  shortcutTrigger?: React.ReactNode;
}

export function getPageNumbers(currentPage: number, totalPages: number): (number | "...")[] {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: (number | "...")[] = [];
  pages.push(1);

  if (currentPage > 3) {
    pages.push("...");
  }

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (currentPage < totalPages - 2) {
    pages.push("...");
  }

  pages.push(totalPages);
  return pages;
}

export const TaskPaginationBar = React.memo(function TaskPaginationBar({
  currentPage,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = DEFAULT_PAGE_SIZES,
  disabled = false,
  className,
  shortcutTrigger,
}: TaskPaginationBarProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const effectivePageSizeOptions = React.useMemo(() => {
    if (pageSizeOptions.includes(pageSize)) return pageSizeOptions;
    return [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safeCurrentPage * pageSize);

  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  const handlePrevious = () => {
    if (safeCurrentPage > 1 && !disabled) {
      onPageChange(safeCurrentPage - 1);
    }
  };

  const handleNext = () => {
    if (safeCurrentPage < totalPages && !disabled) {
      onPageChange(safeCurrentPage + 1);
    }
  };

  const handleFirst = () => {
    if (safeCurrentPage > 1 && !disabled) {
      onPageChange(1);
    }
  };

  const handleLast = () => {
    if (safeCurrentPage < totalPages && !disabled) {
      onPageChange(totalPages);
    }
  };

  return (
    <nav
      aria-label="Phân trang bảng công việc"
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/60 bg-muted/20 px-4 py-2 select-none",
        className
      )}
    >
      {/* Left section: Item range counter & page size selector */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <div className="tabular-nums">
          {totalItems === 0 ? (
            <span>0 nhiệm vụ</span>
          ) : (
            <span>
              <strong className="font-semibold text-foreground font-mono">
                {startItem}–{endItem}
              </strong>{" "}
              /{" "}
              <strong className="font-semibold text-foreground font-mono">
                {totalItems}
              </strong>{" "}
              nhiệm vụ
            </span>
          )}
        </div>

        {/* Page Size Selector */}
        <div className="flex items-center gap-1.5 ml-1">
          <label htmlFor="task-table-page-size" className="sr-only">
            Số lượng công việc trên mỗi trang
          </label>
          <select
            id="task-table-page-size"
            value={pageSize}
            disabled={disabled || totalItems === 0}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="h-8 rounded-lg border border-border/80 bg-background px-2 py-0.5 text-xs font-medium text-foreground shadow-2xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
            aria-label="Số lượng công việc trên mỗi trang"
          >
            {effectivePageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Right section: Page navigation buttons & optional shortcut trigger */}
      <div className="flex items-center gap-1">
        {/* First Page Button */}
        <button
          type="button"
          onClick={handleFirst}
          disabled={disabled || safeCurrentPage <= 1}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-95"
          title="Trang đầu"
          aria-label="Về trang đầu"
        >
          <ChevronsLeft className="size-3.5" strokeWidth={1.5} />
        </button>

        {/* Previous Page Button */}
        <button
          type="button"
          onClick={handlePrevious}
          disabled={disabled || safeCurrentPage <= 1}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-95"
          title="Trang trước"
          aria-label="Sang trang trước"
        >
          <ChevronLeft className="size-3.5" strokeWidth={1.5} />
        </button>

        {/* Numeric Page Buttons */}
        <div className="flex items-center gap-1 mx-1">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <span
                  key={`ellipsis-${idx}`}
                  className="inline-flex size-8 items-center justify-center text-xs font-mono text-muted-foreground select-none"
                  aria-hidden="true"
                >
                  ...
                </span>
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <button
                key={p}
                type="button"
                onClick={() => !disabled && onPageChange(p)}
                disabled={disabled}
                aria-current={isCurrent ? "page" : undefined}
                className={cn(
                  "inline-flex size-8 items-center justify-center rounded-lg text-xs font-medium font-mono tabular-nums transition-colors shadow-2xs cursor-pointer active:scale-95",
                  isCurrent
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border border-border/80 bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                aria-label={`Trang ${p}`}
              >
                {p}
              </button>
            );
          })}
        </div>

        {/* Next Page Button */}
        <button
          type="button"
          onClick={handleNext}
          disabled={disabled || safeCurrentPage >= totalPages}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-95"
          title="Trang sau"
          aria-label="Sang trang sau"
        >
          <ChevronRight className="size-3.5" strokeWidth={1.5} />
        </button>

        {/* Last Page Button */}
        <button
          type="button"
          onClick={handleLast}
          disabled={disabled || safeCurrentPage >= totalPages}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-95"
          title="Trang cuối"
          aria-label="Về trang cuối"
        >
          <ChevronsRight className="size-3.5" strokeWidth={1.5} />
        </button>

        {/* Optional Shortcut Help Trigger */}
        {shortcutTrigger && (
          <div className="hidden sm:flex items-center ml-1.5 pl-2 border-l border-border/60">
            {shortcutTrigger}
          </div>
        )}
      </div>
    </nav>
  );
});
