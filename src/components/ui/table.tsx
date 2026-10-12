"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Mật độ bảng: một dòng 40px (mặc định) hoặc hai dòng 48px. Tiêu đề cột cao bằng hàng. */
export type TableDensity = "one-line" | "two-line";

const TableDensityContext = React.createContext<TableDensity>("one-line");

const rowHeightClass: Record<TableDensity, string> = {
  "one-line": "h-10",
  "two-line": "h-12",
};

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  density?: TableDensity;
}

/** Bảng dữ liệu dùng chung. Không kèm skeleton hay trạng thái rỗng: dùng Skeleton và EmptyState ở nơi gọi. */
function Table({ className, density = "one-line", ...props }: TableProps) {
  return (
    <TableDensityContext.Provider value={density}>
      <div data-slot="table-container" className="relative w-full overflow-x-auto">
        <table data-slot="table" className={cn("w-full caption-bottom border-collapse text-compact", className)} {...props} />
      </div>
    </TableDensityContext.Provider>
  );
}

function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead data-slot="table-header" className={cn("bg-card", className)} {...props} />;
}

function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody data-slot="table-body" className={cn(className)} {...props} />;
}

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Hàng bấm được (mở chi tiết): con trỏ tay và nền hover. */
  interactive?: boolean;
  /** Hàng đang được chọn (checkbox). */
  selected?: boolean;
  /** Hàng đang mở ở panel bên cạnh. */
  current?: boolean;
}

function TableRow({ className, interactive = false, selected = false, current = false, ...props }: TableRowProps) {
  const density = React.useContext(TableDensityContext);
  return (
    <tr
      data-slot="table-row"
      aria-selected={selected || undefined}
      aria-current={current ? "true" : undefined}
      className={cn(
        "border-b border-border/60 transition-colors",
        rowHeightClass[density],
        interactive && "cursor-pointer",
        interactive && !selected && !current && "hover:bg-accent",
        (selected || current) && "bg-selected",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  const density = React.useContext(TableDensityContext);
  return (
    <th
      data-slot="table-head"
      className={cn(
        "whitespace-nowrap px-2 text-left align-middle text-xs font-medium text-muted-foreground",
        rowHeightClass[density],
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td data-slot="table-cell" className={cn("px-2 align-middle text-foreground", className)} {...props} />;
}

export { Table, TableHeader, TableBody, TableRow, TableHead, TableCell };
