"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Trash2,
  X,
  FileText,
  Server,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  OfflineOutboxItem,
  getConflictItems,
  resolveConflict,
  subscribeOutbox,
} from "@/lib/pwa/outbox-manager";

export interface OfflineConflictDialogProps {
  isOpen?: boolean;
  conflicts?: OfflineOutboxItem[];
  onResolve?: (itemId: string, resolution: "override" | "discard") => void | Promise<void>;
  onClose?: () => void;
  className?: string;
}

/**
 * Hook to monitor and interact with active outbox conflict items.
 */
export function useOfflineConflicts() {
  const [conflicts, setConflicts] = React.useState<OfflineOutboxItem[]>([]);
  const [isResolving, setIsResolving] = React.useState(false);

  const refreshConflicts = React.useCallback(async () => {
    try {
      const items = await getConflictItems();
      setConflicts(items);
    } catch {
      // Ignore lookup errors
    }
  }, []);

  React.useEffect(() => {
    refreshConflicts();

    const unsubscribe = subscribeOutbox(() => {
      refreshConflicts();
    });

    const handleConflictEvent = (e: Event) => {
      refreshConflicts();
    };

    window.addEventListener("qcet:outbox-conflict", handleConflictEvent);
    return () => {
      unsubscribe();
      window.removeEventListener("qcet:outbox-conflict", handleConflictEvent);
    };
  }, [refreshConflicts]);

  const handleResolve = React.useCallback(
    async (itemId: string, resolution: "override" | "discard") => {
      setIsResolving(true);
      try {
        await resolveConflict(itemId, resolution);
        await refreshConflicts();
      } finally {
        setIsResolving(false);
      }
    },
    [refreshConflicts]
  );

  return {
    conflicts,
    hasConflicts: conflicts.length > 0,
    isResolving,
    handleResolve,
    refreshConflicts,
  };
}

/**
 * Formats operation names into clear Vietnamese administrative terms.
 */
function formatOperationLabel(operation: string): string {
  const op = operation.toUpperCase();
  if (op.includes("STATUS") || op.includes("UPDATE_STATUS")) return "Cập nhật trạng thái nhiệm vụ";
  if (op.includes("PROGRESS") || op.includes("UPDATE_PROGRESS")) return "Cập nhật tiến độ nhiệm vụ";
  if (op.includes("APPROVE") || op.includes("REVIEW")) return "Phê duyệt / Thẩm định kết quả";
  if (op.includes("DELIVERABLE") || op.includes("SUBMIT")) return "Nộp minh chứng / Báo cáo kết quả";
  if (op.includes("CREATE")) return "Khởi tạo dữ liệu mới";
  if (op.includes("DELETE")) return "Xóa dữ liệu";
  return operation || "Thao tác cập nhật";
}

/**
 * Offline Conflict Resolution Dialog.
 *
 * Appears when offline mutations result in an HTTP 409 OCC Conflict on the server.
 * Adheres strictly to QCET UI guidelines:
 *  - Light-only design standard (slate-900, institutional blue, warning amber; dark variant strictly prohibited)
 *  - Touch ergonomics: All interactive targets meet min-h-[44px]
 *  - High clarity: Explains server vs local version and provides Override vs Discard choices.
 */
