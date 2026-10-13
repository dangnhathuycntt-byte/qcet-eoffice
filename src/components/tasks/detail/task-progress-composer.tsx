"use client";

// Task progress composer modal component with direct update-progress domain integration
import * as React from "react";
import {
  Loader2,
  Check,
  Edit2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types/dashboard";
import type { ProgressResult } from "./task-detail-state";
import { updateTaskProgress } from "@/lib/tasks/task-actions";

export interface TaskProgressComposerProps {
  taskId: string;
  initialProgress: number;
  taskStatus: TaskStatus;
  leadName?: string;
  latestNote?: string;
  completedSubtasks?: number;
  totalSubtasks?: number;
  canEdit?: boolean;
  /** Version hiện tại của nhiệm vụ; có thì server từ chối khi nhiệm vụ đã đổi ở nơi khác (412). */
  expectedVersion?: number;
  onProgressUpdated?: (result: ProgressResult, note?: string) => Promise<void> | void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  className?: string;
}

export function TaskProgressComposer({
  taskId,
  initialProgress,
  taskStatus,
  leadName = "Người phụ trách",
  latestNote,
  completedSubtasks = 0,
  totalSubtasks = 0,
  canEdit = true,
  expectedVersion,
  onProgressUpdated,
  onStatusChange,
  className,
}: TaskProgressComposerProps) {
  const [progress, setProgress] = React.useState<number>(initialProgress);
  const [note, setNote] = React.useState<string>("");
  const [isEditing, setIsEditing] = React.useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = React.useState<boolean>(false);
  const [feedback, setFeedback] = React.useState<{ type: "success" | "error"; message: string } | null>(null);
  const isAutoCalculated = totalSubtasks > 0;

  React.useEffect(() => {
    setProgress(initialProgress);
  }, [initialProgress]);

  React.useEffect(() => {
    if (isAutoCalculated) setIsEditing(false);
  }, [isAutoCalculated]);

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
      const res = await updateTaskProgress(taskId, progress, note.trim() || undefined, expectedVersion);
      if (!res.ok) throw new Error(res.error || "Có lỗi xảy ra khi cập nhật tiến độ");

      if (onProgressUpdated) {
        const payload = res.data as { data?: ProgressResult } | undefined;
        const result: ProgressResult = payload?.data ?? { progressPercent: progress };
        await onProgressUpdated(result, note.trim() || undefined);
      }

      setFeedback({ type: "success", message: "Đã cập nhật tiến độ thành công." });
      setNote("");
      setIsEditing(false);
      setTimeout(() => setFeedback(null), 3000);
    } catch (err: unknown) {
      setFeedback({ type: "error", message: err instanceof Error ? err.message : "Có lỗi xảy ra. Vui lòng thử lại." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      data-slot="task-progress-composer"
      className={cn(
        "rounded-xl border border-border/50 bg-card/40 p-4 space-y-2.5 transition-all select-none cursor-default",
        className
      )}
    >
      {/* 1. Header ("Latest update" · "[Update]") */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-foreground tracking-tight">
          Tiến độ mới nhất
        </span>

        {canEdit && !isEditing && !isAutoCalculated && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 px-2 py-0.5 rounded-md transition-colors cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <Edit2 className="size-3" />
            <span>Cập nhật</span>
          </button>
        )}
      </div>

      {/* 2. Latest Update Body */}
      {!isEditing ? (
        <div className="space-y-2">
          {/* Status badge + Lead Author + Timestamp */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span
              aria-live="polite"
              className={cn(
                "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium",
                progress === 100
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : progress > 0
                  ? "bg-blue-50 text-blue-700 border border-blue-200"
                  : "bg-muted text-muted-foreground border border-border/60"
              )}
            >
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  progress === 100 ? "bg-emerald-600" : progress > 0 ? "bg-blue-600" : "bg-muted-foreground"
                )}
              />
              {/* 100% chỉ là gửi duyệt (update-progress chuyển sang Chờ duyệt), không phải đã hoàn thành */}
              <span>{progress > 0 ? `Tiến độ ${progress}%` : "Chưa cập nhật"}</span>
            </span>

            {/* Author */}
            <div className="flex items-center gap-1 text-foreground font-medium">
              <span className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">
                {leadName.charAt(0).toUpperCase()}
              </span>
              <span>{leadName}</span>
            </div>

          </div>

          <p className="text-xs text-muted-foreground">
            {isAutoCalculated
              ? `Tự động từ ${completedSubtasks}/${totalSubtasks} việc thành phần`
              : "Cập nhật thủ công"}
          </p>

          {/* Chỉ hiện ghi chú thật; không tự chế câu mô tả theo phần trăm */}
          {latestNote && (
            <p className="text-xs text-foreground/90 leading-relaxed font-sans pl-0.5">{latestNote}</p>
          )}
        </div>
      ) : (
        /* 3. Inline Composer Form */
        <form onSubmit={handleSubmit} className="space-y-3 pt-1 animate-in fade-in-0 duration-150">
          <div className="space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium text-foreground">Mức độ hoàn thành</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Chọn một mốc hoặc nhập số chính xác.</p>
              </div>
              <label className="flex h-9 items-center rounded-md border border-border bg-background px-2 focus-within:border-foreground/40">
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
                className="w-12 bg-transparent text-right text-sm font-mono font-semibold tabular-nums text-foreground outline-none disabled:opacity-50"
                aria-label="Nhập số phần trăm tiến độ"
              />
                <span className="ml-0.5 text-xs text-muted-foreground">%</span>
              </label>
            </div>

            {/* Quick preset buttons */}
            <div className="grid grid-cols-5 gap-1.5" aria-label="Các mốc tiến độ">
              {[0, 25, 50, 75, 100].map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => handleApplyPreset(value)}
                  disabled={isSubmitting}
                  aria-pressed={progress === value}
                  className={cn(
                    "h-8 rounded-md border text-xs font-medium tabular-nums transition-colors cursor-pointer disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden",
                    progress === value
                      ? "border-foreground/20 bg-foreground text-background"
                      : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  {value}%
                </button>
              ))}
            </div>
            {progress === 100 && (
              <p className="text-xs text-muted-foreground">Lưu 100% sẽ gửi nhiệm vụ sang Chờ duyệt.</p>
            )}
          </div>

          {/* Note Input */}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={!canEdit || isSubmitting}
            placeholder="Ghi chú nội dung tiến độ hoặc công việc đã hoàn thành..."
            rows={2}
            className="w-full text-xs font-sans text-foreground bg-muted/25 p-3 rounded-lg border border-transparent focus:border-border focus:bg-background focus:outline-none resize-none disabled:opacity-50"
            aria-label="Ghi chú cập nhật tiến độ"
          />

          <div className="flex items-center justify-between gap-2 pt-1">
            <div>
              {feedback && (
                <span
                  className={cn(
                    "text-xs font-medium",
                    feedback.type === "success" ? "text-emerald-600" : "text-destructive"
                  )}
                >
                  {feedback.message}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setProgress(initialProgress);
                  setNote("");
                  setIsEditing(false);
                }}
                disabled={isSubmitting}
                className="px-3 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 shadow-2xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-3 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <>
                    <Check className="size-3.5" />
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
