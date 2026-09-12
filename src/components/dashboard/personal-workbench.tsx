"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  RefreshCw,
  Users,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, DashboardStats } from "@/types/dashboard";
import type { ExecutiveActionStats } from "@/lib/executive-matrix-aggregator";
import type { AuthUser } from "@/types/auth";
import type { WorkspaceScope } from "@/types/workspace";
import { getSystemReferenceDateStr, isTaskPastDue } from "@/lib/unified-task-hub";
import {
  isActiveTaskStatus,
  isTaskAssignedToUser,
  isTaskAssignedToUserOrUnit,
  isTaskOverdueOrHasOverdueSubtask,
  isTaskWaitingApproval,
} from "@/lib/workspace-metrics-aggregator";
import { matchesUser } from "@/lib/role-task-filter";
import { SmartWorkbox } from "@/components/workspace/smart-workbox";
import { ScopeSwitcher } from "@/components/layout/scope-switcher";
import { GlobalMonthSelector } from "@/components/layout/global-month-selector";
import { UpcomingDeadlinesWidget, type UpcomingItem } from "@/components/dashboard/upcoming-deadlines-widget";
import { ActivityFeedWidget, type ActivityEvent } from "@/components/dashboard/activity-feed-widget";
import { DepartmentProgressMatrix, type DepartmentHealthSummary } from "@/components/dashboard/department-progress-matrix";
import { QCET_DEPARTMENTS } from "@/components/org/organization-tree";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types & Contracts
// ============================================================================

export type WorkbenchRole = "STAFF" | "MANAGER" | "EXECUTIVE";

export type AttentionActionType = "APPROVAL" | "SUBMIT" | "OVERDUE" | "TODAY" | "FOCUS";

export interface AttentionQueueItem {
  id: string;
  code?: string;
  title: string;
  departmentCode?: string;
  departmentName?: string;
  assigneeName?: string;
  dueDate?: string;
  isOverdue: boolean;
  progressPercent: number;
  priority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  status: TaskStatus | string;
  statusLabel: string;
  actionType: AttentionActionType;
  actionLabel: string;
  actionBadgeVariant: "destructive" | "warning" | "default" | "secondary";
  targetUrl: string;
  rawTask: SchoolTask | StaffTask;
}

export interface StaffWorkloadItem {
  name: string;
  totalTasks: number;
  inProgressTasks: number;
  completedTasks: number;
  overdueTasks: number;
  progressPercent: number;
}

export interface PersonalWorkbenchProps {
  tasks?: SchoolTask[];
  filteredTasks?: SchoolTask[];
  user?: AuthUser | null;
  role?: WorkbenchRole;
  isExecutive?: boolean;
  isManager?: boolean;
  isStaff?: boolean;
  executiveStats?: ExecutiveActionStats | null;
  departmentHealth?: DepartmentHealthSummary[];
  upcomingItems?: UpcomingItem[];
  activities?: ActivityEvent[];
  referenceDate?: string;
  isRefreshing?: boolean;
  onRefresh?: () => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  hideHeader?: boolean;
  /** When true: render ONLY the attention queue (ACTION surface). Omits SmartWorkbox and context widgets. */
  attentionOnly?: boolean;
  className?: string;
}

// ============================================================================
// Pure Calculation Helpers
// ============================================================================

/**
 * Pure builder function extracting the top 5–7 attention items adapted by role.
 * Standardizes the "What needs my attention?" model (aligned with Linear / Plane 'Your Work').
 * Role ONLY changes priority, order, and data — not the underlying UI card architecture.
 */
