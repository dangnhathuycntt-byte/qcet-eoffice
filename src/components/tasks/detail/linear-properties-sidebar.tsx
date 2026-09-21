"use client";

import * as React from "react";
import { Popover } from "@base-ui/react/popover";
import {
  User,
  Users,
  Building2,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Signal,
  UserPlus,
  CircleDashed,
  Loader2,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import { cn, getInitials } from "@/lib/utils";
import { getRelativeDueTime } from "@/lib/task-detail-helpers";
import {
  formatDisplayDate,
  formatDateTime,
  formatIsoDate,
} from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { QCET_DEPARTMENT_GROUPS } from "@/lib/departments";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { normalizeDisplayStatus } from "@/domain/tasks/canonical-semantics";
import { CORE_STATUS_OPTIONS, PRIORITY_DISPLAY_CONFIG, getStatusDisplay, getPriorityDisplay } from "@/domain/tasks/display-config";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { TaskSubtasksSidebarSection } from "./task-subtasks-sidebar-section";
import { useFeedback } from "@/components/ui/feedback-layer";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";

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
  onReassignLead?: (personId: string, personName: string) => Promise<void> | void;
  onNavigateTab?: (tab: "overview" | "activity") => void;
  auditEvents?: AuditLogItem[];
  isMobileAccordion?: boolean;
  canEdit?: boolean;
  showRelatedSections?: boolean;
  className?: string;
  subTasks?: StaffTask[];
  activeSubtaskId?: string | null;
  onSelectSubtask?: (subtask: StaffTask) => void;
  onAddSubtask?: () => void;
}

/**
 * Tách học vị/học hàm và chức danh để hiển thị tên ngắn gọn kèm chức vụ trong tooltip
 */
