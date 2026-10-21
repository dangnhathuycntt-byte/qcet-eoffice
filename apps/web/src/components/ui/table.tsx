"use client";

import * as React from "react";
import { ArrowUpDown, Check, ChevronDown, ChevronUp, Ellipsis } from "lucide-react";
import type { SelectionGroupPosition } from "@/lib/selection-group";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Pressable } from "@/components/ui/pressable";

/*
 * Bảng danh sách dùng chung, lấy nguyên từ bảng Nhiệm vụ (người dùng chọn bảng Nhiệm vụ làm mẫu cho mọi bảng 21/10/2026):
 * tiêu đề cột 32px chữ 12px thường, không kẻ dòng, hàng bo góc khi rê chuột/đang chọn/đang mở, ô chọn 14px hiện rõ khi rê
 * (`TableRowSelector`), nút "⋯" cuối ô đầu (`TableRowActions`), tiêu đề cột bấm để sắp xếp (`TableSortButton`).
 * Không kèm skeleton hay trạng thái rỗng: dùng Skeleton và EmptyState ở nơi gọi.
 */

/** Mật độ hàng: một dòng 40px (mặc định) hoặc hai dòng 48px (bảng Nhiệm vụ). Tiêu đề cột luôn 32px. */
export type TableDensity = "one-line" | "two-line";

const TableDensityContext = React.createContext<TableDensity>("one-line");
const TableSectionContext = React.createContext<"head" | "body">("body");

const rowHeightClass: Record<TableDensity, string> = {
  "one-line": "h-10",
  "two-line": "h-12",
};

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
  /**
   * Lớp thêm cho khung bọc, mặc định cuộn ngang. Tiêu đề cột dính (`sticky`) theo vùng cuộn của trang chỉ chạy khi khung
   * này không cuộn, nên bảng đó truyền `overflow-x-visible`/`overflow-x-clip` ở cỡ màn hình có tiêu đề dính.
   */
  containerClassName?: string;
}

function Table({ className, density = "one-line", containerClassName, ...props }: TableProps) {
  return (
    <TableDensityContext.Provider value={density}>
      <div data-slot="table-container" className={cn("relative w-full overflow-x-auto", containerClassName)}>
        <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-left text-compact", className)} {...props} />
      </div>
    </TableDensityContext.Provider>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <TableSectionContext.Provider value="head">
      <thead data-slot="table-header" className={cn("bg-card select-none", className)} {...props} />
    </TableSectionContext.Provider>
  );
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Hàng bấm được (mở chi tiết): con trỏ tay, nền khi rê chuột, viền tiêu điểm 2px. */
  interactive?: boolean;
  /** Hàng đang được chọn (ô chọn). */
  selected?: boolean;
  /** Hàng đang mở ở panel bên cạnh hoặc đang trỏ bằng phím. */
  current?: boolean;
  /** Hàng đang xem trước. */
  previewing?: boolean;
  /** Hàng là đích của menu thao tác đang mở: giữ nền khi con trỏ đã rời hàng. */
  menuTarget?: boolean;
  /** Vị trí trong khối hàng đang chọn liền nhau (`getSelectionGroupPositions`): chỉ bo góc ngoài của khối. */
  groupPosition?: SelectionGroupPosition | null;
}

const ROUND_TOP = "[&>td:first-child]:rounded-tl-md [&>td:last-child]:rounded-tr-md";
const ROUND_BOTTOM = "[&>td:first-child]:rounded-bl-md [&>td:last-child]:rounded-br-md";
// Hàng chưa chọn chỉ bo góc khi có nền riêng. Bo sẵn thì lúc bỏ chọn hàng loạt, nền đang mờ dần lộ góc bo rời rạc giữa các hàng.
const ROUND_ON_HOVER = "hover:[&>td:first-child]:rounded-l-md hover:[&>td:last-child]:rounded-r-md";

function rowRadiusClass(selected: boolean, standalone: boolean, interactive: boolean, groupPosition: SelectionGroupPosition | null) {
  if (selected) {
    if (groupPosition === "first") return ROUND_TOP;
    if (groupPosition === "last") return ROUND_BOTTOM;
    if (groupPosition === "middle") return "";
    return cn(ROUND_TOP, ROUND_BOTTOM);
  }
  if (standalone) return cn(ROUND_TOP, ROUND_BOTTOM);
  return interactive ? ROUND_ON_HOVER : "";
}

