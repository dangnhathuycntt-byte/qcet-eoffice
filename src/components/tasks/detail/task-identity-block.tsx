"use client";

import * as React from "react";
import {
  Clock,
  AlertCircle,
  TrendingUp,
  User,
  Building2,
  Edit2,
  Check,
  X,
  ChevronDown,
  Layers,
  Calendar,
  Sparkles,
  Paperclip,
  Plus,
  ExternalLink,
  FolderOpen,
  Trash2,
  Link as LinkIcon,
  FileText,
  CircleDashed,
  Signal,
  UserPlus,
  ArrowRight,
  MoreHorizontal,
  Loader2,
  Search,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority } from "@/types/dashboard";
import { isSchoolTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { formatDetailDate } from "@/lib/task-detail-helpers";
import { VietnameseDatePicker } from "@/components/ui/vietnamese-date-picker";
import { formatDisplayDate } from "@/lib/format/date";
import { formatAssigneeNameWithTitle } from "@/lib/format/personnel";
import { usePersonnelList } from "@/hooks/use-personnel-list";
import { DirectInlineEditor } from "./direct-inline-editor";
import { TaskSourceDocumentBadge } from "./task-source-document-badge";
import {
  taskStateMachine,
  buildActorContext,
  buildTaskContext,
} from "@/domain/tasks/state-machine";
import { CORE_STATUS_OPTIONS, PRIORITY_DISPLAY_CONFIG } from "@/domain/tasks/display-config";
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

import { computeDueStatus } from "@/domain/tasks/deadlines";

// Re-export for backward compat (subtask-detail-drawer imports it)
export { computeDueStatus } from "@/domain/tasks/deadlines";

const STATUS_COLOR_MAP: Record<string, string> = {
  NOT_STARTED: "text-muted-foreground bg-muted/60 border-border/60",
  IN_PROGRESS: "text-blue-700 bg-blue-50/80 border-blue-200/80",
  WAITING_APPROVAL: "text-amber-700 bg-amber-50/80 border-amber-200/80",
  NEEDS_REVIEW: "text-amber-700 bg-amber-50/80 border-amber-200/80",
  COMPLETED: "text-emerald-700 bg-emerald-50/80 border-emerald-200/80",
  CANCELLED: "text-rose-700 bg-rose-50/80 border-rose-200/80",
};

export const STATUS_OPTIONS = CORE_STATUS_OPTIONS.map((opt) => ({
  value: opt.value,
  label: opt.label,
  colorClass: STATUS_COLOR_MAP[opt.value] || "text-muted-foreground bg-muted/60 border-border/60",
  dotClass: opt.dotClass,
  iconClass: opt.iconClass,
}));

const PRIORITY_COLOR_MAP: Record<string, { colorClass: string; iconClass: string }> = {
  URGENT: { colorClass: "text-rose-700 bg-rose-50/80 border-rose-200/80", iconClass: "text-rose-600" },
  HIGH: { colorClass: "text-amber-700 bg-amber-50/80 border-amber-200/80", iconClass: "text-amber-600" },
  NORMAL: { colorClass: "text-blue-700 bg-blue-50/80 border-blue-200/80", iconClass: "text-blue-600" },
  MEDIUM: { colorClass: "text-blue-700 bg-blue-50/80 border-blue-200/80", iconClass: "text-blue-600" },
  LOW: { colorClass: "text-muted-foreground bg-muted/60 border-border/60", iconClass: "text-muted-foreground" },
};

export const PRIORITY_OPTIONS = PRIORITY_DISPLAY_CONFIG.map((opt) => ({
  value: opt.value,
  label: opt.label,
  colorClass: PRIORITY_COLOR_MAP[opt.value]?.colorClass || "text-muted-foreground bg-muted/60 border-border/60",
  iconClass: PRIORITY_COLOR_MAP[opt.value]?.iconClass || "text-muted-foreground",
}));

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

  const departmentName = isSchool
    ? schoolTask?.leadDepartment || schoolTask?.department || schoolTask?.departmentName || "Ban Giám hiệu"
    : staffTask?.assignedToDepartmentName || staffTask?.department || "Tổ chuyên môn";

  const dueInfo = computeDueStatus(task.dueDate);

  // Status popover state
  const [isStatusDropdownOpen, setIsStatusDropdownOpen] = React.useState(false);
  const statusMenuRef = React.useRef<HTMLDivElement>(null);

  // Lead popover state on Properties line
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = React.useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = React.useState("");
  const [isReassigning, setIsReassigning] = React.useState(false);
  const [reassignError, setReassignError] = React.useState<string | null>(null);
  const leadMenuRef = React.useRef<HTMLDivElement>(null);

  const normalizedStatus = normalizeDisplayStatus(task.status) as TaskStatus;

  const currentStatusObj =
    STATUS_OPTIONS.find((s) => s.value === normalizedStatus) || STATUS_OPTIONS[0];

  const rawPriority =
    (task as any).priority || (isSchool ? schoolTask?.priority : "NORMAL") || "NORMAL";
  const normalizedPriority =
    typeof rawPriority === "string"
      ? rawPriority.toUpperCase() === "MEDIUM"
        ? "NORMAL"
        : (rawPriority.toUpperCase() as TaskPriority)
      : "NORMAL";
  // currentPriorityObj retained for potential future use but not rendered
  void PRIORITY_OPTIONS.find((p) => p.value === normalizedPriority);

  const filteredPersonnel = React.useMemo(() => {
    if (!leadSearchQuery.trim()) return personnelList;
    const q = leadSearchQuery.toLowerCase().trim();
    return personnelList.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.email && p.email.toLowerCase().includes(q)) ||
        (p.departmentName && p.departmentName.toLowerCase().includes(q))
    );
  }, [personnelList, leadSearchQuery]);

  // Close dropdowns on outside click / Escape
  React.useEffect(() => {
    const refs = [statusMenuRef, leadMenuRef];
    const setters = [setIsStatusDropdownOpen, setIsLeadDropdownOpen];
    const onMouse = (e: MouseEvent) => { refs.forEach((r, i) => { if (r.current && !r.current.contains(e.target as Node)) setters[i](false); }); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setters.forEach((s) => s(false)); };
    document.addEventListener("mousedown", onMouse);
    window.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onMouse); window.removeEventListener("keydown", onKey); };
  }, []);

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

        {/* Status */}
        <div className="relative" ref={statusMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) setIsStatusDropdownOpen((prev) => !prev);
            }}
            disabled={!canEdit}
            className={cn(
              "inline-flex items-center gap-1.5 py-0.5 rounded text-xs font-normal text-foreground transition-colors",
              canEdit ? "cursor-pointer hover:text-foreground/70" : "cursor-default"
            )}
          >
            <CircleDashed className={cn("size-3.5", currentStatusObj.value === "COMPLETED" ? "text-emerald-600" : currentStatusObj.value === "IN_PROGRESS" ? "text-amber-500" : "text-amber-500")} strokeWidth={1.5} />
            <span>{currentStatusObj.label}</span>
          </button>

          {isStatusDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-48 rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              {STATUS_OPTIONS.map((opt) => {
                const check = allowedMap.get(opt.value === "NOT_STARTED" ? "NEW" : opt.value) || { allowed: true };
                const isCurrent = normalizedStatus === opt.value;
                const isOptionDisabled = !isCurrent && !check.allowed;

                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isOptionDisabled}
                    title={isOptionDisabled ? check.reason : undefined}
                    onClick={() => {
                      if (!isOptionDisabled) {
                        setIsStatusDropdownOpen(false);
                        if (onStatusChange) onStatusChange(task.id, opt.value);
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

        <span>·</span>

        {/* Người phụ trách (Lead) với Popover lựa chọn / chuyển giao */}
        <div className="relative" ref={leadMenuRef}>
          <button
            type="button"
            onClick={() => {
              if (canEdit) {
                setIsStatusDropdownOpen(false);
                setReassignError(null);
                setIsLeadDropdownOpen((prev) => !prev);
              }
            }}
            disabled={!canEdit || isReassigning}
            className={cn(
              "inline-flex items-center gap-1.5 py-0.5 px-1.5 -mx-1.5 rounded text-xs font-normal text-foreground transition-colors select-none",
              canEdit ? "cursor-pointer hover:bg-muted/40 hover:text-foreground" : "cursor-default"
            )}
            title={`Người phụ trách: ${leadName} (nhấp để thay đổi)`}
          >
            {isReassigning ? (
              <Loader2 className="size-3.5 text-primary animate-spin shrink-0" />
            ) : (
              <UserPlus className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
            )}
            <span className="font-normal whitespace-nowrap">{leadName}</span>
          </button>

          {isLeadDropdownOpen && canEdit && (
            <div
              role="listbox"
              className="absolute left-0 top-full mt-1.5 w-64 max-h-72 overflow-y-auto rounded-xl border border-border bg-white p-1 text-foreground shadow-2xl z-100 animate-in fade-in-0 zoom-in-95 duration-100"
            >
              <div className="p-1 border-b border-border/40 mb-1">
                <div className="relative">
                  <Search className="size-3 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={leadSearchQuery}
                    onChange={(e) => setLeadSearchQuery(e.target.value)}
                    placeholder="Tìm kiếm cán bộ..."
                    className="w-full pl-6 pr-2 py-1 text-xs rounded-md bg-muted/40 border border-transparent focus:border-border focus:bg-background focus:outline-hidden"
                    autoFocus
                  />
                </div>
              </div>

              <div className="text-[10px] font-semibold text-muted-foreground px-2 py-1 select-none">
                Chọn người phụ trách
              </div>

              {filteredPersonnel.map((p) => {
                const isSelected = p.name === leadName || p.id === (task as any).leadAssigneeId;
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={async () => {
                      setIsReassigning(true);
                      setReassignError(null);
                      try {
                        if (onReassignLead) {
                          await onReassignLead(p.id, p.name);
                        }
                        setIsLeadDropdownOpen(false);
                      } catch (err: unknown) {
                        setReassignError(err instanceof Error ? err.message : "Không thể chuyển giao người phụ trách");
                      } finally {
                        setIsReassigning(false);
                      }
                    }}
                    className={cn(
                      "w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg transition-colors text-left cursor-pointer",
                      isSelected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="size-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[9px] font-bold shrink-0">
                        {p.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate">
                        <div className="truncate font-medium">{p.name}</div>
                        {p.departmentName && (
                          <div className="text-[10px] text-muted-foreground truncate">{p.departmentName}</div>
                        )}
                      </div>
                    </div>
                    {isSelected && <Check className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />}
                  </button>
                );
              })}

              {reassignError && (
                <div className="p-2 text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-md m-1 flex items-start gap-1">
                  <AlertCircle className="size-3 shrink-0 mt-0.5" />
                  <span>{reassignError}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <span>·</span>

        {/* Ngày bắt đầu → Hạn chót */}
        <div className="inline-flex items-center gap-1 text-xs text-foreground">
          <Calendar className="size-3.5 text-muted-foreground shrink-0" />
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
