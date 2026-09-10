"use client";

/**
 * QCET E-Office - Global PWA Sync Status Indicator & Bar
 *
 * Implements an institutional, light-only true-connectivity status bar:
 * 1. True connectivity state: ONLINE, DEGRADED, OFFLINE.
 * 2. Outbox mutation lifecycle indicators:
 *    - "Đã đồng bộ" (all items synced)
 *    - "Đang đồng bộ X/Y..." (during active flush)
 *    - "X thay đổi đang chờ đồng bộ" (offline / pending mutations)
 *    - "X thay đổi cần xử lý (Xung đột)" (conflict state)
 * 3. Actions:
 *    - [Đồng bộ ngay] (manual sync retry button, >=44px touch target)
 *    - Conflict resolution modal trigger
 *
 * Institutional Invariant: 0% emojis, 0 dark theme classes, light-only institutional styling.
 */

import * as React from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Database,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ConnectionState,
  useConnectivity,
  pwaConnectivityManager,
} from "@/lib/pwa/connectivity";
import {
  OfflineOutboxItem,
  getOutboxQueue,
  subscribeOutbox,
  flushOutbox,
  getActiveUserId,
} from "@/lib/pwa/outbox-manager";
import { OfflineConflictDialog, useOfflineConflicts } from "./offline-conflict-dialog";

export interface PWASyncStatusProps {
  className?: string;
  userId?: string;
  autoHideWhenSynced?: boolean;
}

export function PWASyncStatusBar({
  className,
  userId,
  autoHideWhenSynced = true,
}: PWASyncStatusProps) {
  const { connectionState, isOnline, isDegraded, isOffline, checkNow } = useConnectivity();
  const [queue, setQueue] = React.useState<OfflineOutboxItem[]>([]);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [justSynced, setJustSynced] = React.useState(false);
  const [isConflictOpen, setIsConflictOpen] = React.useState(false);
  const [syncProgress, setSyncProgress] = React.useState<{ current: number; total: number } | null>(null);
  const [mounted, setMounted] = React.useState(false);

  const activeUid = userId || (mounted ? getActiveUserId() : undefined);

  // Hydrate outbox queue and subscribe to changes
  React.useEffect(() => {
    setMounted(true);

    getOutboxQueue(activeUid).then((items) => {
      setQueue(items);
    });

    const unsubscribe = subscribeOutbox((updatedItems) => {
      setQueue(updatedItems);
    });

    return unsubscribe;
  }, [activeUid]);

  // Auto-flush when transitioning from offline/degraded to online
  const prevConnectionStateRef = React.useRef<ConnectionState>(connectionState);
  React.useEffect(() => {
    const prevState = prevConnectionStateRef.current;
    prevConnectionStateRef.current = connectionState;

    if ((prevState === "OFFLINE" || prevState === "DEGRADED") && connectionState === "ONLINE") {
      handleManualSync();
    }
  }, [connectionState]);

  // Manual flush handler
  const handleManualSync = React.useCallback(async () => {
    if (isSyncing) return;

    // Verify actual connectivity before flushing
    const currentState = await checkNow();
    if (currentState === "OFFLINE") return;

    const currentItems = await getOutboxQueue(activeUid);
    const pendingItems = currentItems.filter(
      (i) => i.status === "pending" || i.status === "failed"
    );

    if (pendingItems.length === 0) {
      setJustSynced(true);
      setTimeout(() => setJustSynced(false), 3000);
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 1, total: pendingItems.length });

    try {
      const result = await flushOutbox(activeUid);
      const refreshedQueue = await getOutboxQueue(activeUid);
      setQueue(refreshedQueue);

      if (result.succeeded > 0) {
        setJustSynced(true);
        setTimeout(() => setJustSynced(false), 3500);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress(null);
    }
  }, [isSyncing, checkNow, activeUid]);

  if (!mounted) return null;

  const conflictItems = queue.filter((i) => i.status === "conflict");
  const pendingItems = queue.filter(
    (i) => i.status === "pending" || i.status === "syncing" || i.status === "failed"
  );
  const hasConflicts = conflictItems.length > 0;
  const hasPending = pendingItems.length > 0;

  // Determine visibility
  const isVisible =
    !isOnline ||
    isDegraded ||
    hasConflicts ||
    hasPending ||
    isSyncing ||
    justSynced;

  if (autoHideWhenSynced && !isVisible) {
    return null;
  }

  // Determine textual description and visual status theme
  let statusText = "Đã đồng bộ";
  let statusVariant: "online" | "syncing" | "degraded" | "offline" | "conflict" = "online";
  let statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;

  if (hasConflicts) {
    statusVariant = "conflict";
    statusText = `${conflictItems.length} thay đổi cần xử lý (Xung đột)`;
    statusIcon = <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />;
  } else if (isSyncing) {
    statusVariant = "syncing";
    const current = syncProgress?.current ?? 1;
    const total = syncProgress?.total ?? Math.max(pendingItems.length, 1);
    statusText = `Đang đồng bộ ${current}/${total}...`;
    statusIcon = <RefreshCw className="h-4 w-4 text-sky-600 animate-spin shrink-0" />;
  } else if (isOffline) {
    statusVariant = "offline";
    statusText = hasPending
      ? `${pendingItems.length} thay đổi đang chờ đồng bộ`
      : "Mất kết nối mạng (Ngoại tuyến)";
    statusIcon = <WifiOff className="h-4 w-4 text-slate-600 shrink-0" />;
  } else if (isDegraded) {
    statusVariant = "degraded";
    statusText = hasPending
      ? `${pendingItems.length} thay đổi đang chờ đồng bộ (Máy chủ gián đoạn)`
      : "Kết nối máy chủ gián đoạn";
    statusIcon = <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />;
  } else if (hasPending) {
    statusVariant = "degraded";
    statusText = `${pendingItems.length} thay đổi đang chờ đồng bộ`;
    statusIcon = <Database className="h-4 w-4 text-amber-600 shrink-0" />;
  } else if (justSynced) {
    statusVariant = "online";
    statusText = "Đã đồng bộ";
    statusIcon = <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />;
  }

  const variantStyles = {
    online: "bg-white border-emerald-300 text-emerald-950 shadow-sm",
    syncing: "bg-white border-sky-300 text-sky-950 shadow-sm",
    degraded: "bg-white border-amber-300 text-amber-950 shadow-sm",
    offline: "bg-white border-slate-300 text-slate-900 shadow-sm",
    conflict: "bg-white border-rose-300 text-rose-950 shadow-sm",
  };

  const badgeStyles = {
    online: "bg-emerald-50 text-emerald-800 border-emerald-200",
    syncing: "bg-sky-50 text-sky-800 border-sky-200",
    degraded: "bg-amber-50 text-amber-800 border-amber-200",
    offline: "bg-slate-100 text-slate-800 border-slate-200",
    conflict: "bg-rose-50 text-rose-800 border-rose-200",
  };

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed z-50 transition-all duration-300 pointer-events-auto",
          "bottom-[calc(4.75rem+env(safe-area-inset-bottom,0px))] left-1/2 -translate-x-1/2 sm:bottom-6 max-w-[94vw] sm:max-w-md w-full",
          className
        )}
      >
        <div
          className={cn(
            "rounded-xl border p-3 flex items-center justify-between gap-3 text-xs sm:text-sm font-medium",
            variantStyles[statusVariant]
          )}
        >
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <span
              className={cn(
                "inline-flex items-center justify-center p-1.5 rounded-lg border shrink-0",
                badgeStyles[statusVariant]
              )}
            >
              {statusIcon}
            </span>
            <div className="truncate flex flex-col">
              <span className="font-semibold truncate text-slate-900 leading-tight">
                {statusText}
              </span>
              <span className="text-[11px] text-slate-500 font-normal truncate">
                {isOffline
                  ? "Dữ liệu được lưu an toàn tại thiết bị"
                  : isDegraded
                  ? "Sẽ tự động gửi lại khi máy chủ phản hồi"
                  : isSyncing
                  ? "Đang gửi dữ liệu lên máy chủ..."
                  : hasConflicts
                  ? "Nhấn để giải quyết dữ liệu xung đột"
                  : "Dữ liệu ngoại tuyến đồng nhất"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {hasConflicts && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsConflictOpen(true)}
                className="min-h-[44px] px-3 font-semibold text-xs rounded-lg border border-rose-300"
              >
                Xử lý
              </Button>
            )}

            {!isOffline && (hasPending || isDegraded) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleManualSync}
                disabled={isSyncing}
                className="min-h-[44px] px-3 font-semibold text-xs rounded-lg border-slate-300 text-slate-800 hover:bg-slate-50 bg-white"
              >
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1 text-slate-600" />
                    Đang gửi
                  </>
                ) : (
                  "Đồng bộ ngay"
                )}
              </Button>
            )}

            {isOffline && hasPending && (
              <span className="inline-flex items-center px-2 py-1 rounded bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200">
                {pendingItems.length} chờ gửi
              </span>
            )}
          </div>
        </div>
      </div>

      {isConflictOpen && (
        <OfflineConflictDialog
          isOpen={isConflictOpen}
          conflicts={conflictItems}
          onClose={() => setIsConflictOpen(false)}
        />
      )}
    </>
  );
}

