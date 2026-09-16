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
  ChevronUp,
  TrendingUp,
  Tag,
  Activity,
  History,
  ShieldCheck,
  Check,
  Edit2,
  X,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn } from "@/lib/utils";
import { formatDetailDate, getRelativeDueTime } from "@/components/dashboard/task-detail-side-sheet";
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
  auditEvents?: AuditLogItem[];
  isMobileAccordion?: boolean;
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
    colorClass: "text-slate-600 bg-slate-100 border-slate-200",
    dotClass: "bg-slate-400",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang thực hiện",
    colorClass: "text-blue-700 bg-blue-50 border-blue-200",
    dotClass: "bg-blue-500",
  },
  {
    value: "WAITING_APPROVAL",
    label: "Chờ duyệt",
    colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    dotClass: "bg-amber-500",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
    dotClass: "bg-emerald-500",
  },
];

const PRIORITY_OPTIONS: Array<{
  value: TaskPriority;
  label: string;
  colorClass: string;
  bars: number;
}> = [
  {
    value: "URGENT",
    label: "Khẩn cấp",
    colorClass: "text-red-700 bg-red-50 border-red-200",
    bars: 4,
  },
  {
    value: "HIGH",
    label: "Cao",
    colorClass: "text-amber-700 bg-amber-50 border-amber-200",
    bars: 3,
  },
  {
    value: "NORMAL",
    label: "Bình thường",
    colorClass: "text-blue-700 bg-blue-50 border-blue-200",
    bars: 2,
  },
  {
    value: "LOW",
    label: "Thấp",
    colorClass: "text-slate-600 bg-slate-100 border-slate-200",
    bars: 1,
  },
];