/**
 * Nền hàng đặt bằng `--row-bg` (vẽ trên từng ô ở `globals.css`, `[data-table-row]`). Màu đã trộn sẵn với nền thẻ nên đục:
 * bóng 1px lấp ranh giới cột chồng lên ô kế bên mà không thành vạch đậm. Ưu tiên: đang chọn > xem trước > đang mở > đích menu.
 */
function rowBackgroundClass({ interactive, selected, current, previewing, menuTarget }: Required<Pick<TableRowProps, "interactive" | "selected" | "current" | "previewing" | "menuTarget">>) {
  if (selected) return "[--row-bg:color-mix(in_oklab,var(--color-selected)_80%,var(--color-card))] hover:[--row-bg:var(--color-selected)]";
  if (previewing) return "[--row-bg:color-mix(in_oklab,var(--color-selected)_70%,var(--color-card))]";
  if (current) return "[--row-bg:var(--color-selected)]";
  if (menuTarget) return "[--row-bg:var(--color-accent)]";
  return interactive ? "hover:[--row-bg:color-mix(in_oklab,var(--color-muted)_40%,var(--color-card))]" : "";
}

function TableRow({
  className,
  interactive = false,
  selected = false,
  current = false,
  previewing = false,
  menuTarget = false,
  groupPosition = null,
  ...props
}: TableRowProps) {
  const density = React.useContext(TableDensityContext);
  const section = React.useContext(TableSectionContext);
  if (section === "head") return <tr data-slot="table-header-row" className={className} {...props} />;
  return (
    <tr
      data-slot="table-row"
      data-table-row=""
      data-menu-target={menuTarget ? "" : undefined}
      aria-selected={selected || undefined}
      aria-current={current ? "true" : undefined}
      className={cn(
        "group text-foreground outline-none",
        rowHeightClass[density],
        rowRadiusClass(selected, previewing || current || menuTarget, interactive, groupPosition),
        rowBackgroundClass({ interactive, selected, current, previewing, menuTarget }),
        interactive && "cursor-pointer select-none focus-visible:[--row-ring-c:var(--color-primary)] focus-visible:[--row-ring-w:2px]",
        className,
      )}
      {...props}
    />
  );
}

/** Đệm ô: 12px hai bên, cột đầu và cột cuối 16px (20px từ `sm`) cho thẳng mép với thanh công cụ phía trên. */
const CELL_PADDING = "px-3 py-1.5 first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5";

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      data-slot="table-head"
      scope="col"
      className={cn("group/th h-8 whitespace-nowrap text-left align-middle text-xs font-normal text-muted-foreground", CELL_PADDING, className)}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td data-slot="table-cell" className={cn("align-middle text-foreground", CELL_PADDING, className)} {...props} />;
}

/** Ô chưa có dữ liệu: gạch ngang mờ cho mắt, "Chưa có" cho trình đọc màn hình. */
function TableEmptyValue() {
  return (
    <span className="text-xs text-muted-foreground/50">
      <span aria-hidden="true">–</span>
      <span className="sr-only">Chưa có</span>
    </span>
  );
}

export type TableSortDirection = "asc" | "desc" | null;

/** `aria-sort` cho `TableHead` của cột sắp xếp được. */
export function tableAriaSort(direction: TableSortDirection): "ascending" | "descending" | "none" {
  return direction === "asc" ? "ascending" : direction === "desc" ? "descending" : "none";
}

