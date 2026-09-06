"use client";

import * as React from "react";
import {
  Building2,
  AlertTriangle,
  FileCheck,
  ChevronRight,
  ChevronUp,
  X,
  Target,
  Calendar,
  Clock,
  CheckCircle2,
  AlertCircle,
  Search,
  Filter,
  Layers,
  ArrowUpRight,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import type {
  ExecutiveDepartmentSummary,
  ExecutiveRAGStatus,
  ExecutiveTriageFilter,
  FocusInitiative,
} from "@/types/executive-command";
import { computeExecutiveDepartmentSummaries } from "@/lib/tasks/executive-department-aggregator";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ExecutiveDepartmentCommandCenterProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onSelectDepartment?: (deptId: string | null) => void;
  selectedDepartmentId?: string | null;
  className?: string;
  referenceDate?: string;
}

/**
 * Filter executive department summaries according to quick triage lens
 */
export function filterExecutiveDepartmentSummaries(
  summaries: ExecutiveDepartmentSummary[],
  filter: ExecutiveTriageFilter
): ExecutiveDepartmentSummary[] {
  switch (filter) {
    case "BOTTLENECKS":
      return summaries.filter(
        (s) => s.ragStatus === "RED" || s.metrics.overdue > 0
      );
    case "PENDING_APPROVAL":
      return summaries.filter((s) => s.pendingApprovalCount > 0);
    case "ALL":
    default:
      return summaries;
  }
}

/**
 * Compute counts for triage tabs
 */
export function getTriageFilterCounts(
  summaries: ExecutiveDepartmentSummary[]
): {
  all: number;
  bottlenecks: number;
  pendingApproval: number;
} {
  return {
    all: summaries.length,
    bottlenecks: summaries.filter(
      (s) => s.ragStatus === "RED" || s.metrics.overdue > 0
    ).length,
    pendingApproval: summaries.filter((s) => s.pendingApprovalCount > 0).length,
  };
}

/**
 * Resolve semantic RAG badge configuration
 */
export function getRAGBadgeConfig(status: ExecutiveRAGStatus): {
  label: string;
  className: string;
  dotColor: string;
  pulse: boolean;
} {
  switch (status) {
    case "RED":
      return {
        label: "Báo động trễ",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60",
        dotColor: "bg-rose-500",
        pulse: true,
      };
    case "AMBER":
      return {
        label: "Cần chú ý",
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-900/60",
        dotColor: "bg-amber-500",
        pulse: false,
      };
    case "GREEN":
    default:
      return {
        label: "Đúng hạn",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60",
        dotColor: "bg-emerald-500",
        pulse: false,
      };
  }
}

/**
 * Resolve priority badge visual config
 */
export function getPriorityBadgeConfig(priority: "HIGH" | "MEDIUM" | "LOW"): {
  label: string;
  className: string;
} {
  switch (priority) {
    case "HIGH":
      return {
        label: "Ưu tiên cao",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800",
      };
    case "MEDIUM":
      return {
        label: "Trung bình",
        className:
          "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800",
      };
    case "LOW":
    default:
      return {
        label: "Tiêu chuẩn",
        className:
          "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:text-slate-300 dark:border-slate-700",
      };
  }
}

/**
 * Resolve task status semantic badge config
 */
export function getTaskStatusConfig(status: string): {
  label: string;
  className: string;
} {
  switch (status) {
    case "COMPLETED":
      return {
        label: "Hoàn thành",
        className:
          "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-900/60",
      };
    case "PENDING_EXECUTIVE_APPROVAL":
      return {
        label: "Chờ BGH duyệt",
        className:
          "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-900/60",
      };
    case "NEEDS_REVIEW":
      return {
        label: "Chờ duyệt",
        className:
          "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-400 dark:border-purple-900/60",
      };
    case "BLOCKED":
      return {
        label: "Bị nghẽn",
        className:
          "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-900/60",
      };
    case "NEW":
      return {
        label: "Mới tạo",
        className:
          "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800/50 dark:text-slate-300 dark:border-slate-700",
      };
    case "IN_PROGRESS":
    default:
      return {
        label: "Đang thực hiện",
        className:
          "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-900/60",
      };
  }
}

/**
 * Helper to get name initials for leadership avatar
 */