export function OfflineConflictDialog({
  isOpen: propIsOpen,
  conflicts: propConflicts,
  onResolve: propOnResolve,
  onClose: propOnClose,
  className,
}: OfflineConflictDialogProps) {
  const hookData = useOfflineConflicts();
  const conflicts = propConflicts ?? hookData.conflicts;
  const isControlled = typeof propIsOpen === "boolean";
  const [internalDismissed, setInternalDismissed] = React.useState(false);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [showDetails, setShowDetails] = React.useState(false);

  // Keep index within bounds when conflicts change
  React.useEffect(() => {
    if (currentIndex >= conflicts.length && conflicts.length > 0) {
      setCurrentIndex(conflicts.length - 1);
    }
  }, [conflicts.length, currentIndex]);

  // Reset internal dismissal when new conflicts arrive
  React.useEffect(() => {
    if (conflicts.length > 0) {
      setInternalDismissed(false);
    }
  }, [conflicts.length]);

  const isOpen = isControlled ? propIsOpen : conflicts.length > 0 && !internalDismissed;

  if (!isOpen || conflicts.length === 0) {
    return null;
  }

  const activeItem = conflicts[Math.min(currentIndex, conflicts.length - 1)];
  if (!activeItem) return null;

  const handleDismiss = () => {
    if (propOnClose) {
      propOnClose();
    } else {
      setInternalDismissed(true);
    }
  };

  const handleAction = async (resolution: "override" | "discard") => {
    if (propOnResolve) {
      await propOnResolve(activeItem.id, resolution);
    } else {
      await hookData.handleResolve(activeItem.id, resolution);
    }
    setShowDetails(false);
  };

  const serverData = (activeItem.serverConflictData as any) || {};
  const serverVersion = serverData.currentVersion ?? serverData.version ?? "Mới hơn";
  const localVersion = activeItem.expectedVersion ?? "Trước đó";

  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="conflict-dialog-title"
      aria-describedby="conflict-dialog-desc"
      className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div
        className={cn(
          "w-full max-w-xl rounded-2xl bg-white border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]",
          className
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-4 sm:p-5 border-b border-slate-100 bg-amber-50/60">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-900 mt-0.5 shadow-xs">
              <AlertTriangle className="size-5" strokeWidth={1.5} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2
                  id="conflict-dialog-title"
                  className="text-base sm:text-lg font-bold text-slate-900 leading-snug"
                >
                  Xung đột dữ liệu ngoại tuyến
                </h2>
                {conflicts.length > 1 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-200/80 text-amber-950">
                    {currentIndex + 1} / {conflicts.length}
                  </span>
                )}
              </div>
              <p
                id="conflict-dialog-desc"
                className="mt-1 text-xs text-slate-600 leading-relaxed"
              >
                Dữ liệu bạn chỉnh sửa khi ngoại tuyến đã bị thay đổi trên máy chủ bởi phiên làm việc khác.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDismiss}
            className="size-9 shrink-0 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Đóng hộp thoại xung đột"
          >
            <X className="size-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
          {/* Operation & Entity Info */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-slate-500" strokeWidth={1.5} />
                <span className="font-semibold text-slate-800">
                  {formatOperationLabel(activeItem.operation)}
                </span>
              </div>
              <span className="font-mono text-xs text-slate-500 px-2 py-0.5 bg-white border border-slate-200 rounded">
                Mã: {activeItem.entityId}
              </span>
            </div>

            {activeItem.errorMessage && (
              <p className="text-xs text-amber-800 bg-amber-100/50 p-2 rounded-lg border border-amber-200/50">
                {activeItem.errorMessage}
              </p>
            )}
          </div>

          {/* Comparison Cards: Local vs Server */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Local offline changes */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-blue-900 font-semibold mb-1">
                  <Smartphone className="size-4 text-blue-700" strokeWidth={1.5} />
                  <span>Thay đổi của bạn (Cục bộ)</span>
                </div>
                <div className="text-xs text-blue-800/80 mb-2">
                  Phiên bản gốc dự kiến: <span className="font-mono font-bold">{String(localVersion)}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-blue-100 text-xs text-slate-700 max-h-36 overflow-y-auto font-mono">
                  {typeof activeItem.payload === "object" && activeItem.payload !== null ? (
                    <pre className="whitespace-pre-wrap break-all font-sans text-xs">
                      {JSON.stringify(activeItem.payload, null, 2)}
                    </pre>
                  ) : (
                    String(activeItem.payload ?? "Không có nội dung")
                  )}
                </div>
              </div>
            </div>

            {/* Server truth */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 text-slate-900 font-semibold mb-1">
                  <Server className="size-4 text-slate-700" strokeWidth={1.5} />
                  <span>Dữ liệu hiện tại máy chủ</span>
                </div>
                <div className="text-xs text-slate-600 mb-2">
                  Phiên bản máy chủ: <span className="font-mono font-bold text-slate-900">{String(serverVersion)}</span>
                </div>
                <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-xs text-slate-700 max-h-36 overflow-y-auto font-mono">
                  {serverData.serverState ? (
                    <pre className="whitespace-pre-wrap break-all font-sans text-xs">
                      {JSON.stringify(serverData.serverState, null, 2)}
                    </pre>
                  ) : serverData.error ? (
                    <span className="text-slate-600 font-sans">{serverData.error}</span>
                  ) : (
                    <pre className="whitespace-pre-wrap break-all font-sans text-xs">
                      {JSON.stringify(serverData, null, 2)}
                    </pre>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Collapsible raw details */}
          <div>
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="inline-flex items-center gap-1.5 text-xs text-slate-600 hover:text-slate-900 font-medium py-1.5 cursor-pointer"
            >
              <span>{showDetails ? "Thu gọn chi tiết kỹ thuật" : "Xem chi tiết kỹ thuật"}</span>
              {showDetails ? (
                <ChevronUp className="size-3.5" strokeWidth={1.5} />
              ) : (
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              )}
            </button>

            {showDetails && (
              <div className="mt-2 p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-xs overflow-x-auto space-y-1.5 animate-in fade-in duration-150">
                <p><span className="text-slate-400">URL:</span> {activeItem.method} {activeItem.url}</p>
                <p><span className="text-slate-400">Idempotency Key:</span> {activeItem.idempotencyKey}</p>
                <p><span className="text-slate-400">Tạo lúc:</span> {new Date(activeItem.createdAt).toLocaleString("vi-VN")}</p>
              </div>
            )}
          </div>

          {/* Multi-conflict navigation controls */}
          {conflicts.length > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-xs text-slate-600">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentIndex === 0}
                onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                className="min-h-[44px] px-3 font-medium cursor-pointer"
              >
                Xung đột trước
              </Button>
              <span className="font-semibold text-slate-800">
                Mục {currentIndex + 1} trên {conflicts.length}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentIndex >= conflicts.length - 1}
                onClick={() => setCurrentIndex((i) => Math.min(conflicts.length - 1, i + 1))}
                className="min-h-[44px] px-3 font-medium cursor-pointer"
              >
                Xung đột kế tiếp
              </Button>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50/90 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            disabled={hookData.isResolving}
            onClick={() => handleAction("discard")}
            className="min-h-[44px] px-4 text-xs font-semibold text-rose-700 hover:text-rose-800 hover:bg-rose-50 border-rose-200 cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <Trash2 className="size-4" strokeWidth={1.5} />
            <span>Bỏ thay đổi của tôi</span>
          </Button>

          <Button
            type="button"
            variant="default"
            disabled={hookData.isResolving}
            onClick={() => handleAction("override")}
            className="min-h-[44px] px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs cursor-pointer inline-flex items-center justify-center gap-2"
          >
            <RotateCcw className="size-4" strokeWidth={1.5} />
            <span>Áp dụng lại (Ghi đè)</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default OfflineConflictDialog;
