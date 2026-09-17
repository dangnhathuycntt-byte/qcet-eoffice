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
        // Debounce chống kích hoạt lại ngay khi vừa mở (trong 250ms đầu)
        if (Date.now() - openedAtRef.current < 250) {
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

  // Linear Hold-to-Peek & Quick Look:
  // Nếu người dùng đè giữ phím Space (> 400ms) rồi thả ra -> tự động đóng (hold-to-peek).
  // Nếu chỉ bấm nhả nhanh (< 400ms) -> xem như toggle, giữ modal mở để điều hướng.
  React.useEffect(() => {
    if (!isOpen) return;

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === " " || e.code === "Space") {
        const heldDuration = Date.now() - openedAtRef.current;
        if (heldDuration > 400) {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          onClose();
        }
      }
    };

    window.addEventListener("keyup", handleKeyUp, { capture: true });
    return () => {
      window.removeEventListener("keyup", handleKeyUp, { capture: true });
    };
  }, [isOpen, onClose]);

  if (!isOpen || !task) return null;

  // --- Data extraction ---
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
      ? "bg-amber-500"
      : "bg-muted-foreground/40";

  const priorityVal = (task as any).priority || "NORMAL";
  const priorityLabel =
    priorityVal === "URGENT"
      ? "Khẩn cấp"
      : priorityVal === "HIGH"
      ? "Cao"
      : priorityVal === "LOW"
      ? "Thấp"
      : "Bình thường";

  const priorityColorClass =
    priorityVal === "URGENT"
      ? "text-rose-600 font-medium"
      : priorityVal === "HIGH"
      ? "text-amber-600 font-medium"
      : "text-muted-foreground/75";

  const completedSubtasks = subTasks.filter((s) => s.status === "COMPLETED").length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Xem nhanh nhiệm vụ"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
    >
      {/* Backdrop: cực nhẹ, không blur đục mù mịt, giữ bối cảnh trang */}
      <div
        className="fixed inset-0 bg-black/15 backdrop-blur-[1px] transition-opacity animate-in fade-in duration-100"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Surface: Linear Peek Card gọn, nhẹ, không viền nặng */}
      <div
        ref={modalRef}
        className="relative w-full max-w-[560px] bg-card rounded-xl border border-border/70 shadow-xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-120 text-foreground p-5 space-y-3.5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header cực gọn: ID · Đơn vị bên trái, controls tối thiểu bên phải */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 min-w-0 text-[11px] text-muted-foreground/70">
            <span className="font-mono font-medium text-muted-foreground/90 select-all tracking-wider">
              {taskCode}
            </span>
            <span className="text-muted-foreground/30 select-none">/</span>
            <span className="truncate max-w-[280px] font-normal" title={departmentName}>
              {departmentName}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 text-muted-foreground/50">
            {onNavigatePrev && (
              <button
                type="button"
                onClick={onNavigatePrev}
                disabled={!hasPrev}
                title="Nhiệm vụ trước (↑)"
                className="size-6 rounded flex items-center justify-center hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Nhiệm vụ trước"
              >
                <ChevronUp className="size-3.5" strokeWidth={1.5} />
              </button>
            )}
            {onNavigateNext && (
              <button
                type="button"
                onClick={onNavigateNext}
                disabled={!hasNext}
                title="Nhiệm vụ kế tiếp (↓)"
                className="size-6 rounded flex items-center justify-center hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer disabled:opacity-20 disabled:cursor-not-allowed"
                aria-label="Nhiệm vụ kế tiếp"
              >
                <ChevronDown className="size-3.5" strokeWidth={1.5} />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              title="Đóng (Esc)"
              className="size-6 rounded flex items-center justify-center hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer ml-1"
              aria-label="Đóng"
            >
              <X className="size-3.5" strokeWidth={1.5} />
            </button>
          </div>
        </div>

        {/* Title — trọng tâm chính, leading thoáng, 2-3 dòng */}
        <h2 className="text-[17px] sm:text-[18px] font-semibold text-foreground leading-snug tracking-tight line-clamp-3">
          {task.title}
        </h2>

        {/* Metadata inline nhẹ: trạng thái · ưu tiên · phụ trách · hạn (không pill/card) */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/80">
          {/* Status */}
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
            <span className={cn("size-1.5 rounded-full shrink-0", statusDotColor)} />
            <span>{statusLabel}</span>
          </span>

          <span className="text-muted-foreground/30 select-none" aria-hidden="true">·</span>

          {/* Priority */}
          <span className={priorityColorClass}>
            {priorityLabel}
          </span>

          <span className="text-muted-foreground/30 select-none" aria-hidden="true">·</span>

          {/* Lead assignee */}
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground/90">
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
            <span className="truncate max-w-[130px]">{leadName}</span>
          </span>

          {task.dueDate && (
            <>
              <span className="text-muted-foreground/30 select-none" aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1.5 text-foreground/75">
                <span>{formatDetailDate(task.dueDate)}</span>
                {relativeDue && (
                  <span className={cn(
                    "text-[11px]",
                    relativeDue.text.includes("Quá hạn")
                      ? "text-rose-600 font-medium"
                      : "text-muted-foreground/60"
                  )}>
                    {relativeDue.text}
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        {/* Description: phẳng, trực tiếp, không bọc box */}
        {taskDescription ? (
          <p className="text-[13px] text-foreground/75 leading-relaxed line-clamp-4 whitespace-pre-line">
            {taskDescription}
          </p>
        ) : (
          <p className="text-[12px] italic text-muted-foreground/40">Chưa có mô tả chi tiết.</p>
        )}

        {/* Subtasks (nếu có): danh sách phẳng tối giản */}
        {subTasks.length > 0 && (
          <div className="space-y-1 pt-1">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground/60 font-medium">
              <span>Việc thành phần</span>
              <span className="font-mono tabular-nums">{completedSubtasks}/{subTasks.length}</span>
            </div>
            <div className="space-y-0.5">
              {subTasks.slice(0, 3).map((st) => (
                <div key={st.id} className="flex items-center gap-2 py-0.5 text-xs text-foreground/80">
                  <CheckCircle2
                    className={cn(
                      "size-3 shrink-0",
                      st.status === "COMPLETED" ? "text-emerald-600" : "text-muted-foreground/30"
                    )}
                    strokeWidth={2}
                  />
                  <span className={cn("truncate", st.status === "COMPLETED" && "line-through text-muted-foreground/50")}>
                    {st.title}
                  </span>
                </div>
              ))}
              {subTasks.length > 3 && (
                <span className="text-[11px] text-muted-foreground/50 pl-5">
                  +{subTasks.length - 3} việc khác
                </span>
              )}
            </div>
          </div>
        )}

        {/* Footer: phím tắt cực mờ/gọn, không CTA đen nặng nề */}
        <div className="flex items-center justify-between pt-2 border-t border-border/40 text-[11px] text-muted-foreground/45 select-none shrink-0">
          <div className="flex items-center gap-1.5">
            <span>Space Đóng</span>
            <span className="text-muted-foreground/30">·</span>
            <span>↑↓ Chuyển</span>
            <span className="text-muted-foreground/30">·</span>
            <span>Enter Mở chi tiết</span>
          </div>

          <button
            type="button"
            onClick={() => onOpenDetail(task)}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/60 hover:text-foreground transition-colors cursor-pointer font-normal"
          >
            <span>Mở chi tiết</span>
            <ArrowRight className="size-3" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </div>
  );
}
