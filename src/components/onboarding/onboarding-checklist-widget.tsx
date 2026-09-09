"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Circle,
  ChevronUp,
  ChevronDown,
  X,
  ListChecks,
  CheckCheck,
  Sparkles,
  Loader2,
  Clock,
  Award,
} from "lucide-react";
import { ChecklistTaskConfig, isSnoozed } from "@/lib/onboarding-constants";
import { useAuth } from "@/lib/auth-context";
import { usePushNotification } from "@/hooks/use-push-notification";
import { CelebrationConfetti } from "./celebration-confetti";

export interface OnboardingChecklistWidgetProps {
  tasks: ChecklistTaskConfig[];
  completedSteps: string[];
  percentage: number;
  isExpanded: boolean;
  isDismissed: boolean;
  snoozedUntil?: string | null;
  userRole?: string;
  onToggleExpand: () => void;
  onDismiss: () => void;
  onSnooze?: (hours?: number) => void;
  onCompleteStep: (stepId: string) => void;
  onStartTour?: () => void;
}

export function dispatchRoleAction(
  role?: string,
  dbRole?: string,
  router?: { push: (url: string) => void } | null
): string {
  const effectiveRole = dbRole || role || "STAFF";

  if (effectiveRole === "BAN_GIAM_HIEU" || effectiveRole === "ADMIN") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:navigate-cockpit"));
      const target =
        document.querySelector("#tour-radar-card") ||
        document.querySelector("#tour-cockpit-metrics");
      if (target && "scrollIntoView" in target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    return "qcet:navigate-cockpit";
  }

  if (effectiveRole === "TRUONG_PHONG" || effectiveRole === "MANAGER") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
      const btn = document.querySelector<HTMLButtonElement>("#tour-create-task-btn");
      if (btn && typeof btn.click === "function") {
        btn.click();
      }
    }
    return "qcet:open-create-task";
  }

  if (effectiveRole === "VAN_THU") {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:navigate-documents"));
      if (router && typeof router.push === "function") {
        router.push("/documents");
      } else if (typeof window.location !== "undefined" && window.location.pathname !== "/documents") {
        window.location.href = "/documents";
      }
    }
    return "qcet:navigate-documents";
  }

  // CHUYEN_VIEN / GIANG_VIEN / STAFF (default)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("qcet:open-submit-deliverable"));
    const staffTarget =
      document.querySelector("#tour-empty-state-cta") ||
      document.querySelector("#tour-tasks-landing");
    if (staffTarget && "scrollIntoView" in staffTarget) {
      staffTarget.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
  return "qcet:open-submit-deliverable";
}

