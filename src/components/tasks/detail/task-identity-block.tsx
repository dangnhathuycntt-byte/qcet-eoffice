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
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { DirectInlineEditor } from "./direct-inline-editor";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";
import {
  TaskStatusSelect,
  TaskAssigneePicker,
  TaskDateRange,
  type TaskPersonnelOption,
} from "./task-property-controls";

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
  iconClass: string;
}> = [
  {
    value: "NOT_STARTED",
    label: "Mới",
    colorClass: "text-muted-foreground bg-muted/60 border-border/60",
    dotClass: "bg-muted-foreground/60",
    iconClass: "text-muted-foreground/60",
  },
  {
    value: "IN_PROGRESS",
    label: "Đang thực hiện",
    colorClass: "text-blue-700 bg-blue-50/80 border-blue-200/80",
    dotClass: "bg-blue-600",
    iconClass: "text-blue-600",
  },
  {
    value: "WAITING_APPROVAL",
    label: "Chờ duyệt",
    colorClass: "text-amber-700 bg-amber-50/80 border-amber-200/80",
    dotClass: "bg-amber-600",
    iconClass: "text-amber-600",
  },
  {
    value: "COMPLETED",
    label: "Hoàn thành",
    colorClass: "text-emerald-700 bg-emerald-50/80 border-emerald-200/80",
    dotClass: "bg-emerald-600",
    iconClass: "text-emerald-600",
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

  // Personnel list for shared assignee picker
  const [personnelList, setPersonnelList] = React.useState<TaskPersonnelOption[]>([]);
  const [isReassigning, setIsReassigning] = React.useState(false);

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

  const rawStatus = (task as any).status || "NOT_STARTED";
  const normalizedStatus: TaskStatus = typeof rawStatus === "string"
    ? rawStatus.toUpperCase() === "COMPLETED" || rawStatus.toUpperCase() === "DONE" || rawStatus.toUpperCase() === "HOAN_THANH"
      ? "COMPLETED"
      : rawStatus.toUpperCase() === "IN_PROGRESS" || rawStatus.toUpperCase() === "DANG_THUC_HIEN"
      ? "IN_PROGRESS"
      : rawStatus.toUpperCase() === "WAITING_APPROVAL" || rawStatus.toUpperCase() === "NEEDS_REVIEW" || rawStatus.toUpperCase() === "CHO_DUYET"
      ? "WAITING_APPROVAL"
      : "NOT_STARTED"
    : "NOT_STARTED";

  // Build status options from FSM-allowed transitions
  const statusOptions = React.useMemo(() => {
    return STATUS_OPTIONS.map((opt) => {
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
