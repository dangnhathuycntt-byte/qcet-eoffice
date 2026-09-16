"use client";

import * as React from "react";
import {
  TrendingUp,
  CheckCircle2,
  Send,
  Loader2,
  Check,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/dashboard";

export interface TaskProgressComposerProps {
  taskId: string;
  initialProgress: number;
  taskStatus: TaskStatus;
  canEdit?: boolean;
  onProgressUpdated?: (newProgress: number, note?: string) => Promise<void> | void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  className?: string;
}

export function TaskProgressComposer({
  taskId,
  initialProgress,
  taskStatus,
  canEdit = true,
  onProgressUpdated,
  onStatusChange,
  className,
}: TaskProgressComposerProps) {
  const [progress, setProgress] = React.useState<number>(initialProgress);
  const [note, setNote] = React.useState<string>("");
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);

  React.useEffect(() => {
    setProgress(initialProgress);
  }, [initialProgress]);

  const handleApplyPreset = (value: number) => {
    if (!canEdit) return;
    const nextVal = Math.min(100, Math.max(0, value));
    setProgress(nextVal);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || isSubmitting) return;

    setIsSubmitting(true);
    setFeedback(null);

    try {
      // 1. Send update progress API call
      const res = await fetch(`/api/tasks/${taskId}/actions/update-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressPercent: progress,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
        // Fallback PATCH if endpoint differs
        await fetch(`/api/tasks/${taskId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            progressPercent: progress,
          }),
        });
      }

      if (onProgressUpdated) {
        await onProgressUpdated(progress, note.trim() || undefined);
      }

      // If progress reaches 100% and not yet marked completed, prompt or update status
      if (progress === 100 && taskStatus !== "COMPLETED" && onStatusChange) {
        await onStatusChange(taskId, "COMPLETED", note.trim() || "Hoàn thành 100% nhiệm vụ");
      }

      setFeedback({ type: "success", message: "Đã cập nhật tiến độ thành công." });
      setNote("");
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Có lỗi xảy ra khi lưu tiến độ. Vui lòng thử lại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-slot="task-progress-composer"
      className={cn(
        "rounded-xl border border-border/70 bg-card/60 p-4 space-y-3.5 transition-all shadow-2xs",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-primary shrink-0" strokeWidth={1.5} />
          <h3 className="text-xs font-semibold text-foreground">
            Cập nhật tiến độ thực hiện
          </h3>
        </div>

        {/* Current progress indicator */}
        <span className="font-mono font-bold text-xs text-foreground bg-muted px-2 py-0.5 rounded-md tabular-nums">
          {progress}%
        </span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Progress Slider & Number Input */}
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={progress}
              disabled={!canEdit || isSubmitting}
              onChange={(e) => setProgress(Number(e.target.value))}
              className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary focus:outline-hidden disabled:opacity-50"
              aria-label="Thanh trượt điều chỉnh tỷ lệ phần trăm tiến độ"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={progress}
              disabled={!canEdit || isSubmitting}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (!isNaN(val)) {
                  setProgress(Math.min(100, Math.max(0, val)));
                }
              }}
              className="w-16 h-8 text-center text-xs font-mono font-semibold rounded-lg border border-border bg-background text-foreground focus:ring-2 focus:ring-primary/40 focus:outline-hidden disabled:opacity-50"
              aria-label="Nhập số phần trăm tiến độ"
            />
          </div>

          {/* Quick preset buttons */}
          {canEdit && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-muted-foreground mr-1">Tăng nhanh:</span>
              <button
                type="button"
                onClick={() => handleApplyPreset(progress + 10)}
                disabled={isSubmitting || progress >= 100}
                className="px-2 py-0.5 rounded-md border border-border/80 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                +10%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(progress + 25)}
                disabled={isSubmitting || progress >= 100}
                className="px-2 py-0.5 rounded-md border border-border/80 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                +25%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(50)}
                disabled={isSubmitting}
                className="px-2 py-0.5 rounded-md border border-border/80 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                50% (Một nửa)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(100)}
                disabled={isSubmitting || progress === 100}
                className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40"
              >
                100% (Hoàn thành)
              </button>
            </div>
          )}
        </div>

        {/* Note textarea */}
        <div className="space-y-1">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canEdit || isSubmitting}
            placeholder={
              canEdit
                ? "Ghi chú tiến độ hoặc tóm tắt kết quả thực hiện mới nhất..."
                : "Chỉ người phụ trách mới có quyền cập nhật tiến độ"
            }
            rows={2}
            className="w-full text-xs text-foreground placeholder:text-muted-foreground p-2.5 rounded-lg border border-border/80 bg-background focus:ring-2 focus:ring-primary/40 focus:outline-hidden resize-none transition-colors disabled:opacity-60"
            aria-label="Ghi chú báo cáo tiến độ"
          />
        </div>

        {/* Feedback message */}
        {feedback && (
          <div
            role="status"
            className={cn(
              "text-xs p-2 rounded-lg font-medium flex items-center gap-1.5 animate-in fade-in duration-150",
              feedback.type === "success"
                ? "bg-emerald-500/10 text-emerald-700 border border-emerald-500/20"
                : "bg-rose-500/10 text-rose-700 border border-rose-500/20"
            )}
          >
            {feedback.type === "success" ? (
              <Check className="size-3.5 shrink-0" strokeWidth={1.5} />
            ) : (
              <span className="size-1.5 rounded-full bg-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Action Button */}
        {canEdit && (
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" strokeWidth={1.5} />
                  <span>Gửi cập nhật</span>
                </>
              )}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