function getLeadershipInitials(name: string): string {
  const cleaned = name.replace(/^(TS\.|ThS\.|GS\.|PGS\.|Ông|Bà)\s+/i, "").trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Format deadline date string to DD/MM/YYYY
 */
function formatDeadlineDisplay(dateStr?: string): string {
  if (!dateStr) return "Chưa đặt hạn";
  const [y, m, d] = dateStr.split("T")[0].split("-");
  if (d && m && y) return `${d}/${m}/${y}`;
  return dateStr;
}

/**
 * Helper to get task progress percent
 */
function getTaskProgress(task: SchoolTask | StaffTask): number {
  if (typeof (task as { progressPercent?: number }).progressPercent === "number") {
    return (task as { progressPercent?: number }).progressPercent!;
  }
  if (task.status === "COMPLETED") return 100;
  if (task.status === "IN_PROGRESS") return 50;
  if (task.status === "NEEDS_REVIEW") return 90;
  return 0;
}

/**
 * Helper to get task category label
 */
function getTaskCategoryLabel(task: SchoolTask | StaffTask): string {
  if ("categoryLabel" in task && task.categoryLabel) {
    return task.categoryLabel;
  }
  if ("category" in task && task.category) {
    return String(task.category);
  }
  return "Nhiệm vụ";
}

/**
 * Helper to get task assignee display name
 */
function getTaskAssigneeName(task: SchoolTask | StaffTask): string | undefined {
  if ("leadAssigneeName" in task && task.leadAssigneeName) {
    return task.leadAssigneeName;
  }
  if ("assigneeName" in task && task.assigneeName) {
    return task.assigneeName;
  }
  return undefined;
}

/**
 * Split department tasks into school-level vs unit-internal tasks
 */
export function splitDepartmentTasks(
  tasks: SchoolTask[],
  summary?: ExecutiveDepartmentSummary
): {
  schoolTasks: (SchoolTask | StaffTask)[];
  unitTasks: (SchoolTask | StaffTask)[];
} {
  const schoolTasks: (SchoolTask | StaffTask)[] = [];
  const unitTasks: (SchoolTask | StaffTask)[] = [];

  for (const task of tasks) {
    const isExplicitUnit =
      (task as unknown as { scope?: string }).scope === "UNIT";

    if (isExplicitUnit) {
      unitTasks.push(task);
    } else {
      schoolTasks.push(task);
    }

    // Also extract internal subTasks into unitTasks
    if (Array.isArray(task.subTasks)) {
      for (const sub of task.subTasks) {
        if (!unitTasks.some((t) => t.id === sub.id)) {
          const subTaskWithMeta = {
            ...sub,
            categoryLabel:
              (sub as unknown as { categoryLabel?: string }).categoryLabel ||
              task.categoryLabel ||
              "Nội bộ",
          };
          unitTasks.push(subTaskWithMeta as unknown as StaffTask);
        }
      }
    }
  }

  return { schoolTasks, unitTasks };
}

export interface DepartmentCommandCardProps {
  summary: ExecutiveDepartmentSummary;
  isSelected?: boolean;
  onSelectDepartment?: (deptId: string) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
}

/**
 * Individual Department Command Card
 */
export function DepartmentCommandCard({
  summary,
  isSelected = false,
  onSelectDepartment,
  onSelectTask,
}: DepartmentCommandCardProps) {
  const ragConfig = getRAGBadgeConfig(summary.ragStatus);
  const initials = getLeadershipInitials(summary.headOfDepartment.name);
  const focus = summary.focusInitiative;
  const priorityConfig = focus ? getPriorityBadgeConfig(focus.priority) : null;

  const handleFocusClick = (e: React.MouseEvent) => {
    if (!focus || !onSelectTask) return;
    e.stopPropagation();
    const matched = summary.tasks.find((t) => t.id === focus.taskId);
    if (matched) {
      onSelectTask(matched);
    }
  };

  const handleCardClick = () => {
    onSelectDepartment?.(summary.departmentId);
  };

  return (
    <div
      data-slot="department-command-card"
      data-selected={isSelected}
      onClick={handleCardClick}
      className={cn(
        "group relative flex flex-col justify-between rounded-xl border bg-card p-4 transition-all duration-200 cursor-pointer",
        "border-border/40 hover:border-border/80 hover:shadow-md hover:-translate-y-0.5",
        "focus-within:ring-2 focus-within:ring-primary/20",
        summary.ragStatus === "RED" && "border-rose-300/60 dark:border-rose-900/60",
        summary.ragStatus === "AMBER" && "border-amber-300/60 dark:border-amber-900/60",
        isSelected && "ring-2 ring-primary/40 border-primary/60 shadow-md bg-accent/15"
      )}
    >
      {/* 1. Header: Department Name in UPPERCASE, Head of Dept with avatar/title, RAG Alert Badge */}
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono font-semibold uppercase tracking-wider text-muted-foreground">
                {summary.departmentCode}
              </span>
              {summary.pendingApprovalCount > 0 && (
                <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.2 text-[10px] font-mono font-semibold tabular-nums bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-400 dark:border-purple-800">
                  <FileCheck size={10} strokeWidth={1.5} />
                  {summary.pendingApprovalCount} chờ duyệt
                </span>
              )}
            </div>
            <h3
              title={summary.departmentName}
              className="mt-0.5 text-sm font-bold uppercase tracking-wide text-foreground line-clamp-1"
            >
              {summary.departmentName}
            </h3>
          </div>

          {/* RAG Alert Badge */}
          <div
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold font-mono",
              ragConfig.className
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                ragConfig.dotColor,
                ragConfig.pulse && "animate-pulse"
              )}
            />
            <span>{ragConfig.label}</span>
          </div>
        </div>

        {/* Head of Department with avatar and title */}
        <div className="flex items-center gap-2.5 rounded-lg bg-muted/40 p-2 border border-border/30">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-xs font-semibold border border-primary/20">
            {initials}
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <div className="font-semibold text-foreground truncate">
              {summary.headOfDepartment.name}
            </div>
            <div className="text-[11px] text-muted-foreground truncate">
              {summary.headOfDepartment.title}
            </div>
          </div>
        </div>

        {/* 2. Focus Initiative Banner: Highlighted callout box */}
        <div
          onClick={handleFocusClick}
          className={cn(
            "relative rounded-lg border p-2.5 transition-colors",
            focus
              ? "bg-slate-50/80 dark:bg-slate-900/50 border-slate-200/80 dark:border-slate-800/80 hover:bg-slate-100/80 dark:hover:bg-slate-800/80 cursor-pointer"
              : "bg-muted/20 border-dashed border-border/50"
          )}
        >
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <div className="flex items-center gap-1 text-[11px] font-semibold text-primary">
              <Target size={13} strokeWidth={1.5} />
              <span>Trọng tâm điều hành</span>
            </div>
            {priorityConfig && (
              <span
                className={cn(
                  "inline-flex items-center rounded border px-1.5 py-0.2 text-[10px] font-medium",
                  priorityConfig.className
                )}
              >
                {priorityConfig.label}
              </span>
            )}
          </div>

          {focus ? (
            <div className="space-y-1">
              <p
                title={focus.title}
                className="text-xs font-medium text-foreground line-clamp-2 leading-relaxed"
              >
                {focus.title}
              </p>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                <span className="flex items-center gap-1">
                  <Calendar size={11} strokeWidth={1.5} />
                  <span className="font-mono tabular-nums">
                    Hạn: {formatDeadlineDisplay(focus.dueDate)}
                  </span>
                </span>
                <span className="font-mono tabular-nums font-medium text-foreground">
                  {focus.progressPercent}%
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic py-1">
              Đơn vị chưa phát sinh nhiệm vụ trọng tâm
            </p>
          )}
        </div>
      </div>

      {/* 3. Progress bar + Metric Strip */}
      <div className="mt-3.5 space-y-2.5 pt-2 border-t border-border/30">
        {/* Progress bar with % progress font-mono tabular-nums */}
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[11px] text-muted-foreground">
              Tiến độ chung đơn vị
            </span>
            <span className="font-mono tabular-nums font-semibold text-foreground text-xs">
              {summary.metrics.completionRate}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full transition-all duration-300 ease-in-out",
                summary.metrics.completionRate >= 80
                  ? "bg-emerald-500"
                  : summary.metrics.completionRate >= 50
                  ? "bg-amber-500"
                  : "bg-rose-500"
              )}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, summary.metrics.completionRate)
                )}%`,
              }}
            />
          </div>
        </div>

        {/* 3 Stats: Đang làm | Sắp hạn | Trễ hạn with font-mono tabular-nums */}
        <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted/30 p-1.5 border border-border/20 text-center">
          <div className="px-1 py-0.5">
            <div className="text-[10px] text-muted-foreground">Đang làm</div>
            <div className="text-xs font-bold font-mono tabular-nums text-foreground mt-0.5">
              {summary.metrics.inProgress}
            </div>
          </div>
          <div className="px-1 py-0.5 border-x border-border/30">
            <div className="text-[10px] text-muted-foreground">Sắp hạn</div>
            <div
              className={cn(
                "text-xs font-bold font-mono tabular-nums mt-0.5",
                summary.metrics.dueSoon > 0
                  ? "text-amber-600 dark:text-amber-400 font-extrabold"
                  : "text-foreground"
              )}
            >
              {summary.metrics.dueSoon}
            </div>
          </div>
          <div className="px-1 py-0.5">
            <div className="text-[10px] text-muted-foreground">Trễ hạn</div>
            <div
              className={cn(
                "text-xs font-bold font-mono tabular-nums mt-0.5",
                summary.metrics.overdue > 0
                  ? "text-rose-600 dark:text-rose-400 font-extrabold"
                  : "text-foreground"
              )}
            >
              {summary.metrics.overdue}
            </div>
          </div>
        </div>

        {/* 4. Action footer: Button "Soi chi tiết việc đơn vị" with ChevronRight (strokeWidth={1.5}) */}
        <div className="pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onSelectDepartment?.(summary.departmentId);
            }}
            className={cn(
              "w-full h-8 text-xs font-medium justify-between text-foreground border-border/60 transition-colors",
              isSelected
                ? "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
                : "hover:bg-accent hover:border-primary/40 group-hover:border-primary/50"
            )}
          >
            <span>Soi chi tiết việc đơn vị</span>
            <ChevronRight
              size={14}
              strokeWidth={1.5}
              className={cn(
                "transition-all",
                isSelected
                  ? "text-primary-foreground translate-x-0.5"
                  : "text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5"
              )}
            />
          </Button>
        </div>
      </div>
    </div>
  );
}

export interface DepartmentDrillDownPanelProps {
  summary: ExecutiveDepartmentSummary;
  onClose: () => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  referenceDate?: string;
}

/**
 * Inline Department Drill-Down Panel
 */
export function DepartmentDrillDownPanel({
  summary,
  onClose,
  onSelectTask,
}: DepartmentDrillDownPanelProps) {
  const [activeTab, setActiveTab] = React.useState<"SCHOOL" | "UNIT">("SCHOOL");
  const ragConfig = getRAGBadgeConfig(summary.ragStatus);
  const initials = getLeadershipInitials(summary.headOfDepartment.name);

  // Keyboard accessibility: Escape closes drill-down panel
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const { schoolTasks, unitTasks } = React.useMemo(() => {
    return splitDepartmentTasks(summary.tasks, summary);
  }, [summary]);

  const displayedTasks = activeTab === "SCHOOL" ? schoolTasks : unitTasks;

  return (
    <div
      id="department-drilldown-panel"
      data-slot="department-drilldown-panel"
      className="space-y-4 rounded-xl border border-primary/30 bg-card p-4 shadow-sm md:p-5 transition-all duration-200"
    >
      {/* 1. Header: Department title, Head of Department badge, and Collapse button */}
      <div className="flex flex-col gap-3 border-b border-border/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary border border-primary/20 mt-0.5">
            <Building2 size={20} strokeWidth={1.5} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-muted-foreground">
                {summary.departmentCode}
              </span>
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.2 text-[10px] font-mono font-semibold",
                  ragConfig.className
                )}
              >
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    ragConfig.dotColor,
                    ragConfig.pulse && "animate-pulse"
                  )}
                />
                {ragConfig.label}
              </span>
            </div>
            <h3 className="text-base font-bold uppercase tracking-wide text-foreground">
              {summary.departmentName}
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-center">
          {/* Head of Department badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs">
            <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-mono text-[10px] font-bold">
              {initials}
            </div>
            <span className="font-semibold text-foreground">
              {summary.headOfDepartment.name}
            </span>
            <span className="text-muted-foreground">•</span>
            <span className="text-muted-foreground">
              {summary.headOfDepartment.title}
            </span>
          </div>

          {/* Button: "Thu gọn / Quay lại toàn trường" */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="h-8 gap-1.5 text-xs font-medium cursor-pointer border-border/60 hover:bg-accent hover:text-foreground"
          >
            <ChevronUp size={14} strokeWidth={1.5} />
            <span>Thu gọn / Quay lại toàn trường</span>
          </Button>

          {/* Quick close X button */}
          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng bảng chi tiết"
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
          >
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* 2. Summary Metric pill row for this department */}
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs border border-border/40">
          <span className="text-muted-foreground">Tổng số:</span>
          <span className="font-mono tabular-nums font-bold text-foreground">
            {summary.metrics.totalTasks}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 text-xs border border-sky-200 dark:border-sky-900/60 text-sky-800 dark:text-sky-300">
          <span>Đang làm:</span>
          <span className="font-mono tabular-nums font-bold">
            {summary.metrics.inProgress}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 text-xs border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-300">
          <span>Hoàn thành:</span>
          <span className="font-mono tabular-nums font-bold">
            {summary.metrics.completed}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 px-2.5 py-1 text-xs border border-amber-200 dark:border-amber-900/60 text-amber-800 dark:text-amber-300">
          <span>Sắp hạn:</span>
          <span className="font-mono tabular-nums font-bold">
            {summary.metrics.dueSoon}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1 text-xs border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-300">
          <span>Trễ hạn:</span>
          <span className="font-mono tabular-nums font-bold">
            {summary.metrics.overdue}
          </span>
        </div>
        <div className="inline-flex items-center gap-1.5 rounded-md bg-muted/50 px-2.5 py-1 text-xs border border-border/40">
          <span className="text-muted-foreground">Tiến độ chung:</span>
          <span className="font-mono tabular-nums font-bold text-foreground">
            {summary.metrics.completionRate}%
          </span>
        </div>
        {summary.pendingApprovalCount > 0 && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-purple-50 dark:bg-purple-950/40 px-2.5 py-1 text-xs border border-purple-200 dark:border-purple-900/60 text-purple-800 dark:text-purple-300">
            <span>Chờ BGH duyệt:</span>
            <span className="font-mono tabular-nums font-bold">
              {summary.pendingApprovalCount}
            </span>
          </div>
        )}
      </div>

      {/* 3. Two sub-sections / tabs: Cấp Trường vs Nội bộ */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab("SCHOOL")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "SCHOOL"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 size={14} strokeWidth={1.5} className="text-primary" />
            <span>Nhiệm vụ Cấp Trường giao cho Đơn vị</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[11px] tabular-nums text-foreground border border-border/40">
              {schoolTasks.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("UNIT")}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeTab === "UNIT"
                ? "bg-background text-foreground shadow-xs border border-border/80"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers size={14} strokeWidth={1.5} className="text-primary" />
            <span>Nhiệm vụ Nội bộ Đơn vị triển khai</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[11px] tabular-nums text-foreground border border-border/40">
              {unitTasks.length}
            </span>
          </button>
        </div>

        {/* Task list rows */}
        {displayedTasks.length > 0 ? (
          <div className="space-y-2">
            {displayedTasks.map((task) => {
              const categoryLabel = getTaskCategoryLabel(task);
              const statusConfig = getTaskStatusConfig(task.status);
              const progress = getTaskProgress(task);
              const assignee = getTaskAssigneeName(task);

              return (
                <div
                  key={task.id}
                  data-slot="drilldown-task-row"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      onSelectTask?.(task);
                    }
                  }}
                  onClick={() => onSelectTask?.(task)}
                  className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-border/40 bg-card p-3 transition-colors hover:border-border/80 hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 cursor-pointer"
                >
                  {/* Left Info */}
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center rounded border border-border/50 bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                        {categoryLabel}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full border px-2 py-0.2 text-[10px] font-medium font-mono",
                          statusConfig.className
                        )}
                      >
                        {statusConfig.label}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                        <Calendar size={12} strokeWidth={1.5} />
                        <span className="font-mono tabular-nums">
                          Hạn: {formatDeadlineDisplay(task.dueDate)}
                        </span>
                      </span>
                      {assignee && (
                        <span className="text-[11px] text-muted-foreground truncate max-w-[160px]">
                          • {assignee}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
                      {task.title}
                    </h4>
                  </div>

                  {/* Right Info: Progress bar & Action */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2 min-w-[120px] max-w-[150px]">
                      <div className="h-1.5 w-20 sm:w-24 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full transition-all duration-300",
                            progress >= 80
                              ? "bg-emerald-500"
                              : progress >= 50
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          )}
                          style={{
                            width: `${Math.min(100, Math.max(0, progress))}%`,
                          }}
                        />
                      </div>
                      <span className="font-mono tabular-nums text-xs font-semibold text-foreground w-9 text-right">
                        {progress}%
                      </span>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTask?.(task);
                      }}
                      className="h-7 px-2.5 text-xs font-medium cursor-pointer border-border/60 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shrink-0"
                    >
                      <span>Chi tiết</span>
                      <ArrowUpRight
                        size={12}
                        strokeWidth={1.5}
                        className="ml-1"
                      />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 py-8 text-center bg-muted/20">
            <Building2
              size={24}
              strokeWidth={1.5}
              className="text-muted-foreground/60 mb-2"
            />
            <p className="text-xs font-medium text-muted-foreground">
              {activeTab === "SCHOOL"
                ? "Đơn vị chưa có nhiệm vụ cấp trường được giao."
                : "Chưa có nhiệm vụ nội bộ được tạo cho đơn vị này."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * ExecutiveDepartmentCommandCenter Component
 */
export function ExecutiveDepartmentCommandCenter({
  tasks,
  onSelectTask,
  onSelectDepartment,
  selectedDepartmentId,
  className,
  referenceDate = "2026-09-06",
}: ExecutiveDepartmentCommandCenterProps) {
  const [activeFilter, setActiveFilter] =
    React.useState<ExecutiveTriageFilter>("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [internalSelectedDeptId, setInternalSelectedDeptId] =
    React.useState<string | null>(null);

  const activeDeptId =
    selectedDepartmentId !== undefined
      ? selectedDepartmentId
      : internalSelectedDeptId;

  const drillDownRef = React.useRef<HTMLDivElement | null>(null);

  const handleSelectDepartment = React.useCallback(
    (deptId: string | null) => {
      if (selectedDepartmentId === undefined) {
        setInternalSelectedDeptId(deptId);
      }
      onSelectDepartment?.(deptId);
    },
    [selectedDepartmentId, onSelectDepartment]
  );

  // Aggregate 12 departments
  const allSummaries = React.useMemo(() => {
    return computeExecutiveDepartmentSummaries(tasks, referenceDate);
  }, [tasks, referenceDate]);

  // Counts for triage tabs
  const triageCounts = React.useMemo(() => {
    return getTriageFilterCounts(allSummaries);
  }, [allSummaries]);

  // Filtered summaries
  const displayedSummaries = React.useMemo(() => {
    let filtered = filterExecutiveDepartmentSummaries(
      allSummaries,
      activeFilter
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter((s) => {
        const matchName = s.departmentName.toLowerCase().includes(q);
        const matchCode = s.departmentCode.toLowerCase().includes(q);
        const matchHead = s.headOfDepartment.name.toLowerCase().includes(q);
        const matchFocus = s.focusInitiative?.title.toLowerCase().includes(q);
        return matchName || matchCode || matchHead || matchFocus;
      });
    }

    return filtered;
  }, [allSummaries, activeFilter, searchQuery]);

  // Find currently selected department summary
  const selectedSummary = React.useMemo(() => {
    if (!activeDeptId) return null;
    return allSummaries.find((s) => s.departmentId === activeDeptId) || null;
  }, [allSummaries, activeDeptId]);

  // Smooth scroll to drill-down panel when opened
  React.useEffect(() => {
    if (activeDeptId && drillDownRef.current) {
      drillDownRef.current.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
    }
  }, [activeDeptId]);

  return (
    <div
      data-slot="executive-department-command-center"
      className={cn("space-y-4", className)}
    >
      {/* 1. Executive Quick Triage Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-card p-3 shadow-2xs sm:flex-row sm:items-center sm:justify-between">
        {/* 3 filter tabs: Tất cả đơn vị, Điểm nghẽn cần BGH chỉ đạo, Chờ BGH ký duyệt */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-lg bg-muted/60 border border-border/40">
          <button
            type="button"
            onClick={() => setActiveFilter("ALL")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeFilter === "ALL"
                ? "bg-background text-foreground shadow-xs border border-border/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 size={14} strokeWidth={1.5} className="text-primary" />
            <span>Tất cả đơn vị</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 font-mono text-[11px] tabular-nums text-foreground border border-border/40">
              {triageCounts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("BOTTLENECKS")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeFilter === "BOTTLENECKS"
                ? "bg-background text-rose-700 dark:text-rose-400 shadow-xs border border-rose-200 dark:border-rose-900/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <AlertTriangle
              size={14}
              strokeWidth={1.5}
              className={
                triageCounts.bottlenecks > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-muted-foreground"
              }
            />
            <span>Điểm nghẽn cần BGH chỉ đạo</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 font-mono text-[11px] tabular-nums border",
                triageCounts.bottlenecks > 0
                  ? "bg-rose-100/80 text-rose-800 border-rose-300 dark:bg-rose-950/80 dark:text-rose-300 dark:border-rose-800"
                  : "bg-muted text-muted-foreground border-border/40"
              )}
            >
              {triageCounts.bottlenecks}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveFilter("PENDING_APPROVAL")}
            className={cn(
              "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer",
              activeFilter === "PENDING_APPROVAL"
                ? "bg-background text-purple-700 dark:text-purple-400 shadow-xs border border-purple-200 dark:border-purple-900/60"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck
              size={14}
              strokeWidth={1.5}
              className={
                triageCounts.pendingApproval > 0
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-muted-foreground"
              }
            />
            <span>Chờ BGH ký duyệt</span>
            <span
              className={cn(
                "rounded-full px-1.5 py-0.2 font-mono text-[11px] tabular-nums border",
                triageCounts.pendingApproval > 0
                  ? "bg-purple-100/80 text-purple-800 border-purple-300 dark:bg-purple-950/80 dark:text-purple-300 dark:border-purple-800"
                  : "bg-muted text-muted-foreground border-border/40"
              )}
            >
              {triageCounts.pendingApproval}
            </span>
          </button>
        </div>

        {/* Quick Search inside command center */}
        <div className="relative min-w-[220px] max-w-xs">
          <Search
            size={14}
            strokeWidth={1.5}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo đơn vị, lãnh đạo, việc..."
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-3 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </div>

      {/* 2. Responsive Grid of 12 DepartmentCommandCard items */}
      {displayedSummaries.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedSummaries.map((summary) => (
            <DepartmentCommandCard
              key={summary.departmentId}
              summary={summary}
              isSelected={summary.departmentId === activeDeptId}
              onSelectDepartment={() =>
                handleSelectDepartment(summary.departmentId)
              }
              onSelectTask={onSelectTask}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-12 text-center bg-card">
          <Building2
            size={32}
            strokeWidth={1.5}
            className="text-muted-foreground/60 mb-2"
          />
          <h4 className="text-sm font-semibold text-foreground">
            Không tìm thấy đơn vị phù hợp
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Không có Khoa/Phòng nào thỏa mãn điều kiện lọc hiện tại. Thử chuyển
            về lăng kính "Tất cả đơn vị" hoặc xóa từ khóa tìm kiếm.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setActiveFilter("ALL");
              setSearchQuery("");
            }}
            className="mt-4 h-8 text-xs font-mono"
          >
            Đặt lại bộ lọc
          </Button>
        </div>
      )}

      {/* 3. Inline Department Drill-Down Panel */}
      {selectedSummary && (
        <div ref={drillDownRef} className="mt-4 animate-in fade-in-50 duration-200">
          <DepartmentDrillDownPanel
            summary={selectedSummary}
            onClose={() => handleSelectDepartment(null)}
            onSelectTask={onSelectTask}
            referenceDate={referenceDate}
          />
        </div>
      )}
    </div>
  );
}
