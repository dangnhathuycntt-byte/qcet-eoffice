"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  Check,
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

export function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "...")[] {
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
  // Hide the entire pagination footer (including page size selector) when results fit within one page
  if (totalItems <= pageSize) {
    return null;
  }

  const [isSizeMenuOpen, setIsSizeMenuOpen] = React.useState(false);
  const sizeMenuRef = React.useRef<HTMLDivElement>(null);

  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const effectivePageSizeOptions = React.useMemo(() => {
    if (pageSizeOptions.includes(pageSize)) return pageSizeOptions;
    return [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  }, [pageSizeOptions, pageSize]);

  const startItem = totalItems === 0 ? 0 : (safeCurrentPage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safeCurrentPage * pageSize);

  const pageNumbers = getPageNumbers(safeCurrentPage, totalPages);

  // Click outside listener for custom page size dropdown
  // ponytail: click-outside/Escape handled by Base UI Popover

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
      {/* Left section: Item range counter & custom page size selector */}
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

        {/* Custom Page Size Dropdown Popover */}
        <Popover.Root open={isSizeMenuOpen} onOpenChange={setIsSizeMenuOpen}>
        <div className="relative flex items-center gap-1.5 ml-1" ref={sizeMenuRef}>
          <label htmlFor="task-table-page-size" className="sr-only">
            Số lượng công việc trên mỗi trang
          </label>

          <Popover.Trigger
            type="button"
            id="task-table-page-size-trigger"
            aria-label="Số lượng công việc trên mỗi trang"
            aria-expanded={isSizeMenuOpen}
            aria-haspopup="listbox"
            disabled={disabled || totalItems === 0}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border border-border/80 bg-background px-2.5 py-0.5 text-xs font-medium text-foreground shadow-2xs transition-all hover:bg-muted/60 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              isSizeMenuOpen && "border-primary ring-1 ring-primary bg-muted/40"
            )}
          >
            <span className="font-mono tabular-nums">{pageSize} / trang</span>
            <ChevronDown
              className={cn(
                "size-3 text-muted-foreground transition-transform duration-150",
                isSizeMenuOpen && "rotate-180 text-foreground"
              )}
              strokeWidth={1.5}
            />
          </Popover.Trigger>

          {/* Floating Dropdown Popover */}
          {isSizeMenuOpen && (
            <Popover.Portal>
            <Popover.Positioner className="z-50" side="top" align="start" sideOffset={6} collisionPadding={12}>
            <Popover.Popup
              style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
              role="listbox"
              aria-label="Chọn số lượng công việc mỗi trang"
              className="min-w-[124px] rounded-xl border border-border/80 bg-popover/95 p-1 shadow-lg shadow-black/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-100 text-popover-foreground"
            >
              <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider border-b border-border/40 mb-1">
                Kích thước trang
              </div>
              {effectivePageSizeOptions.map((size) => {
                const isSelected = size === pageSize;
                return (
                  <button
                    key={size}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onPageSizeChange(size);
                      setIsSizeMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-colors text-left cursor-pointer font-mono tabular-nums",
                      isSelected
                        ? "bg-primary/10 text-primary font-semibold"
                        : "text-foreground hover:bg-muted/70 hover:text-foreground"
                    )}
                  >
                    <span>{size} / trang</span>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" strokeWidth={2} />}
                  </button>
                );
              })}
            </Popover.Popup>
            </Popover.Positioner>
            </Popover.Portal>
          )}

          {/* Hidden native select for accessibility, testing & fallback sync */}
          <select
            id="task-table-page-size"
            value={pageSize}
            disabled={disabled || totalItems === 0}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="sr-only"
            aria-hidden="true"
            tabIndex={-1}
          >
            {effectivePageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size} / trang
              </option>
            ))}
          </select>
        </div>
        </Popover.Root>
      </div>

      {/* Right section: Page navigation buttons & optional shortcut trigger */}
      <div className="flex items-center gap-1">
        {/* First Page Button */}
        <button
          type="button"
          onClick={handleFirst}
          disabled={disabled || safeCurrentPage <= 1}
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-[0.98]"
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
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-[0.98]"
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
                  "inline-flex size-8 items-center justify-center rounded-lg text-xs font-medium font-mono tabular-nums transition-all shadow-2xs cursor-pointer active:scale-[0.98]",
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
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-[0.98]"
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
          className="inline-flex size-8 items-center justify-center rounded-lg border border-border/80 bg-background text-muted-foreground transition-all hover:bg-muted/60 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 shadow-2xs cursor-pointer active:scale-[0.98]"
          title="Trang cuối"
          aria-label="Về trang cuối"
        >
          <ChevronsRight className="size-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </nav>
  );
});
