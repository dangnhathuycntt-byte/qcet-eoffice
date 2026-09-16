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
  auditEvents?: AuditLogItem[];
  isMobileAccordion?: boolean;
  canEdit?: boolean;
  className?: string;
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function LinearPropertiesSidebar({
  task,
  currentUser,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  onStartDateChange,
  onNavigateTab,
  auditEvents = [],
  isMobileAccordion = false,
  canEdit = true,
  className,
}: LinearPropertiesSidebarProps) {
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  // Dropdown states
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = React.useState(false);

  // Keyboard accessibility: Escape closes dropdowns
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStatusMenuOpen(false);
        setIsPriorityMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
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
            <span>Properties</span>
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
        <div className="space-y-2.5 text-xs">
          {/* Status Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Status</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (canEdit) setIsStatusMenuOpen(!isStatusMenuOpen);
                }}
                disabled={!canEdit}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  canEdit ? "cursor-pointer hover:bg-muted/60" : "cursor-default"
                )}
              >
                <span className={cn("size-2 rounded-full", activeStatusOption.dotClass)} />
                <span className="text-foreground">{activeStatusOption.label}</span>
              </button>

              {isStatusMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
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
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted font-medium"
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
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Priority</span>
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (canEdit) setIsPriorityMenuOpen(!isPriorityMenuOpen);
                }}
                disabled={!canEdit}
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs font-medium transition-colors",
                  canEdit ? "cursor-pointer hover:bg-muted/60" : "cursor-default"
                )}
              >
                <AlertCircle className={cn("size-3.5", activePriorityOption.iconClass)} strokeWidth={1.5} />
                <span className="text-foreground">{activePriorityOption.label}</span>
              </button>

              {isPriorityMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-44 rounded-xl border border-border/80 bg-popover p-1 text-popover-foreground shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-100"
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
                          ? "bg-primary/10 text-primary font-semibold"
                          : "text-foreground hover:bg-muted font-medium"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <AlertCircle className={cn("size-3.5", opt.iconClass)} strokeWidth={1.5} />
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

          {/* Lead Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Lead</span>
            <div className="flex items-center gap-1.5 font-medium text-foreground max-w-[170px] truncate">
              {leadAvatar ? (
                <img
                  src={leadAvatar}
                  alt={leadName}
                  className="size-4 rounded-full object-cover ring-1 ring-border shrink-0"
                />
              ) : (
                <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[9px] shrink-0">
                  {getInitials(leadName)}
                </div>
              )}
              <span className="truncate text-foreground" title={leadName}>
                {leadName}
              </span>
            </div>
          </div>

          {/* Members / Collaborators Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Members</span>
            <div className="flex items-center gap-1">
              {collaborators.length > 0 ? (
                <div className="flex items-center -space-x-1">
                  {collaborators.slice(0, 3).map((m) => (
                    <span
                      key={m.id}
                      className="size-4 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-bold text-foreground overflow-hidden"
                      title={m.name}
                    >
                      {m.avatarUrl ? (
                        <img src={m.avatarUrl} alt={m.name} className="size-full object-cover" />
                      ) : (
                        getInitials(m.name)
                      )}
                    </span>
                  ))}
                  {collaborators.length > 3 && (
                    <span className="text-[10px] text-muted-foreground font-mono pl-1.5">
                      +{collaborators.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <span className="text-muted-foreground/70 text-[11px]">Add members</span>
              )}
            </div>
          </div>

          {/* Dates Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Dates</span>
            {canEdit && onDueDateChange ? (
              <div className="flex justify-end">
                <VietnameseDatePicker
                  value={dueDateIso}
                  onChange={handleDueDateChange}
                  placeholder="Target date"
                  variant="chip"
                  showPresets={true}
                  align="right"
                  className="max-w-[150px]"
                />
              </div>
            ) : (
              <span className="font-mono text-foreground text-[11px] tabular-nums">
                {dueDateIso ? formatDisplayDate(dueDateIso) : "Target date"}
              </span>
            )}
          </div>

          {/* Teams / Dept Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Teams</span>
            <span className="font-medium text-foreground max-w-[160px] truncate text-right" title={departmentName}>
              {departmentName}
            </span>
          </div>

          {/* Labels Row */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Labels</span>
            <span className="px-1.5 py-0.5 rounded bg-muted/60 text-foreground border border-border/50 text-[10px] font-medium truncate max-w-[150px]">
              {isSchool ? "Chỉ đạo cấp Trường" : "Nhiệm vụ đơn vị"}
            </span>
          </div>
        </div>
      </div>

      {/* 2. SECTION: MILESTONES / SUBTASKS (Linear Style) */}
      <div className="space-y-2.5 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Milestones</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab && onNavigateTab("subtasks")}
            className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            title="Thêm milestone"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        {subTasks.length > 0 ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Việc thành phần</span>
              <span className="font-mono text-foreground font-semibold tabular-nums">
                {completedSubTasks}/{subTasks.length}
              </span>
            </div>
            <div className="h-1 w-full bg-muted/60 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{
                  width: `${subTasks.length > 0 ? (completedSubTasks / subTasks.length) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-muted-foreground/80">
            Thêm việc thành phần để phân rã nhiệm vụ và theo dõi tiến độ chi tiết.
          </p>
        )}
      </div>

      {/* 3. SECTION: ACTIVITY (Linear Style) */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Activity</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab("activity")}
              className="text-[11px] text-muted-foreground hover:text-foreground hover:underline cursor-pointer"
            >
              See all
            </button>
          )}
        </div>

        {/* Compact Chronological Activity List */}
        <div className="space-y-2.5">
          {auditEvents.slice(0, 4).map((evt) => (
            <div key={evt.id} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-tight">
              <div className="size-1.5 rounded-full bg-muted-foreground/60 mt-1 shrink-0" />
              <div className="min-w-0 flex-1">
                <span className="text-foreground font-medium">{evt.actorName || "Người dùng"}</span>{" "}
                <span>{evt.description || evt.action}</span>
                <span className="text-muted-foreground/60 ml-1.5 font-mono text-[10px]">
                  {formatDisplayDate(evt.timestamp)}
                </span>
              </div>
            </div>
          ))}

          {auditEvents.length === 0 && (
            <p className="text-[11px] text-muted-foreground/70 italic">
              Chưa có hoạt động mới nào.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
