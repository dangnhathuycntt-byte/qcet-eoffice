"use client";

import * as React from "react";
import {
  User,
  Users,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Tag,
  Activity,
  History,
  Check,
  Edit2,
  X,
  Layers,
  Plus,
  CalendarClock,
  Sparkles,
  ExternalLink,
  Signal,
  UserPlus,
  ArrowRight,
  CircleDashed,
  Compass,
  MessageSquare,
  Paperclip,
  ArrowLeftRight,
  SquareUserRound,
  PenLine,
  Box,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
import {
  formatDisplayDate,
  formatDateTime,
  formatIsoDate,
} from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { STATUS_OPTIONS, PRIORITY_OPTIONS } from "./task-identity-block";

export interface AuditLogItem {
  id: string;
  action: string;
  timestamp: string;
  actorName?: string;
  description?: string;
}

export interface LinearPropertiesSidebarProps {
  task: SchoolTask | StaffTask;
  currentUser?: AuthUser | null;
  onStatusChange?: (taskId: string, newStatus: TaskStatus, note?: string) => Promise<void> | void;
  onPriorityChange?: (taskId: string, newPriority: TaskPriority) => Promise<void> | void;
  onDueDateChange?: (taskId: string, newDueDate: string) => Promise<void> | void;
  onStartDateChange?: (taskId: string, newStartDate: string) => Promise<void> | void;
  onNavigateTab?: (tab: "overview" | "subtasks" | "activity") => void;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onAddSubTask?: (parentId: string) => void;
  auditEvents?: AuditLogItem[];
  isMobileAccordion?: boolean;
  canEdit?: boolean;
  showRelatedSections?: boolean;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}


function LinearStartDateIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2.5" y="3.5" width="11" height="9.5" rx="2" />
      <path d="M5 2v2.5M11 2v2.5M2.5 6.5h11" />
      <path d="M5.5 10h3M7 8.5l1.5 1.5-1.5 1.5" />
    </svg>
  );
}

function LinearTargetDateIcon({ className, isOverdue }: { className?: string; isOverdue?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2.5" y="3.5" width="11" height="9.5" rx="2" className={isOverdue ? "stroke-rose-500" : ""} />
      <path d="M5 2v2.5M11 2v2.5M2.5 6.5h11" className={isOverdue ? "stroke-rose-500" : ""} />
      <path d="M8 8.5v3M6.5 10h3" className={isOverdue ? "stroke-rose-500" : ""} />
    </svg>
  );
}

