"use client";

import * as React from "react";
import {
  Bell,
  Share,
  PlusSquare,
  Download,
  CheckCircle2,
  ArrowDown,
  X,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
} from "lucide-react";
import {
  BottomSheet,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetDescription,
  BottomSheetClose,
} from "@/components/ui/bottom-sheet";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { usePushNotification } from "@/hooks/use-push-notification";
import { cn } from "@/lib/utils";

const SNOOZE_KEY = "qcet-push-onboarding-dismissed";
const SNOOZE_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface PushOnboardingSheetProps {
  manualOpen?: boolean;
  onManualOpenChange?: (open: boolean) => void;
}

export function PushOnboardingSheet({
  manualOpen,
  onManualOpenChange,
}: PushOnboardingSheetProps) {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(false);
  const { isInstallable, isStandalone, isIOS, installApp } = usePWAInstall();
  const {
    isSubscribed,
    isLoading,
    isSupported,
    error,
    subscribeToPush,
  } = usePushNotification();

  const isControlled = manualOpen !== undefined;
  const isOpen = isControlled ? manualOpen : internalOpen;

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onManualOpenChange?.(nextOpen);
    },
    [isControlled, onManualOpenChange]
  );

  // Auto-display logic on mount: checks 7-day cooldown
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Check if previously dismissed within 7 days
    try {
      const dismissedRaw = localStorage.getItem(SNOOZE_KEY);
      if (dismissedRaw) {
        const dismissedAt = parseInt(dismissedRaw, 10);
        if (!isNaN(dismissedAt) && Date.now() - dismissedAt < SNOOZE_DAYS_MS) {
          return;
        }
      }
    } catch {
      // Ignore localStorage access errors
    }

    // Delay prompt slightly so layout settles
    const timer = setTimeout(() => {
      // If already subscribed and running in standalone, no need to auto-prompt
      if (isSubscribed && isStandalone) {
        return;
      }
      // If not dismissed and needs install or push subscription
      if (!isSubscribed || isInstallable || (isIOS && !isStandalone)) {
        setInternalOpen(true);
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [isSubscribed, isStandalone, isInstallable, isIOS]);

  // Listen for manual trigger via custom event
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleCustomTrigger = () => {
      handleOpenChange(true);
    };

    window.addEventListener("qcet:open-push-onboarding", handleCustomTrigger);
    return () => {
      window.removeEventListener("qcet:open-push-onboarding", handleCustomTrigger);
    };
  }, [handleOpenChange]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(SNOOZE_KEY, Date.now().toString());
    } catch {
      // Ignore localStorage errors
    }
    handleOpenChange(false);
  };

  const handleInstallClick = async () => {
    const res = await installApp();
    if (res === "accepted") {
      handleOpenChange(false);
    }
  };

  const handleSubscribeClick = async () => {
    const success = await subscribeToPush();
    if (success) {
      setTimeout(() => {
        handleOpenChange(false);
      }, 1200);
    }
  };

  // Determine which mode to display:
  // Mode A: iOS Safari (when isIOS and not isStandalone)
  // Mode B: Android / Chromium Desktop (when isInstallable and not isStandalone)
  // Mode C: Standalone PWA or already installed, but not subscribed to push
  // Mode D: Already subscribed to push
  const isModeIOS = isIOS && !isStandalone;
  const isModeAndroidInstall = isInstallable && !isStandalone && !isIOS;
  const isModePushPrompt = !isSubscribed;
  const isModeSubscribed = isSubscribed;

  return (
    <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheetContent className="max-h-[92vh] overflow-y-auto px-4 pb-8 sm:px-6">
        <BottomSheetHeader className="border-b border-border/40 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                {isModeIOS ? (
                  <Smartphone className="size-6 text-primary" />
                ) : isModeAndroidInstall ? (
                  <Download className="size-6 text-primary" />
                ) : (
                  <Bell className="size-6 text-primary" />
                )}
              </div>
              <div>
                <BottomSheetTitle className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  {isModeIOS
                    ? "Cài đặt QCET E-Office lên màn hình chính"
                    : isModeAndroidInstall
                    ? "Cài đặt ứng dụng QCET E-Office"
                    : isModePushPrompt
                    ? "Bật chuông báo chỉ đạo & việc khẩn"
                    : "Thông báo đã sẵn sàng"}
                </BottomSheetTitle>
                <BottomSheetDescription className="text-sm sm:text-base text-muted-foreground mt-0.5">
                  Hệ thống điều hành tác nghiệp Trường CĐ Kỹ thuật Cao Thắng
                </BottomSheetDescription>
              </div>
            </div>

            <BottomSheetClose
              onClick={handleDismiss}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X size={20} />
            </BottomSheetClose>
          </div>
        </BottomSheetHeader>

        {/* Content Body */}
        <div className="py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-sm font-medium">
              <AlertCircle size={20} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode A: iOS Safari Instructions */}
          {isModeIOS && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-foreground font-medium leading-relaxed">
                Để nhận thông báo tức thì và thao tác nhanh chóng như ứng dụng cài đặt trên máy iPhone / iPad, vui lòng làm theo 3 bước sau:
              </p>

              <div className="space-y-3 bg-muted/30 border border-border/50 rounded-2xl p-4 sm:p-5">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="size-9 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-foreground">
                      Nhấn nút Chia sẻ
                    </p>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Nhấn nút Chia sẻ (biểu tượng hình vuông có mũi tên trỏ lên) ở thanh điều khiển Safari dưới cùng của màn hình.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border/60 text-xs font-semibold text-foreground mt-1">
                      <Share size={15} className="text-primary" />
                      <span>Nút Chia sẻ Safari</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border/40 ml-13" />

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="size-9 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-foreground">
                      Chọn &quot;Thêm vào Màn hình chính&quot;
                    </p>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Cuộn xuống trong danh sách tùy chọn và chọn &quot;Thêm vào Màn hình chính&quot; (Add to Home Screen).
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-background border border-border/60 text-xs font-semibold text-foreground mt-1">
                      <PlusSquare size={15} className="text-primary" />
                      <span>Thêm vào Màn hình chính</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-border/40 ml-13" />

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="size-9 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-foreground">
                      Nhấn &quot;Thêm&quot; để hoàn tất
                    </p>
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
                      Nhấn &quot;Thêm&quot; ở góc trên bên phải để hoàn tất cài đặt ứng dụng QCET ra ngoài màn hình chính.
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Pointer pointing down towards Safari bottom bar */}
              <div className="flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 text-primary text-sm font-semibold animate-pulse">
                <ArrowDown size={18} />
                <span>Nút Chia sẻ nằm ở thanh công cụ phía dưới cùng màn hình điện thoại</span>
                <ArrowDown size={18} />
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-base sm:text-lg shadow-md hover:bg-primary/90 transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 size={20} />
                  <span>Tôi đã hiểu cách cài đặt</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode B: Android / Chromium Desktop 1-Click Install */}
          {isModeAndroidInstall && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-foreground font-normal leading-relaxed">
                Truy cập nhanh như ứng dụng di động, không cần mở trình duyệt và không tốn dung lượng máy.
              </p>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-6 text-primary shrink-0" />
                  <span className="text-sm sm:text-base text-foreground font-medium">
                    Nhẹ, an toàn, không tốn bộ nhớ thiết bị
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="size-6 text-primary shrink-0" />
                  <span className="text-sm sm:text-base text-foreground font-medium">
                    Nhận chuông báo việc khẩn và chỉ đạo ngay cả khi tắt ứng dụng
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-base sm:text-lg shadow-lg hover:bg-primary/90 transition-all cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Download size={22} />
                  <span>CÀI ĐẶT 1-CHẠM</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode C: Push Prompt (Standalone or Installed, or Not Subscribed) */}
          {!isModeIOS && !isModeAndroidInstall && isModePushPrompt && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-foreground font-normal leading-relaxed">
                Nhận thông báo tức thì khi có việc khẩn, văn bản hỏa tốc và ý kiến chỉ đạo từ Ban Giám Hiệu ngay cả khi không mở ứng dụng.
              </p>

              <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-3">
                <div className="flex items-center gap-3">
                  <Bell className="size-6 text-primary shrink-0" />
                  <span className="text-sm sm:text-base text-foreground font-medium">
                    Thông báo âm thanh rõ ràng cho nhiệm vụ khẩn và hạn chót
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="size-6 text-primary shrink-0" />
                  <span className="text-sm sm:text-base text-foreground font-medium">
                    Chỉ gửi nội dung liên quan công việc QCET, không làm phiền ngoài giờ
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSubscribeClick}
                  disabled={isLoading}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-bold text-base sm:text-lg shadow-lg hover:bg-primary/90 transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 size={22} className="animate-spin" />
                  ) : (
                    <Bell size={22} />
                  )}
                  <span>BẬT THÔNG BÁO NGAY</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-border/70 hover:bg-muted text-muted-foreground font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode D: Already Subscribed */}
          {!isModeIOS && !isModeAndroidInstall && isModeSubscribed && (
            <div className="space-y-4 text-center py-4">
              <div className="size-16 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-foreground">
                  Thông báo đã kích hoạt thành công
                </p>
                <p className="text-base text-muted-foreground">
                  Bạn sẽ nhận được chuông thông báo mỗi khi có chỉ đạo mới hoặc nhiệm vụ được phân công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-primary text-primary-foreground font-semibold text-base shadow-md hover:bg-primary/90 transition-colors cursor-pointer mt-2"
              >
                Hoàn tất
              </button>
            </div>
          )}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
