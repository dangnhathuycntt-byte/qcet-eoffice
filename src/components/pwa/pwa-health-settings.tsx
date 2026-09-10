"use client";

/**
 * QCET E-Office - PWA Health & Offline Storage Settings
 *
 * Provides institutional configuration and inspection for:
 * 1. Application version and Service Worker lifecycle status.
 * 2. PWA installation state and launch mode.
 * 3. Web Push notification permission and topic preferences.
 * 4. Offline Storage Quota, Breakdown, and Persistence boundary.
 * 5. Outbox pending synchronization and conflict status.
 *
 * Invariants:
 * - Institutional light-only QCET UI (slate-900, institutional blue, zero dark classes).
 * - Zero emojis in all labels, messages, and tooltips.
 * - Minimum 44px touch targets for all interactive actions.
 * - Server truth wins; client-side storage is subordinate and user-controlled.
 */

import * as React from "react";
import {
  Smartphone,
  HardDrive,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Trash2,
  Wifi,
  WifiOff,
  Bell,
  ArrowUpRight,
  Database,
  Lock,
  Loader2,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { clientEnv } from "@/config/env.client";
import { useStorageQuota, type ClearOfflineDataResult } from "@/lib/pwa/storage-manager";
import { useConnectivity } from "@/lib/pwa/connectivity";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { usePushNotification } from "@/hooks/use-push-notification";
import {
  getOutboxQueue,
  subscribeOutbox,
  flushOutbox,
  getActiveUserId,
  type OfflineOutboxItem,
} from "@/lib/pwa/outbox-manager";
import { cn } from "@/lib/utils";

export interface PWAHealthSettingsProps {
  userId?: string;
  className?: string;
}

export function PWAHealthSettings({ userId: propUserId, className }: PWAHealthSettingsProps) {
  const activeUserId = propUserId || getActiveUserId();

  // 1. Storage Quota & Persistence Manager
  const {
    estimate,
    isLoading: isStorageLoading,
    isRequestingPersist,
    isClearing,
    refresh: refreshStorage,
    requestPersist,
    clearData,
  } = useStorageQuota({ userId: activeUserId, refreshIntervalMs: 30_000 });

  // 2. Connectivity State Machine (ONLINE | DEGRADED | OFFLINE)
  const { connectionState, checkNow, isOnline, isDegraded } = useConnectivity();

  // 3. PWA Installation & Standalone detection
  const { isInstallable, isInstalled, isStandalone, installApp } = usePWAInstall();

  // 4. Web Push Notification status
  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
  } = usePushNotification();

  // 5. Outbox Queue Status
  const [outboxItems, setOutboxItems] = React.useState<OfflineOutboxItem[]>([]);
  const [isFlushing, setIsFlushing] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getOutboxQueue(activeUserId).then((items) => {
      if (mounted) setOutboxItems(items);
    });

    const unsubscribe = subscribeOutbox((items) => {
      if (mounted) {
        const userItems = items.filter((item) => !item.userId || item.userId === activeUserId);
        setOutboxItems(userItems);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeUserId]);

  const pendingCount = outboxItems.filter(
    (item) => item.status === "pending" || item.status === "syncing"
  ).length;
  const conflictCount = outboxItems.filter((item) => item.status === "conflict").length;

  // 6. Service Worker status inspection & manual update checking
  const [swStatus, setSwStatus] = React.useState<
    "active" | "installing" | "waiting" | "unregistered" | "unsupported"
  >("unregistered");
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [updateFeedback, setUpdateFeedback] = React.useState<string | null>(null);

  const inspectSW = React.useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        setSwStatus("unregistered");
      } else if (reg.waiting) {
        setSwStatus("waiting");
      } else if (reg.installing) {
        setSwStatus("installing");
      } else if (reg.active) {
        setSwStatus("active");
      }
    } catch {
      setSwStatus("unregistered");
    }
  }, []);

  React.useEffect(() => {
    inspectSW();
  }, [inspectSW]);

  const handleCheckUpdate = async () => {
    setIsCheckingUpdate(true);
    setUpdateFeedback(null);
    try {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        const reg = await navigator.serviceWorker.getRegistration("/");
        if (reg) {
          await reg.update();
          if (reg.waiting) {
            setSwStatus("waiting");
            setUpdateFeedback("Đã có bản cập nhật mới. Đang chuẩn bị áp dụng.");
          } else {
            setUpdateFeedback("Hệ thống đang chạy phiên bản mới nhất.");
          }
        } else {
          setUpdateFeedback("Service Worker chưa được đăng ký.");
        }
      } else {
        setUpdateFeedback("Trình duyệt không hỗ trợ Service Worker.");
      }
      window.dispatchEvent(new CustomEvent("qcet:check-sw-update"));
    } catch {
      setUpdateFeedback("Không thể kiểm tra cập nhật. Vui lòng thử lại sau.");
    } finally {
      setIsCheckingUpdate(false);
      inspectSW();
    }
  };

  // 7. Manual Outbox Sync
  const handleManualSync = async () => {
    if (pendingCount === 0 || !isOnline) return;
    setIsFlushing(true);
    try {
      await flushOutbox(activeUserId);
      const items = await getOutboxQueue(activeUserId);
      setOutboxItems(items);
      await refreshStorage();
    } finally {
      setIsFlushing(false);
    }
  };

  // 8. Storage persistence toggle
  const [persistFeedback, setPersistFeedback] = React.useState<string | null>(null);
  const handleRequestPersistence = async () => {
    const granted = await requestPersist();
    if (granted) {
      setPersistFeedback("Đã kích hoạt lưu trữ vĩnh viễn cho thiết bị này.");
    } else {
      setPersistFeedback("Trình duyệt từ chối hoặc không hỗ trợ quyền lưu trữ vĩnh viễn.");
    }
  };

  // 9. Storage data clear with inline confirmation
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [clearResult, setClearResult] = React.useState<ClearOfflineDataResult | null>(null);

  const handleConfirmClear = async (preserveOutbox = true) => {
    setShowClearConfirm(false);
    const result = await clearData({ preserveOutbox, clearCaches: true });
    setClearResult(result);
    const items = await getOutboxQueue(activeUserId);
    setOutboxItems(items);
    setTimeout(() => setClearResult(null), 5000);
  };

  const appVersion = clientEnv.NEXT_PUBLIC_APP_VERSION || "2026.09.09.1";

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6 text-slate-900",
        className
      )}
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 shrink-0">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              Ứng dụng & Ngoại tuyến
            </h3>
            <p className="text-xs text-slate-500">
              Quản lý tài nguyên ngoại tuyến, đồng bộ dữ liệu và thông số PWA trên thiết bị
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-xs px-2.5 py-1 font-medium flex items-center gap-1.5",
              connectionState === "ONLINE"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : connectionState === "DEGRADED"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-700 border-slate-300"
            )}
          >
            {connectionState === "ONLINE" ? (
              <Wifi className="w-3.5 h-3.5" />
            ) : connectionState === "DEGRADED" ? (
              <AlertTriangle className="w-3.5 h-3.5" />
            ) : (
              <WifiOff className="w-3.5 h-3.5" />
            )}
            {connectionState === "ONLINE"
              ? "Trực tuyến (ONLINE)"
              : connectionState === "DEGRADED"
              ? "Gián đoạn máy chủ (DEGRADED)"
              : "Ngoại tuyến (OFFLINE)"}
          </Badge>
        </div>
      </div>

      {/* Grid of Diagnostics & Settings Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Phiên bản & Service Worker */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Phiên bản hệ thống
              </span>
              <Badge variant="outline" className="text-xs font-mono bg-white border-slate-200">
                v{appVersion}
              </Badge>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-slate-500">Service Worker:</span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded",
                  swStatus === "active"
                    ? "bg-emerald-100 text-emerald-800"
                    : swStatus === "waiting"
                    ? "bg-amber-100 text-amber-800"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {swStatus === "active"
                  ? "Đang hoạt động"
                  : swStatus === "waiting"
                  ? "Bản cập nhật đang chờ"
                  : swStatus === "installing"
                  ? "Đang nạp bộ nhớ"
                  : swStatus === "unsupported"
                  ? "Không hỗ trợ"
                  : "Chưa kích hoạt"}
              </span>
            </div>
            {updateFeedback && (
              <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded p-2 mt-1">
                {updateFeedback}
              </p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCheckUpdate}
            disabled={isCheckingUpdate}
            className="w-full min-h-[44px] justify-center text-xs font-medium border-slate-300 hover:bg-slate-100"
          >
            {isCheckingUpdate ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-1.5" />
            )}
            Kiểm tra bản cập nhật
          </Button>
        </div>

        {/* Card 2: Trạng thái cài đặt & Màn hình chính */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Cài đặt ứng dụng
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded",
                  isStandalone || isInstalled
                    ? "bg-blue-100 text-blue-800"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {isStandalone
                  ? "Ứng dụng độc lập (Standalone)"
                  : isInstalled
                  ? "Đã cài đặt"
                  : "Trình duyệt Web"}
              </span>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              {isStandalone
                ? "Ứng dụng đang chạy ở chế độ chuyên dụng độc lập không thanh địa chỉ."
                : isInstallable
                ? "Thiết bị đủ điều kiện cài đặt ứng dụng lên màn hình chính."
                : "Truy cập thông qua trình duyệt web an toàn."}
            </p>
          </div>
          {isInstallable && !isStandalone ? (
            <Button
              variant="default"
              size="sm"
              onClick={() => installApp()}
              className="w-full min-h-[44px] justify-center text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white"
            >
              <Smartphone className="w-4 h-4 mr-1.5" />
              Cài đặt lên thiết bị
            </Button>
          ) : (
            <div className="min-h-[44px] flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-200 rounded">
              {isStandalone ? "Đang chạy ứng dụng độc lập" : "Sẵn sàng hoạt động"}
            </div>
          )}
        </div>

        {/* Card 3: Thông báo hệ thống (Push Notifications) */}
        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Thông báo đẩy (Web Push)
              </span>
              <span
                className={cn(
                  "text-xs font-medium px-2 py-0.5 rounded",
                  pushPermission === "granted" && isPushSubscribed
                    ? "bg-emerald-100 text-emerald-800"
                    : pushPermission === "denied"
                    ? "bg-rose-100 text-rose-800"
                    : "bg-slate-200 text-slate-700"
                )}
              >
                {pushPermission === "granted" && isPushSubscribed
                  ? "Đã kích hoạt"
                  : pushPermission === "denied"
                  ? "Bị chặn"
                  : !isPushSupported
                  ? "Không hỗ trợ"
                  : "Chưa đăng ký"}
              </span>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              {pushPermission === "granted" && isPushSubscribed
                ? "Thiết bị nhận được thông báo văn bản, lịch trình và công việc mới."
                : pushPermission === "denied"
                ? "Trình duyệt đã từ chối quyền gửi thông báo từ máy chủ."
                : "Bật thông báo để không bỏ lỡ chỉ đạo và văn bản khẩn."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.dispatchEvent(new CustomEvent("qcet:open-push-onboarding"));
              }
            }}
            disabled={!isPushSupported || isPushLoading}
            className="w-full min-h-[44px] justify-center text-xs font-medium border-slate-300 hover:bg-slate-100"
          >
            <Bell className="w-4 h-4 mr-1.5" />
            Cấu hình thông báo
          </Button>
        </div>
      </div>

      {/* Row 2: Bộ nhớ ngoại tuyến & Lưu trữ vĩnh viễn */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-blue-700" />
              <h4 className="text-sm font-semibold text-slate-900">
                Dung lượng bộ nhớ ngoại tuyến & Lưu trữ
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              Chỉ số dung lượng đệm dữ liệu được cấp phát từ trình duyệt cho QCET E-Office
            </p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "text-xs px-2.5 py-1 font-medium w-fit flex items-center gap-1.5",
              estimate.isPersisted
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            )}
          >
            <Lock className="w-3 h-3" />
            {estimate.isPersisted
              ? "Lưu trữ vĩnh viễn (Đã kích hoạt)"
              : "Lưu trữ tạm thời (Trình duyệt có thể xóa)"}
          </Badge>
        </div>

        {/* Quota Progress & Stats */}
        <div className="space-y-2 pt-2">
          <div className="flex justify-between text-xs text-slate-600 font-medium">
            <span>Đã sử dụng: {estimate.usageFormatted}</span>
            <span>Hạn mức tối đa: {estimate.quotaFormatted}</span>
          </div>

          <div className="h-2.5 w-full bg-slate-200 rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-300 rounded-full",
                estimate.percentUsed > 80
                  ? "bg-rose-600"
                  : estimate.percentUsed > 50
                  ? "bg-amber-500"
                  : "bg-blue-600"
              )}
              style={{ width: `${Math.min(Math.max(estimate.percentUsed, 0.5), 100)}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Tỷ lệ chiếm dụng: {estimate.percentUsed}%</span>
            {estimate.breakdown?.indexedDbBytes ? (
              <span>Cơ sở dữ liệu: ~{estimate.usageFormatted}</span>
            ) : null}
          </div>
        </div>

        {persistFeedback && (
          <div className="text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-700 shrink-0" />
            <span>{persistFeedback}</span>
          </div>
        )}

        {/* Storage Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 pt-2">
          {!estimate.isPersisted && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRequestPersistence}
              disabled={isRequestingPersist}
              className="min-h-[44px] text-xs font-medium border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              {isRequestingPersist ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <ShieldCheck className="w-4 h-4 mr-1.5" />
              )}
              Bật lưu trữ vĩnh viễn (Không tự động xóa)
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowClearConfirm(true)}
            disabled={isClearing}
            className="min-h-[44px] text-xs font-medium border-slate-300 text-rose-700 hover:bg-rose-50 hover:border-rose-200"
          >
            {isClearing ? (
              <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
            ) : (
              <Trash2 className="w-4 h-4 mr-1.5" />
            )}
            Xóa dữ liệu ngoại tuyến
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refreshStorage()}
            disabled={isStorageLoading}
            className="min-h-[44px] text-xs text-slate-600 hover:text-slate-900 ml-auto"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5 mr-1.5", isStorageLoading && "animate-spin")}
            />
            Làm mới chỉ số
          </Button>
        </div>

        {/* Clear Confirmation Inline Modal */}
        {showClearConfirm && (
          <div className="rounded-lg border border-rose-200 bg-rose-50/50 p-4 space-y-3 mt-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-xs text-rose-900 space-y-1">
                <p className="font-semibold">Xác nhận xóa bộ đệm dữ liệu ngoại tuyến</p>
                <p className="text-rose-700 leading-relaxed">
                  Thao tác này sẽ dọn dẹp các trang đã đọc và biểu mẫu tạm thời trên thiết bị này.
                  Dữ liệu đang chờ gửi (hộp thư đi) có thể được giữ lại để tránh mất chỉ đạo.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => handleConfirmClear(true)}
                className="min-h-[44px] text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                Xóa bộ đệm (Giữ lại hộp thư đi)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleConfirmClear(false)}
                className="min-h-[44px] text-xs border-rose-300 text-rose-800 hover:bg-rose-100"
              >
                Xóa toàn bộ (Kể cả hộp thư đi)
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowClearConfirm(false)}
                className="min-h-[44px] text-xs text-slate-600 hover:text-slate-900"
              >
                Hủy
              </Button>
            </div>
          </div>
        )}

        {clearResult && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Đã xóa dữ liệu thành công ({clearResult.readCacheCleared} bản ghi đọc,{" "}
              {clearResult.draftsCleared} bản nháp, {clearResult.outboxCleared} thao tác outbox).
            </span>
          </div>
        )}
      </div>

      {/* Row 3: Hàng đợi đồng bộ hóa ngoại tuyến (Outbox Sync) */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/30 p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-blue-700" />
              <h4 className="text-sm font-semibold text-slate-900">
                Hàng đợi đồng bộ hóa ngoại tuyến (Outbox Queue)
              </h4>
            </div>
            <p className="text-xs text-slate-500">
              Các thao tác điều hành được ghi nhận ngoại tuyến sẽ tự động gửi lên máy chủ khi có
              kết nối
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="default"
              size="sm"
              onClick={handleManualSync}
              disabled={isFlushing || pendingCount === 0 || !isOnline}
              className="min-h-[44px] text-xs font-medium bg-blue-700 hover:bg-blue-800 text-white"
            >
              {isFlushing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-1.5" />
              )}
              Đồng bộ ngay
            </Button>
          </div>
        </div>

        <div className="flex flex-wrap gap-4 pt-1">
          <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-slate-500">Thao tác chờ gửi:</span>
            <span
              className={cn(
                "font-semibold px-2 py-0.5 rounded",
                pendingCount > 0 ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800"
              )}
            >
              {pendingCount}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-slate-500">Xung đột phiên bản:</span>
            <span
              className={cn(
                "font-semibold px-2 py-0.5 rounded",
                conflictCount > 0 ? "bg-rose-100 text-rose-800" : "bg-slate-100 text-slate-700"
              )}
            >
              {conflictCount}
            </span>
          </div>

          <div className="flex items-center gap-2 text-xs bg-white border border-slate-200 rounded-lg px-3 py-2">
            <span className="text-slate-500">Trạng thái tổng thể:</span>
            <span className="font-medium text-slate-800">
              {conflictCount > 0
                ? "Có xung đột cần xử lý thủ công"
                : pendingCount > 0
                ? isOnline
                  ? "Sẵn sàng đồng bộ"
                  : "Đang chờ kết nối máy chủ"
                : "Đã đồng bộ hoàn toàn"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export const PWASettingsCard = PWAHealthSettings;
