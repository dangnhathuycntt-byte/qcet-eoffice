"use client";

import * as React from "react";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DestructiveConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  /** Task name or entity being acted on — rendered bold inside the body. */
  entityName?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Show a "cannot be undone" warning. */
  irreversible?: boolean;
  /** Disable the confirm button (e.g. while an API call is in-flight). */
  isConfirming?: boolean;
}

/**
 * Accessible destructive confirmation dialog following the project's
 * `role="alertdialog"` pattern (see linear-create-task-modal.tsx).
 *
 * - Focus trap (Tab / Shift+Tab cycles within dialog)
 * - Esc to dismiss
 * - Restores focus to the previously-active element on close
 * - No `window.confirm()` / `window.alert()` — pure React
 */
export function DestructiveConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  entityName,
  description,
  confirmLabel = "Xóa",
  cancelLabel = "Hủy",
  irreversible = true,
  isConfirming = false,
}: DestructiveConfirmDialogProps) {
  const dialogRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  const cancelBtnRef = React.useRef<HTMLButtonElement>(null);

  // Capture focus origin and autofocus cancel button on open
  React.useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement | null;
      // Slight delay to let animation start, then focus the safe (cancel) button
      const timer = setTimeout(() => cancelBtnRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    } else if (previousActiveElement.current) {
      previousActiveElement.current.focus();
      previousActiveElement.current = null;
    }
  }, [isOpen]);

  // Keyboard: Esc to close, Tab focus trap
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key === "Tab" && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]:not([disabled])'
          )
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    await onConfirm();
  };

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-background/80 backdrop-blur-xs p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="destructive-confirm-title"
      aria-describedby="destructive-confirm-desc"
      onClick={(e) => {
        // Close on backdrop click
        if (e.target === e.currentTarget && !isConfirming) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95"
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="size-8 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <AlertOctagon className="size-4" strokeWidth={1.5} />
          </div>
          <div className="space-y-1 min-w-0">
            <h4
              id="destructive-confirm-title"
              className="text-sm font-semibold text-foreground"
            >
              {title}
            </h4>
            <p
              id="destructive-confirm-desc"
              className="text-xs text-muted-foreground leading-relaxed"
            >
              {entityName && (
                <>
                  Nhiệm vụ{" "}
                  <span className="font-semibold text-foreground">
                    &ldquo;{entityName}&rdquo;
                  </span>{" "}
                </>
              )}
              {description || "sẽ được lưu trữ / hủy bỏ."}
              {irreversible && (
                <span className="block mt-1 text-rose-600 font-medium">
                  Hành động này không thể hoàn tác.
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button
            ref={cancelBtnRef}
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={isConfirming}
            className="text-xs h-8"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={handleConfirm}
            disabled={isConfirming}
            className={cn("text-xs h-8", isConfirming && "opacity-70")}
          >
            {isConfirming ? "Đang xử lý..." : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
