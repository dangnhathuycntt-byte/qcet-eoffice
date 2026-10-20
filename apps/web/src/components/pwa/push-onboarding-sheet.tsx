"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  Share,
  PlusSquare,
  Download,
  CheckCircle2,
  X,
  Smartphone,
  ShieldCheck,
  RefreshCw,
  ChevronDown,
  type LucideIcon,
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
} from "@qcet/shared/lib/pwa/push-preferences";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Pressable } from "@/components/ui/pressable";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SNOOZE_KEY = "qcet-push-onboarding-dismissed";
const SNOOZE_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const TOPIC_PREFERENCE_KEYS: Record<PushTopic, keyof PushPreferences> = {
  task_assigned: "taskAssigned",
  task_review: "taskReview",
  deadline_reminder: "deadlineReminder",
  document_directive: "documentDirective",
  task_extension: "taskExtension",
  task_decline: "taskDecline",
  unit_request: "unitRequest",
};

/** Tiêu đề và một dòng mô tả người dùng được gì, theo tình huống đang hiện. */
const SHEET_HEADERS: Record<"denied" | "ios" | "install" | "push" | "subscribed", { icon: LucideIcon; title: string; description: string }> = {
  denied: {
    icon: BellOff,
    title: "Hướng dẫn mở lại quyền thông báo",
    description: "Trình duyệt đang chặn thông báo của QCET.",
  },
  ios: {
    icon: Smartphone,
    title: "Cài QCET E-Office lên màn hình chính",
    description: "Mở nhanh như ứng dụng và nhận thông báo.",
  },
  install: {
    icon: Download,
    title: "Cài đặt ứng dụng QCET E-Office",
    description: "Mở nhanh như ứng dụng, không cần trình duyệt.",
  },
  push: {
    icon: Bell,
    title: "Bật chuông báo chỉ đạo & việc khẩn",
    description: "Nhận báo ngay cả khi không mở ứng dụng.",
  },
  subscribed: {
    icon: CheckCircle2,
    title: "Thông báo đã sẵn sàng",
    description: "Chuông báo sẽ đến khi có chỉ đạo hoặc việc mới.",
  },
};

/**
 * User-scoped snooze key (T63): a dismissed push/install prompt must not
 * suppress the prompt for a different account signing in on a shared device.
 */
export function pushSnoozeStorageKey(userId?: string | null): string {
  return `${SNOOZE_KEY}:${userId || "guest"}`;
}

/**
 * Reads the account-scoped push-onboarding snooze. Returns true while this
 * account's dismissal is still inside the snooze window, so the sheet never
 * re-prompts the same account — and never suppresses a different account.
 */
export function isPushOnboardingSnoozed(userId?: string | null): boolean {
  if (typeof localStorage === "undefined") return false;
  try {
    const raw = localStorage.getItem(pushSnoozeStorageKey(userId));
    if (!raw) return false;
    const snoozedAt = Number(raw);
    return Number.isFinite(snoozedAt) && Date.now() - snoozedAt < SNOOZE_DAYS_MS;
  } catch {
    return false;
  }
}

/** Persists the account-scoped push-onboarding dismissal timestamp. */
export function recordPushOnboardingSnooze(userId?: string | null): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(pushSnoozeStorageKey(userId), Date.now().toString());
  } catch {
    // Ignore storage write errors
  }
}

export interface PermissionRecoveryGuideProps {
  initialPlatform?: "chrome" | "safari";
  onReload?: () => void;
  onDismiss?: () => void;
  className?: string;
}

interface OnboardingStep {
  title: string;
  detail: React.ReactNode;
}

const RECOVERY_GUIDES: Record<"chrome" | "safari", { intro: string; steps: readonly OnboardingStep[] }> = {
  chrome: {
    intro: "Mở khóa trong Chrome trên máy tính theo 3 bước:",
    steps: [
      {
        title: "Nhấn biểu tượng ổ khóa trên thanh địa chỉ",
        detail: "Ở bên trái đường dẫn https://…, nhấn biểu tượng ổ khóa hoặc Cài đặt trang web.",
      },
      {
        title: 'Chuyển "Thông báo" sang "Cho phép"',
        detail: 'Tìm mục Thông báo (Notifications), đổi từ "Chặn" (Block) sang "Cho phép" (Allow).',
      },
      {
        title: "Tải lại trang để áp dụng",
        detail: 'Nhấn "Tải lại trang ngay" bên dưới hoặc phím F5 (Ctrl+R / Cmd+R).',
      },
    ],
  },
  safari: {
    intro: "Bật lại trong Cài đặt (Settings) của iPhone, iPad theo 3 bước:",
    steps: [
      {
        title: "Mở Cài đặt (Settings) trên iPhone, iPad",
        detail: "Từ màn hình chính, mở Cài đặt, cuộn xuống và chọn QCET E-Office (hoặc Safari).",
      },
      {
        title: 'Bật "Thông báo" (Notifications)',
        detail: 'Chọn Thông báo và bật "Cho phép thông báo" (Allow Notifications), kèm âm thanh nếu muốn.',
      },
      {
        title: "Quay lại QCET và tải lại",
        detail: 'Mở lại QCET E-Office từ màn hình chính hoặc nhấn "Tải lại trang ngay" bên dưới.',
      },
    ],
  },
};

