"use client";

import * as React from "react";
import {
  Clock,
  AlertCircle,
  TrendingUp,
  User,
  Building2,
  Edit2,
  Check,
  X,
  ChevronDown,
  Layers,
  Calendar,
  Sparkles,
  Paperclip,
  Plus,
  ExternalLink,
  FolderOpen,
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
  onAddDeliverable?: () => void;
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

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  colorClass: string;
}> = [
  { value: "URGENT", label: "Khẩn cấp", colorClass: "text-rose-700 bg-rose-50 border-rose-200" },
  { value: "HIGH", label: "Cao", colorClass: "text-amber-700 bg-amber-50 border-amber-200" },
  { value: "NORMAL", label: "Bình thường", colorClass: "text-blue-700 bg-blue-50 border-blue-200" },
  { value: "LOW", label: "Thấp", colorClass: "text-muted-foreground bg-muted border-border/70" },
];

export function TaskIdentityBlock({
  task,
  canEdit = true,
  onStatusChange,
  onPriorityChange,
  onTitleChange,
  onAddDeliverable,
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

  const dueInfo = computeDueStatus(task.dueDate);

  // Status popover state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

  // Priority popover state
  const [isPriorityDropdownOpen, setIsPriorityDropdownOpen] = React.useState(false);
  const priorityMenuRef = React.useRef<HTMLDivElement>(null);

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

  const currentPriorityVal = (task as any).priority === "MEDIUM" ? "NORMAL" : (task as any).priority || "NORMAL";
  const currentPriorityObj =
    PRIORITY_OPTIONS.find((p) => p.value === currentPriorityVal) || PRIORITY_OPTIONS[2];

  // Close dropdowns on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setIsPriorityDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section data-slot="task-identity-block" className={cn("space-y-4", className)}>
      {/* 1. Linear-style Identifier & Scope */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap">
        {isSchool ? (
          <Layers className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        ) : (
          <FolderOpen className="size-4 text-muted-foreground shrink-0" strokeWidth={1.5} />
        )}
        <span className="font-mono font-semibold text-foreground bg-muted px-2 py-0.5 rounded-md text-xs tracking-tight">
          {taskCode}
        </span>
        <span className="text-muted-foreground/40 select-none">•</span>
        <span className="text-muted-foreground">{scopeLabel}</span>
      </div>

      {/* 2. Main Title (Linear-style large readable heading, wrap 60-80ch, inline edit) */}
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
              className="w-full text-2xl sm:text-3xl font-bold tracking-tight text-foreground bg-background p-2 rounded-lg border-2 border-primary focus:outline-hidden resize-none leading-snug"
              aria-label="Chỉnh sửa tên nhiệm vụ"
            />
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSaveTitle}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity cursor-pointer shadow-2xs"
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
                "text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug break-words",
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
                className="opacity-0 group-hover/title:opacity-100 p-1 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-all cursor-pointer mt-1.5 shrink-0"
                title="Sửa tên nhiệm vụ"
                aria-label="Sửa tên nhiệm vụ"
              >
                <Edit2 className="size-4" strokeWidth={1.5} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. Linear-style Inline Properties Row (Properties: Status · Priority · Lead · Dates · Department) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
        <span className="text-muted-foreground font-medium mr-1 select-none">Thuộc tính:</span>

        {/* Status Pill */}
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
              canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
            )}
            aria-label={`Trạng thái: ${currentStatusObj.label}`}
          >
            <span className={cn("size-2 rounded-full", currentStatusObj.dotClass)} />
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

        {/* Priority Pill */}
        <div className="relative" ref={priorityMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsPriorityDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold transition-all shadow-2xs",
              currentPriorityObj.colorClass,
              canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
            )}
          >
            <AlertCircle className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            <span>{currentPriorityObj.label}</span>
            {canEdit && <ChevronDown className="size-3 opacity-60 ml-0.5" strokeWidth={1.5} />}
          </button>

          {isPriorityDropdownOpen && canEdit && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1.5 w-40 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setIsPriorityDropdownOpen(false);
                    if (opt.value !== currentPriorityVal && onPriorityChange) {
                      onPriorityChange(task.id, opt.value as TaskPriority);
                    }
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                    currentPriorityVal === opt.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted font-medium"
                  )}
                >
                  <span>{opt.label}</span>
                  {currentPriorityVal === opt.value && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lead Assignee */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/40 text-xs font-medium text-foreground">
          <User className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span>{leadName}</span>
        </div>

        {/* Due Date */}
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium",
            dueInfo.isOverdue
              ? "text-rose-700 bg-rose-50 border-rose-200 font-semibold"
              : "text-muted-foreground bg-muted/40 border-border/60"
          )}
          title={task.dueDate ? `Hạn: ${formatDetailDate(task.dueDate)}` : "Chưa có hạn"}
        >
          <Calendar className="size-3.5" strokeWidth={1.5} />
          <span>{dueInfo.text}</span>
        </div>

        {/* Department */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/60 bg-muted/40 text-xs font-medium text-muted-foreground">
          <Building2 className="size-3.5" strokeWidth={1.5} />
          <span>{departmentName}</span>
        </div>
      </div>

      {/* 4. Linear-style Resources Row (Resources: + Add document or link...) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
        <span className="text-muted-foreground font-medium mr-1 select-none">Tài liệu:</span>
        <button
          type="button"
          onClick={onAddDeliverable}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-medium transition-colors cursor-pointer py-0.5 px-1.5 rounded-md hover:bg-muted"
        >
          <Plus className="size-3.5 text-primary" strokeWidth={1.5} />
          <span>Thêm tài liệu hoặc liên kết minh chứng...</span>
        </button>
      </div>
    </section>
  );
}
