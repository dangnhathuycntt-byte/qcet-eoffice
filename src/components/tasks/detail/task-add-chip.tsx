"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Khối tùy chọn của chi tiết nhiệm vụ khi còn trống: chỉ hiện một chip, bấm mới mở khối (progressive disclosure).
 * `order-last` để các chip dồn về một hàng sau những khối đã có dữ liệu trong `data-slot="task-optional-sections"`.
 */
export function TaskAddChip({
  children,
  onClick,
  icon = true,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  /** false: không có dấu "+" (thao tác không phải thêm, vd. từ chối nhận việc). */
  icon?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      data-slot="task-add-chip"
      title={title}
      onClick={onClick}
      className={cn(
        "order-last inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors",
        "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      {icon ? <Plus className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}
