"use client";

import * as React from "react";
import * as m from "motion/react-m";
import { AnimatePresence } from "motion/react";
import { Dialog } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fadeVariants } from "@/lib/motion/variants";
import { motionTransition } from "@/lib/motion/tokens";

export interface ConfirmationOverlayProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  loading?: boolean;
}

export function ConfirmationOverlay({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Xác nhận",
  cancelLabel = "Hủy",
  variant = "default",
  loading = false,
}: ConfirmationOverlayProps) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal>
            <Dialog.Backdrop
              className="fixed inset-0 z-50 bg-black/40"
              render={
                <m.div
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={motionTransition}
                />
              }
            />
            <Dialog.Popup
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
              render={
                <m.div
                  variants={fadeVariants}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={motionTransition}
                />
              }
            >
              <div className="w-full max-w-sm rounded-xl border border-border/70 bg-card p-5 shadow-[var(--shadow-dropdown,0_4px_16px_rgba(0,0,0,0.08))]">
                <div className="flex items-start justify-between mb-3">
                  <Dialog.Title className="text-sm font-semibold text-foreground">
                    {title}
                  </Dialog.Title>
                  <Dialog.Close
                    className="rounded-md p-1 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    onClick={onClose}
                  >
                    <X className="size-4" strokeWidth={1.5} />
                  </Dialog.Close>
                </div>
                {description && (
                  <Dialog.Description className="text-xs text-muted-foreground mb-4 leading-relaxed">
                    {description}
                  </Dialog.Description>
                )}
                <div className="flex items-center justify-end gap-2 mt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border/60 transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {cancelLabel}
                  </button>
                  <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className={cn(
                      "px-3 py-2 min-h-[44px] sm:min-h-0 sm:py-1.5 rounded-lg text-xs font-medium transition-colors active:scale-[0.98] disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      variant === "destructive"
                        ? "bg-red-500/10 text-red-700 hover:bg-red-500/20 border border-red-500/20"
                        : "bg-foreground text-background hover:bg-foreground/90"
                    )}
                  >
                    {loading ? "Đang xử lý…" : confirmLabel}
                  </button>
                </div>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
