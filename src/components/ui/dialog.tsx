"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

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
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  showCloseButton?: boolean;
  showHeader?: boolean;
}

const sizeClasses: Record<NonNullable<StandardDialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[95vw] max-h-[92vh]",
};

/**
 * Standard Dialog wrapper over `@base-ui/react/dialog`.
 * Provides accessible portal, backdrop blur (bg-black/40 + backdrop-blur-xs), focus trap, ESC dismiss, and clean layout.
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
}: StandardDialogProps) {
  return (
    <BaseDialog.Root open={open} onOpenChange={onOpenChange}>
      <BaseDialog.Portal keepMounted={open}>
        <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150" />
        <BaseDialog.Popup
          className={cn(
            "fixed left-1/2 top-1/2 z-50 w-full -translate-x-1/2 -translate-y-1/2 outline-none",
            "rounded-xl border border-border bg-card p-6 shadow-xl",
            "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95",
            sizeClasses[size],
            className
          )}
        >
          {showHeader ? (
            <>
              <div className="flex items-center justify-between gap-3 pb-4">
                <BaseDialog.Title className="text-lg font-semibold tracking-tight text-foreground">
                  {title}
                </BaseDialog.Title>
                {showCloseButton && (
                  <BaseDialog.Close
                    className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Đóng"
                  >
                    <X className="h-4 w-4" />
                  </BaseDialog.Close>
                )}
              </div>
              <BaseDialog.Description
                className={cn(!description && "sr-only", "text-sm text-muted-foreground pb-2")}
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
