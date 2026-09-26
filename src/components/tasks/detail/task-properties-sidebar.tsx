"use client";

import * as React from "react";
import {
  User,
  Users,
  Building2,
  Calendar,
  CalendarDays,
  CalendarCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Check,
  Signal,
  UserPlus,
  CircleDashed,
  Loader2,
  FileText,
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
  extractDateIso,
} from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { normalizeDisplayStatus } from "@/domain/tasks/canonical-semantics";
import { CORE_STATUS_OPTIONS, PRIORITY_DISPLAY_CONFIG, getStatusDisplay, getPriorityDisplay } from "@/domain/tasks/display-config";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { TaskStatusSelect, TaskAssigneePicker, TaskPrioritySelect } from "./task-property-controls";
import { PropertyRow } from "@/components/ui/property-row";
import { TaskSubtasksSidebarSection } from "./task-subtasks-sidebar-section";
import { TaskSourceDocumentBadge } from "./task-source-document-badge";
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

export interface TaskPropertiesSidebarProps {
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


function StartDateIcon({ className }: { className?: string }) {
  return (
    <CalendarDays
      className={cn("size-3.5 text-muted-foreground", className)}
      strokeWidth={1.5}
    />
  );
}

function TargetDateIcon({ className, isOverdue }: { className?: string; isOverdue?: boolean }) {
  return (
    <CalendarCheck
      className={cn(
        "size-3.5",
        isOverdue ? "text-rose-500" : "text-muted-foreground",
        className
      )}
      strokeWidth={1.5}
    />
  );
}

export function TaskPropertiesSidebar({
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
}: TaskPropertiesSidebarProps) {
  const isSchool = isSchoolTask(task);
  const schoolTask = isSchool ? (task as SchoolTask) : null;
  const staffTask = !isSchool ? (task as StaffTask) : null;

  // Reassign state (kept — used by handleSelectLead)
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [reassignError, setReassignError] = React.useState<string | null>(null);

  // Shared personnel list via hook (replaces local useState + useEffect fetch)
  const { personnel: personnelList } = usePersonnelList();

  // Status normalization via canonical-semantics (replaces inline if/else chain)
  const normalizedStatus = normalizeDisplayStatus(task.status);

  // Priority mapping
  const currentPriority: TaskPriority =
    (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
  const normalizedPriority =
    currentPriority === "MEDIUM" ? "NORMAL" : currentPriority;

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

    for (const m of personnelList) {
      const mName = m.name.replace(/^(ThS\.|TS\.|CN\.|BS\.|PGS\.|GS\.|KS\.|GVC\.)\s*/i, "").trim();
      if (
        mName.toLowerCase() === parsed.name.toLowerCase() ||
        m.name.toLowerCase() === leadName.toLowerCase()
      ) {
        if (!role && m.title) {
          // title from DB is the position/role string, e.g. "Trưởng phòng"
          role = m.title;
        }
        if (!academicPrefix && m.name) {
          const mMatch = m.name.match(
            /^(ThS\.|TS\.|PGS\.TS\.|GS\.TS\.|PGS\.|GS\.|BS\.|CN\.|KS\.|GVC\.)\s*/i
            );
            if (mMatch) academicPrefix = mMatch[1];
        }
        break;
      }
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
  }, [leadName, departmentName, personnelList]);

  // Members / Collaborators: strictly read-only derived data from server truth (Rule 2)
  const collaborators: Array<{ id: string; name: string; avatarUrl?: string }> = React.useMemo(() => {
    if (Array.isArray((task as any).collaborators) && !isSchool) {
      return (task as any).collaborators.map((c: any) => ({
        id: c.id || c.userId,
        name: c.name || c.userName,
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

  // Dates — use extractDateIso for ICT-safe date extraction (replaces inline typeof + slice)
  const rawStartDate = isSchool ? schoolTask?.startDate : (task as any).startDate;
  const startDateIso = extractDateIso(rawStartDate);
  const dueDateIso = extractDateIso(task.dueDate);
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

  // Build status options from FSM-allowed transitions (same pattern as task-identity-block)
  const statusOptions = React.useMemo(() => {
    return CORE_STATUS_OPTIONS.map((opt) => {
      const check = allowedMap.get(opt.value === "NOT_STARTED" ? "NEW" : opt.value) || { allowed: true };
      const isCurrent = normalizedStatus === opt.value;
      return {
        value: opt.value,
        label: opt.label,
        dotClass: opt.dotClass,
        iconClass: opt.iconClass,
        disabled: !isCurrent && !check.allowed,
        reason: !isCurrent && !check.allowed ? check.reason : undefined,
      };
    });
  }, [allowedMap, normalizedStatus]);

  // Handlers
  const handleSelectStatus = async (newStatus: TaskStatus) => {
    if (onStatusChange && newStatus !== task.status) {
      await onStatusChange(task.id, newStatus);
    }
  };

  const handleSelectPriority = async (newPriority: TaskPriority) => {
    if (onPriorityChange && newPriority !== currentPriority) {
      await onPriorityChange(task.id, newPriority);
    }
  };

  const handleSelectLead = async (personId: string, personName: string) => {
    if (!onReassignLead) return;
    setIsReassigning(true);
    setReassignError(null);
    try {
      await onReassignLead(personId, personName);
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
      data-slot="task-properties-sidebar"
      className={cn(
        "w-full space-y-0 text-xs text-foreground select-none",
        className
      )}
    >
      {/* 1. SECTION: PROPERTIES */}
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
          {/* Status Row — @base-ui Select via TaskStatusSelect */}
          <PropertyRow label="Trạng thái" interactive={canEdit}>
            <TaskStatusSelect
              value={normalizedStatus}
              options={statusOptions}
              disabled={!canEdit}
              onValueChange={handleSelectStatus}
            />
          </PropertyRow>

          {/* Priority Row — @base-ui Select via TaskPrioritySelect */}
          <PropertyRow label="Ưu tiên" interactive={canEdit}>
            <TaskPrioritySelect
              value={normalizedPriority}
              options={PRIORITY_DISPLAY_CONFIG as any}
              disabled={!canEdit}
              onValueChange={handleSelectPriority}
            />
          </PropertyRow>

          {/* Lead / DRI Row — @base-ui Combobox via TaskAssigneePicker */}
          <PropertyRow label="Phụ trách" interactive={canEdit}>
            <TaskAssigneePicker
              items={personnelList}
              assigneeName={leadName}
              displayName={leadParsed.displayName}
              disabled={!canEdit}
              pending={isReassigning}
              onSelect={async (person) => {
                await handleSelectLead(person.id, person.name);
              }}
            />
          </PropertyRow>

          {/* Members / Collaborators Row: strictly read-only derived data from active subtasks (Rule 2) */}
          <PropertyRow label="Phối hợp">
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
          </PropertyRow>

          {/* Row 5: Start Date */}
          <PropertyRow label="Ngày bắt đầu" interactive>
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
                      <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
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
                    <CalendarDays className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                  </div>
                  <span className="tabular-nums font-normal">
                    {startDateIso ? formatDisplayDate(startDateIso) : "Chưa đặt"}
                  </span>
                </div>
              )}
            </div>
          </PropertyRow>

          {/* Row 6: Due Date / Target Date */}
          <PropertyRow label="Hạn hoàn thành" interactive>
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
                      <CalendarCheck
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
                    <CalendarCheck
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
          </PropertyRow>

          {/* Row 7: Department */}
          <PropertyRow label="Đơn vị" interactive>
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
          </PropertyRow>

          {/* Row 8: Source Document */}
          {isSchoolTask(task) && task.sourceDocument && (
            <PropertyRow label="Văn bản gốc" icon={<FileText className="size-3" strokeWidth={1.5} />}>
              <TaskSourceDocumentBadge
                sourceDocument={task.sourceDocument}
                compact
              />
            </PropertyRow>
          )}
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

// Task properties inspector