export function buildRoleAttentionQueue({
  tasks = [],
  user,
  role = "STAFF",
  referenceDate = getSystemReferenceDateStr(),
  limit = 7,
}: {
  tasks?: SchoolTask[];
  user?: AuthUser | null;
  role?: WorkbenchRole;
  referenceDate?: string;
  limit?: number;
}): AttentionQueueItem[] {
  const userDept = user?.departmentCode || user?.department || "";
  const items: AttentionQueueItem[] = [];
  const seenIds = new Set<string>();

  const toQueueItem = (
    t: SchoolTask,
    actionType: AttentionActionType,
    actionLabel: string,
    actionBadgeVariant: "destructive" | "warning" | "default" | "secondary"
  ): AttentionQueueItem => ({
    id: t.id,
    code: t.code,
    title: t.title,
    departmentCode: t.departmentCode,
    departmentName: t.department,
    assigneeName: t.leadAssigneeName || t.assignedTo || "Chưa phân công",
    dueDate: t.dueDate,
    isOverdue: Boolean(t.dueDate && isTaskPastDue(t.dueDate, referenceDate)),
    progressPercent: t.progressPercent ?? 0,
    priority: t.priority ?? "NORMAL",
    status: t.status,
    statusLabel:
      t.status === "WAITING_APPROVAL"
        ? "Chờ duyệt L1"
        : t.status === "PENDING_EXECUTIVE_APPROVAL"
        ? "Chờ duyệt L2"
        : t.status === "IN_PROGRESS"
        ? "Đang làm"
        : t.status === "COMPLETED"
        ? "Hoàn thành"
        : "Cần xử lý",
    actionType,
    actionLabel,
    actionBadgeVariant,
    targetUrl: `/tasks?taskId=${encodeURIComponent(t.id)}`,
    rawTask: t,
  });

  if (role === "STAFF") {
    // ------------------------------------------------------------------------
    // Staff Priorities:
    // 1. Overdue personal tasks (highest urgency)
    // 2. Tasks due today
    // 3. My submissions awaiting supervisor review
    // 4. In-progress personal tasks due soonest
    // ------------------------------------------------------------------------
    const userTasks = tasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      if (!user) return true;
      return isTaskAssignedToUser(t, user);
    });

    // 1. Overdue
    for (const t of userTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskOverdueOrHasOverdueSubtask(t, referenceDate)) {
        items.push(toQueueItem(t, "OVERDUE", "Quá hạn", "destructive"));
        seenIds.add(t.id);
      }
    }

    // 2. Due today
    for (const t of userTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (t.dueDate && t.dueDate.startsWith(referenceDate)) {
        items.push(toQueueItem(t, "TODAY", "Hôm nay", "warning"));
        seenIds.add(t.id);
      }
    }

    // 3. Submissions awaiting review
    for (const t of userTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskWaitingApproval(t.status)) {
        items.push(toQueueItem(t, "APPROVAL", "Đã nộp chờ duyệt", "secondary"));
        seenIds.add(t.id);
      }
    }

    // 4. In-progress active tasks
    for (const t of userTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isActiveTaskStatus(t.status)) {
        items.push(toQueueItem(t, "SUBMIT", "Đang thực hiện", "default"));
        seenIds.add(t.id);
      }
    }
  } else if (role === "MANAGER") {
    // ------------------------------------------------------------------------
    // Manager Priorities:
    // 1. Pending unit approvals (L1 sign-off needed from manager)
    // 2. Overdue unit tasks & at-risk tasks
    // 3. Urgent / high priority unit deliverables
    // 4. Active unit tasks
    // ------------------------------------------------------------------------
    const unitTasks = tasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      if (!userDept) return true;
      return (
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      );
    });

    // 1. Pending unit approvals (L1)
    for (const t of unitTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskWaitingApproval(t.status)) {
        items.push(toQueueItem(t, "APPROVAL", "Chờ duyệt L1", "warning"));
        seenIds.add(t.id);
      }
    }

    // 2. Overdue unit tasks
    for (const t of unitTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskOverdueOrHasOverdueSubtask(t, referenceDate)) {
        items.push(toQueueItem(t, "OVERDUE", "Quá hạn", "destructive"));
        seenIds.add(t.id);
      }
    }

    // 3. Urgent / High priority
    for (const t of unitTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (t.priority === "URGENT" || t.priority === "HIGH") {
        items.push(toQueueItem(t, "FOCUS", "Trọng tâm", "destructive"));
        seenIds.add(t.id);
      }
    }

    // 4. Active tasks
    for (const t of unitTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isActiveTaskStatus(t.status)) {
        items.push(toQueueItem(t, "SUBMIT", "Đang tiến hành", "default"));
        seenIds.add(t.id);
      }
    }
  } else {
    // ------------------------------------------------------------------------
    // Executive (BGH) Priorities:
    // 1. School-wide approvals (L2 sign-off from Board of Rectors)
    // 2. Strategic roadblocks & overdue school tasks
    // 3. Key institutional focus tasks
    // 4. General active tasks
    // ------------------------------------------------------------------------
    const schoolTasks = tasks.filter((t) => t.status !== "COMPLETED");

    // 1. Executive approvals (L2 sign-off)
    for (const t of schoolTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (
        t.status === "PENDING_EXECUTIVE_APPROVAL" ||
        isTaskWaitingApproval(t.status)
      ) {
        items.push(toQueueItem(t, "APPROVAL", "Chờ ký duyệt L2", "warning"));
        seenIds.add(t.id);
      }
    }

    // 2. Strategic roadblocks & overdue
    for (const t of schoolTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskOverdueOrHasOverdueSubtask(t, referenceDate)) {
        items.push(toQueueItem(t, "OVERDUE", "Điểm nghẽn", "destructive"));
        seenIds.add(t.id);
      }
    }

    // 3. Urgent / Focus tasks
    for (const t of schoolTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (t.priority === "URGENT") {
        items.push(toQueueItem(t, "FOCUS", "Trọng tâm", "destructive"));
        seenIds.add(t.id);
      }
    }

    // 4. Other active school tasks
    for (const t of schoolTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isActiveTaskStatus(t.status)) {
        items.push(toQueueItem(t, "SUBMIT", "Đang tiến hành", "default"));
        seenIds.add(t.id);
      }
    }
  }

  return items;
}