/** Tên cột bấm để sắp xếp: đang sắp xếp thì mũi tên màu chính, cột khác hiện ⇅ khi rê vào tiêu đề cột. */
function TableSortButton({
  label,
  direction,
  onSort,
  className,
}: {
  label: React.ReactNode;
  direction: TableSortDirection;
  onSort: () => void;
  className?: string;
}) {
  const Indicator = direction === "asc" ? ChevronUp : direction === "desc" ? ChevronDown : ArrowUpDown;
  return (
    <Pressable onClick={onSort} className={cn("group/sort inline-flex select-none items-center gap-1 rounded transition-colors hover:text-foreground", className)}>
      <span>{label}</span>
      <Indicator
        aria-hidden
        className={cn(
          "size-3 shrink-0",
          direction ? "text-primary" : "text-muted-foreground opacity-0 transition-opacity group-hover/th:opacity-100 group-focus-visible/sort:opacity-100",
        )}
      />
    </Pressable>
  );
}

export interface TableRowSelectorProps {
  checked: boolean;
  /** Ô "chọn tất cả" khi mới chọn một phần. */
  indeterminate?: boolean;
  disabled?: boolean;
  /** Nhận sự kiện để nơi gọi đọc Shift (chọn một dải). */
  onToggle: (event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>) => void;
  "aria-label": string;
  title?: string;
  tabIndex?: number;
  className?: string;
}

/**
 * Ô chọn của hàng (và "chọn tất cả" ở tiêu đề cột): ô 14px trong vùng bấm 28–32px, mờ 60% khi hàng chưa chọn, rõ khi rê
 * vào hàng. Là `role="checkbox"` chứ không phải `<input>` để bộ lọc phím tắt của trang không coi đó là ô gõ chữ.
 */
function TableRowSelector({ checked, indeterminate = false, disabled = false, onToggle, title, tabIndex = 0, className, ...aria }: TableRowSelectorProps) {
  const filled = checked || indeterminate;
  return (
    <div
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-disabled={disabled || undefined}
      aria-label={aria["aria-label"]}
      title={title}
      tabIndex={disabled ? -1 : tabIndex}
      data-slot="table-row-selector"
      onClick={(event) => {
        event.stopPropagation();
        if (!disabled) onToggle(event);
      }}
      onKeyDown={(event) => {
        if (event.key !== " " && event.key !== "Enter") return;
        event.preventDefault();
        event.stopPropagation();
        if (!disabled) onToggle(event);
      }}
      className={cn(
        "group/selector relative -my-2 flex size-7 shrink-0 cursor-pointer select-none items-center justify-center rounded outline-none focus-visible:ring-2 focus-visible:ring-primary sm:size-8",
        disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      {filled ? (
        <span
          aria-hidden
          className="pointer-events-none flex size-3.5 items-center justify-center rounded-[3px] bg-primary text-primary-foreground shadow-2xs transition-[opacity,transform] hover:opacity-90 active:scale-[0.98]"
        >
          {checked ? <Check className="size-2.5" /> : <span className="h-0.5 w-2 rounded-full bg-primary-foreground" />}
        </span>
      ) : (
        <span
          aria-hidden
          className="pointer-events-none size-3.5 rounded-[3px] border border-border/70 bg-background/60 opacity-60 shadow-2xs transition-[opacity,transform,border-color,background-color] duration-150 ease-out group-hover:scale-105 group-hover:border-primary group-hover:bg-primary/5 group-hover:opacity-100 group-hover/selector:opacity-100 group-hover/th:opacity-100 active:scale-[0.98]"
        />
      )}
    </div>
  );
}

/**
 * Nút "⋯" mở menu thao tác của hàng, nằm sát mép phải ô đầu (ô đó cần `relative` và `pr-11`). Hiện khi rê chuột hoặc tiêu
 * điểm trong hàng, khi menu đang mở; màn cảm ứng luôn hiện vì không có rê chuột.
 */
function TableRowActions({
  label,
  open = false,
  onOpen,
  tabIndex,
  className,
}: {
  label: string;
  open?: boolean;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tabIndex?: number;
  className?: string;
}) {
  return (
    <Button
      variant="ghost"
      size="icon-xs"
      aria-label={label}
      aria-haspopup="menu"
      aria-expanded={open}
      tabIndex={tabIndex}
      className={cn(
        "absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100",
        className,
      )}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(event);
      }}
      onKeyDown={(event) => event.stopPropagation()}
    >
      <Ellipsis />
    </Button>
  );
}

export {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableEmptyValue,
  TableSortButton,
  TableRowSelector,
  TableRowActions,
};
