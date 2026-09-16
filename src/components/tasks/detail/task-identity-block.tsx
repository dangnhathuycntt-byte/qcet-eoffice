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
  Box,
  Trash2,
  Link as LinkIcon,
  FileText,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";

export interface TaskIdentityBlockProps {
  task: SchoolTask | StaffTask;
  canEdit?: boolean;
  deliverables?: Array<{ id: string; title: string; fileUrl?: string; notes?: string }>;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onTitleChange?: (taskId: string, newTitle: string) => Promise<void> | void;
  onAddDeliverable?: (title: string, fileUrl?: string, notes?: string) => Promise<void> | void;
  onDeleteDeliverable?: (deliverableId: string) => Promise<void> | void;
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

export const STATUS_OPTIONS: Array<{
  value: TaskStatus;
  label: string;
  colorClass: string;
  dotClass: string;
}> = [
  {
    value: "NOT_STARTED",
    label: "Chưa bắt đầu",
    colorClass: "text-muted-foreground bg-muted/60 border-border/60",
    dotClass: "bg-muted-foreground/60",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang thực hiện",
    colorClass: "text-blue-700 bg-blue-50/80 border-blue-200/80",
    dotClass: "bg-blue-600",
  },
  {
    value: "WAITING_APPROVAL",
    label: "Chờ duyệt",
    colorClass: "text-amber-700 bg-amber-50/80 border-amber-200/80",
    dotClass: "bg-amber-600",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    colorClass: "text-emerald-700 bg-emerald-50/80 border-emerald-200/80",
    dotClass: "bg-emerald-600",
  },
];

export const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  colorClass: string;
  iconClass: string;
}> = [
  {
    value: "URGENT",
    label: "Khẩn cấp",
    colorClass: "text-rose-700 bg-rose-50/80 border-rose-200/80",
    iconClass: "text-rose-600",
  },
  {
    value: "HIGH",
    label: "Cao",
    colorClass: "text-amber-700 bg-amber-50/80 border-amber-200/80",
    iconClass: "text-amber-600",
  },
  {
    value: "NORMAL",
    label: "Bình thường",
    colorClass: "text-blue-700 bg-blue-50/80 border-blue-200/80",
    iconClass: "text-blue-600",
  },
  {
    value: "LOW",
    label: "Thấp",
    colorClass: "text-muted-foreground bg-muted/60 border-border/60",
    iconClass: "text-muted-foreground",
  },
];

