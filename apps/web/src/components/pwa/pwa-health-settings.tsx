"use client";

/**
 * Cài đặt ứng dụng trên thiết bị đang dùng (trang Cài đặt hệ thống): kết nối, phiên bản và bản cập nhật, cài lên thiết bị,
 * thông báo đẩy, dung lượng và lưu trữ ngoại tuyến, hàng đợi đồng bộ, xóa dữ liệu ngoại tuyến.
 * Bố cục kiểu trang cài đặt của Linear (dựng lại 15/10/2026): mỗi nhóm là một khung các hàng "nhãn + mô tả | trạng thái, nút".
 * Dữ liệu máy chủ là chuẩn; dữ liệu trên thiết bị do người dùng tự quản lý. Xóa dữ liệu luôn qua bước xác nhận, mặc định giữ hộp thư đi.
 */

import * as React from "react";
import { CheckCircle2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
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

type Tone = "default" | "muted" | "warning" | "destructive";

const TONE_CLASS: Record<Tone, string> = {
  default: "text-foreground",
  muted: "text-muted-foreground",
  warning: "text-warning",
  destructive: "text-destructive",
};

function SettingsSection({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  const id = React.useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <div>
        <h2 id={id} className="text-compact font-semibold text-foreground">
          {title}
        </h2>
        {description ? <p className="mt-0.5 text-xs text-muted-foreground">{description}</p> : null}
      </div>
      <div className="divide-y divide-border/70 rounded-lg border border-border bg-background">{children}</div>
    </section>
  );
}

/** Một hàng cài đặt: nhãn và mô tả bên trái; trạng thái và nút bên phải (điện thoại: xuống dòng dưới mô tả). */
function SettingsRow({
  label,
  description,
  status,
  tone = "muted",
  action,
  children,
}: {
  label: string;
  description?: React.ReactNode;
  status?: React.ReactNode;
  tone?: Tone;
  action?: React.ReactNode;
  /** Nội dung thêm dưới hàng (thanh dung lượng, khối xác nhận, kết quả thao tác). */
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <p className="text-compact font-medium text-foreground">{label}</p>
          {description ? <p className="mt-0.5 text-xs text-muted-foreground text-pretty">{description}</p> : null}
        </div>
        {status || action ? (
          <div className="flex shrink-0 items-center gap-3">
            {status ? <span className={cn("text-xs", TONE_CLASS[tone])}>{status}</span> : null}
            {action}
          </div>
        ) : null}
      </div>
      {children}
    </div>
  );
}

const SW_STATUS: Record<"active" | "installing" | "waiting" | "unregistered" | "unsupported", { text: string; tone: Tone }> = {
  active: { text: "Đã sẵn sàng dùng ngoại tuyến", tone: "muted" },
  waiting: { text: "Có bản cập nhật, tải lại trang để áp dụng", tone: "warning" },
  installing: { text: "Đang tải bản mới", tone: "muted" },
  unregistered: { text: "Chưa bật dùng ngoại tuyến", tone: "muted" },
  unsupported: { text: "Trình duyệt không hỗ trợ dùng ngoại tuyến", tone: "muted" },
};

export function PWAHealthSettings({ userId: propUserId, className }: PWAHealthSettingsProps) {
  const activeUserId = propUserId || getActiveUserId();

  const {
    estimate,
    isLoading: isStorageLoading,
    isRequestingPersist,
    isClearing,
    refresh: refreshStorage,
    requestPersist,
    clearData,
  } = useStorageQuota({ userId: activeUserId, refreshIntervalMs: 30_000 });

  const { connectionState, isOnline } = useConnectivity();
  const { isInstallable, isInstalled, isStandalone, installApp } = usePWAInstall();
  const {
    isSupported: isPushSupported,
    permission: pushPermission,
    isSubscribed: isPushSubscribed,
    isLoading: isPushLoading,
  } = usePushNotification();

  // Hàng đợi thao tác ghi ngoại tuyến của người dùng hiện tại
  const [outboxItems, setOutboxItems] = React.useState<OfflineOutboxItem[]>([]);
  const [isFlushing, setIsFlushing] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;
    getOutboxQueue(activeUserId).then((items) => {
      if (mounted) setOutboxItems(items);
    });
    const unsubscribe = subscribeOutbox((items) => {
      if (mounted) setOutboxItems(items.filter((item) => !item.userId || item.userId === activeUserId));
    });
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [activeUserId]);

  const pendingCount = outboxItems.filter((item) => item.status === "pending" || item.status === "syncing").length;
  const conflictCount = outboxItems.filter((item) => item.status === "conflict").length;

  // Service worker: trạng thái và kiểm tra bản cập nhật thủ công
  const [swStatus, setSwStatus] = React.useState<keyof typeof SW_STATUS>("unregistered");
  const [isCheckingUpdate, setIsCheckingUpdate] = React.useState(false);
  const [updateFeedback, setUpdateFeedback] = React.useState<string | null>(null);

  const inspectSW = React.useCallback(async () => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      setSwStatus("unsupported");
      return;
    }
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      if (!reg) setSwStatus("unregistered");
      else if (reg.waiting) setSwStatus("waiting");
      else if (reg.installing) setSwStatus("installing");
      else if (reg.active) setSwStatus("active");
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
            setUpdateFeedback("Đang dùng phiên bản mới nhất.");
          }
        } else {
          setUpdateFeedback("Chưa bật dùng ngoại tuyến nên chưa kiểm tra được bản cập nhật.");
        }
      } else {
        setUpdateFeedback("Trình duyệt không hỗ trợ kiểm tra bản cập nhật.");
      }
      window.dispatchEvent(new CustomEvent("qcet:check-sw-update"));
    } catch {
      setUpdateFeedback("Chưa kiểm tra được bản cập nhật. Vui lòng thử lại sau.");
    } finally {
      setIsCheckingUpdate(false);
      inspectSW();
    }
  };

  const handleManualSync = async () => {
    if (pendingCount === 0 || !isOnline) return;
    setIsFlushing(true);
    try {
      await flushOutbox(activeUserId);
      setOutboxItems(await getOutboxQueue(activeUserId));
      await refreshStorage();
    } finally {
      setIsFlushing(false);
    }
  };

  const [persistFeedback, setPersistFeedback] = React.useState<string | null>(null);
  const handleRequestPersistence = async () => {
    const granted = await requestPersist();
    setPersistFeedback(
      granted ? "Đã bật lưu trữ lâu dài trên thiết bị này." : "Trình duyệt từ chối hoặc không hỗ trợ lưu trữ lâu dài."
    );
  };

  // Xóa dữ liệu ngoại tuyến: khối xác nhận ngay trong hàng, mặc định giữ hộp thư đi
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);
  const [clearResult, setClearResult] = React.useState<ClearOfflineDataResult | null>(null);

  const handleConfirmClear = async (preserveOutbox = true) => {
    setShowClearConfirm(false);
    const result = await clearData({ preserveOutbox, clearCaches: true });
    setClearResult(result);
    setOutboxItems(await getOutboxQueue(activeUserId));
    setTimeout(() => setClearResult(null), 5000);
  };

  const appVersion = clientEnv.NEXT_PUBLIC_APP_VERSION || "2026.09.09.1";

  const connection: { text: string; tone: Tone } =
    connectionState === "ONLINE"
      ? { text: "Trực tuyến", tone: "muted" }
      : connectionState === "DEGRADED"
      ? { text: "Máy chủ đang gián đoạn", tone: "warning" }
      : { text: "Ngoại tuyến", tone: "warning" };

  const push: { text: string; tone: Tone; description: string } =
    pushPermission === "granted" && isPushSubscribed
      ? { text: "Đã bật", tone: "muted", description: "Thiết bị này nhận thông báo văn bản, lịch và công việc mới." }
      : pushPermission === "denied"
      ? { text: "Bị chặn", tone: "destructive", description: "Trình duyệt đã chặn thông báo của trang. Mở quyền thông báo trong cài đặt trình duyệt." }
      : !isPushSupported
      ? { text: "Không hỗ trợ", tone: "muted", description: "Trình duyệt này không nhận được thông báo đẩy." }
      : { text: "Chưa bật", tone: "muted", description: "Bật để không bỏ lỡ chỉ đạo và văn bản khẩn." };

  const install = isStandalone
    ? "Đang chạy như ứng dụng"
    : isInstalled
    ? "Đã cài"
    : "Đang mở trong trình duyệt";

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      <SettingsSection title="Ứng dụng">
        <SettingsRow
          label="Kết nối"
          description="Trạng thái kết nối tới máy chủ của thiết bị này."
          status={connection.text}
          tone={connection.tone}
        />
        <SettingsRow
          label={`Phiên bản ${appVersion}`}
          description={updateFeedback ?? SW_STATUS[swStatus].text}
          action={
            <Button variant="toolbar" size="sm" onClick={handleCheckUpdate} loading={isCheckingUpdate}>
              Kiểm tra cập nhật
            </Button>
          }
        />
        <SettingsRow
          label="Cài lên thiết bị"
          description={
            isStandalone
              ? "Mở QCET E-Office như một ứng dụng riêng, không có thanh địa chỉ."
              : isInstallable
              ? "Thiết bị này cài được QCET E-Office lên màn hình chính."
              : "Cài lên điện thoại để mở nhanh và nhận thông báo."
          }
          status={install}
          action={
            isInstallable && !isStandalone ? (
              <Button variant="toolbar" size="sm" onClick={() => installApp()}>
                Cài đặt
              </Button>
            ) : !isStandalone ? (
              <Button variant="toolbar" size="sm" onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-install-modal"))}>
                Cài trên điện thoại
              </Button>
            ) : null
          }
        />
      </SettingsSection>

      <SettingsSection title="Thông báo">
        <SettingsRow
          label="Thông báo đẩy"
          description={push.description}
          status={push.text}
          tone={push.tone}
          action={
            <Button
              variant="toolbar"
              size="sm"
              onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-push-onboarding"))}
              disabled={!isPushSupported || isPushLoading}
            >
              Cấu hình
            </Button>
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Dữ liệu ngoại tuyến"
        description="Chỉ áp dụng cho trình duyệt trên thiết bị này, không đồng bộ sang máy khác."
      >
        <SettingsRow
          label="Dung lượng đã dùng"
          description={`${estimate.usageFormatted} trên hạn mức ${estimate.quotaFormatted} (${estimate.percentUsed}%)`}
          action={
            <Button variant="ghost" size="icon-xs" aria-label="Làm mới dung lượng" onClick={() => refreshStorage()} disabled={isStorageLoading}>
              <RefreshCw className={cn(isStorageLoading && "motion-safe:animate-spin")} />
            </Button>
          }
        >
          <div
            role="progressbar"
            aria-label="Dung lượng ngoại tuyến đã dùng"
            aria-valuenow={estimate.percentUsed}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
          >
            <div
              className={cn(
                "h-full rounded-full",
                estimate.percentUsed > 80 ? "bg-destructive" : estimate.percentUsed > 50 ? "bg-warning" : "bg-foreground/40"
              )}
              style={{ width: `${Math.min(Math.max(estimate.percentUsed, 0.5), 100)}%` }}
            />
          </div>
        </SettingsRow>
        <SettingsRow
          label="Lưu trữ lâu dài"
          description={
            persistFeedback ??
            (estimate.isPersisted
              ? "Trình duyệt không tự xóa dữ liệu ngoại tuyến của QCET E-Office."
              : "Khi thiếu dung lượng, trình duyệt có thể tự xóa dữ liệu ngoại tuyến.")
          }
          status={estimate.isPersisted ? "Đã bật" : "Chưa bật"}
          action={
            !estimate.isPersisted ? (
              <Button variant="toolbar" size="sm" onClick={handleRequestPersistence} loading={isRequestingPersist}>
                Bật
              </Button>
            ) : null
          }
        />
        <SettingsRow
          label="Hàng đợi đồng bộ"
          description={
            conflictCount > 0
              ? "Có thao tác bị xung đột phiên bản, cần xử lý thủ công."
              : pendingCount > 0
              ? isOnline
                ? "Thao tác làm khi ngoại tuyến đang chờ gửi lên máy chủ."
                : "Thao tác sẽ tự gửi khi có kết nối."
              : "Mọi thao tác đã được gửi lên máy chủ."
          }
          status={`${pendingCount} chờ gửi${conflictCount > 0 ? ` · ${conflictCount} xung đột` : ""}`}
          tone={conflictCount > 0 ? "destructive" : pendingCount > 0 ? "warning" : "muted"}
          action={
            <Button
              variant="toolbar"
              size="sm"
              onClick={handleManualSync}
              loading={isFlushing}
              disabled={pendingCount === 0 || !isOnline}
            >
              Đồng bộ ngay
            </Button>
          }
        />
        <SettingsRow
          label="Xóa dữ liệu ngoại tuyến"
          description="Dọn trang đã đọc và bản nháp lưu trên thiết bị này. Dữ liệu trên máy chủ không bị ảnh hưởng."
          action={
            !showClearConfirm ? (
              <Button variant="destructive" size="sm" onClick={() => setShowClearConfirm(true)} loading={isClearing}>
                Xóa…
              </Button>
            ) : null
          }
        >
          {showClearConfirm ? (
            <div role="group" aria-label="Xác nhận xóa dữ liệu ngoại tuyến" className="flex flex-col gap-3 rounded-md border border-destructive/25 px-3 py-3">
              <p className="text-xs text-destructive text-pretty">
                Chọn cách xóa. Hộp thư đi là các thao tác làm khi ngoại tuyến và chưa gửi lên máy chủ; xóa hộp thư đi thì các thao tác đó mất hẳn.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="destructive" size="sm" onClick={() => handleConfirmClear(true)}>
                  Xóa bộ đệm, giữ hộp thư đi
                </Button>
                <Button variant="toolbar" size="sm" className="text-destructive" onClick={() => handleConfirmClear(false)}>
                  Xóa toàn bộ, kể cả hộp thư đi
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowClearConfirm(false)}>
                  Hủy
                </Button>
              </div>
            </div>
          ) : null}
          {clearResult ? (
            <p role="status" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Đã xóa {clearResult.readCacheCleared} bản ghi đọc, {clearResult.draftsCleared} bản nháp, {clearResult.outboxCleared} thao tác chờ gửi.
            </p>
          ) : null}
        </SettingsRow>
      </SettingsSection>
    </div>
  );
}
