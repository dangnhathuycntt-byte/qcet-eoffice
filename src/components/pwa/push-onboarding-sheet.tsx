"use client";

import * as React from "react";
import {
  Bell,
  Share,
  PlusSquare,
  Download,
  CheckCircle2,
  X,
  Smartphone,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Lock,
  Settings,
  RefreshCw,
  ChevronDown,
  ChevronUp,
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
import { usePWAOnboardingCoordinator } from "@/lib/pwa/onboarding-coordinator";
import {
  PUSH_TOPICS,
  loadLocalPushPreferences,
  saveLocalPushPreferences,
  syncServerPushPreferences,
  type PushPreferences,
  type PushTopic,
} from "@/lib/pwa/push-preferences";
import { cn } from "@/lib/utils";

const SNOOZE_KEY = "qcet-push-onboarding-dismissed";
const SNOOZE_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export interface PermissionRecoveryGuideProps {
  initialPlatform?: "chrome" | "safari";
  onReload?: () => void;
  onDismiss?: () => void;
  className?: string;
}

export function PermissionRecoveryGuide({
  initialPlatform = "chrome",
  onReload,
  onDismiss,
  className,
}: PermissionRecoveryGuideProps) {
  const [platform, setPlatform] = React.useState<"chrome" | "safari">(initialPlatform);

  const handleReload = () => {
    if (onReload) {
      onReload();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Platform Switcher Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl border border-slate-200">
        <button
          type="button"
          onClick={() => setPlatform("chrome")}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center",
            platform === "chrome"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Google Chrome / Máy tính
        </button>
        <button
          type="button"
          onClick={() => setPlatform("safari")}
          className={cn(
            "flex-1 py-2 px-3 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer text-center",
            platform === "safari"
              ? "bg-white text-slate-900 shadow-sm border border-slate-200"
              : "text-slate-600 hover:text-slate-900"
          )}
        >
          Safari / iOS (iPhone & iPad)
        </button>
      </div>

      {/* Info notice */}
      <div className="flex items-start gap-3 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs sm:text-sm text-amber-900 leading-relaxed">
        <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
        <span>
          {platform === "chrome"
            ? "Trình duyệt Chrome trên máy tính đã bị chặn gửi thông báo. Hãy làm theo 3 bước bên dưới để mở khóa:"
            : "Thiết bị iPhone / iPad đã tắt thông báo cho QCET. Hãy làm theo 3 bước bên dưới trong phần Cài đặt (Settings) của máy:"}
        </span>
      </div>

      {/* 3 Steps */}
      {platform === "chrome" ? (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              1
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Nhấn vào biểu tượng Ổ khóa trên thanh địa chỉ
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Trên thanh địa chỉ trình duyệt Chrome (bên trái đường dẫn URL https://...), nhấn vào biểu tượng Ổ khóa hoặc Cài đặt trang web.
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 ml-11" />

          {/* Step 2 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              2
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#1e3a8a]" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Chuyển &quot;Thông báo&quot; sang &quot;Cho phép&quot;
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Tìm mục Thông báo (Notifications), chọn gạt công tắc hoặc đổi từ &quot;Chặn&quot; (Block) sang &quot;Cho phép&quot; (Allow).
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 ml-11" />

          {/* Step 3 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              3
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Tải lại trang để áp dụng
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Nhấn nút &quot;Tải lại trang ngay&quot; bên dưới hoặc phím F5 (Ctrl+R / Cmd+R) để hoàn tất cập nhật quyền thông báo.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
          {/* Step 1 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              1
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-[#1e3a8a]" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Mở ứng dụng Cài đặt (Settings) trên iOS
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Từ màn hình chính iPhone / iPad, mở Cài đặt (Settings), cuộn xuống tìm và chọn ứng dụng QCET E-Office (hoặc Safari).
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 ml-11" />

          {/* Step 2 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              2
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Bật mục &quot;Thông báo&quot; (Notifications) sang &quot;Cho phép&quot;
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Chọn mục Thông báo và bật công tắc &quot;Cho phép thông báo&quot; (Allow Notifications), kèm tùy chọn phát âm thanh chuông.
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-200 ml-11" />

          {/* Step 3 */}
          <div className="flex items-start gap-3.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#1e3a8a] font-bold text-sm flex items-center justify-center shrink-0 border border-blue-200">
              3
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-emerald-600" />
                <p className="text-sm sm:text-base font-semibold text-slate-900">
                  Quay lại ứng dụng QCET và tải lại
                </p>
              </div>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Quay lại ứng dụng QCET E-Office từ màn hình chính hoặc bấm nút tải lại bên dưới để hoàn tất xác thực quyền.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action CTA: Reload & Dismiss */}
      <div className="pt-2 space-y-2">
        <button
          type="button"
          onClick={handleReload}
          className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-[#1e3a8a] text-white font-bold text-base sm:text-lg shadow-lg hover:bg-[#1e40af] transition-all cursor-pointer flex items-center justify-center gap-2.5"
        >
          <RefreshCw className="w-5 h-5" />
          <span>Tải lại trang ngay</span>
        </button>
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 font-medium text-base transition-colors cursor-pointer"
          >
            Để sau
          </button>
        )}
      </div>
    </div>
  );
}

export interface PushOnboardingSheetProps {
  userId?: string | null;
  manualOpen?: boolean;
  forceOpen?: boolean;
  onManualOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  onSuccess?: () => void;
  permissionOverride?: "default" | "granted" | "denied" | "unsupported";
}

export function PushOnboardingSheet({
  userId,
  manualOpen,
  forceOpen,
  onManualOpenChange,
  onClose,
  onSuccess,
  permissionOverride,
}: PushOnboardingSheetProps) {
  const [internalOpen, setInternalOpen] = React.useState<boolean>(false);
  const [showPreferences, setShowPreferences] = React.useState<boolean>(false);
  const [preferences, setPreferences] = React.useState<PushPreferences>(() =>
    loadLocalPushPreferences(userId)
  );

  const { isInstallable, isStandalone, isIOS, installApp } = usePWAInstall();
  const {
    isSubscribed,
    isLoading,
    permission,
    error,
    subscribeToPush,
  } = usePushNotification();

  const {
    canShowPushPrompt,
    recordInterruptionShown,
    snoozePush,
  } = usePWAOnboardingCoordinator(userId);

  const isControlled = manualOpen !== undefined || forceOpen !== undefined;
  const isOpen = isControlled ? Boolean(manualOpen ?? forceOpen) : internalOpen;

  const effectivePermission = permissionOverride ?? permission;
  const isDenied = effectivePermission === "denied";

  const handleOpenChange = React.useCallback(
    (nextOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(nextOpen);
      }
      onManualOpenChange?.(nextOpen);
      if (!nextOpen) {
        onClose?.();
      }
    },
    [isControlled, onManualOpenChange, onClose]
  );

  // Controlled or coordinator-driven display logic (zero cold prompt invariant)
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // The sheet only opens if coordinator allows it (never cold-prompts on initial load)
    if (canShowPushPrompt && !isControlled && !isSubscribed) {
      recordInterruptionShown("PUSH");
      setInternalOpen(true);
    }
  }, [canShowPushPrompt, isControlled, isSubscribed, recordInterruptionShown]);

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
      // Ignore
    }
    snoozePush(14);
    handleOpenChange(false);
  };

  const handleInstallClick = async () => {
    const res = await installApp();
    if (res === "accepted") {
      handleOpenChange(false);
    }
  };

  const handleToggleTopic = (topicId: PushTopic) => {
    setPreferences((prev) => {
      let key: keyof PushPreferences;
      switch (topicId) {
        case "task_assigned":
          key = "taskAssigned";
          break;
        case "task_review":
          key = "taskReview";
          break;
        case "deadline_reminder":
          key = "deadlineReminder";
          break;
        case "document_directive":
          key = "documentDirective";
          break;
        default:
          return prev;
      }
      const updated = { ...prev, [key]: !prev[key] };
      saveLocalPushPreferences(updated, userId);
      return updated;
    });
  };

  const handleSubscribeClick = async () => {
    saveLocalPushPreferences(preferences, userId);
    await syncServerPushPreferences(preferences);

    const success = await subscribeToPush();
    if (success) {
      snoozePush(365);
      onSuccess?.();
      setTimeout(() => {
        handleOpenChange(false);
      }, 1200);
    }
  };

  const isModeIOS = isIOS && !isStandalone;
  const isModeAndroidInstall = isInstallable && !isStandalone && !isIOS;
  const isModePushPrompt = !isSubscribed;
  const isModeSubscribed = isSubscribed;

  return (
    <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
      <BottomSheetContent className="max-h-[92vh] overflow-y-auto px-4 pb-8 sm:px-6">
        <BottomSheetHeader className="border-b border-slate-200 pb-3 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#1e3a8a] border border-blue-200 flex items-center justify-center shrink-0">
                {isModeIOS ? (
                  <Smartphone className="w-6 h-6 text-[#1e3a8a]" />
                ) : isModeAndroidInstall ? (
                  <Download className="w-6 h-6 text-[#1e3a8a]" />
                ) : (
                  <Bell className="w-6 h-6 text-[#1e3a8a]" />
                )}
              </div>
              <div>
                <BottomSheetTitle className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {isDenied
                    ? "Hướng dẫn mở lại quyền thông báo"
                    : isModeIOS
                    ? "Cài đặt QCET E-Office lên màn hình chính"
                    : isModeAndroidInstall
                    ? "Cài đặt ứng dụng QCET E-Office"
                    : isModePushPrompt
                    ? "Bật chuông báo chỉ đạo & việc khẩn"
                    : "Thông báo đã sẵn sàng"}
                </BottomSheetTitle>
                <BottomSheetDescription className="text-sm sm:text-base text-slate-500 mt-0.5">
                  {isDenied
                    ? "Quyền thông báo đang bị chặn hoặc bị khóa bởi trình duyệt"
                    : "Hệ thống điều hành tác nghiệp Trường CĐ Kỹ thuật Công nghệ Quy Nhơn (QCET)"}
                </BottomSheetDescription>
              </div>
            </div>

            <BottomSheetClose
              onClick={handleDismiss}
              className="flex items-center justify-center min-w-[44px] min-h-[44px] p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="w-5 h-5" />
            </BottomSheetClose>
          </div>
        </BottomSheetHeader>

        {/* Content Body */}
        <div className="py-5 space-y-5">
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200 text-red-900 text-sm font-medium">
              <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Mode Denied: Recovery Guide */}
          {isDenied && (
            <PermissionRecoveryGuide
              initialPlatform={isIOS ? "safari" : "chrome"}
              onDismiss={handleDismiss}
              onReload={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
            />
          )}

          {/* Mode A: iOS Safari Instructions */}
          {!isDenied && isModeIOS && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-slate-900 font-medium leading-relaxed">
                Để nhận thông báo tức thì và thao tác nhanh chóng như ứng dụng cài đặt trên máy iPhone / iPad, vui lòng làm theo 3 bước sau:
              </p>

              <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5">
                {/* Step 1 */}
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white font-bold text-base flex items-center justify-center shrink-0">
                    1
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-slate-900">
                      Nhấn nút Chia sẻ
                    </p>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                      Nhấn nút Chia sẻ (biểu tượng hình vuông có mũi tên trỏ lên) ở thanh điều khiển Safari dưới cùng của màn hình.
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 mt-1">
                      <Share className="w-4 h-4 text-[#1e3a8a]" />
                      <span>Nút Chia sẻ Safari</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200 ml-13" />

                {/* Step 2 */}
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white font-bold text-base flex items-center justify-center shrink-0">
                    2
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-slate-900">
                      Chọn &quot;Thêm vào Màn hình chính&quot;
                    </p>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                      Cuộn xuống trong danh sách tùy chọn và chọn &quot;Thêm vào Màn hình chính&quot; (Add to Home Screen).
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-900 mt-1">
                      <PlusSquare className="w-4 h-4 text-[#1e3a8a]" />
                      <span>Thêm vào Màn hình chính</span>
                    </div>
                  </div>
                </div>

                <div className="h-px bg-slate-200 ml-13" />

                {/* Step 3 */}
                <div className="flex items-start gap-4">
                  <div className="w-9 h-9 rounded-xl bg-[#1e3a8a] text-white font-bold text-base flex items-center justify-center shrink-0">
                    3
                  </div>
                  <div className="space-y-1">
                    <p className="text-base sm:text-lg font-semibold text-slate-900">
                      Nhấn &quot;Thêm&quot; để hoàn tất
                    </p>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                      Nhấn nút &quot;Thêm&quot; (Add) ở góc trên bên phải màn hình để đưa biểu tượng QCET E-Office ra màn hình chính, sau đó mở ứng dụng từ màn hình chính để kích hoạt thông báo.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode B: Android / Chromium Desktop 1-Click Install */}
          {!isDenied && isModeAndroidInstall && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-slate-900 font-normal leading-relaxed">
                Truy cập nhanh như ứng dụng di động, không cần mở trình duyệt và không tốn dung lượng máy.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#1e3a8a] shrink-0" />
                  <span className="text-sm sm:text-base text-slate-900 font-medium">
                    Nhẹ, an toàn, không tốn bộ nhớ thiết bị
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-[#1e3a8a] shrink-0" />
                  <span className="text-sm sm:text-base text-slate-900 font-medium">
                    Nhận chuông báo việc khẩn và chỉ đạo ngay cả khi tắt ứng dụng
                  </span>
                </div>
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleInstallClick}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-[#1e3a8a] text-white font-bold text-base sm:text-lg shadow-lg hover:bg-[#1e40af] transition-all cursor-pointer flex items-center justify-center gap-2.5"
                >
                  <Download className="w-5 h-5" />
                  <span>CÀI ĐẶT 1-CHẠM</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode C: Push Prompt */}
          {!isDenied && !isModeIOS && !isModeAndroidInstall && isModePushPrompt && (
            <div className="space-y-4">
              <p className="text-base sm:text-lg text-slate-900 font-normal leading-relaxed">
                Nhận thông báo tức thì khi có việc khẩn, văn bản hỏa tốc và ý kiến chỉ đạo từ Ban Giám Hiệu ngay cả khi không mở ứng dụng.
              </p>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center gap-3">
                  <Bell className="w-6 h-6 text-[#1e3a8a] shrink-0" />
                  <span className="text-sm sm:text-base text-slate-900 font-medium">
                    Thông báo âm thanh rõ ràng cho nhiệm vụ khẩn và hạn chót
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-[#1e3a8a] shrink-0" />
                  <span className="text-sm sm:text-base text-slate-900 font-medium">
                    Chỉ gửi nội dung liên quan công việc QCET, không làm phiền ngoài giờ
                  </span>
                </div>
              </div>

              {/* Granular topic selection */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowPreferences((v) => !v)}
                  className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between text-left transition-colors min-h-[44px]"
                >
                  <div className="flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-800">
                    <ShieldCheck className="w-4 h-4 text-slate-500" />
                    <span>Tùy chỉnh các chủ đề nhận thông báo</span>
                  </div>
                  {showPreferences ? (
                    <ChevronUp className="w-4 h-4 text-slate-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-500" />
                  )}
                </button>

                {showPreferences && (
                  <div className="p-4 bg-white divide-y divide-slate-100 space-y-3">
                    {PUSH_TOPICS.map((topic) => {
                      let isChecked = true;
                      switch (topic.id) {
                        case "task_assigned":
                          isChecked = preferences.taskAssigned;
                          break;
                        case "task_review":
                          isChecked = preferences.taskReview;
                          break;
                        case "deadline_reminder":
                          isChecked = preferences.deadlineReminder;
                          break;
                        case "document_directive":
                          isChecked = preferences.documentDirective;
                          break;
                      }

                      return (
                        <label
                          key={topic.id}
                          className="pt-3 first:pt-0 flex items-start gap-3 cursor-pointer group"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => handleToggleTopic(topic.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#1e3a8a] focus:ring-[#1e3a8a] focus:ring-offset-0"
                          />
                          <div className="flex-1">
                            <div className="text-xs sm:text-sm font-semibold text-slate-900 group-hover:text-[#1e3a8a] transition-colors">
                              {topic.title}
                            </div>
                            <div className="text-[11px] sm:text-xs text-slate-500 leading-normal mt-0.5">
                              {topic.description}
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="pt-2 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSubscribeClick}
                  disabled={isLoading}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-[#1e3a8a] text-white font-bold text-base sm:text-lg shadow-lg hover:bg-[#1e40af] transition-all cursor-pointer flex items-center justify-center gap-2.5 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Bell className="w-5 h-5" />
                  )}
                  <span>Bật thông báo trên thiết bị</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full min-h-[52px] py-3.5 px-6 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium text-base transition-colors cursor-pointer"
                >
                  Để sau
                </button>
              </div>
            </div>
          )}

          {/* Mode D: Already Subscribed */}
          {!isDenied && !isModeIOS && !isModeAndroidInstall && isModeSubscribed && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-9 h-9 text-emerald-600" />
              </div>
              <div className="space-y-1">
                <p className="text-lg font-bold text-slate-900">
                  Thông báo đã kích hoạt thành công
                </p>
                <p className="text-base text-slate-600">
                  Bạn sẽ nhận được chuông thông báo mỗi khi có chỉ đạo mới hoặc nhiệm vụ được phân công.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-xl bg-[#1e3a8a] text-white font-semibold text-base shadow-md hover:bg-[#1e40af] transition-colors cursor-pointer mt-2"
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
