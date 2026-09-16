"use client";

import * as React from "react";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  TrendingUp,
  User,
  Building2,
  Edit2,
  Check,
  X,
  ChevronDown,
  Shield,
  Layers,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";

export interface TaskIdentityBlockProps {
  task: SchoolTask | StaffTask;
  canEdit?: boolean;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onTitleChange?: (taskId: string, newTitle: string) => Promise<void> | void;
  className?: string;
}

export function computeDueStatus(dueDate?: string | Date | null): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: "Chưa đặt hạn", isOverdue: false };
  const target = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (isNaN(target.getTime())) return { text: "Chưa đặt hạn", isOverdue: false };
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, isOverdue: true };
  if (diffDays === 0) return { text: "Hôm nay", isOverdue: false };
  if (diffDays === 1) return { text: "Ngày mai", isOverdue: false };
  return { text: `Còn ${diffDays} ngày`, isOverdue: false };
}

const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
  colorClass: string;
  dotClass: string;
}> = [
  {
    value: "NOT_STARTED",
    label: "Chưa bắt đầu",
    colorClass: "text-muted-foreground bg-muted border-border/70",
    dotClass: "bg-muted-foreground/60",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang thực hiện",
    colorClass: "text-blue-700 bg-blue-50 border-blue-200",
    dotClass: "bg-blue-600",
  },
  {
    value: "WAITING_APPROVAL",
    label: "Chờ duyệt",
    colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    dotClass: "bg-amber-600",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dotClass: "bg-emerald-600",
  },
];

