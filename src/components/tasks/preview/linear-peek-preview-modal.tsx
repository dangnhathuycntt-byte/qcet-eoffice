"use client";

import * as React from "react";
import {
  X,
  User,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  ArrowRight,
  ListTodo,
  ExternalLink,
  ChevronUp,
  ChevronDown,
  Flag,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
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
      // Check if typing inside input/textarea or composing IME
      if (shouldIgnoreShortcut(e)) {
        return;
      }

      // Ignore key repeat for toggle actions to prevent rapid flickering
      if (e.repeat && (e.key === " " || e.key === "Escape")) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Focus trap for Tab key
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
          if (document.activeElement === first) {
            e.preventDefault();
            last.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === " ") {
        // Cooldown 200ms after opening to prevent instant bounce
        if (Date.now() - openedAtRef.current < 200) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        onClose();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j" || e.key === "J") {
        e.preventDefault();
        e.stopPropagation();
        onNavigateNext?.();
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k" || e.key === "K") {
        e.preventDefault();
        e.stopPropagation();
        onNavigatePrev?.();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
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

  // Status text & style
  const statusLabel =
    task.status === "COMPLETED"
      ? "Hoàn thành"
      : task.status === "IN_PROGRESS"
      ? "Đang thực hiện"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "Chờ duyệt"
      : "Chưa bắt đầu";

  const statusBadgeStyle =
    task.status === "COMPLETED"
      ? "text-emerald-700 bg-emerald-500/10 border-emerald-500/25 dark:text-emerald-400"
      : task.status === "IN_PROGRESS"
      ? "text-blue-700 bg-blue-500/10 border-blue-500/25 dark:text-blue-400"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-400"
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
      ? "text-rose-700 bg-rose-500/10 border-rose-500/25 dark:text-rose-400"
      : priorityVal === "HIGH"
      ? "text-amber-700 bg-amber-500/10 border-amber-500/25 dark:text-amber-400"
      : "text-muted-foreground bg-muted/60 border-border/80";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem nhanh nhiệm vụ"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop with soft blur */}
      <div
        className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        className="relative w-full max-w-xl sm:max-w-2xl bg-card rounded-xl sm:rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] animate-in fade-in zoom-in-95 duration-150 text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header: Code, Department, Navigation arrows, Close button */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border/70 bg-muted/30 shrink-0">
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
            {/* Previous / Next task navigation in table */}
            {onNavigatePrev && (
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={!hasPrev}
                title="Nhiệm vụ trước (↑ hoặc K)"
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
                title="Nhiệm vụ kế tiếp (↓ hoặc J)"
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
              aria-label="Đóng xem nhanh"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-xs thin-scrollbar flex-1">
          {/* Title (Full wrap, no truncation) */}
          <div>
            <h2 className="text-base sm:text-lg font-semibold text-foreground tracking-tight leading-snug text-balance">
              {task.title}
            </h2>
          </div>

          {/* Quick Properties Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 pb-3 border-b border-border/60">
            {/* 1. Status */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Trạng thái
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium border inline-flex items-center gap-1.5", statusBadgeStyle)}>
                  <span className="size-1.5 rounded-full bg-current" />
                  <span>{statusLabel}</span>
                </span>
              </div>
            </div>

            {/* 2. Priority */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/60">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Ưu tiên
              </span>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium border inline-flex items-center gap-1", priorityStyle)}>
                  <Flag className="size-3" strokeWidth={1.5} />
                  <span>{priorityLabel}</span>
                </span>
              </div>
            </div>

            {/* 3. Lead Assignee */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/60 min-w-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Chủ trì
              </span>
              <div className="flex items-center gap-1.5 mt-0.5 min-w-0" title={leadName}>
                {leadAvatar ? (
                  <img
                    src={leadAvatar}
                    alt=""
                    className="size-4.5 rounded-full object-cover shrink-0 ring-1 ring-border/60"
                  />
                ) : (
                  <span className="size-4.5 rounded-full bg-slate-200 dark:bg-zinc-800 text-[9px] font-semibold text-slate-700 dark:text-zinc-300 flex items-center justify-center shrink-0">
                    {getInitials(leadName)}
                  </span>
                )}
                <span className="text-xs font-medium text-foreground truncate">{leadName}</span>
              </div>
            </div>

            {/* 4. Due Date & SLA */}
            <div className="flex flex-col gap-1 p-2 rounded-lg bg-muted/40 border border-border/60 min-w-0">
              <span className="text-[10px] uppercase font-semibold text-muted-foreground tracking-wider">
                Hạn chót
              </span>
              <div className="flex items-center gap-1 mt-0.5 min-w-0 font-mono text-xs">
                <Calendar className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
                <span className="text-foreground truncate">{formatDetailDate(task.dueDate)}</span>
                {relativeDue && (
                  <span className={cn("font-sans text-[10px] px-1 py-0.2 rounded font-medium shrink-0", relativeDue.color)}>
                    {relativeDue.text}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Mô tả nhiệm vụ
            </span>
            <div className="p-3.5 rounded-lg bg-muted/30 border border-border/60 text-foreground leading-relaxed text-xs">
              {taskDescription ? (
                <p className="whitespace-pre-line text-xs">{taskDescription}</p>
              ) : (
                <p className="italic text-muted-foreground text-xs">Chưa có mô tả chi tiết cho nhiệm vụ này.</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>Tiến độ thực hiện</span>
              </span>
              <span className="font-mono font-bold text-foreground tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted border border-border/60">
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

          {/* Subtasks List Preview (up to 3 items) */}
          {subTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-foreground flex items-center gap-1.5">
                  <ListTodo className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  <span>Đầu việc con ({subTasks.length})</span>
                </span>
                <span className="text-[11px] font-mono text-muted-foreground">
                  {subTasks.filter((s) => s.status === "COMPLETED").length}/{subTasks.length} hoàn thành
                </span>
              </div>

              <div className="divide-y divide-border/60 rounded-lg border border-border/80 overflow-hidden bg-muted/20">
                {subTasks.slice(0, 3).map((st) => (
                  <div key={st.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        className={cn(
                          "size-3.5 shrink-0",
                          st.status === "COMPLETED" ? "text-emerald-600" : "text-muted-foreground/50"
                        )}
                        strokeWidth={2}
                      />
                      <span className={cn("truncate", st.status === "COMPLETED" && "line-through text-muted-foreground")}>
                        {st.title}
                      </span>
                    </div>

                    <span className="text-muted-foreground text-[11px] font-mono shrink-0">
                      {st.assigneeName || "Chưa giao"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Concise Keyboard Hints & Single Clean CTA */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border/70 bg-muted/30 text-xs">
          {/* Keyboard shortcut hints */}
          <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs">
                Space
              </kbd>
              <span>/</span>
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs">
                Esc
              </kbd>
              <span className="hidden sm:inline">Đóng</span>
            </span>

            <span className="text-border select-none" aria-hidden="true">·</span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs">
                ↓
              </kbd>
              <span className="hidden sm:inline">Chuyển</span>
            </span>

            <span className="text-border select-none" aria-hidden="true">·</span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-background border border-border font-mono text-[10px] shadow-2xs">
                Enter
              </kbd>
              <span className="hidden sm:inline">Mở</span>
            </span>
          </div>

          {/* Single Primary Action Button */}
          <button
            type="button"
            onClick={() => onOpenDetail(task)}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md bg-foreground text-background hover:opacity-90 font-medium text-xs transition-opacity cursor-pointer shadow-2xs shrink-0"
          >
            <span>Mở chi tiết</span>
            <ArrowRight className="size-3.5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
