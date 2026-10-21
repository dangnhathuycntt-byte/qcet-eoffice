"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { SHEET_MOTION_CLASS, SheetKeyboardSync } from "@/components/ui/menu";

// Namespace primitives re-export
export const Dialog = BaseDialog;
export const DialogRoot = BaseDialog.Root;
export const DialogPortal = BaseDialog.Portal;
export const DialogBackdrop = BaseDialog.Backdrop;
export const DialogPopup = BaseDialog.Popup;
export const DialogTitle = BaseDialog.Title;
export const DialogDescription = BaseDialog.Description;
export const DialogClose = BaseDialog.Close;
export const DialogTrigger = BaseDialog.Trigger;

export interface StandardDialogProps {
  open: boolean;
  /** `eventDetails.reason` (Base UI): "outside-press", "escape-key", "close-press"…; `event` là sự kiện gây ra. */
  onOpenChange: (open: boolean, eventDetails?: { reason?: string; event?: Event }) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  showHeader?: boolean;
  /** compact: mô tả 12px. Mặc định giữ nguyên. */
  compact?: boolean;
  /** Phần tử nhận focus khi mở (Base UI `initialFocus`); mặc định là phần tử tab được đầu tiên. */
  initialFocus?: React.ComponentProps<typeof BaseDialog.Popup>["initialFocus"];
}

const sizeClasses: Record<NonNullable<StandardDialogProps["size"]>, string> = {
  sm: "max-w-[400px]",
  md: "max-w-[560px]",
  lg: "max-w-[720px]",
  xl: "max-w-4xl",
  full: "max-w-[95vw] max-h-[92vh]",
};

/**
 * Standard Dialog wrapper over `@base-ui/react/dialog`.
 * Provides accessible portal, overlay backdrop (bg-overlay / bg-black/40), focus trap, ESC dismiss, and clean layout.
 * Aligned with Modal.dc.html: 10% distance from top edge (avoids vertical jump on content resize), max-height 85dvh.
 * Điện thoại (< md): bám đáy màn hình, trượt từ dưới lên, có thanh kéo; nâng lên trên bàn phím ảo (`--keyboard-height`).
 * Các lớp `!` thắng `sm:max-w-*`/`sm:p-*` của nơi gọi trong khoảng 640–767px.
 */
export function StandardDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
  size = "md",
  showCloseButton = true,
  showHeader = true,
  compact = false,
  initialFocus,
}: StandardDialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal keepMounted={open}>
        {/* data-slot: nơi gọi phân biệt nhấn nền mờ với nhấn vào portal của nội dung (menu "/" của editor) */}
        <BaseDialog.Backdrop data-slot="dialog-backdrop" className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <BaseDialog.Popup
          initialFocus={initialFocus}
          className={cn(
            "fixed left-1/2 top-[10%] z-50 w-full -translate-x-1/2 outline-none max-h-[85dvh] flex flex-col overflow-y-auto",
            "rounded-2xl border-0 bg-card p-4 sm:p-6 shadow-dialog motion-reduce:transition-none",
            "max-md:inset-x-0 max-md:w-full max-md:top-auto max-md:bottom-[var(--keyboard-height,0px)] max-md:translate-x-0 max-md:max-w-none! max-md:max-h-[calc(85dvh-var(--keyboard-height,0px))]! max-md:rounded-b-none max-md:pt-0! max-md:pb-[calc(env(safe-area-inset-bottom,0px)+24px)]!",
            SHEET_MOTION_CLASS,
            sizeClasses[size],
            className
          )}
        >
          <SheetKeyboardSync />
          <div aria-hidden className="mx-auto my-2 h-1 w-9 shrink-0 rounded-full bg-mark md:hidden" />
          {showHeader ? (
            <>
              {/* Mô tả đi sát tiêu đề (4px) rồi mới cách nội dung 16px; trước đây mô tả cách tiêu đề 16px nhưng chỉ cách
                  nhãn ô đầu 8px nên đọc như dính vào ô (người dùng gửi ảnh hộp Tạo cuộc họp 20/10/2026) */}
              <div className="flex items-start justify-between gap-3 pb-4">
                <div className="flex min-w-0 flex-col gap-1">
                  <BaseDialog.Title className="text-base font-semibold tracking-tight text-foreground">
                    {title}
                  </BaseDialog.Title>
                  <BaseDialog.Description
                    className={cn(!description && "sr-only", compact ? "text-xs" : "text-sm", "text-muted-foreground")}
                  >
                    {description || title}
                  </BaseDialog.Description>
                </div>
                {showCloseButton && (
                  <BaseDialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Đóng" className="-mt-0.5 shrink-0" />}>
                    <X className="size-4" />
                  </BaseDialog.Close>
                )}
              </div>
            </>
          ) : (
            <>
              <BaseDialog.Title className="sr-only">{title}</BaseDialog.Title>
              <BaseDialog.Description className="sr-only">
                {description || title}
              </BaseDialog.Description>
            </>
          )}
          {children}
        </BaseDialog.Popup>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

/**
 * Biểu mẫu trong hộp thoại: Enter trong ô một dòng gửi (có nút `type="submit"` trong `DialogFooter` và nút đó không bị
 * `disabled`), Ctrl/Cmd+Enter trong ô nhiều dòng gửi. Tắt kiểm tra của trình duyệt (`noValidate`): nơi gọi tự báo lỗi
 * từng ô (`aria-invalid` + dòng `text-xs text-destructive` dưới ô) và đưa focus vào ô lỗi đầu tiên.
 */
export function DialogForm({ onSubmit, className, children }: { onSubmit: () => void; className?: string; children: React.ReactNode }) {
  return (
    <form
      noValidate
      className={cn("flex flex-col gap-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || !(event.metaKey || event.ctrlKey) || event.nativeEvent.isComposing) return;
        event.preventDefault();
        event.currentTarget.requestSubmit();
      }}
    >
      {children}
    </form>
  );
}

/** Chân hộp thoại: nút phụ (ghost) bên trái nút chính, dồn phải, cách nhau 8px. Nút chính `type="submit"` + `loading` khi đang gửi. */
export function DialogFooter({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("flex justify-end gap-2 pt-1", className)}>{children}</div>;
}

/**
 * Dòng đầu hộp tạo/soạn thay cho tiêu đề lớn: nơi chứa › việc đang làm, chữ 12px, mục đầu đậm (hộp Tạo cuộc họp, Soạn văn
 * bản đi, Tạo nhiệm vụ). Mục giữa dài (tên việc cha) thì cắt cuối, nơi gọi gắn `title` để xem đủ.
 */
export function DialogBreadcrumb({ items, icon, className }: { items: React.ReactNode[]; icon?: React.ReactNode; className?: string }) {
  return (
    <div data-slot="dialog-breadcrumb" className={cn("flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground", className)}>
      {icon}
      {items.map((item, index) => (
        <React.Fragment key={index}>
          {index > 0 ? <ChevronRight className="size-3 shrink-0 text-muted-foreground/60" aria-hidden /> : null}
          <span className={index === 0 ? "shrink-0 font-medium text-foreground" : "min-w-0 truncate"}>{item}</span>
        </React.Fragment>
      ))}
    </div>
  );
}

/** Lỗi của một ô nhập: dòng `text-xs text-destructive` ngay dưới ô (ô đặt `aria-invalid` và `aria-describedby` trỏ tới `id`), đọc to khi hiện. */
export function FieldError({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <p id={id} role="alert" className="text-xs text-destructive">
      {children}
    </p>
  );
}
