"use client";

import * as React from "react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { DirectInlineEditor } from "./direct-inline-editor";
import { TaskSourceDocumentBadge } from "./task-source-document-badge";
import { TaskStatusSelect, TaskAssigneePicker } from "./task-property-controls";
import type { TaskStatusChoice } from "./task-property-controls";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";
import { CORE_STATUS_OPTIONS } from "@/domain/tasks/display-config";
import { normalizeDisplayStatus } from "@/domain/tasks/canonical-semantics";

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

  const { personnel: personnelList } = usePersonnelList();

  const rawLeadName = isSchool
    ? schoolTask?.leadAssigneeName || "Chưa phân công"
    : staffTask?.assigneeName || "Chưa phân công";

  const leadName = formatAssigneeNameWithTitle(rawLeadName, personnelList);

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

  // Reassign lead state
  const [isReassigning, setIsReassigning] = React.useState(false);

  const normalizedStatus = normalizeDisplayStatus(task.status) as TaskStatus;

  // Build status choices with FSM-allowed transitions
  const statusChoices: TaskStatusChoice[] = React.useMemo(() =>
    CORE_STATUS_OPTIONS.map((opt) => {
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
    }),
  [allowedMap, normalizedStatus]);

  return (
    <section data-slot="task-identity-block" className={cn("space-y-4 relative z-30", className)}>
      {/* 0. Linked Official Source Document (nếu có) */}
      {isSchoolTask(task) && task.sourceDocument && (
        <div className="pb-1">
          <TaskSourceDocumentBadge sourceDocument={task.sourceDocument} />
        </div>
      )}

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

        {/* Status — @base-ui/react Select */}
        <TaskStatusSelect
          value={normalizedStatus}
          options={statusChoices}
          disabled={!canEdit}
          onValueChange={(newStatus) => {
            if (onStatusChange) onStatusChange(task.id, newStatus);
          }}
        />

        <span>·</span>

        {/* Người phụ trách — @base-ui/react Combobox */}
        <TaskAssigneePicker
          items={personnelList}
          assigneeId={(task as any).leadAssigneeId}
          assigneeName={leadName}
          displayName={leadName}
          disabled={!canEdit}
          pending={isReassigning}
          onSelect={async (person) => {
            setIsReassigning(true);
            try {
              if (onReassignLead) await onReassignLead(person.id, person.name);
            } finally {
              setIsReassigning(false);
            }
          }}
        />

        <span>·</span>

        {/* Ngày bắt đầu → Hạn chót */}
        <div className="inline-flex items-center gap-1 text-xs text-foreground">
          {canEdit && onStartDateChange ? (
            <VietnameseDatePicker
              value={startDateIso}
              onChange={(newDate) => onStartDateChange(task.id, newDate)}
              placeholder="Bắt đầu"
              variant="chip"
              align="left"
              className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
            />
          ) : (
            <span className="text-muted-foreground">{startDateIso ? formatDisplayDate(startDateIso) : "—"}</span>
          )}
          <span className="text-muted-foreground/60 px-0.5">→</span>
          {canEdit && onDueDateChange ? (
            <VietnameseDatePicker
              value={dueDateIso}
              onChange={(newDate) => onDueDateChange(task.id, newDate)}
              placeholder="Hạn chót"
              variant="chip"
              showPresets={true}
              align="left"
              className="p-0 h-auto border-0 text-xs font-normal shadow-none hover:bg-transparent"
            />
          ) : (
            <span className="text-muted-foreground">{dueDateIso ? formatDisplayDate(dueDateIso) : "Chưa đặt hạn"}</span>
          )}
        </div>
      </div>
      )}
    </section>
  );
}
