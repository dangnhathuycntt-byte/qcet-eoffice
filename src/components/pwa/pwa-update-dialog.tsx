"use client";

import * as React from "react";
import { Sparkles, RefreshCw, AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PWAUpdateDialogProps {
  isOpen: boolean;
  hasUnsavedChanges: boolean;
  isUpdating?: boolean;
  onUpdate: () => void;
  onDismiss: () => void;
  className?: string;
}

/**
 * PWA update notification banner / dialog.
 * Presents clean non-intrusive update CTA or protective warning when unsaved changes exist.
 * Strictly adheres to QCET light-only design standard and touch ergonomics (min-h-[44px]).
 */
export function PWAUpdateDialog({
  isOpen,
  hasUnsavedChanges,
  isUpdating = false,
  onUpdate,
  onDismiss,
  className,
}: PWAUpdateDialogProps) {
  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Thông báo cập nhật QCET E-Office"
      className={cn(
        "fixed z-50 transition-all duration-300 pointer-events-auto",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] md:bottom-6",
        "left-4 right-4 md:left-auto md:right-6 md:max-w-md",
        className
      )}
    >
      <div
        className={cn(
          "rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all",
          hasUnsavedChanges
            ? "bg-amber-50/95 border-amber-300 text-amber-950 shadow-amber-900/10"
            : "bg-white/95 border-border text-foreground shadow-slate-900/10"
        )}
      >
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg mt-0.5",
              hasUnsavedChanges
                ? "bg-amber-100 text-amber-800"
                : "bg-primary/10 text-primary"
            )}
          >
            {hasUnsavedChanges ? (
              <AlertTriangle className="size-5" strokeWidth={1.5} />
            ) : (
              <Sparkles className="size-5" strokeWidth={1.5} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm leading-tight text-foreground">
                {hasUnsavedChanges
                  ? "Bản cập nhật mới sẵn sàng"
                  : "Có phiên bản QCET E-Office mới"}
              </h3>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Đóng thông báo cập nhật"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {hasUnsavedChanges
                ? "Có bản cập nhật mới. Vui lòng hoàn tất biểu mẫu trước khi cập nhật."
                : "Phiên bản mới đã sẵn sàng để sử dụng với các cải tiến và bản sửa lỗi."}
            </p>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {hasUnsavedChanges ? (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onDismiss}
                    className="min-h-[44px] px-3.5 text-xs font-medium"
                  >
                    Để sau
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={onUpdate}
                    disabled={isUpdating}
                    className="min-h-[44px] px-3.5 text-xs font-semibold gap-1.5"
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.5} />
                        <span>Đang cập nhật...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" strokeWidth={1.5} />
                        <span>Kiểm tra & Cập nhật</span>
                      </>
                    )}
                  </Button>
                </>
              ) : (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={onUpdate}
                    disabled={isUpdating}
                    className="min-h-[44px] px-4 text-xs font-semibold gap-1.5"
                  >
                    {isUpdating ? (
                      <>
                        <RefreshCw className="size-3.5 animate-spin" strokeWidth={1.5} />
                        <span>Đang cập nhật...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw className="size-3.5" strokeWidth={1.5} />
                        <span>Cập nhật ngay</span>
                      </>
                    )}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onDismiss}
                    className="min-h-[44px] px-3.5 text-xs font-medium"
                  >
                    Để sau
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PWAUpdateDialog;