export function TaskIdentityBlock({
  task,
  canEdit = true,
  onStatusChange,
  onPriorityChange,
  onTitleChange,
  className,
}: TaskIdentityBlockProps) {
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

  const scopeLabel = isSchool ? "Cấp Trường" : "Cấp Đơn vị";

  const leadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  const currentProgressPercent =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  const dueInfo = computeDueStatus(task.dueDate);

  // Status popover state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

  // Title inline editing state
  const [isEditingTitle, setIsEditingTitle] = React.useState(false);
  const [titleDraft, setTitleDraft] = React.useState(task.title);
  const titleInputRef = React.useRef<HTMLTextAreaElement>(null);

  React.useEffect(() => {
    setTitleDraft(task.title);
  }, [task.title]);

  React.useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus();
      titleInputRef.current.select();
    }
  }, [isEditingTitle]);

  const handleSaveTitle = async () => {
    if (!titleDraft.trim() || titleDraft.trim() === task.title) {
      setIsEditingTitle(false);
      setTitleDraft(task.title);
      return;
    }
    setIsEditingTitle(false);
    if (onTitleChange) {
      await onTitleChange(task.id, titleDraft.trim());
    }
  };

  const handleCancelTitle = () => {
    setIsEditingTitle(false);
    setTitleDraft(task.title);
  };

  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];

  // Close status dropdown on click outside
  React.useEffect(() => {
    if (!isStatusDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isStatusDropdownOpen]);

  return (
    <section data-slot="task-identity-block" className={cn("space-y-3.5", className)}>
      {/* 1. Identifier & Scope Tag */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
        <span className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md text-xs tracking-tight">
          {taskCode}
        </span>
        <span className="text-muted-foreground/50 select-none">•</span>
        <span className="inline-flex items-center gap-1 text-muted-foreground bg-muted/40 px-2 py-0.5 rounded-md text-xs font-medium">
          <Layers className="size-3" strokeWidth={1.5} />
          {scopeLabel}
        </span>
      </div>

      {/* 2. Main Title (Full readability ~60-80ch, no truncation, wrap naturally, inline edit) */}
      <div className="group/title relative max-w-4xl">
        {isEditingTitle && canEdit ? (
          <div className="space-y-2">
            <textarea
              ref={titleInputRef}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSaveTitle();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  handleCancelTitle();
                }
              }}
              rows={2}
              className="w-full text-xl sm:text-2xl font-bold tracking-tight text-foreground bg-background p-2 rounded-lg border-2 border-primary focus:outline-hidden resize-none leading-snug"
              aria-label="Chỉnh sửa tên nhiệm vụ"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveTitle}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer"
              >
                <Check className="size-3.5" strokeWidth={1.5} />
                <span>Lưu (Enter)</span>
              </button>
              <button
                type="button"
                onClick={handleCancelTitle}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border text-muted-foreground hover:text-foreground text-xs font-medium transition-colors cursor-pointer"
              >
                <X className="size-3.5" strokeWidth={1.5} />
                <span>Hủy (Esc)</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <h1
              onClick={() => {
                if (canEdit) setIsEditingTitle(true);
              }}
              className={cn(
                "text-xl sm:text-2xl md:text-[26px] font-bold tracking-tight text-foreground leading-snug break-words",
                canEdit && "cursor-pointer hover:text-primary transition-colors rounded-sm"
              )}
              title={canEdit ? "Nhấp để đổi tên nhiệm vụ" : undefined}
            >
              {task.title}
            </h1>
            {canEdit && (
              <button
                type="button"
                onClick={() => setIsEditingTitle(true)}
                className="opacity-0 group-hover/title:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-all cursor-pointer mt-1 shrink-0"
                title="Sửa tên nhiệm vụ"
                aria-label="Sửa tên nhiệm vụ"
              >
                <Edit2 className="size-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Pinned Status, Progress, and Due Badge Row (Linear-inspired quick scan) */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        {/* Status Dropdown/Badge */}
        <div className="relative" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsStatusDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shadow-2xs",
              currentStatusObj.colorClass,
              canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default opacity-90"
            )}
            aria-label={`Trạng thái: ${currentStatusObj.label}`}
            aria-expanded={isStatusDropdownOpen}
          >
            <span className={cn("size-2 rounded-full", currentStatusObj.dotClass)} aria-hidden="true" />
            <span>{currentStatusObj.label}</span>
            {canEdit && <ChevronDown className="size-3 opacity-60 ml-0.5" strokeWidth={1.5} />}
          </button>

          {isStatusDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={task.status === opt.value}
                  onClick={() => {
                    setIsStatusDropdownOpen(false);
                    if (opt.value !== task.status && onStatusChange) {
                      onStatusChange(task.id, opt.value);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                    task.status === opt.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("size-2 rounded-full", opt.dotClass)} />
                    <span>{opt.label}</span>
                  </div>
                  {task.status === opt.value && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Progress Badge */}
        <div
          className={cn(
            "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold font-mono tabular-nums shadow-2xs",
            currentProgressPercent === 100
              ? "text-emerald-700 bg-emerald-50 border-emerald-200"
              : "text-foreground bg-muted/60 border-border/60"
          )}
          title={`Tiến độ hiện tại: ${currentProgressPercent}%`}
        >
          <TrendingUp className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
          <span>{currentProgressPercent}%</span>
        </div>

        {/* Due Date & Overdue Indicator */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium shadow-2xs",
            dueInfo.isOverdue
              ? "text-rose-700 bg-rose-50 border-rose-200 font-semibold"
              : "text-muted-foreground bg-muted/40 border-border/60"
          )}
          title={task.dueDate ? `Hạn: ${formatDetailDate(task.dueDate)}` : "Chưa có hạn"}
        >
          {dueInfo.isOverdue ? (
            <AlertCircle className="size-3 text-rose-600 shrink-0" strokeWidth={1.5} />
          ) : (
            <Clock className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />
          )}
          <span>{dueInfo.text}</span>
        </div>
      </div>

      {/* 4. Sub-metadata line: Assignee & Department */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1 flex-wrap">
        <div className="flex items-center gap-1.5 font-medium text-foreground">
          <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px]">
            {leadName.charAt(0).toUpperCase()}
          </div>
          <span>{leadName}</span>
        </div>

        <span className="text-muted-foreground/40 select-none">•</span>

        <div className="flex items-center gap-1 text-muted-foreground">
          <Building2 className="size-3.5" strokeWidth={1.5} />
          <span>{departmentName}</span>
        </div>
      </div>
    </section>
  );
}
