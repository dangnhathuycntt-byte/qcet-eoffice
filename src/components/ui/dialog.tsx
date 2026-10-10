"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { focusRingClass } from "@/components/ui/focus-ring";

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
  /** compact: nút đóng 44px mobile / 28px desktop, icon 1,5px, mô tả 12px. Mặc định giữ nguyên. */
  compact?: boolean;
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
 * Aligned with Modal.dc.html: 10% distance from top edge (avoids vertical jump on content resize), max-height 85vh.
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
}: StandardDialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal keepMounted={open}>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-overlay transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-reduce:transition-none" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-[10%] z-50 w-full -translate-x-1/2 outline-none max-h-[85vh] flex flex-col overflow-y-auto",
            "rounded-2xl border-0 bg-card p-4 sm:p-6 shadow-dialog motion-reduce:transition-none",
            sizeClasses[size],
            className
          )}
        >
          {showHeader ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-4">
                <BaseDialog.Title className={cn("font-semibold tracking-tight text-foreground", (size === "lg" || size === "xl" || size === "full") ? "text-xl" : "text-base")}>
                  {title}
                </BaseDialog.Title>
                {showCloseButton && (
                  compact ? (
                    <BaseDialog.Close
                      render={<Button variant="ghost" size="icon-sm" aria-label="Đóng" />}
                    >
                      <X className="size-4" strokeWidth={1.5} />
                    </BaseDialog.Close>
                  ) : (
                    <BaseDialog.Close
                      className={`rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground ${focusRingClass}`}
                      aria-label="Đóng"
                    >
                      <X className="h-4 w-4" />
                    </BaseDialog.Close>
                  )
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
