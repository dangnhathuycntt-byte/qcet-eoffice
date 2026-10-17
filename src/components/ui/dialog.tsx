"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
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
  /** `eventDetails.reason` (Base UI): "outside-press", "escape-key", "close-press"… */
  onOpenChange: (open: boolean, eventDetails?: { reason?: string }) => void;
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
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
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
              <div className="flex items-center justify-between gap-3 pb-4">
                <BaseDialog.Title className="text-base font-semibold tracking-tight text-foreground">
                  {title}
                </BaseDialog.Title>
                {showCloseButton && (
                  <BaseDialog.Close render={<Button variant="ghost" size="icon-sm" aria-label="Đóng" />}>
                    <X className="size-4" />
                  </BaseDialog.Close>
                )}
              </div>
              <BaseDialog.Description
                className={cn(!description && "sr-only", compact ? "text-xs" : "text-sm", "text-muted-foreground pb-2")}
              >
                {description || title}
              </BaseDialog.Description>
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
