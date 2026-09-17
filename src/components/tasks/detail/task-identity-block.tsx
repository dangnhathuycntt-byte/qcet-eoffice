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
  Trash2,
  Link as LinkIcon,
  FileText,
  CircleDashed,
  Signal,
  UserPlus,
  ArrowRight,
  MoreHorizontal,
  Loader2,
  Search,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/components/dashboard/task-detail-side-sheet";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { DirectInlineEditor } from "./direct-inline-editor";

export interface TaskIdentityBlockProps {
  task: SchoolTask | StaffTask;
  canEdit?: boolean;
  deliverables?: Array<{ id: string; title: string; fileUrl?: string; notes?: string }>;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onTitleChange?: (taskId: string, newTitle: string) => Promise<void> | void;
  onStartDateChange?: (taskId: string, newStartDate: string) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onReassignLead?: (personId: string, personName: string) => Promise<void> | void;
  onAddDeliverable?: (title: string, fileUrl?: string, notes?: string) => Promise<void> | void;
  onDeleteDeliverable?: (deliverableId: string) => Promise<void> | void;
  showInlineProperties?: boolean;
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
    label: "Mới",
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


function LinearInlineStartDateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="3.5" width="11" height="9.5" rx="2" />
      <path d="M5 2v2.5M11 2v2.5M2.5 6.5h11" />
      <path d="M5.5 10h3M7 8.5l1.5 1.5-1.5 1.5" />
    </svg>
  );
}

function LinearInlineTargetDateIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2.5" y="3.5" width="11" height="9.5" rx="2" />
      <path d="M5 2v2.5M11 2v2.5M2.5 6.5h11" />
      <path d="M8 8.5v3M6.5 10h3" />
    </svg>
  );
}

