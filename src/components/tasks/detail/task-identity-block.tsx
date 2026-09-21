"use client";

import * as React from "react";
import {
  Clock,
  AlertCircle,
  TrendingUp,
  User,
  Building2,
  Edit2,
  X,
  Layers,
  Sparkles,
  Paperclip,
  Plus,
  ExternalLink,
  FolderOpen,
  Trash2,
  Link as LinkIcon,
  FileText,
  ArrowRight,
  MoreHorizontal,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";
import { formatDisplayDate, extractDateIso } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { DirectInlineEditor } from "./direct-inline-editor";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";
import { computeDueStatus } from "@/domain/tasks/deadlines";
import { normalizeDisplayStatus } from "@/domain/tasks/canonical-semantics";
import { CORE_STATUS_OPTIONS, PRIORITY_DISPLAY_CONFIG } from "@/domain/tasks/display-config";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import {
  TaskStatusSelect,
  TaskAssigneePicker,
  TaskDateRange,
  type TaskPersonnelOption,
} from "./task-property-controls";

// Backward-compat re-exports — prefer direct imports from domain layer
export { computeDueStatus } from "@/domain/tasks/deadlines";
export { CORE_STATUS_OPTIONS as STATUS_OPTIONS } from "@/domain/tasks/display-config";
export { PRIORITY_DISPLAY_CONFIG as PRIORITY_OPTIONS } from "@/domain/tasks/display-config";

export interface TaskIdentityBlockProps {
  task: SchoolTask | StaffTask;
  currentUser?: any;
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

export function TaskIdentityBlock({
  task,
  currentUser,
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

  const rawLeadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadName = formatAssigneeNameWithTitle(rawLeadName);

  const rawStartDate = isSchool
    ? (schoolTask?.startDate || schoolTask?.assignedDate)
    : ((task as any).startDate || (task as any).assignedDate);
  const startDateIso = extractDateIso(rawStartDate);

  const rawDueDate = task.dueDate || (isSchool ? schoolTask?.dueDate : staffTask?.dueDate);
  const dueDateIso = extractDateIso(rawDueDate);

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  const dueInfo = computeDueStatus(task.dueDate);

  // Personnel list for shared assignee picker
  const { personnel: personnelList } = usePersonnelList();
  const [isReassigning, setIsReassigning] = React.useState(false);

  const normalizedStatus = normalizeDisplayStatus(task.status);

  // Build status options from FSM-allowed transitions
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

  return (
    <section data-slot="task-identity-block" className={cn("space-y-4 relative z-30", className)}>
      {/* 1. Title Area */}
      <div className="w-full min-w-0 space-y-1">
          {/* Direct Inline Editable Title with exact caret positioning */}
          <div className="w-full">
            <DirectInlineEditor
              value={task.title}
              onSave={async (newTitle) => {
                const cleaned = newTitle.replace(/\r?\n|\r/g, " ").trim();
                if (onTitleChange && cleaned) {
                  await onTitleChange(task.id, cleaned);
                }
              }}
              canEdit={canEdit}
              as="h1"
              multiline={false}
              submitOnEnter={true}
              ariaLabel="Tên nhiệm vụ"
              placeholder="Nhập tên nhiệm vụ..."
              viewClassName="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
              editorClassName="text-xl sm:text-2xl font-semibold tracking-tight text-foreground leading-snug break-words whitespace-pre-wrap"
            />
          </div>
        </div>

      {showInlineProperties && (
      /* 2. Compact Properties Summary khi Sidebar đóng (Trạng thái · Người phụ trách · Hạn hoàn thành) */
      <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-muted-foreground font-normal select-none">
        <TaskStatusSelect
          value={normalizedStatus}
          options={statusOptions}
          disabled={!canEdit}
          onValueChange={(newStatus) => {
            if (onStatusChange) onStatusChange(task.id, newStatus);
          }}
        />

        <span>·</span>

        <TaskAssigneePicker
          items={personnelList}
          assigneeId={isSchool ? (task as any).leadAssigneeId : (task as any).assigneeId}
          assigneeName={rawLeadName}
          displayName={leadName}
          disabled={!canEdit}
          pending={isReassigning}
          onSelect={async (person) => {
            setIsReassigning(true);
            try {
              if (onReassignLead) {
                await onReassignLead(person.id, person.name);
              }
            } finally {
              setIsReassigning(false);
            }
          }}
        />

        <span>·</span>

        <TaskDateRange
          startDateIso={startDateIso}
          dueDateIso={dueDateIso}
          canEdit={canEdit}
          onStartDateChange={(newDate) => {
            if (onStartDateChange) onStartDateChange(task.id, newDate);
          }}
          onDueDateChange={(newDate) => {
            if (onDueDateChange) onDueDateChange(task.id, newDate);
          }}
        />
      </div>
      )}
    </section>
  );
}
