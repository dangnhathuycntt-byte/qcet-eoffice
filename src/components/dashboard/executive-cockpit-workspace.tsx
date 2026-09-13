"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  Send,
  ShieldAlert,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
} from "@/types/workspace";
import { isTaskPastDue, TODAY_ISO } from "@/lib/unified-task-hub";
import { computeDashboardStats } from "@/lib/dashboard-aggregator";
import {
  ExecutiveStatStrip,
  type WorkboxFilter,
} from "@/components/dashboard/executive-stat-strip";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import {
  UpcomingDeadlinesWidget,
  type UpcomingItem,
} from "@/components/dashboard/upcoming-deadlines-widget";
import {
  ActivityFeedWidget,
  type ActivityEvent,
} from "@/components/dashboard/activity-feed-widget";
import { computeDepartmentHealthMatrix } from "@/lib/executive-matrix-aggregator";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Forward pure calculation helpers and legacy types for backwards compatibility
export {
  calculateDepartmentHealth,
  calculateHealth,
  computeExecutiveCockpitMetrics,
  computeElevenDepartmentRadar,
  extractSchoolBottlenecks,
  extractInstitutionalApprovalQueue,
  type ExecutiveCockpitMetrics,
  type ElevenDepartmentRadarItem,
  type SchoolBottleneckItem,
  type InstitutionalApprovalItem,
  type ExecutiveCockpitTab,
} from "../portal/executive-cockpit-workspace";

// ============================================================================
// 1. Attention Queue Types & Builders
// ============================================================================

export type AttentionItemType =
  | "APPROVAL"
  | "BLOCKED"
  | "OVERDUE"
  | "STRATEGIC_RISK";

export interface ExecutiveAttentionItem {
  id: string;
  code?: string;
  title: string;
  departmentCode: string;
  departmentName: string;
  assigneeName?: string;
  dueDate: string;
  progressPercent: number;
  type: AttentionItemType;
  typeLabel: string;
  badgeVariant: "destructive" | "warning" | "default" | "secondary";
  tasksUrl: string;
  rawTask: SchoolTask | StaffTask;
}

/**
 * Extracts the top 5–7 critical items requiring executive decision/action.
 * Priority:
 * 1. Pending approval (requires executive sign-off / review)
 * 2. Blocked tasks
 * 3. Overdue tasks
 * 4. High-priority strategic tasks at risk
 */