/**
 * Compact Sync Status Badge for Topbar or Page Headers.
 */
export function PWASyncStatusBadge({ className }: { className?: string }) {
  const { connectionState, isOnline, isDegraded, isOffline } = useConnectivity();
  const [queue, setQueue] = React.useState<OfflineOutboxItem[]>([]);
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    getOutboxQueue().then(setQueue);
    return subscribeOutbox(setQueue);
  }, []);

  if (!mounted) return null;

  const pendingCount = queue.filter((i) => i.status !== "conflict").length;
  const conflictCount = queue.filter((i) => i.status === "conflict").length;

  if (conflictCount > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-800 border border-rose-200",
          className
        )}
      >
        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
        <span>{conflictCount} xung đột</span>
      </span>
    );
  }

  if (isOffline) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-800 border border-slate-200",
          className
        )}
      >
        <WifiOff className="h-3.5 w-3.5 text-slate-600" />
        <span>{pendingCount > 0 ? `${pendingCount} chờ đồng bộ` : "Ngoại tuyến"}</span>
      </span>
    );
  }

  if (isDegraded) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200",
          className
        )}
      >
        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
        <span>Máy chủ gián đoạn</span>
      </span>
    );
  }

  if (pendingCount > 0) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-sky-50 text-sky-800 border border-sky-200",
          className
        )}
      >
        <RefreshCw className="h-3.5 w-3.5 text-sky-600 animate-spin" />
        <span>{pendingCount} đang đồng bộ</span>
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200",
        className
      )}
    >
      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      <span>Đã đồng bộ</span>
    </span>
  );
}

// Canonical alias
export const PWASyncStatus = PWASyncStatusBar;