export function LinearPropertiesSidebar({
  task,
  currentUser,
  onStatusChange,
  onPriorityChange,
  onDueDateChange,
  auditEvents = [],
  isMobileAccordion = false,
  className,
}: LinearPropertiesSidebarProps) {
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  // Mobile accordion state (default open on desktop, collapsible on mobile)
  const [isMobileOpen, setIsMobileOpen] = React.useState(true);

  // Dropdown states
  const [isStatusMenuOpen, setIsStatusMenuOpen] = React.useState(false);
  const [isPriorityMenuOpen, setIsPriorityMenuOpen] = React.useState(false);

  // Due Date inline edit state
  const [isEditingDueDate, setIsEditingDueDate] = React.useState(false);
  const [dueDateInput, setDueDateInput] = React.useState<string>(() => {
    if (!task.dueDate) return "";
    try {
      const d = new Date(task.dueDate);
      if (isNaN(d.getTime())) return "";
      return d.toISOString().split("T")[0];
    } catch {
      return "";
    }
  });
  const [isSavingDueDate, setIsSavingDueDate] = React.useState(false);

  // Keyboard accessibility: Escape closes dropdowns
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsStatusMenuOpen(false);
        setIsPriorityMenuOpen(false);
        setIsEditingDueDate(false);
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

  // Department
  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  // Members / Collaborators
  const members: Array<{ id: string; name: string }> = React.useMemo(() => {
    if (isSchool && schoolTask) {
      const list: Array<{ id: string; name: string }> = [];
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
            list.push({ id: st.id || st.assigneeName, name: st.assigneeName });
          }
        });
      }
      return list;
    }
    if (staffTask?.collaborators && Array.isArray(staffTask.collaborators)) {
      return staffTask.collaborators.map((c) => ({ id: c.id, name: c.name }));
    }
    return [];
  }, [isSchool, schoolTask, staffTask]);

  // Dates
  const startDateStr = isSchool ? schoolTask?.startDate : undefined;
  const dueDateStr = task.dueDate;
  const relativeDue = getRelativeDueTime(dueDateStr);

  // Progress
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

  const handleSaveDueDate = async () => {
    if (!dueDateInput || !onDueDateChange) {
      setIsEditingDueDate(false);
      return;
    }
    setIsSavingDueDate(true);
    try {
      await onDueDateChange(task.id, dueDateInput);
      setIsEditingDueDate(false);
    } finally {
      setIsSavingDueDate(false);
    }
  };

  return (
    <aside
      data-slot="linear-properties-sidebar"
      className={cn(
        "w-full bg-slate-50/70 border-l border-border/40 p-4 sm:p-5 flex flex-col space-y-5 text-xs text-slate-800",
        className
      )}
    >
      {/* 1. Header label with Mobile Accordion Toggle */}
      <div className="flex items-center justify-between pb-2 border-b border-border/40">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono">
            Thuộc tính nhiệm vụ
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-600 font-mono font-medium">
            Linear
          </span>
        </div>

        {/* Mobile toggle button */}
        <button
          type="button"
          onClick={() => setIsMobileOpen((prev) => !prev)}
          className="md:hidden inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-900 font-medium cursor-pointer p-1 rounded hover:bg-slate-200/60 transition-colors"
          aria-expanded={isMobileOpen}
          aria-label={isMobileOpen ? "Thu gọn thuộc tính" : "Mở rộng thuộc tính"}
        >
          <span>{isMobileOpen ? "Thu gọn" : "Xem chi tiết"}</span>
          {isMobileOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        </button>
      </div>

      {/* Accordion Content wrapper for Mobile */}
      <div className={cn("space-y-5 flex-1", !isMobileOpen && "hidden md:block")}>
        {/* 2. Key Properties List */}
        <div className="space-y-4">
          {/* Status Dropdown */}
          <div className="flex items-center justify-between gap-2 relative">
            <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Clock className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Trạng thái
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsStatusMenuOpen(!isStatusMenuOpen);
                  setIsPriorityMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isStatusMenuOpen}
                aria-label="Thay đổi trạng thái nhiệm vụ"
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  activeStatusOption.colorClass
                )}
              >
                <span className={cn("size-2 rounded-full", activeStatusOption.dotClass)} />
                <span>{activeStatusOption.label}</span>
                <ChevronDown className="size-3 text-slate-400" strokeWidth={2} />
              </button>

              {isStatusMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsStatusMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    aria-label="Danh sách trạng thái"
                    className="absolute right-0 top-full mt-1 w-44 rounded-lg bg-white border border-border/60 shadow-lg py-1 z-30 divide-y divide-border/30 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectStatus(opt.value)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer focus-visible:bg-slate-100 focus-visible:outline-none",
                          opt.value === normalizedStatus ? "font-bold text-slate-900 bg-slate-50" : "text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", opt.dotClass)} />
                          <span>{opt.label}</span>
                        </div>
                        {opt.value === normalizedStatus && (
                          <Check className="size-3 text-primary" strokeWidth={2} />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Priority Dropdown */}
          <div className="flex items-center justify-between gap-2 relative">
            <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <AlertCircle className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Độ ưu tiên
            </span>

            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setIsPriorityMenuOpen(!isPriorityMenuOpen);
                  setIsStatusMenuOpen(false);
                }}
                aria-haspopup="menu"
                aria-expanded={isPriorityMenuOpen}
                aria-label="Thay đổi độ ưu tiên nhiệm vụ"
                className={cn(
                  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold border transition-colors cursor-pointer hover:opacity-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none",
                  activePriorityOption.colorClass
                )}
              >
                <div className="flex items-end gap-0.5 h-3">
                  {[1, 2, 3, 4].map((b) => (
                    <span
                      key={b}
                      className={cn(
                        "w-0.5 rounded-full",
                        b <= activePriorityOption.bars ? "bg-current" : "bg-slate-300",
                        b === 1 ? "h-1.5" : b === 2 ? "h-2" : b === 3 ? "h-2.5" : "h-3"
                      )}
                    />
                  ))}
                </div>
                <span>{activePriorityOption.label}</span>
                <ChevronDown className="size-3 text-slate-400" strokeWidth={2} />
              </button>

              {isPriorityMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-20"
                    onClick={() => setIsPriorityMenuOpen(false)}
                    aria-hidden="true"
                  />
                  <div
                    role="menu"
                    aria-label="Danh sách độ ưu tiên"
                    className="absolute right-0 top-full mt-1 w-40 rounded-lg bg-white border border-border/60 shadow-lg py-1 z-30 divide-y divide-border/30 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {PRIORITY_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        role="menuitem"
                        type="button"
                        onClick={() => handleSelectPriority(opt.value)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 flex items-center justify-between text-xs hover:bg-slate-50 transition-colors cursor-pointer focus-visible:bg-slate-100 focus-visible:outline-none",
                          opt.value === normalizedPriority ? "font-bold text-slate-900 bg-slate-50" : "text-slate-700"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <div className="flex items-end gap-0.5 h-3">
                            {[1, 2, 3, 4].map((b) => (
                              <span
                                key={b}
                                className={cn(
                                  "w-0.5 rounded-full",
                                  b <= opt.bars ? "bg-slate-800" : "bg-slate-200",
                                  b === 1 ? "h-1.5" : b === 2 ? "h-2" : b === 3 ? "h-2.5" : "h-3"
                                )}
                              />
                            ))}
                          </div>
                          <span>{opt.label}</span>
                        </div>
                        {opt.value === normalizedPriority && (
                          <Check className="size-3 text-primary" strokeWidth={2} />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Lead Assignee (DRI) */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <User className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Người chủ trì (DRI)
            </span>
            <div className="flex items-center gap-2 min-w-0">
              <div className="size-5 rounded-full bg-blue-100 border border-blue-200 text-blue-700 text-[10px] font-bold flex items-center justify-center shrink-0">
                {leadName.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-slate-900 truncate max-w-[150px]" title={leadName}>
                {leadName}
              </span>
            </div>
          </div>

          {/* Department */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Building2 className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Đơn vị phụ trách
            </span>
            <span className="font-medium text-slate-900 truncate max-w-[160px]" title={departmentName}>
              {departmentName}
            </span>
          </div>

          {/* Collaborators / Co-Assignees */}
          <div className="flex flex-col gap-1.5 pt-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5">
              <Users className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Nhân sự phối hợp
            </span>
            {members.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {members.slice(0, 5).map((m) => (
                  <div
                    key={m.id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-border/60 text-[11px] font-medium text-slate-700 shadow-2xs"
                    title={m.name}
                  >
                    <span className="size-3.5 rounded-full bg-slate-200 text-[9px] flex items-center justify-center font-bold text-slate-700">
                      {m.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate max-w-[90px]">{m.name}</span>
                  </div>
                ))}
                {members.length > 5 && (
                  <span className="text-[10px] text-slate-500 font-mono self-center">
                    +{members.length - 5}
                  </span>
                )}
              </div>
            ) : (
              <span className="text-slate-400 italic text-[11px]">Chưa phân công nhân sự phối hợp</span>
            )}
          </div>

          {/* Dates & Due Date Edit */}
          <div className="flex flex-col gap-1.5 pt-1">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <Calendar className="size-3.5 text-slate-400" strokeWidth={1.5} />
                Thời hạn thực hiện
              </span>
              {relativeDue && !isEditingDueDate && (
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded border font-mono font-medium", relativeDue.color)}>
                  {relativeDue.text}
                </span>
              )}
            </div>

            {isEditingDueDate ? (
              <div className="p-2 rounded-lg border border-primary/40 bg-white space-y-2 animate-in fade-in">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-700">Chọn hạn mới:</span>
                  <button
                    type="button"
                    onClick={() => setIsEditingDueDate(false)}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <VietnameseDatePicker
                  value={dueDateInput}
                  onChange={(val) => setDueDateInput(val)}
                  variant="input"
                  placeholder="Chọn hạn hoàn thành..."
                  className="w-full"
                />
                <div className="flex items-center justify-end gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsEditingDueDate(false)}
                    className="px-2 py-0.5 text-[11px] text-slate-500 hover:text-slate-700"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    disabled={isSavingDueDate || !dueDateInput}
                    onClick={handleSaveDueDate}
                    className="px-2.5 py-0.5 text-[11px] font-semibold rounded bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingDueDate ? "Đang lưu..." : "Lưu hạn"}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-slate-800 font-mono text-[11px]">
                <div className="flex items-center gap-1.5">
                  {startDateStr ? (
                    <>
                      <span>{formatDetailDate(startDateStr)}</span>
                      <span className="text-slate-400">→</span>
                    </>
                  ) : null}
                  <span className="font-semibold text-slate-900">
                    {formatDetailDate(dueDateStr)}
                  </span>
                </div>
                {onDueDateChange && (
                  <button
                    type="button"
                    onClick={() => setIsEditingDueDate(true)}
                    className="text-slate-400 hover:text-primary transition-colors cursor-pointer p-0.5 rounded hover:bg-slate-100"
                    title="Thay đổi hạn hoàn thành"
                    aria-label="Thay đổi hạn hoàn thành"
                  >
                    <Edit2 className="size-3" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium flex items-center gap-1.5">
                <TrendingUp className="size-3.5 text-slate-400" strokeWidth={1.5} />
                Tiến độ hoàn thành
              </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {progressVal}%
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
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

          {/* Label / Category */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-slate-500 font-medium flex items-center gap-1.5 shrink-0">
              <Tag className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Lĩnh vực
            </span>
            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200 text-[11px] font-medium truncate max-w-[160px]">
              {categoryLabel}
            </span>
          </div>
        </div>

        {/* 3. Phân cách */}
        <hr className="border-border/40" />

        {/* 4. Hoạt động gần đây (Recent Activity Feed) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-mono flex items-center gap-1.5">
              <Activity className="size-3.5 text-slate-400" strokeWidth={1.5} />
              Hoạt động gần đây
            </span>
            {auditEvents.length > 0 && (
              <span className="text-[10px] font-mono text-slate-400 tabular-nums">
                {auditEvents.length}
              </span>
            )}
          </div>

          {auditEvents.length > 0 ? (
            <div className="relative pl-4 space-y-3 before:absolute before:left-1.5 before:top-2 before:bottom-2 before:w-px before:bg-slate-200">
              {auditEvents.slice(0, 5).map((evt) => (
                <div key={evt.id} className="relative flex flex-col gap-0.5 text-[11px]">
                  <span className="absolute -left-4 top-1 flex size-2.5 items-center justify-center rounded-full border border-white bg-blue-500" />
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900 truncate">
                      {evt.description || evt.action}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 shrink-0 tabular-nums">
                      {formatDetailDate(evt.timestamp)}
                    </span>
                  </div>
                  {evt.actorName && (
                    <span className="text-slate-500 text-[10px] truncate">
                      bởi {evt.actorName}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="py-3 px-2 text-center text-[11px] text-slate-400 rounded-md border border-dashed border-border/50 bg-white/50">
              Chưa có ghi nhận nhật ký nào.
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
