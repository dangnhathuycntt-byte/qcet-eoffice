"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT_PAGE_SIZES } from "../constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MenuActionItem, MenuContent, MenuRoot, MenuSubmenuTitle, MenuTrigger } from "@/components/ui/menu";

export interface TaskPaginationBarProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  pageSizeOptions?: number[];
  disabled?: boolean;
  className?: string;
  /** Nhãn domain cho consumer dùng chung; mặc định giữ nguyên bảng Nhiệm vụ. */
  itemLabel?: string;
  shortcutTrigger?: React.ReactNode;
}

/**
 * Luôn trả về tối đa 7 ô (trang đầu, trang cuối, trang hiện tại ± 1 và dấu "...")
 * để thanh phân trang giữ nguyên độ rộng khi chuyển trang.
 */
export function getPageNumbers(
  currentPage: number,
  totalPages: number
): (number | "...")[] {
  const range = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);

  if (totalPages <= 7) return range(1, totalPages);
  if (currentPage <= 4) return [...range(1, 5), "...", totalPages];
  if (currentPage >= totalPages - 3) return [1, "...", ...range(totalPages - 4, totalPages)];
  return [1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages];
}

/** Dấu "..." bấm được: mở ô nhập để nhảy thẳng tới một trang. */
function PageJump({
  totalPages,
  disabled,
  onJump,
}: {
  totalPages: number;
  disabled: boolean;
  onJump: (page: number) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");

  if (!editing) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        onClick={() => {
          setValue("");
          setEditing(true);
        }}
        className="text-xs"
        title="Nhập số trang"
        aria-label={`Đến trang (1–${totalPages})`}
      >
        …
      </Button>
    );
  }

  const commit = () => {
    const page = Number.parseInt(value, 10);
    if (Number.isFinite(page)) onJump(Math.min(Math.max(1, page), totalPages));
    setEditing(false);
  };

  return (
    <Input
      compact
      autoFocus
      inputMode="numeric"
      value={value}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditing(false);
        }
      }}
      onBlur={() => setEditing(false)}
      placeholder="Trang"
      aria-label={`Đến trang (1–${totalPages})`}
      className="w-14 text-center text-xs tabular-nums"
    />
  );
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
  itemLabel = "nhiệm vụ",
  shortcutTrigger,
}: TaskPaginationBarProps) {
  const [isSizeMenuOpen, setIsSizeMenuOpen] = React.useState(false);

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

  // Giữ thứ tự hook ổn định khi dữ liệu hoặc bộ lọc đưa kết quả về một trang.
  if (totalItems <= pageSize) return null;

  return (
    <nav
      aria-label={itemLabel === "nhiệm vụ" ? "Phân trang bảng công việc" : `Phân trang ${itemLabel}`}
      className={cn(
        "flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-border/40 bg-card/60 px-4 py-2.5 select-none",
        className
      )}
    >
      {/* Left section: Item range counter & custom page size selector */}
      <div className="flex items-center gap-2.5 text-xs text-muted-foreground w-full sm:w-auto justify-between sm:justify-start">
        <div className="tabular-nums">
          {totalItems === 0 ? (
            <span>0 {itemLabel}</span>
          ) : (
            <span>
              <strong className="font-medium text-foreground font-mono">
                {startItem}–{endItem}
              </strong>{" "}
              /{" "}
              <strong className="font-medium text-foreground font-mono">
                {totalItems}
              </strong>{" "}
              {itemLabel}
            </span>
          )}
        </div>

        {/* Chọn số dòng mỗi trang: menu chuẩn ui/menu (mục đang chọn nền accent, chữ đậm) */}
        <MenuRoot open={isSizeMenuOpen} onOpenChange={setIsSizeMenuOpen}>
          <MenuTrigger
            render={<Button variant="toolbar" size="sm" />}
            id="task-table-page-size-trigger"
            aria-label={itemLabel === "nhiệm vụ" ? "Số lượng công việc trên mỗi trang" : `Số lượng ${itemLabel} trên mỗi trang`}
            disabled={disabled || totalItems === 0}
            className="ml-1 data-[popup-open]:bg-selected"
          >
            <span className="font-mono tabular-nums">{pageSize} / trang</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </MenuTrigger>
          <MenuContent
            side="top"
            sideOffset={6}
            positionerClassName="z-50"
            className="min-w-32"
            mobileSheet
            sheetTitle="Kích thước trang"
          >
            {/* Điện thoại: tiêu đề đã nằm ở đầu sheet (sheetTitle) */}
            <MenuSubmenuTitle className="max-md:hidden">Kích thước trang</MenuSubmenuTitle>
            {effectivePageSizeOptions.map((size) => (
              <MenuActionItem
                key={size}
                selected={size === pageSize}
                onClick={() => onPageSizeChange(size)}
                className="font-mono tabular-nums"
              >
                {size} / trang
              </MenuActionItem>
            ))}
          </MenuContent>
        </MenuRoot>
      </div>

      {/* Right section: điều hướng trang. Di động chỉ còn ‹ x / n ›, máy tính hiện dãy số trang */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleFirst}
          disabled={disabled || safeCurrentPage <= 1}
          className="sm:hidden"
          aria-label="Về trang đầu"
        >
          <ChevronsLeft className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handlePrevious}
          disabled={disabled || safeCurrentPage <= 1}
          title="Trang trước"
          aria-label="Sang trang trước"
        >
          <ChevronLeft className="size-3.5" />
        </Button>

        <span className="px-2 text-xs tabular-nums text-muted-foreground sm:hidden" aria-live="polite">
          <span className="font-medium text-foreground">{safeCurrentPage}</span> / {totalPages}
        </span>

        <div className="hidden sm:flex items-center gap-0.5">
          {pageNumbers.map((p, idx) => {
            if (p === "...") {
              return (
                <PageJump
                  key={`ellipsis-${idx}`}
                  totalPages={totalPages}
                  disabled={disabled}
                  onJump={onPageChange}
                />
              );
            }

            const isCurrent = p === safeCurrentPage;
            return (
              <Button
                key={p}
                variant={isCurrent ? "default" : "ghost"}
                size="icon-sm"
                onClick={() => !isCurrent && !disabled && onPageChange(p)}
                disabled={disabled}
                aria-current={isCurrent ? "page" : undefined}
                className="w-auto min-w-7 px-1.5 text-xs tabular-nums"
                aria-label={`Trang ${p}`}
              >
                {p}
              </Button>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleNext}
          disabled={disabled || safeCurrentPage >= totalPages}
          title="Trang sau"
          aria-label="Sang trang sau"
        >
          <ChevronRight className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={handleLast}
          disabled={disabled || safeCurrentPage >= totalPages}
          className="sm:hidden"
          aria-label="Về trang cuối"
        >
          <ChevronsRight className="size-3.5" />
        </Button>
      </div>
    </nav>
  );
});
