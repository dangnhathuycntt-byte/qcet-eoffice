"use client";

import * as React from "react";
import {
  X,
  Box,
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
      ? "Đang làm"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "Chờ duyệt"
      : "Chưa bắt đầu";

  const statusBadgeStyle =
    task.status === "COMPLETED"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : task.status === "IN_PROGRESS"
      ? "text-blue-700 bg-blue-50 border-blue-200"
      : task.status === "WAITING_APPROVAL" || task.status === "NEEDS_REVIEW"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-600 bg-slate-100 border-slate-200";

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
      ? "text-red-700 bg-red-50 border-red-200"
      : priorityVal === "HIGH"
      ? "text-amber-700 bg-amber-50 border-amber-200"
      : "text-slate-700 bg-slate-50 border-slate-200";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem nhanh nhiệm vụ"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Surface */}
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-xl border border-border/60 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150 text-slate-900"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top bar: Code, Breadcrumb, Close button */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/40 bg-slate-50/50">
          <div className="flex items-center gap-2 min-w-0">
            <div className="size-6 rounded-md bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
              <Box className="size-3.5" strokeWidth={1.75} />
            </div>
            <span className="font-mono text-xs font-semibold text-slate-500 uppercase">
              {taskCode}
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-500 truncate">
              {departmentName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenDetail(task)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold text-primary hover:bg-primary/5 transition-colors cursor-pointer"
            >
              <span>Mở chi tiết</span>
              <ExternalLink className="size-3" />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="size-7 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              aria-label="Đóng xem nhanh"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs thin-scrollbar flex-1">
          {/* Title */}
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-snug">
              {task.title}
            </h2>
          </div>

          {/* Inline Properties Strip */}
          <div className="flex flex-wrap items-center gap-2 pt-1 pb-2 border-b border-border/40">
            {/* Status */}
            <span className={cn("px-2.5 py-1 rounded-md font-semibold border text-xs inline-flex items-center gap-1.5", statusBadgeStyle)}>
              <span className="size-2 rounded-full bg-current" />
              {statusLabel}
            </span>

            {/* Priority */}
            <span className={cn("px-2.5 py-1 rounded-md font-medium border text-xs inline-flex items-center gap-1", priorityStyle)}>
              <AlertCircle className="size-3 text-current" strokeWidth={1.5} />
              {priorityLabel}
            </span>

            {/* Lead */}
            <span
              className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs inline-flex items-center gap-1.5"
              title="Người chủ trì DRI"
            >
              <User className="size-3 text-slate-400" strokeWidth={1.5} />
              <span className="font-medium text-slate-900">{leadName}</span>
            </span>

            {/* Due Date */}
            <span
              className="px-2.5 py-1 rounded-md bg-slate-50 border border-slate-200 text-slate-700 text-xs inline-flex items-center gap-1.5 font-mono"
              title="Hạn hoàn thành"
            >
              <Calendar className="size-3 text-slate-400" strokeWidth={1.5} />
              <span>{formatDetailDate(task.dueDate)}</span>
              {relativeDue && (
                <span className={cn("ml-1 font-sans text-[10px] px-1 rounded", relativeDue.color)}>
                  {relativeDue.text}
                </span>
              )}
            </span>
          </div>

          {/* Description Excerpt */}
          <div className="space-y-1.5">
            <span className="font-semibold text-slate-500 uppercase text-[11px] font-mono tracking-wider">
              Mô tả nhiệm vụ
            </span>
            <div className="p-3 rounded-lg bg-slate-50 border border-border/40 text-slate-700 leading-relaxed text-xs">
              {taskDescription ? (
                <p className="line-clamp-4 whitespace-pre-line">{taskDescription}</p>
              ) : (
                <p className="italic text-slate-400">Chưa có mô tả chi tiết cho nhiệm vụ này.</p>
              )}
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-slate-400" strokeWidth={1.5} />
                Tiến độ thực hiện
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {progressPercent}%
              </span>
            </div>
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-100 border border-slate-200/60">
              <div
                className={cn(
                  "h-full transition-all duration-300 ease-out",
                  progressPercent === 100
                    ? "bg-emerald-500"
                    : progressPercent > 50
                    ? "bg-blue-600"
                    : "bg-amber-500"
                )}
                style={{ width: `${Math.min(Math.max(progressPercent, 0), 100)}%` }}
              />
            </div>
          </div>

          {/* Subtasks Preview (up to 3 items) */}
          {subTasks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5 text-xs">
                  <ListTodo className="size-3.5 text-slate-400" strokeWidth={1.5} />
                  Đầu việc con ({subTasks.length})
                </span>
                <span className="text-[11px] font-mono text-slate-400">
                  {subTasks.filter((s) => s.status === "COMPLETED").length}/{subTasks.length} hoàn thành
                </span>
              </div>

              <div className="divide-y divide-border/40 rounded-lg border border-border/50 overflow-hidden bg-slate-50/40">
                {subTasks.slice(0, 3).map((st) => (
                  <div key={st.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <CheckCircle2
                        className={cn(
                          "size-3.5 shrink-0",
                          st.status === "COMPLETED" ? "text-emerald-600" : "text-slate-300"
                        )}
                        strokeWidth={2}
                      />
                      <span className={cn("truncate", st.status === "COMPLETED" && "line-through text-slate-400")}>
                        {st.title}
                      </span>
                    </div>

                    <span className="text-slate-500 text-[11px] font-mono shrink-0">
                      {st.assigneeName || "Chưa giao"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer: Keyboard hints & Primary CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-border/40 bg-slate-50/70 text-xs">
          {/* Keyboard shortcut pills */}
          <div className="flex items-center gap-3 text-slate-500 text-[11px]">
            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-border/80 font-mono text-[10px] shadow-2xs">
                Phím cách
              </kbd>
              <span>/</span>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-border/80 font-mono text-[10px] shadow-2xs">
                Esc
              </kbd>
              <span>Đóng</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-border/80 font-mono text-[10px] shadow-2xs">
                ↑
              </kbd>
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-border/80 font-mono text-[10px] shadow-2xs">
                ↓
              </kbd>
              <span>Chuyển việc</span>
            </span>

            <span className="inline-flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-white border border-border/80 font-mono text-[10px] shadow-2xs">
                Enter
              </kbd>
              <span>Xem chi tiết</span>
            </span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(task)}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-xs transition-colors cursor-pointer"
          >
            <span>Mở trang chi tiết</span>
            <ArrowRight className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
}