/**
 * Pure builder function computing staff workload distribution for a department.
 */
export function computeStaffWorkloadDistribution({
  tasks = [],
  departmentCode,
  referenceDate = getSystemReferenceDateStr(),
}: {
  tasks?: SchoolTask[];
  departmentCode?: string;
  referenceDate?: string;
}): StaffWorkloadItem[] {
  const staffMap = new Map<
    string,
    {
      total: number;
      inProgress: number;
      completed: number;
      overdue: number;
      progressSum: number;
    }
  >();

  const deptTasks = tasks.filter((t) => {
    if (!departmentCode) return true;
    return t.departmentCode === departmentCode || t.department === departmentCode;
  });

  for (const t of deptTasks) {
    const assignee = t.leadAssigneeName || t.assignedTo;
    if (assignee && assignee.trim() !== "") {
      const entry = staffMap.get(assignee) || {
        total: 0,
        inProgress: 0,
        completed: 0,
        overdue: 0,
        progressSum: 0,
      };
      entry.total++;
      if (t.status === "COMPLETED") {
        entry.completed++;
      } else {
        if (isActiveTaskStatus(t.status)) entry.inProgress++;
        if (isTaskOverdueOrHasOverdueSubtask(t, referenceDate)) entry.overdue++;
      }
      entry.progressSum += t.progressPercent ?? 0;
      staffMap.set(assignee, entry);
    }
  }

  const result: StaffWorkloadItem[] = [];
  for (const [name, stats] of staffMap.entries()) {
    result.push({
      name,
      totalTasks: stats.total,
      inProgressTasks: stats.inProgress,
      completedTasks: stats.completed,
      overdueTasks: stats.overdue,
      progressPercent: stats.total > 0 ? Math.round(stats.progressSum / stats.total) : 0,
    });
  }

  // Sort: highest overdue first, then highest total tasks
  return result.sort((a, b) => b.overdueTasks - a.overdueTasks || b.totalTasks - a.totalTasks);
}

// ============================================================================
// React Subcomponents
// ============================================================================

