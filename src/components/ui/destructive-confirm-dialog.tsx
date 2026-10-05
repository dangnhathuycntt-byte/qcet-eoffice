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
          className="fixed inset-0 z-40 bg-overlay transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 motion-reduce:transition-none"
        />
        <AlertDialog.Popup
          className="fixed inset-0 z-40 flex items-center justify-center p-4 outline-none motion-reduce:transition-none"
        >
          <div className="bg-card rounded-2xl shadow-dialog border-0 max-w-md w-full p-4 sm:p-6 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="size-8 rounded-full bg-danger-soft text-destructive flex items-center justify-center shrink-0">
                <AlertOctagon className="size-4" strokeWidth={1.5} />
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <AlertDialog.Title className="text-sm font-semibold text-foreground">
                  {title}
                </AlertDialog.Title>
                <AlertDialog.Description className="text-xs text-muted-foreground leading-relaxed">
                  {entityName && (
                    <>Nhiệm vụ{" "}<span className="font-semibold text-foreground">&ldquo;{entityName}&rdquo;</span>{" "}</>
                  )}
                  {description || "sẽ được lưu trữ / hủy bỏ."}
                  {irreversible && (
                    <span className="block mt-1 text-destructive font-medium">Hành động này không thể hoàn tác.</span>
                  )}
                </AlertDialog.Description>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-0">
              <AlertDialog.Close
                render={<Button variant="secondary" size="default" />}
                disabled={isConfirming}
              >
                {cancelLabel}
              </AlertDialog.Close>
              <Button
                type="button"
                variant="destructive"
                size="default"
                onClick={handleConfirm}
                disabled={isConfirming}
                className={cn(isConfirming && "opacity-70")}
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
