"use client";

import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { TaskIconChecklist, TaskIconClose } from "@qcet/shared/lib/icons/task-icons";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/**
 * Esc trong menu, hộp thoại, popover hay ô nhập chữ là của lớp đó (đóng lớp, xóa chữ), không bỏ chọn các hàng. Ô tích của
 * hàng không tính: vừa bấm ô tích thì tiêu điểm nằm ở đó, Esc vẫn phải bỏ chọn.
 */
const OWN_ESCAPE_SELECTOR =
  "[role='menu'], [role='dialog'], [role='alertdialog'], [role='listbox'], [data-list-toolbar-popover], input:not([type='checkbox']):not([type='radio']), textarea, select, [contenteditable='true']";

export interface SelectionActionBarProps {
  /** Số hàng đang chọn; 0 thì không hiện thanh. */
  count: number;
  /** Tổng số hàng của danh sách (hiện "/tổng" sau số đã chọn). */
  total?: number;
  /** Tên loại hàng ("cuộc họp", "văn bản") cho nhãn vùng và nút bỏ chọn. */
  noun: string;
  onClear: () => void;
  /** Đang chạy một thao tác: khóa nút bỏ chọn, báo cho trình đọc màn hình. */
  busy?: boolean;
  /** Các nút thao tác (`SelectionActionButton`), ngăn nhóm bằng `SelectionActionDivider`. */
  children: React.ReactNode;
  className?: string;
}

/**
 * Thanh thao tác hàng loạt nổi ở đáy trang khi có hàng được chọn, cùng hình với thanh của bảng Nhiệm vụ (kiểu Linear):
 * "Đã chọn n/tổng" · các thao tác · Bỏ chọn (Esc). Điện thoại: rộng gần hết màn, hàng trên là số đã chọn và nút bỏ chọn,
 * hàng dưới là các thao tác chia đều.
 */
export function SelectionActionBar({ count, total, noun, onClear, busy = false, children, className }: SelectionActionBarProps) {
  React.useEffect(() => {
    if (count <= 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (event.target instanceof Element && event.target.closest(OWN_ESCAPE_SELECTOR)) return;
      event.preventDefault();
      onClear();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, onClear]);

  if (count <= 0) return null;

  return (
    <aside
      role="region"
      aria-label={`Thao tác hàng loạt trên ${noun}`}
      aria-busy={busy || undefined}
      className={cn(
        "fixed inset-x-0 bottom-6 z-40 mx-auto w-fit max-w-[95vw] select-none sm:max-w-max md:bottom-[calc(1.5rem+var(--app-statusbar,0px))] md:left-[var(--sidebar-w,0px)]",
        "max-sm:bottom-[calc(env(safe-area-inset-bottom,0px)+12px)] max-sm:w-[calc(100vw-24px)]",
        "animate-in fade-in slide-in-from-bottom-3 duration-200 motion-reduce:animate-none",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-0.5 rounded-[var(--radius-menu)] border border-border/60 bg-card px-2 py-1.5 text-foreground shadow-menu">
        <div aria-live="polite" className="flex items-center gap-2 whitespace-nowrap pl-1.5 pr-2 text-xs font-medium max-sm:flex-1">
          <TaskIconChecklist className="size-4 shrink-0 text-primary" />
          <span>
            Đã chọn <strong className="font-semibold tabular-nums">{count}</strong>
            {total ? <span className="font-normal tabular-nums text-muted-foreground">/{total}</span> : null}
            <span className="sr-only"> {noun}</span>
          </span>
        </div>
        <SelectionActionDivider />
        {children}
        <SelectionActionDivider />
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          disabled={busy}
          aria-label={`Bỏ chọn tất cả ${noun}`}
          title="Bỏ chọn (Esc)"
          className="max-sm:order-1 max-sm:size-9 max-sm:px-0"
        >
          <TaskIconClose className="size-4" />
          <span className="max-sm:hidden">Bỏ chọn</span>
          <Kbd className="max-sm:hidden">Esc</Kbd>
        </Button>
        {/* Điện thoại: ngắt hàng sau nút bỏ chọn để các thao tác nằm riêng hàng dưới */}
        <div aria-hidden="true" className="hidden h-0 basis-full max-sm:order-1 max-sm:block" />
      </div>
    </aside>
  );
}

/** Vạch ngăn nhóm thao tác (ẩn trên điện thoại, nơi các thao tác xuống hàng riêng). */
export function SelectionActionDivider() {
  return <div aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border max-sm:hidden" />;
}

const selectionActionVariants = cva("text-foreground max-sm:order-2 max-sm:h-9 max-sm:flex-1 [&_svg]:text-muted-foreground", {
  variants: {
    tone: {
      default: "",
      destructive: "text-destructive hover:bg-destructive/10 hover:text-destructive [&_svg]:text-destructive",
    },
  },
  defaultVariants: { tone: "default" },
});

export type SelectionActionButtonProps = Omit<ButtonProps, "variant" | "size"> & VariantProps<typeof selectionActionVariants>;

/** Nút trong thanh thao tác hàng loạt: ghost 28px (icon truyền `size-4` như thanh Nhiệm vụ); `tone="destructive"` cho hủy/xóa. */
export const SelectionActionButton = React.forwardRef<HTMLButtonElement, SelectionActionButtonProps>(
  ({ tone, className, ...props }, ref) => (
    <Button ref={ref} variant="ghost" size="sm" className={cn(selectionActionVariants({ tone }), className)} {...props} />
  )
);
SelectionActionButton.displayName = "SelectionActionButton";