export function TaskIdentityBlock({
  task,
  canEdit = true,
  deliverables = [],
  onStatusChange,
  onPriorityChange,
  onTitleChange,
  onStartDateChange,
  onDueDateChange,
  onReassignLead,
  onAddDeliverable,
  onDeleteDeliverable,
  showInlineProperties = true,
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

  const rawLeadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadName = formatAssigneeNameWithTitle(rawLeadName);

  const rawStartDate = isSchool
    ? (schoolTask?.startDate || schoolTask?.assignedDate)
    : ((task as any).startDate || (task as any).assignedDate);
  const startDateIso = rawStartDate
    ? typeof rawStartDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawStartDate)
      ? rawStartDate.slice(0, 10)
      : new Date(rawStartDate).toISOString().slice(0, 10)
    : "";

  const rawDueDate = task.dueDate || (isSchool ? schoolTask?.dueDate : staffTask?.dueDate);
  const dueDateIso = rawDueDate
    ? typeof rawDueDate === "string" && /^\d{4}-\d{2}-\d{2}/.test(rawDueDate)
      ? rawDueDate.slice(0, 10)
      : new Date(rawDueDate).toISOString().slice(0, 10)
    : "";

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

  // Lead popover state on Properties line
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = React.useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = React.useState("");
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [reassignError, setReassignError] = React.useState<string | null>(null);
  const [personnelList, setPersonnelList] = React.useState<
    Array<{ id: string; name: string; email?: string; departmentName?: string }>
  >([]);
  const leadMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setPersonnelList(
            data.users.map((u: any) => ({
              id: u.id,
              name: u.name,
              email: u.email,
              departmentName: u.department?.name || u.departmentName || "Đơn vị",
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Resource popover state
  const [isResourcePopoverOpen, setIsResourcePopoverOpen] = React.useState(false);
  const [resourceTitle, setResourceTitle] = React.useState("");
  const [resourceUrl, setResourceUrl] = React.useState("");
  const [resourceError, setResourceError] = React.useState<string | null>(null);
  const [isSavingResource, setIsSavingResource] = React.useState(false);
  const resourceMenuRef = React.useRef<HTMLDivElement>(null);

  const isValidHttpUrl = (str: string): boolean => {
    const trimmed = str.trim();
    if (!trimmed) return false;
    try {
      const url = new URL(trimmed);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  };

  const handleOpenResourcePopover = () => {
    setResourceError(null);
    setIsResourcePopoverOpen((prev) => !prev);
  };

  const handleAddResourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResourceError(null);

    const trimmedTitle = resourceTitle.trim();
    const trimmedUrl = resourceUrl.trim();

    if (!trimmedTitle) {
      setResourceError("Vui lòng nhập tên tài liệu hoặc văn bản minh chứng");
      return;
    }

    if (!trimmedUrl) {
      setResourceError("Đường dẫn liên kết (URL) là bắt buộc");
      return;
    }

    if (!isValidHttpUrl(trimmedUrl)) {
      setResourceError("Đường dẫn không hợp lệ. Vui lòng nhập URL bắt đầu bằng http:// hoặc https://");
      return;
    }

    setIsSavingResource(true);
    try {
      if (onAddDeliverable) {
        await onAddDeliverable(trimmedTitle, trimmedUrl);
      }
      setResourceTitle("");
      setResourceUrl("");
      setResourceError(null);
      setIsResourcePopoverOpen(false);
    } catch (err: any) {
      setResourceError(err?.message || "Không thể lưu tài liệu minh chứng. Vui lòng thử lại");
    } finally {
      setIsSavingResource(false);
    }
  };

  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];

  const rawPriority =
    (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
  const normalizedPriority =
    typeof rawPriority === "string"
      ? rawPriority.toUpperCase() === "MEDIUM"
        ? "NORMAL"
        : (rawPriority.toUpperCase() as TaskPriority)
      : "NORMAL";
  const currentPriorityObj =
    PRIORITY_OPTIONS.find((p) => p.value === normalizedPriority) || PRIORITY_OPTIONS[2];

  const filteredPersonnel = React.useMemo(() => {
    if (!leadSearchQuery.trim()) return personnelList;
    const q = leadSearchQuery.toLowerCase().trim();
    return personnelList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.departmentName && p.departmentName.toLowerCase().includes(q))
    );
  }, [personnelList, leadSearchQuery]);

  // Close dropdowns on click outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusDropdownOpen(false);
      }
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setIsPriorityDropdownOpen(false);
      }
      if (leadMenuRef.current && !leadMenuRef.current.contains(e.target as Node)) {
        setIsLeadDropdownOpen(false);
      }
      if (resourceMenuRef.current && !resourceMenuRef.current.contains(e.target as Node)) {
        setIsResourcePopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <section data-slot="task-identity-block" className={cn("space-y-4 relative z-30", className)}>
      {/* 1. Title Area */}
      <div className="w-full min-w-0 space-y-1">
          {/* Direct Inline Editable Title with exact caret positioning */}
          <div className="w-full">
            <DirectInlineEditor
              value={task.title}
              onSave={async (newTitle) => {
                if (onTitleChange) {
                  await onTitleChange(task.id, newTitle);
                }
              }}
              canEdit={canEdit}
              as="h1"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên nhiệm vụ"
              placeholder="Nhập tên nhiệm vụ..."
              viewClassName="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-snug"
              editorClassName="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-snug"
            />
          </div>

          {/* Subtitle / Sub-heading (Linear Project Style) */}
          <p className="text-sm text-muted-foreground font-normal pt-0.5 select-none">
            {taskCode} · {scopeLabel} · {departmentName}
          </p>
        </div>

      {showInlineProperties && (
      /* 2. Linear-style Minimalist Inline Properties Bar */
      <div className="flex items-center gap-4 pt-1 flex-wrap text-xs text-foreground font-normal select-none">
        <span className="text-muted-foreground select-none font-normal text-xs">
          Properties
        </span>

        {/* Status */}
        <div className="relative" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsStatusDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 py-0.5 rounded text-xs font-normal text-foreground transition-colors",
              canEdit ? "cursor-pointer hover:text-foreground/70" : "cursor-default"
            )}
          >
            <CircleDashed className={cn("size-3.5", currentStatusObj.value === "COMPLETED" ? "text-emerald-600" : currentStatusObj.value === "IN_PROGRESS" ? "text-amber-500" : "text-amber-500")} strokeWidth={1.5} />
            <span>{currentStatusObj.label}</span>
          </button>

          {isStatusDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
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
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
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

        {/* Priority */}
        <div className="relative" ref={priorityMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsPriorityDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 py-0.5 rounded text-xs font-normal text-foreground transition-colors",
              canEdit ? "cursor-pointer hover:text-foreground/70" : "cursor-default"
            )}
          >
            <Signal className={cn("size-3.5", currentPriorityObj.iconClass)} strokeWidth={1.5} />
            <span>{currentPriorityObj.label}</span>
          </button>

          {isPriorityDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
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
                    normalizedPriority === opt.value
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-foreground hover:bg-muted"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Signal className={cn("size-3.5", opt.iconClass)} strokeWidth={1.5} />
                    <span>{opt.label}</span>
                  </div>
                  {normalizedPriority === opt.value && (
                    <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Người phụ trách (Lead) với Popover lựa chọn / chuyển giao */}
        <div className="relative" ref={leadMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) {
                setIsStatusDropdownOpen(false);
                setIsPriorityDropdownOpen(false);
                setReassignError(null);
                setIsLeadDropdownOpen((prev) => !prev);
              }
            }}
            disabled={!canEdit || isReassigning}
            className={cn(
              "inline-flex items-center gap-1.5 py-0.5 px-1.5 -mx-1.5 rounded text-xs font-normal text-foreground transition-colors select-none",
              canEdit ? "cursor-pointer hover:bg-muted/40 hover:text-foreground" : "cursor-default"
            )}
            title={`Người phụ trách: ${leadName} (nhấp để thay đổi)`}
          >
            {isReassigning ? (
              <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
            ) : (
              <UserPlus className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            )}
            <span className="font-normal whitespace-nowrap">{leadName}</span>
          </button>

          {isLeadDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              <div className="p-1 border-b border-border/40 mb-1">
                <div className="relative">
                  <Search className="size-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm cán bộ..."
                    className="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-muted/40 border border-transparent focus:border-border focus:bg-background focus:outline-hidden"
                    autoFocus
                  />
                </div>
              </div>

              <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 select-none">
                Chọn người phụ trách
              </div>

              {filteredPersonnel.map((p) => {
                const isSelected = p.name === leadName || p.id === (task as any).leadAssigneeId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      setIsReassigning(true);
                      setReassignError(null);
                      try {
                        if (onReassignLead) {
                          await onReassignLead(p.id, p.name);
                        }
                        setIsLeadDropdownOpen(false);
                      } catch (err: any) {
                        setReassignError(err?.message || "Không thể chuyển giao người phụ trách");
                      } finally {
                        setIsReassigning(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                      isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="truncate font-medium">{p.name}</div>
                        {p.departmentName && (
                          <div className="text-[10px] text-muted-foreground truncate">{p.departmentName}</div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />}
                  </button>
                );
              })}

              {reassignError && (
                <div className="p-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-md m-1 flex items-start gap-1">
                  <AlertCircle className="size-3 shrink-0 mt-0.5" />
                  <span>{reassignError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Dates Range (Linear style: Start date -> Target date) */}
        <div className="inline-flex items-center gap-1 text-xs text-foreground flex-wrap">
          {/* Start Date */}
          {canEdit && onStartDateChange ? (
            <VietnameseDatePicker
              value={startDateIso}
              onChange={(newDate) => onStartDateChange(task.id, newDate)}
              placeholder="Chọn ngày bắt đầu"
              variant="chip"
              icon={<LinearInlineStartDateIcon className="size-3.5 text-muted-foreground shrink-0" />}
              showPresets={false}
              align="left"
              className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
            />
          ) : (
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <LinearInlineStartDateIcon className="size-3.5 text-muted-foreground shrink-0" />
              <span>{startDateIso ? formatDisplayDate(startDateIso) : "Chọn ngày bắt đầu"}</span>
            </div>
          )}

          <ArrowRight className="size-3 text-muted-foreground/60 mx-0.5 shrink-0" strokeWidth={1.5} />

          {/* Due Date */}
          {canEdit && onDueDateChange ? (
            <VietnameseDatePicker
              value={dueDateIso}
              onChange={(newDate) => onDueDateChange(task.id, newDate)}
              placeholder="Chọn hạn chót"
              variant="chip"
              icon={<LinearInlineTargetDateIcon className="size-3.5 text-rose-500 shrink-0" />}
              showPresets={true}
              align="left"
              className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
            />
          ) : (
            <div className="inline-flex items-center gap-1 text-muted-foreground">
              <LinearInlineTargetDateIcon className="size-3.5 text-rose-500 shrink-0" />
              <span>{dueDateIso ? formatDisplayDate(dueDateIso) : "Chọn hạn chót"}</span>
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3. Linear-style Inline Resources Row */}
      <div className="flex items-center gap-2 pt-0.5 flex-wrap text-xs" ref={resourceMenuRef}>
        <span className="text-muted-foreground select-none font-normal text-xs mr-1">
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
              onClick={handleOpenResourcePopover}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>Thêm tài liệu hoặc liên kết...</span>
            </button>

            {/* Compact Add Resource Popover */}
            {isResourcePopoverOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 rounded-xl border border-border bg-white p-3 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100">
                <form onSubmit={handleAddResourceSubmit} className="space-y-2.5">
                  <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                    <span>Đính kèm tài liệu / liên kết</span>
                    <button
                      type="button"
                      onClick={() => setIsResourcePopoverOpen(false)}
                      className="text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>

                  {resourceError && (
                    <div className="p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5 leading-snug">
                      <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{resourceError}</span>
                    </div>
                  )}

                  <label className="block space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      Tên tài liệu <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={resourceTitle}
                      onChange={(e) => {
                        setResourceTitle(e.target.value);
                        if (resourceError) setResourceError(null);
                      }}
                      placeholder="Ví dụ: Kế hoạch triển khai năm học"
                      className="w-full text-xs font-medium text-foreground bg-muted/25 px-2.5 py-2 rounded-md border border-transparent focus:border-border focus:bg-background focus:outline-none"
                    />
                  </label>

                  <label className="block space-y-1">
                    <span className="text-[11px] text-muted-foreground">
                      Đường dẫn liên kết (URL) <span className="text-rose-500">*</span>
                    </span>
                    <input
                      type="url"
                      required
                      value={resourceUrl}
                      onChange={(e) => {
                        setResourceUrl(e.target.value);
                        if (resourceError) setResourceError(null);
                      }}
                      placeholder="https://drive.google.com/..."
                      className="w-full text-xs font-mono text-foreground bg-muted/25 px-2.5 py-2 rounded-md border border-transparent focus:border-border focus:bg-background focus:outline-none"
                    />
                  </label>

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
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 cursor-pointer disabled:opacity-50"
                    >
                      {isSavingResource ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Đang lưu...</span>
                        </>
                      ) : (
                        <span>Thêm tài liệu</span>
                      )}
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