function extractNameAndTitle(rawName?: string | null): { name: string; prefix?: string; role?: string } {
  if (!rawName) return { name: "Chưa phân công" };
  const trimmed = rawName.trim();
  if (!trimmed || trimmed.toLowerCase().includes("chưa phân công")) {
    return { name: "Chưa phân công" };
  }

  // 1. Tách học vị / học hàm tiền tố: ThS., TS., PGS.TS., GS.TS., BS., CN., KS., GVC., ...
  const academicPrefixRegex =
    /^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|BS\.|CN\.|KS\.|GVC\.|ThS\b|TS\b)\s*/i;
  const match = trimmed.match(academicPrefixRegex);

  let cleanName = trimmed;
  let prefix = "";
  if (match) {
    prefix = match[1].trim();
    cleanName = trimmed.slice(match[0].length).trim();
  }

  // 2. Tách chức vụ trong ngoặc đơn / vuông nếu có
  let role = "";
  const roleInParenMatch = cleanName.match(/\s*[\(\[](.*?)[\)\]]/);
  if (roleInParenMatch) {
    role = roleInParenMatch[1].trim();
    cleanName = cleanName.replace(/\s*[\(\[](.*?)[\)\]]/g, "").trim();
  }

  // 3. Tách chức vụ sau dấu gạch ngang
  const roleAfterDashMatch = cleanName.match(/\s*-\s*(.*)$/);
  if (roleAfterDashMatch) {
    role = role || roleAfterDashMatch[1].trim();
    cleanName = cleanName.replace(/\s*-\s*(.*)$/, "").trim();
  }

  return {
    name: cleanName || trimmed,
    prefix: prefix || undefined,
    role: role || undefined,
  };
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
  onReassignLead,
  onNavigateTab,
  auditEvents = [],
  isMobileAccordion = false,
  canEdit = true,
  showRelatedSections = true,
  className,
  subTasks,
  activeSubtaskId,
  onSelectSubtask,
  onAddSubtask,
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
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [reassignError, setReassignError] = React.useState<string | null>(null);
  const { personnel: personnelList } = usePersonnelList();
  const leadMenuRef = React.useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click / Escape (lightweight per-menu)
  React.useEffect(() => {
    const refs = [statusMenuRef, priorityMenuRef, leadMenuRef];
    const setters = [setIsStatusMenuOpen, setIsPriorityMenuOpen, setIsLeadMenuOpen];
    const handler = (e: MouseEvent) => {
      refs.forEach((ref, i) => {
        if (ref.current && !ref.current.contains(e.target as Node)) setters[i](false);
      });
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setters.forEach((s) => s(false));
    };
    document.addEventListener("mousedown", handler);
    window.addEventListener("keydown", keyHandler);
    return () => { document.removeEventListener("mousedown", handler); window.removeEventListener("keydown", keyHandler); };
  }, []);

  // Status mapping
  const normalizedStatus = normalizeDisplayStatus(task.status);

  const activeStatusOption = getStatusDisplay(normalizedStatus);

  // Priority mapping
  const currentPriority: TaskPriority =
    (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
  const normalizedPriority =
    currentPriority === "MEDIUM" ? "NORMAL" : currentPriority;
  const activePriorityOption = getPriorityDisplay(normalizedPriority);

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

  // Phụ trách chỉ hiện avatar + tên; chức vụ đưa vào tooltip/popover
  const leadParsed = React.useMemo(() => {
    const parsed = extractNameAndTitle(leadName);
    if (!leadName || leadName === "Chưa phân công") {
      return {
        displayName: "Chưa phân công",
        fullTitle: "Chưa phân công",
        role: "",
        tooltip: "Chưa phân công",
      };
    }

    let role = parsed.role || "";
    let academicPrefix = parsed.prefix || "";

    for (const group of QCET_DEPARTMENT_GROUPS) {
      for (const m of group.members) {
        if (
          m.name.toLowerCase() === parsed.name.toLowerCase() ||
          m.name.toLowerCase() === leadName.toLowerCase()
        ) {
          if (!role && m.role) role = m.role;
          if (!academicPrefix && m.title) {
            const mMatch = m.title.match(
              /^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|BS\.|CN\.|KS\.|GVC\.)\s*/i
            );
            if (mMatch) academicPrefix = mMatch[1];
          }
          break;
        }
      }
      if (role) break;
    }

    const titleWithPrefix = academicPrefix ? `${academicPrefix} ${parsed.name}` : parsed.name;
    const tooltipParts: string[] = [];
    if (titleWithPrefix) tooltipParts.push(titleWithPrefix);
    if (role) tooltipParts.push(role);
    if (departmentName && !tooltipParts.includes(departmentName)) tooltipParts.push(departmentName);

    return {
      displayName: parsed.name,
      fullTitle: titleWithPrefix,
      role: role,
      tooltip: tooltipParts.join(" · ") || leadName,
    };
  }, [leadName, departmentName]);

  // Members / Collaborators
  // Members / Collaborators: strictly read-only derived data from server truth (Rule 2)
  const collaborators: Array<{ id: string; name: string; avatarUrl?: string }> = React.useMemo(() => {
    if (Array.isArray((task as any).collaborators) && (task as any).collaborators.length > 0) {
      return (task as any).collaborators.map((c: any) => ({
        id: c.id || c.name,
        name: c.name || c,
        avatarUrl: c.avatarUrl,
      }));
    }

    if (isSchool && schoolTask) {
      const list: Array<{ id: string; name: string; avatarUrl?: string }> = [];
      if (Array.isArray(schoolTask.coAssignees)) {
        schoolTask.coAssignees.forEach((name, idx) => {
          if (name && typeof name === "string") {
            list.push({ id: `co-${idx}`, name });
          } else if (name && typeof name === "object") {
            list.push({ id: (name as any).id || `co-${idx}`, name: (name as any).name || '', avatarUrl: (name as any).avatarUrl });
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
  }, [task, isSchool, schoolTask, staffTask]);

  // Dates
  const rawStartDate = isSchool ? schoolTask?.startDate : (task as any).startDate;
  const startDateIso = rawStartDate ? formatIsoDate(rawStartDate, "") : "";
  const dueDateIso = task.dueDate ? formatIsoDate(task.dueDate, "") : "";
  const dueStatus = computeDueStatus(task.dueDate);

  // Allowed transitions validation via domain State Machine
  const actorContext = React.useMemo(() => buildActorContext(currentUser), [currentUser]);
  const taskContext = React.useMemo(() => buildTaskContext(task), [task]);
  const allowedTransitions = React.useMemo(() => {
    return taskStateMachine.getAllowedTransitions(actorContext, taskContext, task.status);
  }, [actorContext, taskContext, task.status]);
  const allowedMap = React.useMemo(() => {
    const map = new Map<string, { allowed: boolean; reason?: string }>();
    for (const t of allowedTransitions) {
      map.set(t.status, { allowed: t.allowed, reason: t.reason });
    }
    return map;
  }, [allowedTransitions]);

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
    setIsReassigning(true);
    setReassignError(null);
    try {
      if (onReassignLead) {
        await onReassignLead(personId, personName);
        setIsLeadMenuOpen(false);
        return;
      }

      const res = await fetch(`/api/tasks/${task.id}/actions/reassign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newAssigneeId: personId,
          newAssigneeName: personName,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const errMsg =
          errJson?.error?.message ||
          errJson?.message ||
          (res.status === 403
            ? "Bạn không có quyền chuyển giao người phụ trách (403 Forbidden)"
            : "Không thể chuyển giao người phụ trách. Vui lòng thử lại");
        setReassignError(errMsg);
        return;
      }

      setIsLeadMenuOpen(false);
      window.location.reload();
    } catch (e: unknown) {
      setReassignError(e instanceof Error ? e.message : "Lỗi kết nối khi chuyển giao người phụ trách");
    } finally {
      setIsReassigning(false);
    }
  };

  const { notifyWarning } = useFeedback();

  const handleStartDateChangeInternal = async (newDateIso: string) => {
    if (!newDateIso) {
      if (onStartDateChange) await onStartDateChange(task.id, "");
      return;
    }
    if (dueDateIso && newDateIso > dueDateIso) {
      notifyWarning("Ngày bắt đầu không được sau hạn chót", "Thời hạn không hợp lệ");
      return;
    }
    if (onStartDateChange) {
      await onStartDateChange(task.id, newDateIso);
    }
  };

  const handleDueDateChangeInternal = async (newDateIso: string) => {
    if (!newDateIso) {
      if (onDueDateChange) await onDueDateChange(task.id, "");
      return;
    }
    if (startDateIso && newDateIso < startDateIso) {
      notifyWarning("Hạn chót không được trước ngày bắt đầu", "Thời hạn không hợp lệ");
      return;
    }
    if (onDueDateChange) {
      await onDueDateChange(task.id, newDateIso);
    }
  };

  return (
    <div
      data-slot="linear-properties-sidebar"
      className={cn(
        "w-full space-y-0 text-xs text-foreground select-none",
        className
      )}
    >
      {/* 1. SECTION: PROPERTIES (Linear Style) */}
      <div className="space-y-3 pb-5">
        {/* Section Header */}
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <span>Thuộc tính</span>
            <ChevronDown className="size-3 text-muted-foreground" />
          </span>
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
              "group relative flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none min-h-[28px]",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Trạng thái</span>
            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground"
              >
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <CircleDashed className={cn("size-3.5", activeStatusOption.value === "COMPLETED" ? "text-emerald-600" : activeStatusOption.value === "IN_PROGRESS" ? "text-amber-500" : "text-muted-foreground")} strokeWidth={1.5} />
                </div>
                <span>{activeStatusOption.label}</span>
              </div>

              {isStatusMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  {CORE_STATUS_OPTIONS.map((opt) => {
                    const check = allowedMap.get(opt.value === "NOT_STARTED" ? "NEW" : opt.value) || { allowed: true };
                    const isCurrent = normalizedStatus === opt.value;
                    const isOptionDisabled = !isCurrent && !check.allowed;

                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="menuitem"
                        disabled={isOptionDisabled}
                        title={isOptionDisabled ? check.reason : undefined}
                        onClick={() => {
                          if (!isOptionDisabled) {
                            handleSelectStatus(opt.value);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left",
                          isOptionDisabled
                            ? "opacity-40 cursor-not-allowed text-muted-foreground hover:bg-transparent"
                            : "cursor-pointer",
                          isCurrent
                            ? "bg-primary/10 text-primary font-medium"
                            : !isOptionDisabled
                            ? "text-foreground hover:bg-muted"
                            : ""
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("size-2 rounded-full", opt.dotClass)} />
                          <span>{opt.label}</span>
                        </div>
                        {isCurrent && (
                          <Check className="size-3.5 text-primary" strokeWidth={1.5} />
                        )}
                      </button>
                    );
                  })}
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
              "group relative flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none min-h-[28px]",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Ưu tiên</span>
            <div className="relative">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground"
              >
                <div className="size-4 shrink-0 flex items-center justify-center">
                  <Signal className={cn("size-3.5", activePriorityOption.iconClass)} strokeWidth={1.5} />
                </div>
                <span>{activePriorityOption.label}</span>
              </div>

              {isPriorityMenuOpen && canEdit && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  {PRIORITY_DISPLAY_CONFIG.map((opt) => (
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
              if (canEdit && !isReassigning) {
                setIsStatusMenuOpen(false);
                setIsPriorityMenuOpen(false);
                setReassignError(null);
                setIsLeadMenuOpen(!isLeadMenuOpen);
              }
            }}
            className={cn(
              "group relative flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md transition-colors select-none min-h-[28px]",
              canEdit ? "cursor-pointer hover:bg-muted/40" : ""
            )}
          >
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Phụ trách</span>
            <div className="relative min-w-0">
              <div
                className="inline-flex items-center gap-2 px-1.5 py-0.5 rounded text-xs font-normal text-foreground"
                style={{ minWidth: 0, whiteSpace: "normal", overflow: "visible", textOverflow: "clip" }}
                title={leadParsed.tooltip}
              >
                {isReassigning ? (
                  <div className="flex items-center gap-2 text-primary text-xs">
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <Loader2 className="size-3.5 animate-spin" />
                    </div>
                    <span>Đang cập nhật...</span>
                  </div>
                ) : leadParsed.displayName && leadParsed.displayName !== "Chưa phân công" ? (
                  <>
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <div className="size-4 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[8px]">
                        {getInitials(leadParsed.displayName)}
                      </div>
                    </div>
                    <span
                      className="min-w-0 font-normal line-clamp-2 select-text"
                      title={leadParsed.tooltip}
                      style={{ minWidth: 0, whiteSpace: "normal", overflow: "visible", textOverflow: "clip", wordBreak: "break-word" }}
                    >
                      {leadParsed.displayName}
                    </span>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <UserPlus className="size-3.5" strokeWidth={1.5} />
                    </div>
                    <span>Thêm phụ trách</span>
                  </div>
                )}
              </div>

              {isLeadMenuOpen && canEdit && (
                <div
                  role="menu"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 top-full mt-1.5 w-60 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
                >
                  <div className="text-[11px] font-semibold text-muted-foreground px-2 py-1 select-none flex items-center justify-between">
                    <span>Chọn người phụ trách</span>
                    {isReassigning && <Loader2 className="size-3 animate-spin text-primary" />}
                  </div>

                  {reassignError && (
                    <div className="mx-1 my-1 p-2 rounded-md bg-rose-50 border border-rose-200 text-rose-700 text-[11px] flex items-start gap-1.5 leading-snug">
                      <AlertCircle className="size-3.5 text-rose-600 shrink-0 mt-0.5" />
                      <span>{reassignError}</span>
                    </div>
                  )}

                  {personnelList.map((p, idx) => {
                    const isSelected = p.name === leadName || p.name === leadParsed.displayName;
                    return (
                      <button
                        key={p.id || `lead-${idx}-${p.name}`}
                        type="button"
                        disabled={isReassigning}
                        onClick={() => handleSelectLead(p.id, p.name)}
                        className={cn(
                          "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer disabled:opacity-50",
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

          {/* Members / Collaborators Row: strictly read-only derived data from active subtasks (Rule 2) */}
          <div className="flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md min-h-[28px] select-none">
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Phối hợp</span>
            <div className="relative">
              {collaborators.length > 0 ? (
                <div
                  className="inline-flex items-center px-1.5 py-0.5 -space-x-1.5 overflow-visible"
                  title={collaborators.map((c) => c.name).join(", ")}
                >
                  {collaborators.slice(0, 3).map((m, idx) => (
                    <span
                      key={m.id || `collab-${idx}-${m.name}`}
                      className="size-5 rounded-full bg-primary/10 text-primary border-2 border-background flex items-center justify-center text-[8px] font-semibold overflow-hidden shrink-0 shadow-xs"
                      title={m.name}
                    >
                      {getInitials(m.name)}
                    </span>
                  ))}
                  {collaborators.length > 3 && (
                    <span
                      className="size-5 rounded-full bg-muted text-muted-foreground border-2 border-background flex items-center justify-center text-[9px] font-medium font-mono shrink-0 shadow-xs"
                      title={`+${collaborators.length - 3} thành viên khác`}
                    >
                      +{collaborators.length - 3}
                    </span>
                  )}
                </div>
              ) : (
                <div className="inline-flex items-center px-1.5 py-0.5 text-xs text-muted-foreground/60">
                  <span className="size-4 shrink-0 flex items-center justify-center">—</span>
                </div>
              )}
            </div>
          </div>

          {/* Row 5: Start Date */}
          <div className="group flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors select-none min-h-[28px]">
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Ngày bắt đầu</span>
            <div className="flex items-center text-xs shrink-0 min-w-0">
              {canEdit && onStartDateChange ? (
                <VietnameseDatePicker
                  value={startDateIso}
                  onChange={handleStartDateChangeInternal}
                  placeholder="Chọn ngày"
                  title="Ngày bắt đầu"
                  variant="inline"
                  icon={
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                    </div>
                  }
                  showPresets={false}
                  align="right"
                />
              ) : (
                <div
                  title="Ngày bắt đầu"
                  className="inline-flex items-center gap-2 py-0.5 px-1.5 rounded text-xs text-foreground select-none"
                >
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    <Calendar className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="tabular-nums font-normal">
                    {startDateIso ? formatDisplayDate(startDateIso) : "Chưa đặt"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Row 6: Due Date / Target Date */}
          <div className="group flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors select-none min-h-[28px]">
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5 whitespace-nowrap">Hạn hoàn thành</span>
            <div className="flex items-center text-xs shrink-0 min-w-0">
              {canEdit && onDueDateChange ? (
                <VietnameseDatePicker
                  value={dueDateIso}
                  onChange={handleDueDateChangeInternal}
                  placeholder="Chọn ngày"
                  title="Hạn hoàn thành"
                  variant="inline"
                  icon={
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <Calendar
                        className={cn(
                          "size-3.5",
                          dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                            ? "text-rose-500"
                            : "text-muted-foreground"
                        )}
                        strokeWidth={1.5}
                      />
                    </div>
                  }
                  triggerClassName={cn(
                    dueStatus.isOverdue && normalizedStatus !== "COMPLETED" && "text-rose-600 font-normal"
                  )}
                  showPresets={true}
                  align="right"
                />
              ) : (
                <div
                  title="Hạn hoàn thành"
                  className={cn(
                    "inline-flex items-center gap-2 py-0.5 px-1.5 rounded text-xs select-none",
                    dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                      ? "text-rose-600 font-normal"
                      : "text-foreground font-normal"
                  )}
                >
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    <Calendar
                      className={cn(
                        "size-3.5",
                        dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                          ? "text-rose-500"
                          : "text-muted-foreground"
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <span className="tabular-nums font-normal">
                    {dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt"}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Row 7: Department */}
          <div className="group flex items-start justify-between gap-2 py-1 px-1.5 -mx-1.5 rounded-md hover:bg-muted/40 transition-colors min-h-[28px]">
            <span className="text-muted-foreground text-xs font-normal shrink-0 pt-0.5">Đơn vị</span>
            <div
              className="inline-flex items-start gap-2 px-1.5 py-0.5 rounded min-w-0 text-foreground text-xs leading-snug"
              style={{
                minWidth: 0,
                whiteSpace: "normal",
                overflow: "visible",
                textOverflow: "clip",
              }}
            >
              <div className="size-4 shrink-0 flex items-center justify-center mt-0.5">
                <Building2 className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
              </div>
              <span
                className="min-w-0 font-normal select-text line-clamp-2"
                title={departmentName}
                style={{
                  minWidth: 0,
                  whiteSpace: "normal",
                  overflow: "visible",
                  textOverflow: "clip",
                  wordBreak: "break-word",
                }}
              >
                {departmentName}
              </span>
            </div>
          </div>
        </div>
      </div>

      {subTasks && onSelectSubtask && (
        <TaskSubtasksSidebarSection
          subTasks={subTasks}
          activeSubtaskId={activeSubtaskId}
          onSelectSubtask={onSelectSubtask}
          onAddSubtask={onAddSubtask}
        />
      )}
    </div>
  );
}

// QCET linear properties inspector