export function buildExecutiveAttentionQueue(
  tasks: SchoolTask[] = [],
  referenceDate: string = TODAY_ISO,
  limit: number = 7
): ExecutiveAttentionItem[] {
  const items: ExecutiveAttentionItem[] = [];
  const seenIds = new Set<string>();

  // 1. Approvals requiring executive attention
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const isApprovalPending =
      task.status === "PENDING_EXECUTIVE_APPROVAL" ||
      task.status === "WAITING_APPROVAL" ||
      (task.status as string) === "NEEDS_REVIEW" ||
      task.progressPercent === 100;

    if (isApprovalPending && !seenIds.has(task.id)) {
      seenIds.add(task.id);
      items.push({
        id: task.id,
        code: task.code,
        title: task.title,
        departmentCode: task.departmentId || "UNASSIGNED",
        departmentName: task.departmentName || task.departmentId || "Toàn trường",
        assigneeName: (task as unknown as { assigneeName?: string }).assigneeName || task.leadAssigneeName,
        dueDate: task.dueDate,
        progressPercent: task.progressPercent,
        type: "APPROVAL",
        typeLabel: "Chờ duyệt hoàn thành",
        badgeVariant: "default",
        tasksUrl: `/tasks?taskId=${encodeURIComponent(task.id)}`,
        rawTask: task,
      });
    }
  }

  // 2. Blocked tasks
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const isBlocked = (task.status as string) === "BLOCKED";
    if (isBlocked && !seenIds.has(task.id)) {
      seenIds.add(task.id);
      items.push({
        id: task.id,
        code: task.code,
        title: task.title,
        departmentCode: task.departmentId || "UNASSIGNED",
        departmentName: task.departmentName || task.departmentId || "Toàn trường",
        assigneeName: (task as unknown as { assigneeName?: string }).assigneeName || task.leadAssigneeName,
        dueDate: task.dueDate,
        progressPercent: task.progressPercent,
        type: "BLOCKED",
        typeLabel: "Bị nghẽn / tạm dừng",
        badgeVariant: "destructive",
        tasksUrl: `/tasks?taskId=${encodeURIComponent(task.id)}`,
        rawTask: task,
      });
    }
  }

  // 3. Overdue tasks
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const isOverdue = isTaskPastDue(task.dueDate, referenceDate);
    if (isOverdue && !seenIds.has(task.id)) {
      seenIds.add(task.id);
      items.push({
        id: task.id,
        code: task.code,
        title: task.title,
        departmentCode: task.departmentId || "UNASSIGNED",
        departmentName: task.departmentName || task.departmentId || "Toàn trường",
        assigneeName: (task as unknown as { assigneeName?: string }).assigneeName || task.leadAssigneeName,
        dueDate: task.dueDate,
        progressPercent: task.progressPercent,
        type: "OVERDUE",
        typeLabel: "Quá hạn thực hiện",
        badgeVariant: "warning",
        tasksUrl: `/tasks?taskId=${encodeURIComponent(task.id)}`,
        rawTask: task,
      });
    }
  }

  // 4. Subtasks awaiting review or overdue
  for (const task of tasks) {
    for (const sub of task.subTasks || []) {
      if (sub.status === "COMPLETED") continue;
      const isSubApproval =
        sub.status === "NEEDS_REVIEW" ||
        sub.requiresReview === true ||
        (sub.status as string) === "PENDING";
      const isSubOverdue = isTaskPastDue(sub.dueDate, referenceDate);
      const isSubBlocked = (sub.status as string) === "BLOCKED";

      if ((isSubApproval || isSubBlocked || isSubOverdue) && !seenIds.has(sub.id)) {
        seenIds.add(sub.id);
        const subType: AttentionItemType = isSubApproval
          ? "APPROVAL"
          : isSubBlocked
          ? "BLOCKED"
          : "OVERDUE";
        const subLabel = isSubApproval
          ? "Minh chứng chờ duyệt"
          : isSubBlocked
          ? "Tiểu tác vụ bị tắc"
          : "Tiểu tác vụ trễ hạn";

        items.push({
          id: sub.id,
          title: `${task.title}: ${sub.title}`,
          departmentCode: sub.departmentId || task.departmentId || "UNASSIGNED",
          departmentName: task.departmentName || task.departmentId || "Toàn trường",
          assigneeName: sub.assigneeName,
          dueDate: sub.dueDate,
          progressPercent: sub.progressPercent ?? 0,
          type: subType,
          typeLabel: subLabel,
          badgeVariant: isSubBlocked ? "destructive" : isSubApproval ? "default" : "warning",
          tasksUrl: `/tasks?taskId=${encodeURIComponent(task.id)}`,
          rawTask: sub,
        });
      }
    }
  }

  return items.slice(0, limit);
}

// ============================================================================
// 2. Attention Queue Component
// ============================================================================

