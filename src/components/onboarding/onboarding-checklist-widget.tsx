"use client";

import * as React from "react";
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
} from "lucide-react";
import { ChecklistTaskConfig } from "@/lib/onboarding-constants";
import { usePushNotification } from "@/hooks/use-push-notification";

interface OnboardingChecklistWidgetProps {
  tasks: ChecklistTaskConfig[];
  completedSteps: string[];
  percentage: number;
  isExpanded: boolean;
  isDismissed: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
  onCompleteStep: (stepId: string) => void;
  onStartTour?: () => void;
}

export function OnboardingChecklistWidget({
  tasks,
  completedSteps,
  percentage,
  isExpanded,
  isDismissed,
  onToggleExpand,
  onDismiss,
  onCompleteStep,
  onStartTour,
}: OnboardingChecklistWidgetProps) {
  const { subscribeToPush } = usePushNotification();

  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null);
  const [pushNotice, setPushNotice] = React.useState<string | null>(null);

  if (isDismissed) return null;

  const nextIncomplete = tasks.find((t) => !completedSteps.includes(t.id));

  const handleAction = async (task: ChecklistTaskConfig) => {
    if (activeTaskId) return;
    setActiveTaskId(task.id);

    try {
      if (task.actionType === "REQUEST_PUSH") {
        try {
          const pushPromise = subscribeToPush();
          const timeoutPromise = new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 3000));
          const granted = await Promise.race([pushPromise, timeoutPromise]);

          if (granted) {
            setPushNotice("Đã bật nhận thông báo đẩy thành công!");
          } else if (typeof Notification !== "undefined" && Notification.permission === "denied") {
            setPushNotice("Trình duyệt đang chặn thông báo. Đã đánh dấu hoàn tất để bạn tiếp tục.");
          }
        } catch {
          // Graceful fallback
        } finally {
          onCompleteStep(task.id);
          setTimeout(() => setPushNotice(null), 4000);
        }
      } else if (task.actionType === "OPEN_SEARCH") {
        const searchBtn = document.querySelector<HTMLButtonElement>("#tour-topbar-search");
        if (searchBtn) {
          searchBtn.click();
        } else {
          window.dispatchEvent(
            new KeyboardEvent("keydown", { key: "k", metaKey: true, ctrlKey: true, bubbles: true })
          );
        }
        onCompleteStep(task.id);
      } else if (task.actionType === "NAVIGATE" || task.id === "step-action") {
        window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
        onCompleteStep(task.id);
      } else {
        onCompleteStep(task.id);
      }
    } finally {
      setActiveTaskId(null);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-40">
        {!isExpanded ? (
          /* Mini Pill Badge */
          <button
            onClick={onToggleExpand}
            className="group flex items-center gap-2.5 px-3.5 py-2 rounded-full bg-card/95 border border-border/80 shadow-lg hover:shadow-xl hover:border-primary/50 text-xs font-semibold text-foreground transition-all duration-200 backdrop-blur-md"
            aria-label={`Khởi động hệ thống: ${percentage}% hoàn thành`}
          >
            <div className="flex items-center gap-1.5 text-primary">
              <ListChecks className="w-4 h-4" />
              <span className="text-foreground">Thiết lập hệ thống</span>
            </div>
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {percentage}%
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
          </button>
        ) : (
          /* Expanded Card */
          <div
            className="w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-xl p-5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
            role="region"
            aria-label="Danh mục khởi động cho cán bộ mới"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/50">
              <div className="flex items-center gap-2">
                <ListChecks className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-semibold text-foreground">Thiết lập khởi đầu</h4>
                <span className="text-xs font-medium text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20">
                  {percentage}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleExpand}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Thu nhỏ"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={onDismiss}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Ẩn checklist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Segmented Progress Bar */}
            <div className="my-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Tiến độ hoàn thành</span>
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
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-xs font-semibold text-emerald-600 flex items-center justify-center gap-1.5">
                  <CheckCheck className="w-4 h-4" /> Thầy/Cô đã hoàn tất thiết lập ban đầu!
                </span>
              </div>
            ) : onStartTour ? (
              <button
                type="button"
                onClick={onStartTour}
                className="mt-3 w-full py-1.5 px-3 rounded-xl border border-primary/25 bg-primary/5 hover:bg-primary/10 text-primary text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Xem hướng dẫn trực quan (Tour)</span>
              </button>
            ) : null}
          </div>
        )}
      </div>
  );
}
