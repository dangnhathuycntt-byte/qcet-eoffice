"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Popover } from "@base-ui/react/popover";
import { cn } from "@/lib/utils";

const CHIP_CLASS = cn(
  "order-last inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md px-2 text-xs text-muted-foreground transition-colors",
  "hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  "data-[popup-open]:bg-accent data-[popup-open]:text-foreground",
);

/**
 * Khối tùy chọn của chi tiết nhiệm vụ khi còn trống: chỉ hiện một chip (progressive disclosure).
 * Có `panel` thì bấm chip mở form trong popover neo tại chip, trang không giãn ra; khối chỉ xuất hiện khi đã có dữ liệu.
 * `order-last` để các chip dồn về một hàng sau những khối đã có dữ liệu trong `data-slot="task-optional-sections"`.
 */
export function TaskAddChip({
  children,
  onClick,
  icon = true,
  title,
  panel,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  /** false: không có dấu "+" (thao tác không phải thêm, vd. từ chối nhận việc). */
  icon?: boolean;
  title?: string;
  /** Form hiện trong popover; mở/đóng theo `open`/`onOpenChange` của khối. */
  panel?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const content = (
    <>
      {icon ? <Plus className="size-3.5" strokeWidth={1.5} aria-hidden="true" /> : null}
      {children}
    </>
  );

  if (!panel) {
    return (
      <button type="button" data-slot="task-add-chip" title={title} onClick={onClick} className={CHIP_CLASS}>
        {content}
      </button>
    );
  }

  return (
    <Popover.Root open={open} onOpenChange={(next) => onOpenChange?.(next)}>
      <Popover.Trigger type="button" data-slot="task-add-chip" title={title} className={CHIP_CLASS}>
        {content}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner className="z-50" align="start" sideOffset={4} collisionPadding={12}>
          <Popover.Popup
            data-slot="task-add-chip-panel"
            style={{ maxHeight: "var(--available-height)" }}
            className="w-64 overflow-y-auto rounded-xl border border-border bg-popover p-2 shadow-2xl outline-none"
          >
            <p className="mb-1.5 px-0.5 text-xs font-medium text-foreground">{children}</p>
            {panel}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
