"use client";

import * as React from "react";
import {
  User,
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Check,
  Signal,
  UserPlus,
  CircleDashed,
  Loader2,
} from "lucide-react";
import { TaskIconDeadline, TaskIconDepartment } from "@/lib/icons/task-icons";
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
import { UserAvatar, UserAvatarGroup } from "@/components/ui/user-avatar";
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
  /** Đổi hạn trực tiếp chỉ dành cho người giao (T-01); người thực hiện dùng Xin gia hạn. Mặc định cho phép. */
  canChangeDueDate?: boolean;
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
    <TaskIconDeadline className={cn("size-4 text-muted-foreground", className)} />
  );
}

function TargetDateIcon({ className, isOverdue }: { className?: string; isOverdue?: boolean }) {
  return (
    <TaskIconDeadline
      className={cn(
        "size-4",
        isOverdue ? "text-destructive" : "text-muted-foreground",
        className
      )}
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
  canChangeDueDate: canChangeDueDateProp,
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
  // Nhiệm vụ đơn vị (StaffTask) cũng có mảng subTasks nên bị nhận nhầm là SchoolTask:
  // đọc cả hai nhóm trường để không mất người phụ trách
  const anyTask = task as any;
  const leadName: string =
    anyTask.leadAssigneeName || anyTask.assigneeName || "Chưa phân công";

  const leadAvatar: string | undefined =
    anyTask.leadAssigneeAvatar || anyTask.assigneeAvatar || undefined;

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
  const allCollaborators: Array<{ id: string; name: string; avatarUrl?: string }> = React.useMemo(() => {
    // Nhiệm vụ đơn vị có mảng subTasks nên có thể bị nhận nhầm là cấp trường (isSchool):
    // đọc cả hai nguồn thay vì dựa vào phân loại.
    const anyTask = task as any;
    if (Array.isArray(anyTask.coAssigneeUsers) && anyTask.coAssigneeUsers.length > 0) {
      return anyTask.coAssigneeUsers
        .map((c: any, idx: number) => ({ id: c.id || `co-${idx}`, name: c.name || "", avatarUrl: c.avatarUrl || undefined }))
        .filter((c: { name: string }) => c.name);
    }
    if (Array.isArray(anyTask.collaborators) && anyTask.collaborators.length > 0) {
      return anyTask.collaborators
        .map((c: any, idx: number) =>
          typeof c === "string"
            ? { id: `co-${idx}`, name: c }
            : { id: c.id || c.userId || `co-${idx}`, name: c.name || c.userName || "", avatarUrl: c.avatarUrl }
        )
        .filter((c: { name: string }) => c.name);
    }
    const list: Array<{ id: string; name: string; avatarUrl?: string }> = [];
    if (Array.isArray(anyTask.coAssignees)) {
      anyTask.coAssignees.forEach((entry: any, idx: number) => {
        if (entry && typeof entry === "string") {
          list.push({ id: `co-${idx}`, name: entry });
        } else if (entry && typeof entry === "object") {
          list.push({ id: entry.id || `co-${idx}`, name: entry.name || "", avatarUrl: entry.avatarUrl });
        }
      });
    }
    return list.filter((c) => c.name);
  }, [task]);

  // Người phụ trách chính đã hiện ở hàng "Phụ trách": không lặp lại trong "Phối hợp"
  const collaborators = React.useMemo(() => {
    const leadId: string | undefined = anyTask.leadAssigneeId || anyTask.assigneeId;
    // So khớp cả tên đầy đủ (có chức danh) và tên đã tách chức danh
    const leadKeys = new Set([leadName, leadParsed.displayName].map((n) => n.trim().toLocaleLowerCase("vi")));
    return allCollaborators.filter(
      (c) => !(leadId && c.id === leadId) && !leadKeys.has(c.name.trim().toLocaleLowerCase("vi")),
    );
  }, [allCollaborators, anyTask.leadAssigneeId, anyTask.assigneeId, leadName, leadParsed.displayName]);

  // Dates — use extractDateIso for ICT-safe date extraction (replaces inline typeof + slice)
  const rawStartDate = isSchool ? schoolTask?.startDate : (task as any).startDate;
  const startDateIso = extractDateIso(rawStartDate);
  const dueDateIso = extractDateIso(task.dueDate);
  // Đổi hạn trực tiếp cần task.assign; người thực hiện dùng Xin gia hạn (T-01).
  const taskActions = (task as { availableActions?: unknown }).availableActions;
  const canChangeDueDate = canChangeDueDateProp ?? (!Array.isArray(taskActions) || taskActions.includes("task.assign"));
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
        "w-full space-y-2 text-xs text-foreground select-none",
        className
      )}
    >
      {/* 1. SECTION: PROPERTIES */}
      <div className="space-y-3 rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
        {/* Section Header */}
        <div className="flex items-center justify-between text-muted-foreground">
          <span className="text-xs font-semibold text-foreground">Thuộc tính</span>
        </div>

        {/* 2-Column Key-Value Table */}
        <div className="text-xs">
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
              assigneeId={anyTask.leadAssigneeId || anyTask.assigneeId}
              assigneeName={leadName}
              assigneeAvatarUrl={leadAvatar}
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
              {collaborators.length === 1 ? (
                <div
                  className="inline-flex h-7 items-center gap-1.5 px-1.5 text-xs text-foreground select-none"
                  title={collaborators[0].name}
                >
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    <UserAvatar name={collaborators[0].name} avatarUrl={collaborators[0].avatarUrl} size="sm" />
                  </span>
                  <span className="truncate font-normal">{collaborators[0].name}</span>
                </div>
              ) : collaborators.length > 1 ? (
                <UserAvatarGroup
                  users={collaborators}
                  max={3}
                  size="sm"
                  className="px-1.5 py-0.5"
                  title={collaborators.map((c) => c.name).join(", ")}
                />
              ) : (
                <div className="inline-flex h-7 items-center px-1.5 text-xs text-muted-foreground/70 select-none">
                  Chưa có
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
                      <TaskIconDeadline className="size-4 text-muted-foreground" />
                    </div>
                  }
                  showPresets={false}
                  align="right"
                />
              ) : (
                <div
                  title="Ngày bắt đầu"
                  className="inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded text-xs text-foreground select-none"
                >
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    <TaskIconDeadline className="size-4 text-muted-foreground" />
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
              {canEdit && canChangeDueDate && onDueDateChange ? (
                <VietnameseDatePicker
                  value={dueDateIso}
                  onChange={handleDueDateChangeInternal}
                  placeholder="Chọn ngày"
                  title="Hạn hoàn thành"
                  variant="inline"
                  icon={
                    <div className="size-4 shrink-0 flex items-center justify-center">
                      <TaskIconDeadline
                        className={cn(
                          "size-4",
                          dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                        />
                    </div>
                  }
                  triggerClassName={cn(
                    dueStatus.isOverdue && normalizedStatus !== "COMPLETED" && "text-destructive font-normal"
                  )}
                  showPresets={true}
                  align="right"
                />
              ) : (
                <div
                  title="Hạn hoàn thành"
                  className={cn(
                    "inline-flex items-center gap-1.5 py-0.5 px-1.5 rounded text-xs select-none",
                    dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                      ? "text-destructive font-normal"
                      : "text-foreground font-normal"
                  )}
                >
                  <div className="size-4 shrink-0 flex items-center justify-center">
                    <TaskIconDeadline
                      className={cn(
                        "size-4",
                        dueStatus.isOverdue && normalizedStatus !== "COMPLETED"
                          ? "text-destructive"
                          : "text-muted-foreground"
                      )}
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
              className="inline-flex items-start gap-1.5 px-1.5 py-0.5 rounded min-w-0 text-foreground text-xs leading-snug"
              style={{
                minWidth: 0,
                whiteSpace: "normal",
                overflow: "visible",
                textOverflow: "clip",
              }}
            >
              <div className="size-4 shrink-0 flex items-center justify-center mt-0.5">
                <TaskIconDepartment className="size-4 text-muted-foreground" />
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
            <PropertyRow label="Văn bản gốc" interactive valueClassName="justify-start">
              <TaskSourceDocumentBadge
                sourceDocument={task.sourceDocument}
                compact
              />
            </PropertyRow>
          )}
        </div>
      </div>

      {subTasks && onSelectSubtask && (
        <div className="rounded-lg border border-border/70 bg-card p-3 shadow-2xs">
          <TaskSubtasksSidebarSection
            subTasks={subTasks}
            activeSubtaskId={activeSubtaskId}
            onSelectSubtask={onSelectSubtask}
            onAddSubtask={onAddSubtask}
          />
        </div>
      )}
    </div>
  );
}

// Task properties inspector