const IOS_INSTALL_STEPS: readonly OnboardingStep[] = [
  {
    title: "Nhấn nút Chia sẻ",
    detail: (
      <>
        Nút hình vuông có mũi tên trỏ lên, ở thanh công cụ dưới cùng của Safari.
        <StepHint icon={Share}>Chia sẻ</StepHint>
      </>
    ),
  },
  {
    title: 'Chọn "Thêm vào Màn hình chính"',
    detail: (
      <>
        Cuộn xuống danh sách tùy chọn và chọn &quot;Thêm vào Màn hình chính&quot; (Add to Home Screen).
        <StepHint icon={PlusSquare}>Thêm vào Màn hình chính</StepHint>
      </>
    ),
  },
  {
    title: 'Nhấn "Thêm" để hoàn tất',
    detail: 'Nhấn "Thêm" (Add) ở góc trên bên phải, rồi mở QCET E-Office từ màn hình chính để bật thông báo.',
  },
];

function StepHint({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <span className="mt-1 flex w-fit items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 font-medium text-foreground">
      <Icon aria-hidden="true" className="size-3.5" />
      {children}
    </span>
  );
}

function OnboardingSteps({ steps }: { steps: readonly OnboardingStep[] }) {
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, index) => (
        <li key={step.title} className="flex gap-2.5">
          <span
            aria-hidden="true"
            className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-medium tabular-nums text-foreground"
          >
            {index + 1}
          </span>
          <div className="min-w-0">
            <p className="text-compact font-medium text-foreground">{step.title}</p>
            <div className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{step.detail}</div>
          </div>
        </li>
      ))}
    </ol>
  );
}

function FeatureList({ items }: { items: readonly { icon: LucideIcon; text: string }[] }) {
  return (
    <ul className="flex flex-col gap-2 rounded-lg bg-secondary p-3">
      {items.map(({ icon: Icon, text }) => (
        <li key={text} className="flex items-start gap-2 text-compact text-foreground">
          <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <span>{text}</span>
        </li>
      ))}
    </ul>
  );
}