export function LinearPropertiesSidebar({
  task,
  currentUser,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onStartDateChange,
  onNavigateTab,
  onSelectSubtask,
  onAddSubTask,
  auditEvents = [],
  isMobileAccordion = false,
  canEdit = true,
  showRelatedSections = true,
  className,
}: LinearPropertiesSidebarProps) {
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  // Dropdown states
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = React.useState(false);

  const statusMenuRef = React.useRef<HTMLDivElement>(null);
  const priorityMenuRef = React.useRef<HTMLDivElement>(null);
  // Lead popover state
  const [isLeadMenuOpen, setIsLeadMenuOpen] = React.useState(false);
  const [personnelList, setPersonnelList] = React.useState<Array<{ id: string; name: string; email?: string; departmentName?: string }>>([]);
  const leadMenuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => {
        if (data.success && Array.isArray(data.users)) {
          setPersonnelList(data.users.map((u: any) => ({
            id: u.id,
            name: u.name,
            email: u.email,
            departmentName: u.department?.name || u.departmentName || "Đơn vị",
          })));
        }
      })
      .catch(() => {});
  }, []);

  // Click outside listener & Keyboard accessibility
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) {
        setIsStatusMenuOpen(false);
      }
      if (priorityMenuRef.current && !priorityMenuRef.current.contains(e.target as Node)) {
        setIsPriorityMenuOpen(false);
      }
      if (leadMenuRef.current && !leadMenuRef.current.contains(e.target as Node)) {
        setIsLeadMenuOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStatusMenuOpen(false);
        setIsPriorityMenuOpen(false);
        setIsLeadMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Status mapping
  const currentStatus = task.status;
  const normalizedStatus =
    currentStatus === "NEW"
      ? "NOT_STARTED"
      : currentStatus === "NEEDS_REVIEW" || currentStatus === "PENDING_EXECUTIVE_APPROVAL"
      ? "WAITING_APPROVAL"
      : currentStatus;

  const activeStatusOption =
    STATUS_OPTIONS.find((opt) => opt.value === normalizedStatus) || STATUS_OPTIONS[0];

  // Priority mapping
  const currentPriority: TaskPriority =
    (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
  const normalizedPriority =
    currentPriority === "MEDIUM" ? "NORMAL" : currentPriority;
  const activePriorityOption =
    PRIORITY_OPTIONS.find((opt) => opt.value === normalizedPriority) || PRIORITY_OPTIONS[2];

  // Lead / DRI
  const leadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadAvatar = isSchool
    ? schoolTask?.leadAssigneeAvatar
    : staffTask?.assigneeAvatar;

  // Department
  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  // Members / Collaborators
  const collaborators: Array<{ id: string; name: string; avatarUrl?: string }> = React.useMemo(() => {
    if (isSchool && schoolTask) {
      const list: Array<{ id: string; name: string; avatarUrl?: string }> = [];
      if (Array.isArray(schoolTask.coAssignees)) {
        schoolTask.coAssignees.forEach((name, idx) => {
          if (name && typeof name === "string") {
            list.push({ id: `co-${idx}`, name });
          }
        });
      }
      if (Array.isArray(schoolTask.subTasks)) {
        schoolTask.subTasks.forEach((st) => {
          if (st.assigneeName && !list.some((m) => m.name === st.assigneeName)) {
            list.push({
              id: st.id || st.assigneeName,
              name: st.assigneeName,
              avatarUrl: st.assigneeAvatar,
            });
          }
        });
      }
      return list;
    }
    if (staffTask?.collaborators && Array.isArray(staffTask.collaborators)) {
      return staffTask.collaborators.map((c) => ({
        id: c.id,
        name: c.name,
        avatarUrl: c.avatarUrl,
      }));
    }
    return [];
  }, [isSchool, schoolTask, staffTask]);

  // Dates
  const rawStartDate = isSchool ? schoolTask?.startDate : (task as any).startDate;
  const startDateIso = rawStartDate ? formatIsoDate(rawStartDate, "") : "";
  const dueDateIso = task.dueDate ? formatIsoDate(task.dueDate, "") : "";
  const relativeDue = getRelativeDueTime(task.dueDate);

  // Subtasks completion
  const subTasks: StaffTask[] = isSchool && Array.isArray(schoolTask?.subTasks) ? schoolTask.subTasks : [];
  const completedSubTasks = subTasks.filter((s) => s.status === "COMPLETED").length;

  // Handlers
  const handleSelectStatus = async (newStatus: TaskStatus) => {
    setIsStatusMenuOpen(false);
    if (onStatusChange && newStatus !== task.status) {
      await onStatusChange(task.id, newStatus);
    }
  };

  const handleSelectPriority = async (newPriority: TaskPriority) => {
    setIsPriorityMenuOpen(false);
    if (onPriorityChange && newPriority !== currentPriority) {
      await onPriorityChange(task.id, newPriority);
    }
  };

  const handleSelectLead = async (personId: string, personName: string) => {
    setIsLeadMenuOpen(false);
    try {
      await fetch(`/api/tasks/${task.id}/actions/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newAssigneeId: personId,
          newAssigneeName: personName,
        }),
      });
      window.location.reload();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDueDateChange = async (newDateIso: string) => {
    if (onDueDateChange) {
      await onDueDateChange(task.id, newDateIso);
    }
  };

  return (
    <div
      data-slot="linear-properties-sidebar"
      className={cn(
        "w-full space-y-6 text-xs text-foreground select-none p-4 sm:p-5",
        className
      )}
    >
      {/* 1. SECTION: PROPERTIES (Linear Style) */}
      <div className="space-y-3">
        {/* Section Header */}
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Thuộc tính</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
          <button
            type="button"
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Thêm thuộc tính"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {/* 2-Column Key-Value Table */}
        <div className="space-y-1 text-xs">
          {/* Status Row */}
          <div
            ref={statusMenuRef}
            onClick={() => {
              if (canEdit) {
                setIsPriorityMenuOpen(false);
                setIsLeadMenuOpen(false);
                setIsStatusMenuOpen(!isStatusMenuOpen);
              }
            }}
            className={cn(
              "group relative flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal">Trạng thái</span>
            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground"
              >
                <CircleDashed className={cn("size-3.5", activeStatusOption.value === "COMPLETED" ? "text-emerald-600" : activeStatusOption.value === "IN_PROGRESS" ? "text-amber-500" : "text-muted-foreground")} strokeWidth={1.5} />
                <span>{activeStatusOption.label}</span>
              </div>

              {isStatusMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectStatus(opt.value)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                        normalizedStatus === opt.value
                          ? "bg-primary/10 text-primary font-medium"
                          : "text-foreground hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <span className={cn("size-2 rounded-full", opt.dotClass)} />
                        <span>{opt.label}</span>
                      </div>
                      {normalizedStatus === opt.value && (
                        <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Priority Row */}
          <div
            ref={priorityMenuRef}
            onClick={() => {
              if (canEdit) {
                setIsStatusMenuOpen(false);
                setIsLeadMenuOpen(false);
                setIsPriorityMenuOpen(!isPriorityMenuOpen);
              }
            }}
            className={cn(
              "group relative flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal">Ưu tiên</span>
            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground"
              >
                <Signal className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>{activePriorityOption.label}</span>
              </div>

              {isPriorityMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="menuitem"
                      onClick={() => handleSelectPriority(opt.value)}
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
          </div>

          {/* Lead Row with Reassign Popover */}
          <div
            ref={leadMenuRef}
            onClick={() => {
              if (canEdit) {
                setIsStatusMenuOpen(false);
                setIsPriorityMenuOpen(false);
                setIsLeadMenuOpen(!isLeadMenuOpen);
              }
            }}
            className={cn(
              "group relative flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal">Phụ trách</span>
            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground max-w-[180px] truncate"
              >
                {leadName && leadName !== "Chưa phân công" ? (
                  <>
                    <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[8px] shrink-0">
                      {getInitials(leadName)}
                    </div>
                    <span className="truncate" title={leadName}>
                      {leadName}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <UserPlus className="size-3.5" strokeWidth={1.5} />
                    <span>Thêm phụ trách</span>
                  </div>
                )}
              </div>

              {isLeadMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-56 max-h-64 overflow-y-auto rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 select-none">
                    Chọn người phụ trách
                  </div>
                  {personnelList.map((p) => {
                    const isSelected = p.name === leadName;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => handleSelectLead(p.id, p.name)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                          isSelected
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-foreground hover:bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="size-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-semibold shrink-0">
                            {getInitials(p.name)}
                          </div>
                          <div className="truncate">
                            <div className="truncate text-foreground font-normal">{p.name}</div>
                            {p.departmentName && (
                              <div className="text-[10px] text-muted-foreground truncate">{p.departmentName}</div>
                            )}
                          </div>
                        </div>
                        {isSelected && <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Members / Collaborators Row */}
          <div className="group flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors">
            <span className="text-muted-foreground text-xs font-normal">Thành viên</span>
            <div className="flex items-center gap-1.5">
              {collaborators.length > 0 ? (
                <div className="flex items-center -space-x-1">
                  {collaborators.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className="size-4 rounded-full bg-muted border border-background flex items-center justify-center text-[7px] font-semibold text-foreground overflow-hidden"
                      title={m.name}
                    >
                      {getInitials(m.name)}
                    </span>
                  ))}
                  {collaborators.length > 3 && (
                    <span className="text-[10px] text-muted-foreground font-mono pl-1.5">
                      +{collaborators.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Users className="size-3.5" strokeWidth={1.5} />
                  <span>Thêm thành viên</span>
                </div>
              )}
            </div>
          </div>

          {/* Dates Row (Linear Start -> Target Range style) */}
          <div className="group flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors">
            <span className="text-muted-foreground text-xs font-normal">Thời hạn</span>
            <div className="flex items-center gap-1.5 text-xs">
              {/* Start Date */}
              {startDateIso ? (
                <div className="flex items-center gap-1 text-foreground" title={`Bắt đầu: ${formatDisplayDate(startDateIso)}`}>
                  <LinearStartDateIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <span className="tabular-nums">{formatDisplayDate(startDateIso)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-muted-foreground/80">
                  <LinearStartDateIcon className="size-3.5 text-muted-foreground shrink-0" />
                  <span>Bắt đầu</span>
                </div>
              )}

              <ArrowRight className="size-3 text-muted-foreground/60 shrink-0 mx-0.5" strokeWidth={1.5} />

              {/* Due Date / Target Date */}
              {canEdit && onDueDateChange ? (
                <div className="flex items-center gap-1">
                  <VietnameseDatePicker
                    value={dueDateIso}
                    onChange={handleDueDateChange}
                    placeholder="Hạn chót"
                    variant="chip"
                    icon={<LinearTargetDateIcon className="size-3.5 text-rose-500/90 shrink-0" />}
                    showPresets={true}
                    align="right"
                    className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
                  />
                </div>
              ) : (
                <div className="flex items-center gap-1 text-foreground">
                  <LinearTargetDateIcon className={cn("size-3.5 shrink-0", dueDateIso ? "text-rose-500/90" : "text-muted-foreground")} />
                  <span className={cn("tabular-nums", !dueDateIso && "text-muted-foreground")}>
                    {dueDateIso ? formatDisplayDate(dueDateIso) : "Hạn chót"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Teams / Dept Row */}
          <div className="group flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors">
            <span className="text-muted-foreground text-xs font-normal">Đơn vị</span>
            <div className="flex items-center gap-1.5 max-w-[160px] truncate text-foreground">
              <Building2 className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="truncate text-xs" title={departmentName}>
                {departmentName}
              </span>
            </div>
          </div>

          {/* Labels Row */}
          <div className="group flex items-center justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors">
            <span className="text-muted-foreground text-xs font-normal">Nhãn</span>
            <div className="flex items-center gap-1.5 text-foreground max-w-[150px] truncate">
              <Tag className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
              <span className="text-xs truncate">
                {isSchool ? "Chỉ đạo cấp Trường" : "Nhiệm vụ đơn vị"}
              </span>
            </div>
          </div>
        </div>
            </div>

      {showRelatedSections && (
      <>
      {/* 2. SECTION: MILESTONES / SUBTASKS (Compact Notion-style list) */}
      <div className="space-y-2 pt-2.5 border-t border-border/40 select-none">
        {/* Header với số lượng, nút Thêm, và nút Xem tất cả */}
        <div className="flex items-center justify-between gap-1.5 text-muted-foreground">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-xs font-semibold text-foreground truncate">
              Việc thành phần
            </span>
            <span className="font-mono text-[11px] text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded-full tabular-nums shrink-0">
              {completedSubTasks}/{subTasks.length}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canEdit && (
              <button
                type="button"
                onClick={() => (onAddSubTask ? onAddSubTask(task.id) : onNavigateTab?.("subtasks"))}
                className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                title="Thêm việc thành phần mới"
                aria-label="Thêm việc thành phần"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
              </button>
            )}
            {onNavigateTab && subTasks.length > 0 && (
              <button
                type="button"
                onClick={() => onNavigateTab("subtasks")}
                className="text-[11px] font-medium text-primary hover:underline cursor-pointer pl-1"
                title="Xem tất cả việc thành phần dưới dạng bảng đầy đủ"
              >
                Xem tất cả
              </button>
            )}
          </div>
        </div>

        {/* Danh sách việc con gọn / Trạng thái rỗng */}
        {subTasks.length > 0 ? (
          <div className="space-y-1.5 pt-0.5">
            {subTasks.map((st) => {
              const isCompleted = st.status === "COMPLETED";
              const statusObj = STATUS_OPTIONS.find((s) => s.value === st.status) || STATUS_OPTIONS[0];
              const assigneeTitle = formatAssigneeNameWithTitle(st.assigneeName);
              const formattedDue = st.dueDate ? formatDisplayDate(st.dueDate) : "";

              return (
                <div
                  key={st.id}
                  onClick={() => onSelectSubtask && onSelectSubtask(st)}
                  className={cn(
                    "group p-2 rounded-lg border border-border/40 hover:border-border/80 bg-background/60 hover:bg-muted/30 transition-all cursor-pointer space-y-1",
                    isCompleted && "opacity-75 bg-muted/10"
                  )}
                  title={`Xem việc thành phần: ${st.title}`}
                >
                  {/* Tên việc con: tối đa 2 dòng */}
                  <div
                    className={cn(
                      "text-xs font-medium text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug",
                      isCompleted && "line-through text-muted-foreground"
                    )}
                  >
                    {st.title}
                  </div>

                  {/* Dòng phụ gọn: Trạng thái dot/pill, người phụ trách, hạn chót */}
                  <div className="flex items-center justify-between gap-1.5 text-[11px] text-muted-foreground pt-0.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={cn("size-1.5 rounded-full shrink-0", statusObj.dotClass)} />
                      <span className="truncate text-[11px]" title={assigneeTitle}>
                        {assigneeTitle}
                      </span>
                    </div>

                    {formattedDue && (
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground/80 shrink-0">
                        {formattedDue}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Trạng thái rỗng chỉ một dòng cùng nút thêm */
          <div className="flex items-center justify-between text-xs text-muted-foreground py-1">
            <span>Chưa có việc thành phần</span>
            {canEdit && (
              <button
                type="button"
                onClick={() => (onAddSubTask ? onAddSubTask(task.id) : onNavigateTab?.("subtasks"))}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline cursor-pointer"
              >
                <Plus className="size-3" />
                <span>Thêm</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. SECTION: ACTIVITY (Linear Style) */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Hoạt động</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab("activity")}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              Xem tất cả
            </button>
          )}
        </div>

        {/* Compact Chronological Activity List with Linear-style thin icons */}
        <div className="space-y-2">
          {auditEvents.slice(0, 5).map((evt) => {
            const isNameChange = evt.action === "UPDATE_TITLE" || evt.description?.includes("tiêu đề") || evt.description?.includes("tên");
            const isPriority = evt.action === "UPDATE_PRIORITY" || evt.description?.includes("ưu tiên");
            const isDate = evt.action === "UPDATE_DUE_DATE" || evt.description?.includes("hạn");
            const isProgress = evt.action === "UPDATE_PROGRESS" || evt.description?.includes("tiến độ");
            
            return (
              <div key={evt.id} className="flex items-start gap-2.5 text-[11px] text-muted-foreground leading-snug py-0.5">
                <span className="mt-0.5 shrink-0 text-muted-foreground/70">
                  {isNameChange ? (
                    <PenLine className="size-3.5" strokeWidth={1.5} />
                  ) : isPriority ? (
                    <Signal className="size-3.5" strokeWidth={1.5} />
                  ) : isDate ? (
                    <Calendar className="size-3.5" strokeWidth={1.5} />
                  ) : isProgress ? (
                    <CheckCircle2 className="size-3.5 text-emerald-600" strokeWidth={1.5} />
                  ) : (
                    <Box className="size-3.5" strokeWidth={1.5} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-foreground font-normal">{evt.actorName || "Người dùng"}</span>{" "}
                  <span className="text-foreground/80">{evt.description || evt.action}</span>
                  <span className="text-muted-foreground/50 ml-1.5 font-normal text-[10px]">
                    · {formatDisplayDate(evt.timestamp)}
                  </span>
                </div>
              </div>
            );
          })}

          {auditEvents.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              Chưa có hoạt động mới nào.
            </p>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