export interface ExecutiveAttentionQueueProps {
  items: ExecutiveAttentionItem[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onQuickApprove?: (task: SchoolTask | StaffTask) => void;
  onSendReminder?: (deptCode: string, taskTitle: string) => void;
  className?: string;
}

export function ExecutiveAttentionQueue({
  items,
  onSelectTask,
  onQuickApprove,
  onSendReminder,
  className,
}: ExecutiveAttentionQueueProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/80 bg-card p-4 shadow-xs flex flex-col justify-between",
        className
      )}
      data-slot="executive-attention-queue"
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-border/50">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-700">
            <ShieldAlert size={16} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold text-foreground tracking-tight">
                Hàng đợi cần BGH xử lý
              </h2>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 tabular-nums">
                {items.length}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Các phê duyệt cấp trường và điểm nghẽn ưu tiên cao nhất
            </p>
          </div>
        </div>
        {/* `status` is a query key the /tasks parser really consumes; the previous
            `filter=pending` was silently ignored and led nowhere (plan T08.1). */}
        <Link
          href="/tasks?scope=school&status=PENDING_EXECUTIVE_APPROVAL"
          className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1 shrink-0"
        >
          <span>Xem tất cả</span>
          <ArrowRight size={12} strokeWidth={1.5} />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex items-center gap-3 p-3.5 my-2 rounded-xl border border-emerald-500/20 bg-emerald-50/40 text-xs">
          <CheckCircle2 size={16} strokeWidth={1.5} className="text-emerald-600 shrink-0" />
          <div className="min-w-0">
            <span className="font-semibold text-foreground">Tiến độ toàn trường thông suốt. </span>
            <span className="text-muted-foreground">
              Không có điểm nghẽn hay yêu cầu phê duyệt nào tồn đọng tại cấp Ban Giám hiệu.
            </span>
          </div>
        </div>
      ) : (
        <div className="divide-y divide-border/40 overflow-y-auto max-h-[360px] pr-1 mt-2 space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className="py-2.5 px-2 hover:bg-muted/40 rounded-xl transition-colors flex items-center justify-between gap-3 group"
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={
                      item.badgeVariant === "destructive"
                        ? "destructive"
                        : item.badgeVariant === "warning"
                        ? "outline"
                        : "secondary"
                    }
                    className={cn(
                      "text-xs px-1.5 py-0 font-medium",
                      item.badgeVariant === "warning" &&
                        "border-amber-500/50 bg-amber-50 text-amber-900"
                    )}
                  >
                    {item.typeLabel}
                  </Badge>
                  <span className="text-xs font-medium text-muted-foreground">
                    {item.departmentName}
                  </span>
                  {item.code && (
                    <span className="text-xs font-mono text-muted-foreground/70">
                      {item.code}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <Link
                    href={item.tasksUrl}
                    className="text-xs font-semibold text-foreground hover:text-primary line-clamp-1 group-hover:underline text-left"
                    onClick={(e) => {
                      if (onSelectTask) {
                        e.preventDefault();
                        onSelectTask(item.rawTask);
                      }
                    }}
                  >
                    {item.title}
                  </Link>
                </div>

                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Clock size={12} />
                    <span>Hạn: {item.dueDate}</span>
                  </span>
                  {item.assigneeName && (
                    <span>Chủ trì: {item.assigneeName}</span>
                  )}
                  <span className="tabular-nums font-medium text-foreground">
                    {item.progressPercent}%
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                {item.type === "APPROVAL" && onQuickApprove && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300"
                    onClick={() => onQuickApprove(item.rawTask)}
                  >
                    <FileCheck size={12} className="mr-1" />
                    Duyệt
                  </Button>
                )}

                {item.type !== "APPROVAL" && onSendReminder && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs font-medium text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-amber-300"
                    onClick={() => onSendReminder(item.departmentCode, item.title)}
                  >
                    <Send size={12} className="mr-1" />
                    Đôn đốc
                  </Button>
                )}

                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
                  asChild
                >
                  <Link href={item.tasksUrl} title="Mở chi tiết tại /tasks">
                    <ExternalLink size={14} />
                  </Link>
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 3. Streamlined Executive Cockpit Workspace
// ============================================================================

export interface ExecutiveCockpitWorkspaceProps {
  user: AuthUser;
  tasks?: SchoolTask[];
  staffTasks?: StaffTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (payload: DeliverableSubmissionPayload) => Promise<void> | void;
  onCreateDirective?: () => void;
  onSendReminder?: (deptCode: string, reason?: string) => void;
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
  referenceDate?: string;
  tasksUrl?: string;
  className?: string;
}

const EMPTY_TASKS: SchoolTask[] = [];
const EMPTY_STAFF_TASKS: StaffTask[] = [];

export function ExecutiveCockpitWorkspace({
  user,
  tasks = EMPTY_TASKS,
  staffTasks = EMPTY_STAFF_TASKS,
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onCreateDirective,
  onSendReminder,
  onStatusChange,
  referenceDate = TODAY_ISO,
  tasksUrl = "/tasks",
  className,
}: ExecutiveCockpitWorkspaceProps) {
  // 1. Build stats for single 5-KPI strip
  const [activeFilter, setActiveFilter] = React.useState<WorkboxFilter>("ALL");

  const dashboardStats = React.useMemo(() => {
    return computeDashboardStats(tasks, referenceDate);
  }, [tasks, referenceDate]);

  // 2. Build 5-7 item attention queue
  const attentionItems = React.useMemo(() => {
    return buildExecutiveAttentionQueue(tasks, referenceDate, 7);
  }, [tasks, referenceDate]);

  // 3. Department progress matrix data
  const departmentHealth = React.useMemo(() => {
    return computeDepartmentHealthMatrix(tasks, referenceDate);
  }, [tasks, referenceDate]);

  // 4. Upcoming deadlines (top 5)
  const upcomingDeadlines = React.useMemo<UpcomingItem[]>(() => {
    const active = tasks.filter((t) => t.status !== "COMPLETED");
    const sorted = [...active].sort(
      (a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
    );
    return sorted.slice(0, 5).map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate,
      department: t.departmentName || t.departmentId || "Toàn trường",
      level: "Trường" as const,
      assigneeName: (t as unknown as { assigneeName?: string }).assigneeName || t.leadAssigneeName,
      priority: t.priority,
      status: t.status,
    }));
  }, [tasks]);

  // 5. Activity log (top 5 recent items)
  const activities = React.useMemo<ActivityEvent[]>(() => {
    return tasks.slice(0, 5).map((t, idx) => ({
      id: `act-${t.id}-${idx}`,
      actorName: (t as unknown as { assigneeName?: string }).assigneeName || t.leadAssigneeName || "Cán bộ phụ trách",
      targetTitle: t.title,
      action: t.status === "COMPLETED" ? "Đã hoàn thành nghiệm thu" : "Cập nhật tiến độ điều hành",
      timestamp: t.updatedAt || t.createdAt || "Gần đây",
      category: t.category,
      type: t.status === "COMPLETED" ? ("approval" as const) : ("update" as const),
    }));
  }, [tasks]);

  const handleQuickApprove = (task: SchoolTask | StaffTask) => {
    if (onReview) {
      onReview({
        taskId: task.id,
        decision: "approved",
        comment: "Ban Giám hiệu phê duyệt từ Hàng đợi xử lý nhanh.",
        reviewedByRole: "ADMIN",
        reviewedByName: user.name,
      });
    } else if (onStatusChange) {
      onStatusChange(task.id, "COMPLETED");
    }
  };

  const handleSendReminder = (deptCode: string, taskTitle: string) => {
    if (onSendReminder) {
      onSendReminder(deptCode, `Đôn đốc khẩn cấp từ BGH: ${taskTitle}`);
    }
  };

  return (
    <div
      className={cn("space-y-4 max-w-7xl mx-auto", className)}
      data-slot="executive-cockpit-workspace"
    >
      {/* 1. Single 5-KPI Strip */}
      <section aria-label="Chỉ số điều hành toàn trường">
        <ExecutiveStatStrip
          stats={dashboardStats}
          isExecutive={true}
          activeFilter={activeFilter}
          onFilterChange={setActiveFilter}
        />
      </section>

      {/* 2. Main Executive Grid: Attention Queue (7 cols) + Unit Ranking (5 cols) */}
      <section
        aria-label="Khu vực điều hành trọng tâm"
        className="grid grid-cols-1 lg:grid-cols-12 gap-4"
      >
        <div className="lg:col-span-7">
          <ExecutiveAttentionQueue
            items={attentionItems}
            onSelectTask={onSelectTask}
            onQuickApprove={handleQuickApprove}
            onSendReminder={handleSendReminder}
            className="h-full"
          />
        </div>

        <div className="lg:col-span-5">
          <DepartmentProgressMatrix
            departments={departmentHealth}
            defaultViewMode="ranking"
            navigateToTasks
          />
        </div>
      </section>

      {/* 3. Compact Bottom Widgets: Upcoming Deadlines (6 cols) & Activity Feed (6 cols) */}
      <section
        aria-label="Tiện ích tiến độ và nhật ký"
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <UpcomingDeadlinesWidget
          items={upcomingDeadlines}
          initialLimit={5}
          onSelectTask={(task) => {
            const found = tasks.find((t) => t.id === task.id);
            if (found && onSelectTask) onSelectTask(found);
          }}
        />
        <ActivityFeedWidget
          activities={activities}
          initialLimit={5}
        />
      </section>
    </div>
  );
}

export const ExecutiveWorkspace = ExecutiveCockpitWorkspace;
export default ExecutiveCockpitWorkspace;
