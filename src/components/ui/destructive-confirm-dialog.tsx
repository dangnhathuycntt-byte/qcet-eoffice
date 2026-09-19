"use client";

import * as React from "react";
import { AlertDialog } from "@base-ui/react/alert-dialog";
import { AlertOctagon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DestructiveConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: string;
  entityName?: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  irreversible?: boolean;
  isConfirming?: boolean;
}

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
  const handleConfirm = async () => { await onConfirm(); };

  return (
    <AlertDialog.Root open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AlertDialog.Portal>
        <AlertDialog.Backdrop
          className="fixed inset-0 z-60 bg-background/80 backdrop-blur-xs"
        />
        <AlertDialog.Popup
          className="fixed inset-0 z-60 flex items-center justify-center p-4"
        >
          <div className="bg-card rounded-xl shadow-2xl border border-border max-w-md w-full p-5 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                <AlertOctagon className="size-4" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 min-w-0">
                <AlertDialog.Title className="text-sm font-semibold text-foreground">
                  {title}
                </AlertDialog.Title>
                <AlertDialog.Description className="text-xs text-muted-foreground leading-relaxed">
                  {entityName && (
                    <>Nhiệm vụ{" "}<span className="font-semibold text-foreground">&ldquo;{entityName}&rdquo;</span>{" "}</>
                  )}
                  {description || "sẽ được lưu trữ / hủy bỏ."}
                  {irreversible && (
                    <span className="block mt-1 text-rose-600 font-medium">Hành động này không thể hoàn tác.</span>
                  )}
                </AlertDialog.Description>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
              <AlertDialog.Close
                render={<Button variant="outline" size="sm" className="text-xs h-8" />}
                disabled={isConfirming}
              >
                {cancelLabel}
              </AlertDialog.Close>
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
        </AlertDialog.Popup>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  );
}