function ManagerStaffWorkloadWidget({
  workload,
  departmentName,
}: {
  workload: StaffWorkloadItem[];
  departmentName?: string;
}) {
  return (
    <div
      data-slot="manager-staff-workload-widget"
      className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-3.5"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Users size={16} className="text-primary" strokeWidth={1.5} />
          <h3 className="text-sm font-semibold text-foreground tracking-tight">
            Phân bổ công việc nhân sự
          </h3>
        </div>
        <span className="text-xs text-muted-foreground font-medium truncate">
          {departmentName || "Đơn vị"}
        </span>
      </div>

      {workload.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3 text-center">
          Chưa có dữ liệu phân công công việc nhân sự đơn vị.
        </div>
      ) : (
        <div className="space-y-2.5">
          {workload.slice(0, 5).map((staff) => (
            <div
              key={staff.name}
              className="p-2.5 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/30 transition-colors text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-foreground truncate">{staff.name}</span>
                <div className="flex items-center gap-1.5 shrink-0 tabular-nums font-mono">
                  <span className="text-muted-foreground">{staff.totalTasks} việc</span>
                  {staff.overdueTasks > 0 && (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-800 font-medium">
                      {staff.overdueTasks} trễ
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      staff.overdueTasks > 0 ? "bg-rose-500" : "bg-primary"
                    )}
                    style={{ width: `${Math.min(100, staff.progressPercent)}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground font-mono tabular-nums shrink-0">
                  {staff.progressPercent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// Main Component: PersonalWorkbench
// ============================================================================

export function PersonalWorkbench({
  tasks = [],
  filteredTasks,
  user,
  role = "STAFF",
  isExecutive,
  isManager,
  isStaff,
  executiveStats,
  departmentHealth = [],
  upcomingItems = [],
  activities = [],
  referenceDate = getSystemReferenceDateStr(),
  isRefreshing,
  onRefresh,
  onSelectTask,
  hideHeader = false,
  attentionOnly = false,
  className,
}: PersonalWorkbenchProps) {
  // Infer active role
  const effectiveRole: WorkbenchRole = isExecutive
    ? "EXECUTIVE"
    : isManager
    ? "MANAGER"
    : role || (isStaff ? "STAFF" : "STAFF");

  const effectiveScope: WorkspaceScope =
    effectiveRole === "EXECUTIVE"
      ? "school"
      : effectiveRole === "MANAGER"
      ? "unit"
      : "my";

  const operationalUnitCount = QCET_DEPARTMENTS.filter((d) => d.category !== "BGH").length;

  // Role labels
  const roleBadge =
    effectiveRole === "EXECUTIVE"
      ? "Bàn làm việc Điều hành"
      : effectiveRole === "MANAGER"
      ? "Bàn làm việc Quản lý"
      : "Bàn làm việc Cá nhân";

  const roleTitle =
    effectiveRole === "EXECUTIVE"
      ? "Bàn làm việc Ban Giám hiệu"
      : effectiveRole === "MANAGER"
      ? `Bàn làm việc: ${user?.department || "Đơn vị"}`
      : `Bàn làm việc: ${user?.name || "Cán bộ / Giảng viên"}`;

  const roleSubtitle =
    effectiveRole === "EXECUTIVE"
      ? `Toàn cảnh tiến độ, điểm nghẽn và phê duyệt cấp trường của ${operationalUnitCount} đơn vị trực thuộc`
      : effectiveRole === "MANAGER"
      ? "Điều phối công việc đơn vị, thẩm định minh chứng L1 và kiểm soát tiến độ nhiệm vụ"
      : "Nhiệm vụ cá nhân hôm nay, việc chờ nộp minh chứng và lịch công tác cần xử lý";

  // Build role-adapted attention queue (capped at 7 to guarantee clean 1-2 viewport desktop height)
  const baseTasks = tasks.length > 0 ? tasks : filteredTasks || [];
  const attentionQueue = buildRoleAttentionQueue({
    tasks: baseTasks,
    user,
    role: effectiveRole,
    referenceDate,
    limit: 7,
  });

  const staffWorkload =
    effectiveRole === "MANAGER"
      ? computeStaffWorkloadDistribution({
          tasks: baseTasks,
          departmentCode: user?.departmentCode,
          referenceDate,
        })
      : [];

  const viewAllTasksUrl =
    effectiveRole === "EXECUTIVE"
      ? "/tasks?scope=school"
      : effectiveRole === "MANAGER"
      ? `/tasks?scope=unit${user?.departmentCode ? `&dept=${encodeURIComponent(user.departmentCode)}` : ""}`
      : "/tasks?scope=my";

  return (
    <div
      data-slot="personal-workbench"
      className={cn("space-y-6", className)}
      aria-label="Bàn làm việc cá nhân và điều hành theo vai trò"
    >
      {/* 1. Header & Contextual Greeting */}
      {!hideHeader && (
        <div className="space-y-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg font-sans font-medium text-xs bg-primary/10 text-primary border border-primary/20 shadow-2xs">
                {roleBadge}
              </span>
            </div>
            <h1 className="font-heading font-bold text-xl sm:text-2xl tracking-tight text-foreground">
              {roleTitle}
            </h1>
            <p className="text-xs text-muted-foreground mt-1 text-balance">
              {roleSubtitle}
            </p>
          </div>

          {/* Action Bar */}
          <div
            aria-label="Thanh tác vụ ngữ cảnh: Kỳ vận hành và Phạm vi"
            className="flex flex-wrap items-center justify-between gap-3 p-2 rounded-2xl bg-muted/30 border border-border/50"
          >
            <div className="flex flex-wrap items-center gap-2">
              <React.Suspense fallback={<div className="h-8 w-44 rounded-lg bg-muted/40 animate-pulse" />}>
                <ScopeSwitcher />
              </React.Suspense>
              <React.Suspense fallback={<div className="h-8 w-32 rounded-lg bg-muted/40 animate-pulse" />}>
                <GlobalMonthSelector />
              </React.Suspense>
            </div>
            {onRefresh && (
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="gap-1.5 text-xs rounded-xl min-h-[44px] sm:min-h-[36px] touch-manipulation"
                >
                  <RefreshCw size={14} className={isRefreshing ? "animate-spin text-primary" : ""} />
                  <span>Làm mới dữ liệu</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. Smart Workbox Quick Filters — omitted in attentionOnly mode */}
      {!attentionOnly && (
        <section aria-label="Hộp việc thông minh">
          <SmartWorkbox
            tasks={baseTasks}
            user={user}
            roleScope={effectiveScope}
            referenceDate={referenceDate}
          />
        </section>
      )}

      {/* 3. Attention Grid: full-width in attentionOnly, dual-column otherwise */}
      <div className={attentionOnly ? "" : "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"}>
        {/* Attention Queue Column */}
        <div className={attentionOnly ? "" : "lg:col-span-7 space-y-4"}>
          <div className="p-4 sm:p-5 rounded-2xl border border-border/80 bg-card shadow-2xs space-y-4" data-slot="action-surface">
            {/* Attention Stream Header */}
            <div className="flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-primary shrink-0" strokeWidth={1.5} />
                  <h2 className="font-heading font-semibold text-base text-foreground tracking-tight truncate">
                    CẦN XỬ LÝ
                  </h2>
                  <Badge variant="secondary" className="text-xs font-mono tabular-nums px-2 py-0">
                    {attentionQueue.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {effectiveRole === "EXECUTIVE"
                    ? "Hồ sơ chờ phê duyệt L2, điểm nghẽn chi���n lược và tiến độ toàn trường"
                    : effectiveRole === "MANAGER"
                    ? "Hồ sơ chờ duyệt cấp đơn vị L1, công việc trễ hạn và các nhiệm vụ trọng tâm"
                    : "Nhiệm vụ cá nhân hôm nay, việc chờ nộp minh chứng và hạn chót gần nhất"}
                </p>
              </div>

              <Link
                href={viewAllTasksUrl}
                className="shrink-0 text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 min-h-[44px] sm:min-h-[32px] items-center"
              >
                <span>Xem tất cả</span>
                <ArrowRight size={13} strokeWidth={1.5} />
              </Link>
            </div>

            {/* Attention Items List */}
            {attentionQueue.length === 0 ? (
              <div
                className="p-4 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground/80 flex items-center gap-3"
                data-slot="action-empty-state"
              >
                <CheckCircle2 size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="space-y-0.5">
                  <p className="font-semibold">Không có việc cần bạn xử lý</p>
                  <p className="text-muted-foreground">
                    Các hàng đợi hiện đã được giải quyết.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {attentionQueue.map((item) => (
                  <div
                    key={item.id}
                    data-slot="attention-queue-card"
                    className="p-3 sm:p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 hover:bg-muted/10 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant={item.actionBadgeVariant}
                          className={cn(
                            "text-xs font-sans font-medium px-2 py-0.5 rounded-md",
                            item.actionType === "APPROVAL"
                              ? "bg-amber-500/15 text-amber-900 border-amber-500/30"
                              : item.actionType === "OVERDUE"
                              ? "bg-rose-500/15 text-rose-900 border-rose-500/30"
                              : item.actionType === "TODAY"
                              ? "bg-blue-500/15 text-blue-900 border-blue-500/30"
                              : ""
                          )}
                        >
                          {item.actionLabel}
                        </Badge>
                        {item.priority === "URGENT" && (
                          <Badge variant="destructive" className="text-xs px-1.5 py-0">
                            Khẩn
                          </Badge>
                        )}
                        {item.departmentCode && effectiveRole !== "STAFF" && (
                          <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-1.5 py-0.5 rounded">
                            {item.departmentCode}
                          </span>
                        )}
                      </div>

                      {item.dueDate && (
                        <span
                          className={cn(
                            "text-xs font-mono tabular-nums shrink-0",
                            item.isOverdue ? "text-rose-700 font-semibold" : "text-muted-foreground"
                          )}
                        >
                          Hạn: {item.dueDate}
                          {item.isOverdue ? " (Trễ hạn)" : ""}
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <div>
                      <Link
                        href={item.targetUrl}
                        onClick={(e) => {
                          if (onSelectTask) {
                            e.preventDefault();
                            onSelectTask(item.rawTask);
                          }
                        }}
                        className="font-semibold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 group inline-flex items-center gap-1"
                      >
                        {item.code && <span className="font-mono text-muted-foreground">[{item.code}]</span>}
                        <span>{item.title}</span>
                        <ArrowUpRight
                          size={13}
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0"
                        />
                      </Link>
                    </div>

                    {/* Assignee & Progress */}
                    <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                      <span className="truncate">Chủ trì: {item.assigneeName}</span>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={cn(
                              "h-full rounded-full transition-all",
                              item.isOverdue ? "bg-rose-500" : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                          />
                        </div>
                        <span className="font-mono tabular-nums">{item.progressPercent}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Bottom link to Tasks */}
            <div className="pt-2 border-t border-border/40 text-center sm:text-right">
              <Link
                href={viewAllTasksUrl}
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1.5 min-h-[44px] sm:min-h-[32px] items-center"
              >
                <span>Mở bảng nhiệm vụ đầy đủ ({baseTasks.length} nhiệm vụ)</span>
                <ArrowRight size={13} strokeWidth={1.5} />
              </Link>
            </div>
          </div>
        </div>

        {/* Right Column: Operational Context & Supporting Widgets (~40% desktop width) — omitted in attentionOnly mode */}
        {!attentionOnly && (
          <div className="lg:col-span-5 space-y-4">
          {/* Executive Widgets */}
          {effectiveRole === "EXECUTIVE" && departmentHealth.length > 0 && (
            <div className="space-y-4">
              <DepartmentProgressMatrix
                departments={departmentHealth}
                defaultViewMode="ranking"
              />
            </div>
          )}

          {/* Manager Workload Widget */}
          {effectiveRole === "MANAGER" && staffWorkload.length > 0 && (
            <ManagerStaffWorkloadWidget
              workload={staffWorkload}
              departmentName={user?.department}
            />
          )}

          {/* Upcoming Deadlines Widget */}
          {upcomingItems.length > 0 && (
            <UpcomingDeadlinesWidget
              items={upcomingItems.slice(0, 5)}
              onSelectTask={onSelectTask ? (item) => {
                const found = baseTasks.find((t) => t.id === item.id || t.id === item.taskId);
                if (found) onSelectTask(found);
              } : undefined}
            />
          )}

          {/* Activity Feed Widget */}
          {activities.length > 0 && (
            <ActivityFeedWidget activities={activities.slice(0, 5)} />
          )}
        </div>
        )}
      </div>
    </div>
  );
}
