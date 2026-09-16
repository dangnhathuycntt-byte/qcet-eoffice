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
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  TrendingUp,
  Tag,
  Activity,
  History,
  ShieldCheck,
  Check,
  Edit2,
  X,
  Layers,
  Sparkles,
  Info,
  CalendarClock,
  Hash,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
import { isTaskPastDue } from "@/components/tasks/table/utils/table-date-helpers";
import {
  formatDisplayDate,
  formatDateTime,
  formatIsoDate,
  toIctDateTimeParts,
} from "@/lib/format/date";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";

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
  auditEvents?: AuditLogItem[];
  isMobileAccordion?: boolean;
  canEdit?: boolean;
  className?: string;
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
  dotClass: string;
}> = [
  {
    value: "URGENT",
    label: "Khẩn cấp",
    colorClass: "text-rose-700 bg-rose-50 border-rose-200",
    dotClass: "bg-rose-600",
  },
  {
    value: "HIGH",
    label: "Cao",
    colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    dotClass: "bg-amber-600",
  },
  {
    value: "NORMAL",
    label: "Bình thường",
    colorClass: "text-blue-700 bg-blue-50 border-blue-200",
    dotClass: "bg-blue-600",
  },
  {
    value: "LOW",
    label: "Thấp",
    colorClass: "text-muted-foreground bg-muted border-border/70",
    dotClass: "bg-muted-foreground/60",
  },
];

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
    if (staffTask?.coAssignees && Array.isArray(staffTask.coAssignees)) {
      return staffTask.coAssignees.map((c) => ({
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

  // Progress Percent
  const progressVal =
    typeof (task as any).progressPercent === "number"
      ? (task as any).progressPercent
      : isSchool
      ? schoolTask?.progress ?? 0
      : 0;

  // Category / Label
  const categoryLabel = isSchool
    ? schoolTask?.categoryLabel || schoolTask?.category || "Công việc chung"
    : (task as any).category || "Nhiệm vụ đơn vị";

  // Scope / Tier Label
  const tierScope = React.useMemo(() => {
    if (isSchool) {
      return {
        label: "Toàn trường",
        description: "Nhiệm vụ chỉ đạo cấp Trường",
        badgeClass: "bg-blue-50 text-blue-700 border-blue-200",
      };
    }
    if (staffTask?.parentSchoolTaskId || staffTask?.parentTask) {
      return {
        label: "Đơn vị",
        description: "Nhiệm vụ phân rã cấp Đơn vị",
        badgeClass: "bg-emerald-50 text-emerald-700 border-emerald-200",
      };
    }
    return {
      label: "Cá nhân",
      description: "Nhiệm vụ thực hiện cá nhân",
      badgeClass: "bg-muted text-foreground border-border/70",
    };
  }, [isSchool, staffTask]);

  // Task code
  const taskCode =
    task.code ||
    (isSchool ? schoolTask?.taskCode : staffTask?.taskId) ||
    task.id.slice(0, 8).toUpperCase();

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

  const handleStartDateChange = async (newDateIso: string) => {
    if (onStartDateChange) {
      await onStartDateChange(task.id, newDateIso);
    }
  };

  return (
    <aside
      data-slot="linear-properties-sidebar"
      className={cn(
        "w-full space-y-6 text-xs text-foreground select-none",
        className
      )}
    >
      {/* 1. Header label with subtle status */}
      <div className="flex items-center justify-between pb-2 border-b border-border/60">
        <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Info className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
          Thuộc tính nhiệm vụ
        </span>
        <span className="font-mono text-[10px] text-muted-foreground font-semibold px-1.5 py-0.5 rounded bg-muted/60">
          {taskCode}
        </span>
      </div>

      {/* 2. Key Workflow Properties Group */}
      <div className="space-y-3.5">
        {/* Status Property */}
        <div className="flex items-center justify-between gap-2 relative">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Clock className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Trạng thái
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (canEdit) {
                  setIsStatusMenuOpen(!isStatusMenuOpen);
                  setIsPriorityMenuOpen(false);
                }
              }}
              disabled={!canEdit}
              aria-haspopup="menu"
              aria-expanded={isStatusMenuOpen}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shadow-2xs",
                activeStatusOption.colorClass,
                canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
              )}
            >
              <span className={cn("size-2 rounded-full", activeStatusOption.dotClass)} />
              <span>{activeStatusOption.label}</span>
              {canEdit && <ChevronDown className="size-3 opacity-60 ml-0.5" strokeWidth={1.5} />}
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
                    {normalizedStatus === opt.value && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Priority Property */}
        <div className="flex items-center justify-between gap-2 relative">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <AlertCircle className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Độ ưu tiên
          </span>

          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (canEdit) {
                  setIsPriorityMenuOpen(!isPriorityMenuOpen);
                  setIsStatusMenuOpen(false);
                }
              }}
              disabled={!canEdit}
              aria-haspopup="menu"
              aria-expanded={isPriorityMenuOpen}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all shadow-2xs",
                activePriorityOption.colorClass,
                canEdit ? "cursor-pointer hover:opacity-90 active:scale-95" : "cursor-default"
              )}
            >
              <span className={cn("size-2 rounded-full", activePriorityOption.dotClass)} />
              <span>{activePriorityOption.label}</span>
              {canEdit && <ChevronDown className="size-3 opacity-60 ml-0.5" strokeWidth={1.5} />}
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
                      <span className={cn("size-2 rounded-full", opt.dotClass)} />
                      <span>{opt.label}</span>
                    </div>
                    {normalizedPriority === opt.value && <Check className="size-3.5 text-primary" strokeWidth={1.5} />}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Phân cách */}
      <hr className="border-border/40" />

      {/* 4. People & Governance Group */}
      <div className="space-y-3.5">
        {/* Lead Assignee Property */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <User className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Phụ trách chính
          </span>

          <div className="flex items-center gap-1.5 font-medium text-foreground max-w-[170px] truncate">
            {leadAvatar ? (
              <img
                src={leadAvatar}
                alt={leadName}
                className="size-5 rounded-full object-cover ring-1 ring-border shrink-0"
              />
            ) : (
              <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0">
                {getInitials(leadName)}
              </div>
            )}
            <span className="truncate" title={leadName}>
              {leadName}
            </span>
          </div>
        </div>

        {/* Lead Department Property */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Building2 className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Đơn vị chủ trì
          </span>

          <span className="font-medium text-foreground max-w-[170px] truncate text-right" title={departmentName}>
            {departmentName}
          </span>
        </div>

        {/* Collaborators Property */}
        <div className="flex items-start justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0 pt-0.5">
            <Users className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Phối hợp
          </span>

          <div className="flex flex-wrap items-center justify-end gap-1 max-w-[170px]">
            {collaborators.length > 0 ? (
              collaborators.slice(0, 3).map((m) => (
                <span
                  key={m.id}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-muted text-[11px] font-medium text-foreground"
                  title={m.name}
                >
                  {m.avatarUrl ? (
                    <img
                      src={m.avatarUrl}
                      alt={m.name}
                      className="size-3.5 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="size-3.5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[8px] font-bold shrink-0">
                      {getInitials(m.name)}
                    </span>
                  )}
                  <span className="max-w-[70px] truncate">{m.name}</span>
                </span>
              ))
            ) : (
              <span className="text-muted-foreground/70 italic text-[11px]">Chưa có</span>
            )}
            {collaborators.length > 3 && (
              <span className="text-[10px] text-muted-foreground font-mono">
                +{collaborators.length - 3}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 5. Phân cách */}
      <hr className="border-border/40" />

      {/* 6. Schedule & Dates Group */}
      <div className="space-y-3.5">
        {/* Start Date */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Calendar className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Ngày bắt đầu
          </span>

          {canEdit && onStartDateChange ? (
            <div className="flex justify-end">
              <VietnameseDatePicker
                value={startDateIso}
                onChange={handleStartDateChange}
                placeholder="Chọn ngày bắt đầu"
                variant="chip"
                showPresets={true}
                align="right"
                className="max-w-[160px]"
              />
            </div>
          ) : (
            <span className="font-mono text-foreground tabular-nums">
              {startDateIso ? formatDisplayDate(startDateIso) : "Chưa đặt"}
            </span>
          )}
        </div>

        {/* Due Date with VietnameseDatePicker */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <CalendarClock className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Hạn hoàn thành
          </span>

          {canEdit && onDueDateChange ? (
            <div className="flex justify-end">
              <VietnameseDatePicker
                value={dueDateIso}
                onChange={handleDueDateChange}
                placeholder="Chọn hạn chót"
                variant="chip"
                showPresets={true}
                align="right"
                className="max-w-[160px]"
              />
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "font-mono tabular-nums",
                  relativeDue && relativeDue.text.includes("Quá hạn")
                    ? "text-rose-700 font-semibold"
                    : "text-foreground"
                )}
              >
                {dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt"}
              </span>
              {relativeDue && relativeDue.text.includes("Quá hạn") && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-rose-50 text-rose-700 border border-rose-200 font-medium">
                  Quá hạn
                </span>
              )}
            </div>
          )}
        </div>

        {/* Progress % */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground font-medium flex items-center gap-1.5">
              <TrendingUp className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
              Tiến độ hoàn thành
            </span>
            <span className="font-mono font-bold text-foreground tabular-nums">
              {progressVal}%
            </span>
          </div>
          <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-out",
                progressVal === 100
                  ? "bg-emerald-500"
                  : progressVal > 50
                  ? "bg-blue-600"
                  : "bg-amber-500"
              )}
              style={{ width: `${Math.min(Math.max(progressVal, 0), 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* 7. Phân cách */}
      <hr className="border-border/40" />

      {/* 8. Classification & Scope */}
      <div className="space-y-4">
        {/* Tier / Scope */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Layers className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Cấp độ
          </span>

          <span
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-semibold border",
              tierScope.badgeClass
            )}
            title={tierScope.description}
          >
            {tierScope.label}
          </span>
        </div>

        {/* Category / Domain */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground font-medium flex items-center gap-1.5 shrink-0">
            <Tag className="size-3.5 text-muted-foreground/70" strokeWidth={1.5} />
            Lĩnh vực
          </span>

          <span className="px-2 py-0.5 rounded bg-muted text-foreground border border-border/60 text-[11px] font-medium truncate max-w-[160px]">
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* 9. Phân cách */}
      <hr className="border-border/40" />

      {/* 10. Metadata & Timestamps */}
      <div className="space-y-2.5 pt-1 text-[11px] text-muted-foreground">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <History className="size-3 text-muted-foreground/70" strokeWidth={1.5} />
            Ngày tạo:
          </span>
          <span className="font-mono text-foreground tabular-nums">
            {task.createdAt ? formatDateTime(task.createdAt) : "—"}
          </span>
        </div>
        {task.updatedAt && (
          <div className="flex items-center justify-between">
            <span>Cập nhật gần nhất:</span>
            <span className="font-mono text-foreground tabular-nums">
              {formatDateTime(task.updatedAt)}
            </span>
          </div>
        )}
      </div>
    </aside>
  );
}
