import * as React from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  enableKeyboardNavigation?: boolean;
  density?: "comfortable" | "compact";
}

/**
 * Bảng dữ liệu không viền, không thẻ; hàng phân tách bằng nền khi rê chuột.
 * Hỗ trợ WAI-ARIA grid keyboard navigation (↑ ↓ di chuyển dòng, Space chọn dòng, Enter mở chi tiết).
 */
export function Table({ className, enableKeyboardNavigation, density = "comfortable", onKeyDown, ...props }: TableProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableElement>) => {
    onKeyDown?.(e);
    if (!enableKeyboardNavigation || e.defaultPrevented) return;

    const target = e.target as HTMLElement;
    const row = target.closest("tr");
    if (!row) return;

    if (e.key === "ArrowDown") {
      const nextRow = row.nextElementSibling as HTMLTableRowElement | null;
      if (nextRow && nextRow.tabIndex >= 0) {
        e.preventDefault();
        nextRow.focus();
      }
    } else if (e.key === "ArrowUp") {
      const prevRow = row.previousElementSibling as HTMLTableRowElement | null;
      if (prevRow && prevRow.tabIndex >= 0) {
        e.preventDefault();
        prevRow.focus();
      }
    }
  };

  return (
    <div className="w-full overflow-x-auto" data-density={density}>
      <table
        role={enableKeyboardNavigation ? "grid" : undefined}
        onKeyDown={handleKeyDown}
        className={cn("w-full border-collapse text-[13px] leading-5", className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead role="rowgroup" {...props} />;
}

export function TableBody(props: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody role="rowgroup" {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onOpen?: () => void;
}

export function TableRow({
  className,
  selected,
  onSelectChange,
  onOpen,
  onKeyDown,
  tabIndex,
  ...props
}: TableRowProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTableRowElement>) => {
    onKeyDown?.(e);
    if (e.defaultPrevented) return;

    if (e.key === " ") {
      e.preventDefault();
      onSelectChange?.(!selected);
    } else if (e.key === "Enter") {
      e.preventDefault();
      onOpen?.();
    }
  };

  return (
    <tr
      role="row"
      tabIndex={tabIndex ?? (onOpen || onSelectChange ? 0 : undefined)}
      aria-selected={selected}
      data-selected={selected ? "" : undefined}
      onKeyDown={handleKeyDown}
      className={cn(
        "transition-colors duration-100 hover:bg-accent data-[selected]:bg-selected outline-none focus-visible:bg-selected focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-[-2px] motion-reduce:transition-none",
        (onOpen || onSelectChange) && "cursor-pointer",
        className,
      )}
      {...props}
    />
  );
}

export type SortDirection = "asc" | "desc" | null;

export interface TableHeadProps extends Omit<React.ThHTMLAttributes<HTMLTableCellElement>, "onClick"> {
  /** Đặt khi cột sắp xếp được; null nghĩa là chưa sắp xếp theo cột này. */
  sort?: SortDirection;
  sortable?: boolean;
  onSort?: () => void;
}

export function TableHead({ className, children, sort = null, sortable, onSort, ...props }: TableHeadProps) {
  const ariaSort = sortable ? (sort === "asc" ? "ascending" : sort === "desc" ? "descending" : "none") : undefined;
  return (
    <th
      scope="col"
      role="columnheader"
      aria-sort={ariaSort}
      className={cn("h-9 px-3 text-left text-xs font-medium text-muted-foreground", className)}
      {...props}
    >
      {sortable ? (
        <button
          type="button"
          onClick={onSort}
          className="-ml-1 inline-flex cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
        >
          {children}
          {sort === "asc" ? <ArrowUp aria-hidden="true" className="size-3" /> : null}
          {sort === "desc" ? <ArrowDown aria-hidden="true" className="size-3" /> : null}
        </button>
      ) : (
        children
      )}
    </th>
  );
}

export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {
  /** Cấp phân cấp cho việc cha/con (mỗi cấp thụt lề 20px). */
  level?: number;
}

export function TableCell({ className, level = 0, style, children, ...props }: TableCellProps) {
  const indentStyle = level > 0 ? { paddingLeft: `${12 + level * 20}px` } : undefined;

  return (
    <td
      role="gridcell"
      style={{ ...indentStyle, ...style }}
      className={cn("h-[var(--table-row-height,48px)] px-3 align-middle text-foreground", className)}
      {...props}
    >
      {children}
    </td>
  );
}
