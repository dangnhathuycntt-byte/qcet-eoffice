"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface BulkActionItem {
  label: string;
  icon?: React.ReactNode;
  variant?: "default" | "destructive";
  onClick: () => void;
  disabled?: boolean;
}

export interface BulkActionBarProps extends React.HTMLAttributes<HTMLDivElement> {
  selectedCount: number;
  itemLabel?: string; // "văn bản" | "nhiệm vụ" | "mục"
  totalCount?: number;
  onSelectAllPages?: () => void;
  isAllPagesSelected?: boolean;
  onClearSelection: () => void;
  actions: BulkActionItem[];
  floating?: boolean;
}

/**
 * Thanh thao tác hàng loạt khi chọn nhiều dòng trong bảng hoặc danh sách.
 * Chuẩn QCET: Artboard Files & T3Bulk (Nền tối #25282F, cao 48px, bo góc 14px, thay tiêu đề bảng hoặc thanh nổi).
 */
export function BulkActionBar({
  selectedCount,
  itemLabel = "mục",
  totalCount,
  onSelectAllPages,
  isAllPagesSelected = false,
  onClearSelection,
  actions,
  floating = false,
  className,
  ...props
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;

  return (
    <div
      role="region"
      aria-label="Thao tác hàng loạt"
      className={cn(
        "flex h-12 items-center justify-between gap-4 rounded-xl px-4 text-xs sm:text-sm font-medium select-none transition-colors duration-100",
        "bg-foreground text-background shadow-dialog",
        floating && "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-2xl w-[calc(100%-2rem)]",
        className
      )}
      {...props}
    >
      <div className="flex items-center gap-2 truncate">
        <span className="font-semibold tabular-nums">
          Đã chọn {selectedCount} {itemLabel}
        </span>

        {totalCount && totalCount > selectedCount && onSelectAllPages && !isAllPagesSelected && (
          <button
            type="button"
            onClick={onSelectAllPages}
            aria-label={`Chọn tất cả ${totalCount} ${itemLabel}`}
            className="text-xs text-background/80 underline underline-offset-3 hover:text-background transition-colors cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
          >
            (Chọn tất cả {totalCount} {itemLabel})
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {actions.map((act, index) => (
          <button
            key={index}
            type="button"
            onClick={act.onClick}
            disabled={act.disabled}
            aria-label={act.label}
            className={cn(
              "flex items-center gap-1.5 transition-colors cursor-pointer text-xs sm:text-sm font-medium rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground",
              act.variant === "destructive"
                ? "text-destructive hover:opacity-80"
                : "text-background/90 hover:text-background",
              act.disabled && "pointer-events-none opacity-40"
            )}
          >
            {act.icon}
            <span>{act.label}</span>
          </button>
        ))}

        <button
          type="button"
          onClick={onClearSelection}
          aria-label="Bỏ chọn tất cả"
          className="flex items-center gap-1 text-background/70 hover:text-background transition-colors text-xs ml-1 cursor-pointer rounded-md px-2 py-1 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-foreground"
        >
          <X className="size-3.5" />
          <span>Bỏ chọn</span>
        </button>
      </div>
    </div>
  );
}