export function OnboardingChecklistWidget({
  tasks,
  completedSteps,
  percentage,
  isExpanded,
  isDismissed,
  snoozedUntil,
  userRole,
  onToggleExpand,
  onDismiss,
  onSnooze,
  onCompleteStep,
  onStartTour,
}: OnboardingChecklistWidgetProps) {
  const { subscribeToPush } = usePushNotification();

  let router: ReturnType<typeof useRouter> | null = null;
  try {
    router = useRouter();
  } catch {
    // Graceful fallback when rendered outside Next.js App Router
  }

  let authContextUser = null;
  try {
    const auth = useAuth();
    authContextUser = auth?.user;
  } catch {
    // Graceful fallback for non-auth provider environments
  }

  const effectiveRole =
    userRole || authContextUser?.dbRole || authContextUser?.role || "STAFF";

  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [pushNotice, setPushNotice] = React.useState<string | null>(null);

  if (isDismissed || (snoozedUntil && isSnoozed(snoozedUntil))) return null;

  const nextIncomplete = tasks.find((t) => !completedSteps.includes(t.id));

  const handleAction = async (task: ChecklistTaskConfig) => {
    if (activeTaskId) return;
    setActiveTaskId(task.id);

    try {
      if (task.actionType === "REQUEST_PUSH") {
        try {
          const pushPromise = subscribeToPush();
          const timeoutPromise = new Promise<boolean>((resolve) =>
            setTimeout(() => resolve(false), 3000)
          );
          const granted = await Promise.race([pushPromise, timeoutPromise]);

          if (granted) {
            setPushNotice("Đã bật nhận thông báo đẩy thành công!");
          } else if (
            typeof Notification !== "undefined" &&
            Notification.permission === "denied"
          ) {
            setPushNotice(
              "Trình duyệt đang chặn thông báo. Đã đánh dấu hoàn tất để Thầy/Cô tiếp tục làm việc."
            );
          }
        } catch {
          // Graceful fallback
        } finally {
          onCompleteStep(task.id);
          setTimeout(() => setPushNotice(null), 4000);
        }
      } else if (task.actionType === "OPEN_SEARCH") {
        const searchBtn = document.querySelector<HTMLButtonElement>(
          "#tour-topbar-search"
        );
        if (searchBtn) {
          searchBtn.click();
        } else {
          window.dispatchEvent(
            new KeyboardEvent("keydown", {
              key: "k",
              metaKey: true,
              ctrlKey: true,
              bubbles: true,
            })
          );
        }
        onCompleteStep(task.id);
      } else if (task.actionType === "NAVIGATE" || task.id === "step-action") {
        if (task.targetAction && typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(task.targetAction));
        }
        dispatchRoleAction(effectiveRole, authContextUser?.dbRole, router);
        onCompleteStep(task.id);
      } else {
        onCompleteStep(task.id);
      }
    } finally {
      setActiveTaskId(null);
    }
  };

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
      {!isExpanded ? (
        /* Mini Pill Badge */
        <button
          onClick={onToggleExpand}
          className="group flex items-center gap-2.5 px-3.5 py-2 min-h-[44px] rounded-full bg-card/95 border border-border/80 shadow-lg hover:shadow-xl hover:border-primary/50 text-xs font-semibold text-foreground transition-all duration-200 backdrop-blur-md touch-manipulation cursor-pointer"
          aria-label={`Khởi động hệ thống: ${percentage}% hoàn thành`}
        >
          <div
            className={`flex items-center gap-1.5 ${
              percentage === 100
                ? "text-emerald-600 font-semibold"
                : "text-primary"
            }`}
          >
            {percentage === 100 ? (
              <Award className="w-4 h-4" />
            ) : (
              <ListChecks className="w-4 h-4" />
            )}
            <span className="text-foreground">
              {percentage === 100
                ? "Cán bộ số hóa tiêu biểu"
                : "Thiết lập hệ thống"}
            </span>
          </div>
          <span
            className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
              percentage === 100
                ? "bg-emerald-500/10 text-emerald-600"
                : "bg-primary/10 text-primary"
            }`}
          >
            {percentage}%
          </span>
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
        </button>
      ) : (
        /* Expanded Card */
        <div
          className="w-[calc(100vw-2rem)] sm:w-96 max-w-sm bg-card border border-border/80 rounded-2xl shadow-xl p-4 sm:p-5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
          role="region"
          aria-label="Danh mục khởi động cho cán bộ mới"
        >
          <div className="flex items-center justify-between pb-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">
                Thiết lập khởi đầu
              </h4>
              <span className="text-xs font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                {percentage}%
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  if (onSnooze) {
                    onSnooze(24);
                  }
                }}
                title="Nhắc lại sau 24 giờ"
                aria-label="Nhắc lại sau 24 giờ"
                className="px-2 py-1 min-h-[36px] text-xs text-muted-foreground hover:text-foreground hover:bg-muted rounded-md flex items-center gap-1 transition-colors cursor-pointer touch-manipulation"
              >
                <Clock className="w-3.5 h-3.5 shrink-0" />
                <span>Nhắc lại sau 24h</span>
              </button>
              <button
                type="button"
                onClick={onToggleExpand}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer touch-manipulation"
                aria-label="Thu nhỏ"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="p-1.5 min-h-[36px] min-w-[36px] flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer touch-manipulation"
                aria-label="Ẩn checklist"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Segmented Progress Bar */}
          <div className="my-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">
                Tiến độ hoàn thành
              </span>
              <span className="font-semibold text-foreground">
                {completedSteps.length}/{tasks.length} mục
              </span>
            </div>
            <div className="grid grid-cols-4 gap-1.5">
              {tasks.map((t, idx) => {
                const isDone = completedSteps.includes(t.id);
                return (
                  <div
                    key={t.id}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      isDone
                        ? "bg-primary"
                        : idx === completedSteps.length
                        ? "bg-primary/35"
                        : "bg-muted"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {/* Task list */}
          <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
            {tasks.map((task) => {
              const isDone = completedSteps.includes(task.id);
              const isNext = nextIncomplete?.id === task.id;

              return (
                <div
                  key={task.id}
                  className={`p-2.5 rounded-xl border transition-all duration-200 ${
                    isDone
                      ? "bg-muted/30 border-transparent text-muted-foreground"
                      : isNext
                      ? "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
                      : "bg-card border-border/50"
                  }`}
                >
                  <div className="flex items-start gap-2.5">
                    {isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-xs font-semibold ${
                            isDone
                              ? "line-through text-muted-foreground"
                              : "text-foreground"
                          }`}
                        >
                          {task.title}
                        </p>
                        {isNext && !isDone && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded-md bg-primary text-primary-foreground">
                            Ưu tiên
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {task.description}
                      </p>
                    </div>
                    {!isDone && (
                      <button
                        type="button"
                        onClick={() => handleAction(task)}
                        disabled={activeTaskId === task.id}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0 cursor-pointer disabled:opacity-60 flex items-center gap-1.5"
                      >
                        {activeTaskId === task.id ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin text-primary" />
                            <span>Đang xử lý...</span>
                          </>
                        ) : (
                          task.actionLabel
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {pushNotice && (
            <div className="mt-2.5 p-2 rounded-lg bg-primary/10 border border-primary/20 text-xs text-primary font-medium text-center animate-in fade-in slide-in-from-bottom-1">
              {pushNotice}
            </div>
          )}

          {percentage === 100 ? (
            <div className="relative mt-3 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 shadow-xs space-y-2.5 animate-in fade-in zoom-in-95 duration-300">
              <CelebrationConfetti />
              <div className="flex items-center justify-between gap-2 relative z-20">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600 text-white text-xs font-semibold shadow-xs">
                  <Award className="w-3.5 h-3.5 shrink-0" />
                  <span>Cán bộ số hóa tiêu biểu</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-md">
                  100% Hoàn tất
                </span>
              </div>
              <div className="text-left space-y-1 relative z-20">
                <p className="text-xs font-semibold text-foreground">
                  Xuất sắc! Thầy/Cô đã hoàn tất các bước thiết lập khởi đầu
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Hệ thống QCET E-Office đã sẵn sàng phục vụ công tác điều hành, phân công và xử lý công việc trực tuyến.
                </p>
              </div>
              <div className="pt-1 flex items-center justify-end relative z-20">
                <button
                  type="button"
                  onClick={onDismiss}
                  className="w-full sm:w-auto px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium transition-colors shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
                  aria-label="Đóng và bắt đầu làm việc"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Đóng và bắt đầu làm việc</span>
                </button>
              </div>
            </div>
          ) : onStartTour ? (
            <button
              type="button"
              onClick={onStartTour}
              className="mt-3 w-full py-1.5 px-3 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Xem hướng dẫn từng bước</span>
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}
