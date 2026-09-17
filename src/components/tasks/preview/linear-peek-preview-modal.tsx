"use client";

import * as React from "react";
import {
  X,
  CheckCircle2,
  ArrowRight,
  ChevronUp,
  ChevronDown,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate, getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
import { shouldIgnoreShortcut } from "@/lib/shortcuts/guards";

export interface LinearPeekPreviewModalProps {
  task: SchoolTask | StaffTask | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenDetail: (task: SchoolTask | StaffTask) => void;
  triggerElement?: HTMLElement | null;
  onNavigateNext?: () => void;
  onNavigatePrev?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

function getInitials(name: string): string {
  if (!name) return "—";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function LinearPeekPreviewModal({
  task,
  isOpen,
  onClose,
  onOpenDetail,
  triggerElement,
  onNavigateNext,
  onNavigatePrev,
  hasPrev = true,
  hasNext = true,
}: LinearPeekPreviewModalProps) {
  const modalRef = React.useRef<HTMLDivElement>(null);
  const previousActiveElement = React.useRef<HTMLElement | null>(null);
  const openedAtRef = React.useRef<number>(0);

  // Focus trap & Return focus (REQ-09 / REQ-23)
  React.useEffect(() => {
    if (isOpen) {
      openedAtRef.current = Date.now();
      previousActiveElement.current = (triggerElement || document.activeElement) as HTMLElement | null;
      const timer = setTimeout(() => {
        if (modalRef.current) {
          const firstFocusable = modalRef.current.querySelector<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]:not([disabled]), a:not([disabled])'
          );
          firstFocusable?.focus();
        }
      }, 40);
      return () => clearTimeout(timer);
    } else {
      if (previousActiveElement.current) {
        previousActiveElement.current.focus();
        previousActiveElement.current = null;
      }
    }
  }, [isOpen, triggerElement]);

  // Global keyboard shortcuts while modal is open
  React.useEffect(() => {
    if (!isOpen || !task) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (shouldIgnoreShortcut(e)) return;

      if (e.repeat && (e.key === " " || e.key === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      if (e.key === "Tab") {
        if (!modalRef.current) return;
        const focusables = Array.from(
          modalRef.current.querySelectorAll<HTMLElement>(
            'button:not([disabled]), [tabindex="0"]:not([disabled]), a:not([disabled]), input:not([disabled])'
          )
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey) {
          if (document.activeElement === first) { e.preventDefault(); last.focus(); }
        } else {
          if (document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === " ") {
        if (Date.now() - openedAtRef.current < 200) {
          e.preventDefault(); e.stopPropagation();
          return;
        }
        e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault(); e.stopPropagation();
        onNavigateNext?.();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault(); e.stopPropagation();
        onNavigatePrev?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault(); e.stopPropagation();
        onOpenDetail(task);
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [isOpen, task, onClose, onOpenDetail, onNavigateNext, onNavigatePrev]);

  // Linear Hold-to-Peek: Releasing Space immediately closes preview
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
      }
    };

    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // --- Data extraction (unchanged) ---
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const leadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadAvatar = isSchool ? schoolTask?.leadAssigneeAvatar : undefined;

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  const progressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  const subTasks = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];

  const taskDescription = isSchool
    ? schoolTask?.description
    : staffTask?.deliverableDescription || (task as any).description;

  const relativeDue = getRelativeDueTime(task.dueDate);

  const statusLabel =
    task.status === "COMPLETED"
      ? "Hoàn thành"
      : task.status === "IN_PROGRESS"
      ? "Đang thực hiện"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "Chờ duyệt"
      : "Chưa bắt đầu";

  const statusDotColor =
    task.status === "COMPLETED"
      ? "bg-emerald-500"
      : task.status === "IN_PROGRESS"
      ? "bg-blue-500"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "bg-muted-foreground/60"
      : "bg-muted-foreground/40";

  const statusBadgeStyle =
    task.status === "COMPLETED"
      ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/25"
      : task.status === "IN_PROGRESS"
      ? "text-blue-700 bg-blue-500/10 border-blue-500/25"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "text-amber-700 bg-amber-500/10 border-amber-500/25"
      : "text-muted-foreground bg-muted border-border";

  const priorityVal = (task as any).priority || "NORMAL";
  const priorityLabel =
    priorityVal === "URGENT"
      ? "Khẩn cấp"
      : priorityVal === "HIGH"
      ? "Cao"
      : priorityVal === "LOW"
      ? "Thấp"
      : "Bình thường";

  const priorityStyle =
    priorityVal === "URGENT"
      ? "text-rose-700 bg-rose-500/10 border-rose-500/25"
      : priorityVal === "HIGH"
      ? "text-amber-700 bg-amber-500/10 border-amber-500/25"
      : "text-muted-foreground bg-muted/60 border-border/80";

  const completedSubtasks = subTasks.filter((s) => s.status === "COMPLETED").length;

  // --- Render ---
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem nhanh nhiệm vụ"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        className="relative w-full max-w-[640px] bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header: ID · Đơn vị | Nav ↑↓ | ✕ */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-border/60 shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-mono text-xs font-semibold text-muted-foreground uppercase bg-muted px-2 py-0.5 rounded border border-border/60">
              {taskCode}
            </span>
            <span className="text-border select-none">/</span>
            <span className="text-xs font-medium text-muted-foreground truncate" title={departmentName}>
              {departmentName}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {onNavigatePrev && (
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={!hasPrev}
                title="Nhiệm vụ trước (↑)"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Nhiệm vụ trước"
              >
                <ChevronUp className="size-4" strokeWidth={1.5} />
              </button>
            )}
            {onNavigateNext && (
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={!hasNext}
                title="Nhiệm vụ kế tiếp (↓)"
                className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                aria-label="Nhiệm vụ kế tiếp"
              >
                <ChevronDown className="size-4" strokeWidth={1.5} />
              </button>
            )}

            <div className="w-px h-4 bg-border/80 mx-1 select-none" aria-hidden="true" />

            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
              aria-label="Đóng"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Body: compact read-first content */}
        <div className="px-5 py-4 overflow-y-auto space-y-3 flex-1">
          {/* Title — large, max 3 lines */}
          <h2 className="text-lg font-semibold text-foreground leading-snug tracking-tight line-clamp-3">
            {task.title}
          </h2>

          {/* Inline metadata row: Status · Priority · Phụ trách · Hạn */}
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
            {/* Status badge */}
            <span className={cn(
              "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium border",
              statusBadgeStyle
            )}>
              <span className={cn("size-1.5 rounded-full", statusDotColor)} />
              {statusLabel}
            </span>

            <span className="text-border select-none" aria-hidden="true">·</span>

            {/* Priority badge */}
            <span className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border",
              priorityStyle
            )}>
              {priorityLabel}
            </span>

            <span className="text-border select-none" aria-hidden="true">·</span>

            {/* Lead assignee */}
            <span className="inline-flex items-center gap-1.5">
              {leadAvatar ? (
                <img
                  src={leadAvatar}
                  alt=""
                  className="size-4 rounded-full object-cover ring-1 ring-border/60"
                />
              ) : (
                <span className="size-4 rounded-full bg-muted text-[8px] font-semibold text-muted-foreground flex items-center justify-center">
                  {getInitials(leadName)}
                </span>
              )}
              <span className="text-foreground font-medium truncate max-w-[140px]">{leadName}</span>
            </span>

            {task.dueDate && (
              <>
                <span className="text-border select-none" aria-hidden="true">·</span>
                <span className="inline-flex items-center gap-1 text-foreground/80">
                  <span>{formatDetailDate(task.dueDate)}</span>
                  {relativeDue && (
                    <span className={cn(
                      "text-[11px]",
                      relativeDue.text.includes("Quá hạn") ? "text-rose-600 font-medium" : "text-muted-foreground"
                    )}>
                      {relativeDue.text}
                    </span>
                  )}
                </span>
              </>
            )}
          </div>

          {/* Description — flat text, no card */}
          {taskDescription ? (
            <p className="text-sm text-foreground/80 leading-relaxed line-clamp-4 whitespace-pre-line">
              {taskDescription}
            </p>
          ) : (
            <p className="text-sm italic text-muted-foreground/60">Chưa có mô tả.</p>
          )}

          {/* Progress — thin bar, only when > 0% */}
          {progressPercent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Tiến độ</span>
                <span className="font-mono font-semibold text-foreground tabular-nums">
                  {progressPercent}%
                </span>
              </div>
              <div className="relative h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full transition-all duration-300 ease-out rounded-full",
                    progressPercent === 100
                      ? "bg-emerald-500"
                      : progressPercent > 50
                      ? "bg-primary"
                      : "bg-amber-500"
                  )}
                  style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Subtasks — flat list, no card border */}
          {subTasks.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Việc thành phần</span>
                <span className="font-mono text-[11px] tabular-nums">
                  {completedSubtasks}/{subTasks.length}
                </span>
              </div>
              <div className="space-y-0.5">
                {subTasks.slice(0, 3).map((st) => (
                  <div key={st.id} className="flex items-center gap-2 py-0.5 text-xs">
                    <CheckCircle2
                      className={cn(
                        "size-3.5 shrink-0",
                        st.status === "COMPLETED" ? "text-emerald-600" : "text-muted-foreground/40"
                      )}
                      strokeWidth={2}
                    />
                    <span className={cn(
                      "truncate",
                      st.status === "COMPLETED" && "line-through text-muted-foreground"
                    )}>
                      {st.title}
                    </span>
                  </div>
                ))}
                {subTasks.length > 3 && (
                  <span className="text-[11px] text-muted-foreground pl-5.5">
                    +{subTasks.length - 3} khác
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer: plain text hints + CTA */}
        <div className="flex items-center justify-between gap-3 px-5 py-2.5 border-t border-border/60 text-xs shrink-0">
          <div className="text-[11px] text-muted-foreground/70 select-none">
            <span>↑↓ Chuyển</span>
            <span className="mx-1.5">·</span>
            <span>Space/Esc Đóng</span>
            <span className="mx-1.5">·</span>
            <span>Enter Mở chi tiết</span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(task)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 font-medium text-xs transition-opacity cursor-pointer shrink-0"
          >
            Mở chi tiết
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