export function TaskIdentityBlock({
  task,
  canEdit = true,
  deliverables = [],
  onStatusChange,
  onPriorityChange,
  onTitleChange,
  onAddDeliverable,
  onDeleteDeliverable,
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

  // Resource popover state
  const [isResourcePopoverOpen, setIsResourcePopoverOpen] = React.useState(false);
  const [resourceTitle, setResourceTitle] = React.useState("");
  const [resourceUrl, setResourceUrl] = React.useState("");
  const [isSavingResource, setIsSavingResource] = React.useState(false);
  const resourceMenuRef = React.useRef<HTMLDivElement>(null);

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

  const handleAddResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resourceTitle.trim() && !resourceUrl.trim()) return;

    setIsSavingResource(true);
    try {
      if (onAddDeliverable) {
        await onAddDeliverable(
          resourceTitle.trim() || "Tài liệu minh chứng",
          resourceUrl.trim() || undefined
        );
      }
      setResourceTitle("");
      setResourceUrl("");
      setIsResourcePopoverOpen(false);
    } catch {
      // safe fallback
    } finally {
      setIsSavingResource(false);
    }
  };

  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];

  const currentPriorityVal =
    (task as any).priority === "MEDIUM"
      ? "NORMAL"
      : (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
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
      if (resourceMenuRef.current && !resourceMenuRef.current.contains(e.target as Node)) {
        setIsResourcePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section data-slot="task-identity-block" className={cn("space-y-4 select-none", className)}>
      {/* 1. Linear Project Icon + Title Area */}
      <div className="flex items-start gap-3.5">
        {/* Project Icon container (like Linear 3D cube) */}
        <div className="size-10 rounded-xl bg-muted/60 border border-border/50 flex items-center justify-center text-foreground/80 shrink-0 shadow-2xs mt-1">
          <Box className="size-5 text-foreground/70" strokeWidth={1.5} />
        </div>

        {/* Title & Scope/Code */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Editable Title */}
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
            <div className="group/title flex items-start gap-2">
              <h1
                onClick={() => {
                  if (canEdit) setIsEditingTitle(true);
                }}
                className={cn(
                  "text-2xl sm:text-3xl font-bold tracking-tight text-foreground leading-snug break-words",
                  canEdit && "cursor-pointer hover:text-primary/90 transition-colors"
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
                  <Edit2 className="size-3.5" strokeWidth={1.5} />
                </button>
              )}
            </div>
          )}

          {/* Subtitle: Code, Scope & Department */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium flex-wrap pt-0.5">
            <span className="font-mono text-[11px] font-semibold text-foreground bg-muted/60 px-1.5 py-0.5 rounded">
              {taskCode}
            </span>
            <span className="text-muted-foreground/40 select-none">•</span>
            <span>{scopeLabel}</span>
            <span className="text-muted-foreground/40 select-none">•</span>
            <span>{departmentName}</span>
          </div>
        </div>
      </div>

      {/* 2. Linear-style Inline Properties Row (Properties: Status · Priority · Lead · Dates · Teams · ···) */}
      <div className="flex items-center gap-2 pt-1 flex-wrap text-xs">
        <span className="text-muted-foreground/80 font-medium mr-1 select-none text-[11px]">
          Properties
        </span>

        {/* Status Pill */}
        <div className="relative" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsStatusDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
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
                  onClick={() => {
                    setIsStatusDropdownOpen(false);
                    if (onStatusChange) onStatusChange(task.id, opt.value);
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
                  {task.status === opt.value && (
                    <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                  )}
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
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all",
              currentPriorityObj.colorClass,
              canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
            )}
            aria-label={`Độ ưu tiên: ${currentPriorityObj.label}`}
          >
            <AlertCircle className={cn("size-3.5", currentPriorityObj.iconClass)} strokeWidth={1.5} />
            <span>{currentPriorityObj.label}</span>
            {canEdit && <ChevronDown className="size-3 opacity-60 ml-0.5" strokeWidth={1.5} />}
          </button>

          {isPriorityDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-44 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {PRIORITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setIsPriorityDropdownOpen(false);
                    if (onPriorityChange) onPriorityChange(task.id, opt.value);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                    currentPriorityVal === opt.value
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground hover:bg-muted font-medium"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <AlertCircle className={cn("size-3.5", opt.iconClass)} strokeWidth={1.5} />
                    <span>{opt.label}</span>
                  </div>
                  {currentPriorityVal === opt.value && (
                    <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Lead Assignee Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 text-xs font-medium text-foreground">
          <User className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className="max-w-[150px] truncate">{leadName}</span>
        </div>

        {/* Due Date Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 text-xs font-medium text-foreground">
          <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className={cn(dueInfo.isOverdue ? "text-rose-600 font-semibold" : "")}>
            {dueInfo.text}
          </span>
        </div>

        {/* Department Pill */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border/60 bg-muted/30 text-xs font-medium text-foreground">
          <Building2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
          <span className="max-w-[150px] truncate">{departmentName}</span>
        </div>
      </div>

      {/* 3. Linear-style Inline Resources Row */}
      <div className="flex items-center gap-2 pt-0.5 flex-wrap text-xs" ref={resourceMenuRef}>
        <span className="text-muted-foreground/80 font-medium mr-1 select-none text-[11px]">
          Resources
        </span>

        {/* Existing deliverables as clean chips */}
        {deliverables.map((item) => (
          <div
            key={item.id}
            className="group/chip inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border/60 bg-background hover:bg-muted/50 text-xs font-medium text-foreground transition-colors"
          >
            <FileText className="size-3 text-muted-foreground" strokeWidth={1.5} />
            {item.fileUrl ? (
              <a
                href={item.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary flex items-center gap-1 max-w-[180px] truncate"
              >
                <span>{item.title}</span>
                <ExternalLink className="size-2.5 text-muted-foreground/70" />
              </a>
            ) : (
              <span className="max-w-[180px] truncate">{item.title}</span>
            )}

            {canEdit && onDeleteDeliverable && (
              <button
                type="button"
                onClick={() => onDeleteDeliverable(item.id)}
                className="opacity-0 group-hover/chip:opacity-100 text-muted-foreground hover:text-rose-600 ml-0.5 cursor-pointer transition-opacity"
                title="Xóa tài liệu"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>
        ))}

        {/* Add Resource Trigger Button */}
        {canEdit && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsResourcePopoverOpen((prev) => !prev)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>Thêm tài liệu hoặc liên kết...</span>
            </button>

            {/* Compact Add Resource Popover */}
            {isResourcePopoverOpen && (
              <div className="absolute left-0 top-full mt-1.5 w-72 rounded-xl border border-border/80 bg-popover p-3 text-popover-foreground shadow-xl z-50 animate-in fade-in-0 zoom-in-95 duration-100">
                <form onSubmit={handleAddResourceSubmit} className="space-y-2.5">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Đính kèm tài liệu / liên kết</span>
                    <button
                      type="button"
                      onClick={() => setIsResourcePopoverOpen(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    autoFocus
                    value={resourceTitle}
                    onChange={(e) => setResourceTitle(e.target.value)}
                    placeholder="Tên tài liệu / Minh chứng..."
                    className="w-full text-xs font-medium text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
                  />
                  <input
                    type="url"
                    value={resourceUrl}
                    onChange={(e) => setResourceUrl(e.target.value)}
                    placeholder="Liên kết URL (Google Drive, v.v.)..."
                    className="w-full text-xs font-mono text-foreground bg-background px-2.5 py-1.5 rounded-lg border border-border focus:ring-2 focus:ring-primary/40 focus:outline-hidden"
                  />
                  <div className="flex items-center justify-end gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsResourcePopoverOpen(false)}
                      className="px-2.5 py-1 rounded-md border border-border bg-background text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      Hủy
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingResource}
                      className="px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingResource ? "Đang lưu..." : "Thêm"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
