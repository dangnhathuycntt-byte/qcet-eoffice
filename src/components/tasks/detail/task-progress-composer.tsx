"use client";

import * as React from "react";
import {
  TrendingUp,
  Send,
  Loader2,
  Check,
  Edit2,
  X,
  MessageSquare,
  Sparkles,
  ChevronDown,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/dashboard";

export interface TaskProgressComposerProps {
  taskId: string;
  initialProgress: number;
  taskStatus: TaskStatus;
  leadName?: string;
  latestNote?: string;
  canEdit?: boolean;
  onProgressUpdated?: (newProgress: number, note?: string) => Promise<void> | void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  className?: string;
}

export function TaskProgressComposer({
  taskId,
  initialProgress,
  taskStatus,
  leadName = "Người phụ trách",
  latestNote,
  canEdit = true,
  onProgressUpdated,
  onStatusChange,
  className,
}: TaskProgressComposerProps) {
  const [progress, setProgress] = React.useState<number>(initialProgress);
  const [note, setNote] = React.useState<string>("");
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
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

      // If progress reaches 100% and not yet marked completed, update status
      if (progress === 100 && taskStatus !== "COMPLETED" && onStatusChange) {
        await onStatusChange(taskId, "COMPLETED", note.trim() || "Hoàn thành 100% nhiệm vụ");
      }

      setFeedback({ type: "success", message: "Đã cập nhật tiến độ thành công." });
      setNote("");
      setIsEditing(false);
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
        "rounded-xl border border-border/70 bg-card/60 p-4 space-y-3 transition-all shadow-2xs",
        className
      )}
    >
      {/* 1. Header Row (Linear style: "Tiến độ mới nhất" · Nút "Cập nhật tiến độ") */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-xs font-semibold text-foreground">
          Tiến độ mới nhất
        </h3>

        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
          >
            <Edit2 className="size-3" strokeWidth={1.5} />
            <span>Cập nhật tiến độ</span>
          </button>
        )}
      </div>

      {/* 2. Latest Update Card Summary (Linear Project Overview style) */}
      {!isEditing ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap text-xs">
            {/* Health / Progress Pill */}
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                progress === 100
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : progress > 0
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-muted text-muted-foreground border border-border/70"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  progress === 100 ? "bg-emerald-600" : progress > 0 ? "bg-blue-600" : "bg-muted-foreground"
                )}
              />
              <span>{progress === 100 ? "Hoàn thành" : `Tiến độ ${progress}%`}</span>
            </span>

            {/* Author */}
            <div className="flex items-center gap-1 text-foreground font-medium">
              <span className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold">
                {leadName.charAt(0).toUpperCase()}
              </span>
              <span>{leadName}</span>
            </div>

            <span className="text-muted-foreground/40 select-none">•</span>
            <span className="text-muted-foreground text-[11px]">Hôm nay</span>
          </div>

          {/* Note message */}
          <p className="text-xs text-foreground leading-relaxed pl-0.5">
            {latestNote || (progress === 100 ? "Nhiệm vụ đã hoàn thành to��n bộ nội dung." : "Đang triển khai thực hiện theo kế hoạch phân công.")}
          </p>
        </div>
      ) : (
        /* 3. Inline Update Form when user clicks Update */
        <form onSubmit={handleSubmit} className="space-y-3 pt-1 animate-in fade-in-0 duration-150">
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
          </div>

          {/* Note textarea */}
          <div className="space-y-1">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              disabled={!canEdit || isSubmitting}
              placeholder="Ghi chú tóm tắt kết quả hoặc tình hình thực hiện mới nhất..."
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

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setIsEditing(false)}
              className="px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground rounded-md border border-border bg-background transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-2xs disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <Send className="size-3.5" strokeWidth={1.5} />
                  <span>Lưu cập nhật</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
