"use client";

import * as React from "react";
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import {
  isOnline,
  getOfflineMutationQueue,
  subscribeOfflineQueue,
  flushOfflineMutations,
  type OfflineMutation,
} from "@/lib/offline-sync";
import { cn } from "@/lib/utils";

export function OfflineBanner() {
  const [online, setOnline] = React.useState(true);
  const [queue, setQueue] = React.useState<OfflineMutation[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    setOnline(isOnline());
    setQueue(getOfflineMutationQueue());

    const handleOnline = () => {
      setOnline(true);
      setIsSyncing(true);
      flushOfflineMutations()
        .then(({ succeeded }) => {
          if (succeeded > 0) {
            setJustSynced(true);
            setTimeout(() => setJustSynced(false), 3500);
          }
        })
        .finally(() => {
          setIsSyncing(false);
          setQueue(getOfflineMutationQueue());
        });
    };

    const handleOffline = () => {
      setOnline(false);
      setJustSynced(false);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const unsubscribe = subscribeOfflineQueue((updatedQueue) => {
      setQueue(updatedQueue);
    });

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      unsubscribe();
    };
  }, []);

  const handleManualSync = React.useCallback(async () => {
    if (isSyncing || !online) return;
    setIsSyncing(true);
    try {
      const { succeeded } = await flushOfflineMutations();
      if (succeeded > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3500);
      }
    } finally {
      setIsSyncing(false);
      setQueue(getOfflineMutationQueue());
    }
  }, [isSyncing, online]);

  if (!mounted) return null;

  const isVisible = !online || queue.length > 0 || justSynced;
  if (!isVisible) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed z-50 transition-all duration-300 pointer-events-auto",
        "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 sm:bottom-6 max-w-[92vw] sm:max-w-md w-full"
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-full shadow-lg border text-xs font-medium backdrop-blur-md transition-all",
          !online
            ? "bg-amber-50/95 border-amber-300/80 text-amber-900 shadow-amber-900/5"
            : justSynced
            ? "bg-emerald-50/95 border-emerald-300/80 text-emerald-900 shadow-emerald-900/5"
            : "bg-blue-50/95 border-blue-300/80 text-blue-900 shadow-blue-900/5"
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          {!online ? (
            <WifiOff className="size-4 shrink-0 text-amber-600 animate-pulse" />
          ) : justSynced ? (
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="size-4 shrink-0 text-blue-600" />
          )}

          <div className="min-w-0">
            <span className="font-semibold block truncate">
              {!online
                ? "Chế độ ngoại tuyến"
                : justSynced
                ? "Đã đồng bộ thành công"
                : "Thay đổi chưa gửi"}
            </span>
            <span className="text-xs opacity-80 block truncate">
              {!online
                ? queue.length > 0
                  ? `Đang lưu tạm ${queue.length} tác vụ cục bộ`
                  : "Dữ liệu được lưu trong bộ nhớ tạm"
                : justSynced
                ? "Tất cả thay đổi đã được cập nhật"
                : `${queue.length} tác vụ đang chờ máy chủ`}
            </span>
          </div>
        </div>

        {online && queue.length > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isSyncing}
            className={cn(
              "shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-all cursor-pointer",
              "bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            )}
          >
            <RefreshCw
              className={cn("size-3", isSyncing && "animate-spin")}
            />
            <span>{isSyncing ? "Đang đồng bộ..." : "Đồng bộ ngay"}</span>
          </button>
        )}
      </div>
    </div>
  );
}
