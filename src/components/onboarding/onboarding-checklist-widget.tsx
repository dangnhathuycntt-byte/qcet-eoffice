"use client";

import * as React from "react";
import {
  CheckCircle2,
  Circle,
  ChevronUp,
  ChevronDown,
  X,
  Rocket,
  Sparkles,
} from "lucide-react";
import { ChecklistTaskConfig } from "@/lib/onboarding-constants";
import { CelebrationConfetti } from "./celebration-confetti";
import { subscribeToPush } from "@/lib/push-service";

interface OnboardingChecklistWidgetProps {
  tasks: ChecklistTaskConfig[];
  completedSteps: string[];
  percentage: number;
  isExpanded: boolean;
  isDismissed: boolean;
  onToggleExpand: () => void;
  onDismiss: () => void;
  onCompleteStep: (stepId: string) => void;
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
}: OnboardingChecklistWidgetProps) {
  const [showConfetti, setShowConfetti] = React.useState(false);

  React.useEffect(() => {
    if (percentage === 100) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 2500);
      return () => clearTimeout(timer);
    }
  }, [percentage]);

  if (isDismissed) return null;

  const nextIncomplete = tasks.find((t) => !completedSteps.includes(t.id));

  const handleAction = async (task: ChecklistTaskConfig) => {
    if (task.actionType === "REQUEST_PUSH") {
      try {
        const sub = await subscribeToPush();
        if (sub) onCompleteStep(task.id);
      } catch {
        onCompleteStep(task.id); // Graceful fallback
      }
    } else if (task.actionType === "OPEN_SEARCH") {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true })
      );
      onCompleteStep(task.id);
    } else {
      onCompleteStep(task.id);
    }
  };

  return (
    <>
      <CelebrationConfetti active={showConfetti} />

      <div className="fixed bottom-6 right-6 z-40">
        {!isExpanded ? (
          /* Mini Pill Badge */
          <button
            onClick={onToggleExpand}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-full bg-card/95 border border-primary/30 shadow-xl hover:shadow-2xl hover:border-primary text-xs font-semibold text-foreground transition-all duration-200 backdrop-blur-md"
            aria-label={`Khởi động hệ thống: ${percentage}% hoàn thành`}
          >
            <span className="relative flex h-2 w-2">
              {percentage < 100 && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              )}
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
            </span>
            <span className="flex items-center gap-1.5">
              <Rocket className="w-3.5 h-3.5 text-primary" />
              <span>Khởi động QCET</span>
            </span>
            <span className="px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
              {percentage}%
            </span>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground group-hover:text-foreground transition-transform" />
          </button>
        ) : (
          /* Expanded Card */
          <div
            className="w-80 sm:w-96 bg-card border border-border/80 rounded-2xl shadow-2xl p-5 backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200"
            role="region"
            aria-label="Danh mục khởi động cho cán bộ mới"
          >
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Rocket className="w-4 h-4 text-primary" />
                <h4 className="text-sm font-bold text-foreground">Khởi động nhanh</h4>
                <span className="text-xs font-semibold text-primary px-2 py-0.5 rounded-full bg-primary/10">
                  {percentage}%
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={onToggleExpand}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Thu nhỏ"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button
                  onClick={onDismiss}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
                  aria-label="Ẩn checklist"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="my-3">
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
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
                            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground">
                              Tiếp theo
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {task.description}
                        </p>
                      </div>
                      {!isDone && (
                        <button
                          onClick={() => handleAction(task)}
                          className="px-2 py-1 rounded-lg text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors shrink-0"
                        >
                          {task.actionLabel}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {percentage === 100 && (
              <div className="mt-3 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Thầy/Cô đã sẵn sàng 100%!
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
