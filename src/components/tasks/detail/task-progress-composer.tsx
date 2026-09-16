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
  Smile,
  Plus,
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
      const res = await fetch(`/api/tasks/${taskId}/actions/update-progress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          progressPercent: progress,
          note: note.trim() || undefined,
        }),
      });

      if (!res.ok) {
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

      if (progress === 100 && taskStatus !== "COMPLETED" && onStatusChange) {
        await onStatusChange(taskId, "COMPLETED", note.trim() || "Hoàn thành 100% nhiệm vụ");
      }

      setFeedback({ type: "success", message: "Đã cập nhật tiến độ." });
      setNote("");
      setIsEditing(false);
      setTimeout(() => setFeedback(null), 3000);
    } catch {
      setFeedback({ type: "error", message: "Có lỗi xảy ra. Vui lòng thử lại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-slot="task-progress-composer"
      className={cn(
        "rounded-xl border border-border/50 bg-card/40 p-4 space-y-2.5 transition-all select-none",
        className
      )}
    >
      {/* 1. Header (Linear Project Overview style: "Latest update" · "[Update]") */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground tracking-tight">
          Tiến độ mới nhất
        </span>

        {canEdit && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
          >
            <Edit2 className="size-3" strokeWidth={1.5} />
            <span>Cập nhật</span>
          </button>
        )}
      </div>

      {/* 2. Latest Update Body (Linear card style) */}
      {!isEditing ? (
        <div className="space-y-2">
          {/* Status badge + Lead Author + Timestamp */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                progress === 100
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : progress > 0
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-muted text-muted-foreground border border-border/60"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  progress > 0 ? "bg-emerald-600" : "bg-muted-foreground"
                )}
              />
              <span>
                {progress === 100
                  ? "Hoàn thành"
                  : progress > 0
                  ? `Đúng tiến độ (${progress}%)`
                  : "Chưa cập nhật"}
              </span>
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

          {/* Update Note Content */}
          <p className="text-xs text-foreground/90 leading-relaxed font-sans pl-0.5">
            {latestNote ||
              (progress === 100
                ? "Nhiệm vụ đã hoàn thành toàn bộ nội dung theo yêu cầu."
                : "Đang triển khai thực hiện theo kế hoạch phân công.")}
          </p>

          {/* Reaction & Activity Footer */}
          <div className="flex items-center gap-2 pt-1 text-muted-foreground/60">
            <button
              type="button"
              className="p-1 rounded hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
              title="Thêm phản hồi"
            >
              <Smile className="size-3.5" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              className="p-1 rounded hover:bg-muted/60 hover:text-foreground transition-colors cursor-pointer"
              title="Bình luận"
            >
              <MessageSquare className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      ) : (
        /* 3. Inline Composer Form */
        <form onSubmit={handleSubmit} className="space-y-3 pt-1 animate-in fade-in-0 duration-150">
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
                className="px-2 py-0.5 rounded-md border border-border/70 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                +10%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(progress + 25)}
                disabled={isSubmitting || progress >= 100}
                className="px-2 py-0.5 rounded-md border border-border/70 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                +25%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(50)}
                disabled={isSubmitting}
                className="px-2 py-0.5 rounded-md border border-border/70 bg-background text-[11px] font-medium text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-40"
              >
                50%
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset(100)}
                disabled={isSubmitting || progress === 100}
                className="px-2 py-0.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-500/20 transition-colors cursor-pointer disabled:opacity-40"
              >
                100% Hoàn thành
              </button>
            </div>
          </div>

          {/* Note Input */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canEdit || isSubmitting}
            placeholder="Ghi chú nội dung tiến độ hoặc công việc đã hoàn thành..."
            rows={2}
            className="w-full text-xs font-sans text-foreground bg-background p-2.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden resize-none disabled:opacity-50"
            aria-label="Ghi chú cập nhật tiến độ"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {feedback && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    feedback.type === "success" ? "text-emerald-600" : "text-rose-600"
                  )}
                >
                  {feedback.message}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isSubmitting}
                className="px-3 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" strokeWidth={1.5} />
                    <span>Lưu tiến độ</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