/** Nút cuối hộp: trên điện thoại xếp dọc, rộng hết, nút chính trên cùng; trên máy tính một hàng bên phải, nút chính ngoài cùng. */
function OnboardingActions({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-col gap-2 pt-1 md:flex-row-reverse md:justify-start">{children}</div>;
}

export function PermissionRecoveryGuide({
  initialPlatform = "chrome",
  onReload,
  onDismiss,
  className,
}: PermissionRecoveryGuideProps) {
  const [platform, setPlatform] = React.useState<"chrome" | "safari">(initialPlatform);
  const guide = RECOVERY_GUIDES[platform];

  const handleReload = () => {
    if (onReload) {
      onReload();
    } else if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <Tabs value={platform} onValueChange={(next) => setPlatform(next as "chrome" | "safari")}>
        <TabsList variant="pill" size="sm" aria-label="Thiết bị đang dùng">
          <TabsTrigger value="chrome">Chrome / máy tính</TabsTrigger>
          <TabsTrigger value="safari">Safari / iPhone, iPad</TabsTrigger>
        </TabsList>
      </Tabs>
      <p className="text-compact text-foreground">{guide.intro}</p>
      <OnboardingSteps steps={guide.steps} />
      <OnboardingActions>
        <Button size="sm" onClick={handleReload} className="max-md:w-full">
          <RefreshCw aria-hidden="true" />
          Tải lại trang ngay
        </Button>
        {onDismiss ? (
          <Button variant="ghost" size="sm" onClick={onDismiss} className="max-md:w-full">
            Để sau
          </Button>
        ) : null}
      </OnboardingActions>
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

    // The sheet only opens if the coordinator allows it (never cold-prompts on
    // initial load) and this account has not dismissed it within the window.
    if (canShowPushPrompt && !isControlled && !isSubscribed && !isPushOnboardingSnoozed(userId)) {
      recordInterruptionShown("PUSH");
      setInternalOpen(true);
    }
  }, [canShowPushPrompt, isControlled, isSubscribed, userId, recordInterruptionShown]);

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
    recordPushOnboardingSnooze(userId);
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
      const key = TOPIC_PREFERENCE_KEYS[topicId];
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

  const mode = isDenied
    ? "denied"
    : isIOS && !isStandalone
    ? "ios"
    : isInstallable && !isStandalone && !isIOS
    ? "install"
    : isSubscribed
    ? "subscribed"
    : "push";
  const header = SHEET_HEADERS[mode];
  const HeaderIcon = header.icon;

  return (
    <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
      {/* Điện thoại: tấm trượt từ đáy. Máy tính: thẻ 400px giữa đáy màn hình như hộp thoại nhỏ (căn bằng mx-auto vì vaul dùng
          transform để trượt; tắt ::after vaul nối dài nền xuống dưới để che khi kéo, nếu không thẻ có dải nền dưới chân) */}
      <BottomSheetContent
        handleClassName="md:hidden"
        className="md:bottom-6 md:mx-auto md:max-w-[400px] md:rounded-2xl md:pb-5 md:after:hidden"
      >
        <BottomSheetHeader className="flex-row items-start gap-3 px-4 pt-3 pb-0 md:px-5 md:pt-5">
          <span aria-hidden="true" className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <HeaderIcon className="size-4" />
          </span>
          <div className="min-w-0 flex-1">
            <BottomSheetTitle>{header.title}</BottomSheetTitle>
            <BottomSheetDescription className="mt-0.5">{header.description}</BottomSheetDescription>
          </div>
          <BottomSheetClose asChild>
            <Button variant="ghost" size="icon-sm" aria-label="Đóng" onClick={handleDismiss} className="-mt-0.5 -mr-1">
              <X aria-hidden="true" />
            </Button>
          </BottomSheetClose>
        </BottomSheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 pt-4 md:px-5">
          {error ? <InlineAlert variant="error">{error}</InlineAlert> : null}

          {mode === "denied" ? (
            <PermissionRecoveryGuide
              initialPlatform={isIOS ? "safari" : "chrome"}
              onDismiss={handleDismiss}
              onReload={() => {
                if (typeof window !== "undefined") {
                  window.location.reload();
                }
              }}
            />
          ) : null}

          {mode === "ios" ? (
            <>
              <OnboardingSteps steps={IOS_INSTALL_STEPS} />
              <OnboardingActions>
                <Button variant="secondary" size="sm" onClick={handleDismiss} className="max-md:w-full">
                  Để sau
                </Button>
              </OnboardingActions>
            </>
          ) : null}

          {mode === "install" ? (
            <>
              <FeatureList
                items={[
                  { icon: ShieldCheck, text: "Nhẹ, an toàn, không tốn bộ nhớ thiết bị" },
                  { icon: Bell, text: "Nhận chuông báo việc khẩn và chỉ đạo ngay cả khi tắt ứng dụng" },
                ]}
              />
              <OnboardingActions>
                <Button size="sm" onClick={() => void handleInstallClick()} className="max-md:w-full">
                  <Download aria-hidden="true" />
                  Cài đặt ứng dụng
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="max-md:w-full">
                  Để sau
                </Button>
              </OnboardingActions>
            </>
          ) : null}

          {mode === "push" ? (
            <>
              <FeatureList
                items={[
                  { icon: Bell, text: "Thông báo âm thanh rõ ràng cho nhiệm vụ khẩn và hạn chót" },
                  { icon: ShieldCheck, text: "Chỉ gửi nội dung liên quan công việc QCET, không làm phiền ngoài giờ" },
                ]}
              />
              <div>
                <Pressable
                  aria-expanded={showPreferences}
                  onClick={() => setShowPreferences((v) => !v)}
                  className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-2 text-left text-compact font-medium text-foreground transition-colors hover:bg-accent motion-reduce:transition-none"
                >
                  <span>Tùy chỉnh các chủ đề nhận thông báo</span>
                  <ChevronDown
                    aria-hidden="true"
                    className={cn("size-4 text-muted-foreground transition-transform motion-reduce:transition-none", showPreferences && "rotate-180")}
                  />
                </Pressable>
                {showPreferences ? (
                  <div className="mt-2 flex flex-col gap-2.5 px-2">
                    {PUSH_TOPICS.map((topic) => (
                      <label key={topic.id} className="flex cursor-pointer items-start gap-2.5">
                        <Checkbox
                          checked={preferences[TOPIC_PREFERENCE_KEYS[topic.id]]}
                          onChange={() => handleToggleTopic(topic.id)}
                          className="mt-0.5"
                        />
                        <span className="min-w-0">
                          <span className="block text-compact font-medium text-foreground">{topic.title}</span>
                          <span className="block text-xs text-muted-foreground">{topic.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
              <OnboardingActions>
                <Button size="sm" loading={isLoading} onClick={() => void handleSubscribeClick()} className="max-md:w-full">
                  <Bell aria-hidden="true" />
                  Bật thông báo trên thiết bị
                </Button>
                <Button variant="ghost" size="sm" onClick={handleDismiss} className="max-md:w-full">
                  Để sau
                </Button>
              </OnboardingActions>
            </>
          ) : null}

          {mode === "subscribed" ? (
            <OnboardingActions>
              <Button size="sm" onClick={() => handleOpenChange(false)} className="max-md:w-full">
                Hoàn tất
              </Button>
            </OnboardingActions>
          ) : null}
        </div>
      </BottomSheetContent>
    </BottomSheet>
  );
}
