"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileCheck,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus, TaskPriority, DashboardStats } from "@/types/dashboard";
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
import { QCET_ORG_UNITS } from "@/lib/org/org-structure";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  useOptionalDashboardData,
  useOptionalDashboardActions,
} from "@/components/dashboard/dashboard-context";

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
  priority: TaskPriority;
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
  allTasks?: SchoolTask[];
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

export type WorkbenchFilterTab = "urgent" | "assigned_by_me" | "monitoring" | "all";

// ============================================================================
// Pure Calculation Helpers
// ============================================================================

/**
 * Checks if a task was assigned, initiated, or delegated by the user.
 */
export function isTaskAssignedByMe(task: SchoolTask | StaffTask, user?: AuthUser | null): boolean {
  if (!user) return false;
  const anyTask = task as unknown as Record<string, unknown>;
  const userId = user.id;
  const userName = user.name;
  const userEmail = user.email;

  if (anyTask.createdById && (anyTask.createdById === userId || anyTask.createdById === userEmail)) return true;
  if (anyTask.assignerId && (anyTask.assignerId === userId || anyTask.assignerId === userEmail)) return true;
  if (anyTask.assignedById && (anyTask.assignedById === userId || anyTask.assignedById === userEmail)) return true;
  if (anyTask.createdBy && (anyTask.createdBy === userId || anyTask.createdBy === userName)) return true;
  if (anyTask.assignedBy && (anyTask.assignedBy === userName || anyTask.assignedBy === userId)) return true;

  // Subtasks assigned to other members
  if ("subTasks" in anyTask && Array.isArray(anyTask.subTasks)) {
    const subTasks = anyTask.subTasks as Array<Record<string, unknown>>;
    const hasSubtasksForOthers = subTasks.some(
      (st) =>
        (st.assigneeName && st.assigneeName !== userName) ||
        (st.assigneeId && st.assigneeId !== userId)
    );
    if (
      (anyTask.leadAssigneeName === userName || anyTask.leadAssigneeId === userId) &&
      hasSubtasksForOthers
    ) {
      return true;
    }
  }

  // Manager: unit tasks assigned to staff
  const userRole = user.role;
  const userDept = user.departmentCode || user.department;
  if (
    userRole === "MANAGER" &&
    userDept &&
    (anyTask.departmentCode === userDept || anyTask.leadDepartmentCode === userDept)
  ) {
    const assignee = anyTask.leadAssigneeName || anyTask.assignedTo || anyTask.assigneeName;
    if (assignee && assignee !== userName) return true;
  }

  // Executive/Admin: school-wide tasks assigned to others
  if (userRole === "ADMIN" || (userRole as string) === "EXECUTIVE") {
    const assignee = anyTask.leadAssigneeName || anyTask.assignedTo || anyTask.assigneeName;
    if (assignee && assignee !== userName) return true;
  }

  return false;
}

/**
 * Pure builder function extracting attention items adapted by role.
 * Standardizes the "What needs my attention?" model.
 * Role ONLY changes priority, order, and data — not the underlying UI card architecture.
 *
 * CRITICAL POLICY: Must NOT let monthly filters hide overdue tasks from prior months!
 * When allTasks is supplied, overdue candidates are sourced from allTasks.
 */
export function buildRoleAttentionQueue({
  tasks = [],
  allTasks,
  user,
  role = "STAFF",
  referenceDate = getSystemReferenceDateStr(),
  limit = 50,
}: {
  tasks?: SchoolTask[];
  allTasks?: SchoolTask[];
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
    code: t.code || t.taskCode,
    title: t.title,
    departmentCode: t.departmentCode || t.leadDepartmentCode,
    departmentName: t.department || t.departmentName || t.leadDepartment,
    assigneeName: t.leadAssigneeName || t.assignedTo || "Chưa phân công",
    dueDate: t.dueDate,
    isOverdue: Boolean(t.dueDate && isTaskPastDue(t.dueDate, referenceDate)),
    progressPercent: t.progressPercent ?? t.progress ?? 0,
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
        : t.status === "NOT_STARTED"
        ? "Chưa bắt đầu"
        : "Cần xử lý",
    actionType,
    actionLabel,
    actionBadgeVariant,
    targetUrl: `/tasks?taskId=${encodeURIComponent(t.id)}`,
    rawTask: t,
  });

  // Source for overdue tasks: MUST prioritize allTasks so monthly filters do not hide past-due tasks
  const overdueSourceTasks = allTasks && allTasks.length > 0 ? allTasks : tasks;

  if (role === "STAFF") {
    // ------------------------------------------------------------------------
    // Staff Priorities:
    // 1. Overdue personal tasks (highest urgency, sourced across all months)
    // 2. Tasks due today
    // 3. My submissions awaiting supervisor review
    // 4. In-progress personal tasks due soonest
    // ------------------------------------------------------------------------
    const overduePersonalTasks = overdueSourceTasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      if (!user) return true;
      return isTaskAssignedToUser(t, user);
    });

    // 1. Overdue (quét toàn bộ allTasks - không bao giờ bị mất do bộ lọc tháng)
    for (const t of overduePersonalTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskOverdueOrHasOverdueSubtask(t, referenceDate)) {
        items.push(toQueueItem(t, "OVERDUE", "Quá hạn", "destructive"));
        seenIds.add(t.id);
      }
    }

    const currentScopeTasks = tasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      if (!user) return true;
      return isTaskAssignedToUser(t, user);
    });

    // 2. Due today
    for (const t of currentScopeTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (t.dueDate && t.dueDate.startsWith(referenceDate)) {
        items.push(toQueueItem(t, "TODAY", "Hôm nay", "warning"));
        seenIds.add(t.id);
      }
    }

    // 3. Submissions awaiting review
    for (const t of currentScopeTasks) {
      if (items.length >= limit) break;
      if (seenIds.has(t.id)) continue;
      if (isTaskWaitingApproval(t.status)) {
        items.push(toQueueItem(t, "APPROVAL", "Đã nộp chờ duyệt", "secondary"));
        seenIds.add(t.id);
      }
    }

    // 4. In-progress active tasks
    for (const t of currentScopeTasks) {
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
    // 2. Overdue unit tasks & at-risk tasks (sourced across all months)
    // 3. Urgent / high priority unit deliverables
    // 4. Active unit tasks
    // ------------------------------------------------------------------------
    const overdueUnitTasks = overdueSourceTasks.filter((t) => {
      if (t.status === "COMPLETED") return false;
      if (!userDept) return true;
      return (
        t.departmentCode === userDept ||
        t.department === userDept ||
        isTaskAssignedToUserOrUnit(t, user)
      );
    });

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

    // 2. Overdue unit tasks (quét toàn bộ allTasks - không bao giờ bị mất do bộ lọc tháng)
    for (const t of overdueUnitTasks) {
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
    // 2. Strategic roadblocks & overdue school tasks (sourced across all months)
    // 3. Key institutional focus tasks
    // 4. General active tasks
    // ------------------------------------------------------------------------
    const overdueSchoolTasks = overdueSourceTasks.filter((t) => t.status !== "COMPLETED");
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

    // 2. Strategic roadblocks & overdue (quét toàn bộ allTasks - không bao giờ bị mất do bộ lọc tháng)
    for (const t of overdueSchoolTasks) {
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
  allTasks,
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

  const operationalUnitCount = QCET_ORG_UNITS.filter((d) => d.category !== "BGH").length;

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

  // Context access for state updates and unified full task set
  const dashboardData = useOptionalDashboardData();
  const dashboardActions = useOptionalDashboardActions();

  // Unified full task set ensuring overdue tasks from previous months are included
  const fullUnfilteredTasks = allTasks || dashboardData?.tasks || tasks;
  const baseTasks = tasks.length > 0 ? tasks : filteredTasks || [];

  // Local interaction states
  const [activeTab, setActiveTab] = React.useState<WorkbenchFilterTab>("urgent");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [updatingId, setUpdatingId] = React.useState<string | null>(null);
  const [revisionTaskId, setRevisionTaskId] = React.useState<string | null>(null);
  const [revisionText, setRevisionText] = React.useState("");
  const [actionFeedback, setActionFeedback] = React.useState<Record<string, string>>({});
  const [showAllItems, setShowAllItems] = React.useState(false);

  // Build role-adapted attention queue with limit=100 so in-place tabs have rich data
  const attentionQueue = React.useMemo(() => {
    return buildRoleAttentionQueue({
      tasks: baseTasks,
      allTasks: fullUnfilteredTasks,
      user,
      role: effectiveRole,
      referenceDate,
      limit: 100,
    });
  }, [baseTasks, fullUnfilteredTasks, user, effectiveRole, referenceDate]);

  // Tab categorization
  const urgentItems = React.useMemo(() => {
    return attentionQueue.filter(
      (item) =>
        item.isOverdue ||
        item.actionType === "OVERDUE" ||
        item.actionType === "TODAY" ||
        item.actionType === "APPROVAL" ||
        item.status === "WAITING_APPROVAL" ||
        item.status === "PENDING_EXECUTIVE_APPROVAL"
    );
  }, [attentionQueue]);

  const assignedByMeItems = React.useMemo(() => {
    return attentionQueue.filter((item) => isTaskAssignedByMe(item.rawTask, user));
  }, [attentionQueue, user]);

  const monitoringItems = React.useMemo(() => {
    return attentionQueue.filter(
      (item) =>
        item.status === "IN_PROGRESS" ||
        isActiveTaskStatus(item.status as TaskStatus) ||
        item.actionType === "SUBMIT"
    );
  }, [attentionQueue]);

  const tabCounts = React.useMemo(
    () => ({
      urgent: urgentItems.length,
      assigned_by_me: assignedByMeItems.length,
      monitoring: monitoringItems.length,
      all: attentionQueue.length,
    }),
    [urgentItems.length, assignedByMeItems.length, monitoringItems.length, attentionQueue.length]
  );

  // Filter items based on active tab
  const tabFilteredItems = React.useMemo(() => {
    switch (activeTab) {
      case "urgent":
        return urgentItems;
      case "assigned_by_me":
        return assignedByMeItems;
      case "monitoring":
        return monitoringItems;
      case "all":
      default:
        return attentionQueue;
    }
  }, [activeTab, urgentItems, assignedByMeItems, monitoringItems, attentionQueue]);

  // Apply real-time search query
  const searchFilteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return tabFilteredItems;
    const query = searchQuery.trim().toLowerCase();
    return tabFilteredItems.filter((item) => {
      const title = item.title.toLowerCase();
      const code = (item.code || "").toLowerCase();
      const assignee = (item.assigneeName || "").toLowerCase();
      const dept = (item.departmentName || item.departmentCode || "").toLowerCase();
      return (
        title.includes(query) ||
        code.includes(query) ||
        assignee.includes(query) ||
        dept.includes(query)
      );
    });
  }, [tabFilteredItems, searchQuery]);

  const MAX_VISIBLE_DEFAULT = 7;
  const displayedItems = showAllItems
    ? searchFilteredItems
    : searchFilteredItems.slice(0, MAX_VISIBLE_DEFAULT);

  // Staff Workload for Managers
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

  // Actions Handlers
  const notifyFeedback = (taskId: string, message: string) => {
    setActionFeedback((prev) => ({ ...prev, [taskId]: message }));
    setTimeout(() => {
      setActionFeedback((prev) => {
        const next = { ...prev };
        delete next[taskId];
        return next;
      });
    }, 3500);
  };

  // 1. Quick progress update (+10%, +25%)
  const handleQuickProgress = async (item: AttentionQueueItem, delta: number) => {
    const currentP = item.progressPercent ?? 0;
    const targetP = Math.min(100, currentP + delta);
    setUpdatingId(item.id);

    try {
      if (targetP >= 100) {
        if (dashboardActions?.handleStatusChange) {
          dashboardActions.handleStatusChange(item.id, "COMPLETED");
        }
        notifyFeedback(item.id, "Đã hoàn thành 100%!");
      } else {
        if (item.status === "NOT_STARTED" && dashboardActions?.handleStatusChange) {
          dashboardActions.handleStatusChange(item.id, "IN_PROGRESS");
        }
        const res = await fetch(`/api/tasks/${encodeURIComponent(item.id)}/actions/update-progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ progressPercent: targetP }),
        });
        if (res.ok) {
          notifyFeedback(item.id, `Tiến độ: ${targetP}%`);
          if (dashboardActions?.handleManualRefresh) {
            dashboardActions.handleManualRefresh();
          }
        } else {
          notifyFeedback(item.id, "Lỗi cập nhật tiến độ");
        }
      }
    } catch {
      notifyFeedback(item.id, "Không thể kết nối máy chủ");
    } finally {
      setUpdatingId(null);
    }
  };

  // 2. Mark complete
  const handleQuickComplete = (item: AttentionQueueItem) => {
    setUpdatingId(item.id);
    try {
      if (dashboardActions?.handleStatusChange) {
        dashboardActions.handleStatusChange(item.id, "COMPLETED");
        notifyFeedback(item.id, "Đã đánh d���u hoàn thành!");
      }
    } catch {
      notifyFeedback(item.id, "Lỗi cập nhật");
    } finally {
      setUpdatingId(null);
    }
  };

  // 3. Quick approve (L1 or L2)
  const handleQuickApprove = async (item: AttentionQueueItem) => {
    setUpdatingId(item.id);
    try {
      if (dashboardActions?.handleReviewAction) {
        await dashboardActions.handleReviewAction({
          taskId: item.id,
          decision: "approved",
          comment:
            effectiveRole === "EXECUTIVE"
              ? "Ban Giám hiệu phê duyệt L2"
              : "Trưởng đơn vị phê duyệt L1",
          reviewedByRole: user?.role || (effectiveRole === "EXECUTIVE" ? "ADMIN" : "MANAGER"),
          reviewedByName: user?.name || "Người duyệt",
        });
        notifyFeedback(item.id, "Đã phê duyệt thành công!");
      }
    } catch {
      notifyFeedback(item.id, "Lỗi phê duyệt nhiệm vụ");
    } finally {
      setUpdatingId(null);
    }
  };

  // 4. Request revision
  const handleQuickRequestRevision = async (item: AttentionQueueItem) => {
    setUpdatingId(item.id);
    try {
      if (dashboardActions?.handleReviewAction) {
        await dashboardActions.handleReviewAction({
          taskId: item.id,
          decision: "revision_requested",
          comment: revisionText.trim() || "Yêu cầu chỉnh sửa và bổ sung minh chứng",
          reviewedByRole: user?.role || (effectiveRole === "EXECUTIVE" ? "ADMIN" : "MANAGER"),
          reviewedByName: user?.name || "Người duyệt",
        });
        notifyFeedback(item.id, "Đã gửi yêu cầu chỉnh sửa!");
      }
    } catch {
      notifyFeedback(item.id, "Lỗi gửi yêu cầu chỉnh sửa");
    } finally {
      setUpdatingId(null);
      setRevisionTaskId(null);
      setRevisionText("");
    }
  };

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
                    {searchFilteredItems.length}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {effectiveRole === "EXECUTIVE"
                    ? "Hồ sơ chờ phê duyệt L2, điểm nghẽn chiến lược và tiến độ toàn trường"
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

            {/* In-place Filter Tabs */}
            <div
              className="flex items-center gap-1.5 p-1 rounded-xl bg-muted/40 border border-border/50 overflow-x-auto no-scrollbar"
              role="tablist"
              aria-label="Lọc nhanh danh sách cần xử lý"
            >
              {[
                { key: "urgent" as const, label: "Cần xử lý ngay", count: tabCounts.urgent },
                { key: "assigned_by_me" as const, label: "Tôi giao việc", count: tabCounts.assigned_by_me },
                { key: "monitoring" as const, label: "Đang theo dõi", count: tabCounts.monitoring },
                { key: "all" as const, label: "Tất cả", count: tabCounts.all },
              ].map((tab) => {
                const isActive = activeTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => {
                      setActiveTab(tab.key);
                      setShowAllItems(false);
                    }}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      isActive
                        ? "bg-card text-foreground font-semibold shadow-2xs border border-border/70"
                        : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "text-[11px] font-mono tabular-nums px-1.5 py-0.2 rounded-full",
                        isActive ? "bg-primary/10 text-primary font-semibold" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* In-place Quick Search Input */}
            <div className="relative">
              <Search size={14} strokeWidth={1.5} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm nhanh nhiệm vụ theo tên, mã, người chủ trì..."
                className="pl-8 pr-8 h-8 text-xs rounded-lg border-border/60 bg-muted/20 focus:bg-card"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={13} strokeWidth={1.5} />
                </button>
              )}
            </div>

            {/* Attention Items List */}
            {displayedItems.length === 0 ? (
              <div
                className="p-4 rounded-xl border border-border/60 bg-muted/20 text-xs text-foreground/80 flex items-center gap-3"
                data-slot="action-empty-state"
              >
                <CheckCircle2 size={16} className="text-muted-foreground shrink-0" strokeWidth={1.5} />
                <div className="space-y-0.5">
                  <p className="font-semibold">
                    {searchQuery
                      ? "Không tìm thấy nhiệm vụ phù hợp"
                      : "Không có việc trong mục này"}
                  </p>
                  <p className="text-muted-foreground">
                    {searchQuery
                      ? "Thử tìm với từ khóa khác hoặc chuyển sang tab khác."
                      : "Các hàng đợi tương ứng hiện đã được giải quyết hoặc chưa có việc."}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {displayedItems.map((item) => {
                  const isItemUpdating = updatingId === item.id;
                  const feedback = actionFeedback[item.id];
                  const canReview =
                    (effectiveRole === "MANAGER" &&
                      (item.status === "WAITING_APPROVAL" || item.actionType === "APPROVAL")) ||
                    (effectiveRole === "EXECUTIVE" &&
                      (item.status === "PENDING_EXECUTIVE_APPROVAL" ||
                        item.status === "WAITING_APPROVAL" ||
                        item.actionType === "APPROVAL"));
                  const isRevisionOpen = revisionTaskId === item.id;

                  return (
                    <div
                      key={item.id}
                      data-slot="attention-queue-card"
                      className={cn(
                        "p-3 sm:p-3.5 rounded-xl border bg-card transition-all space-y-2.5 relative",
                        item.isOverdue
                          ? "border-rose-500/40 bg-rose-500/[0.02] hover:border-rose-500/60"
                          : "border-border/70 hover:border-primary/40 hover:bg-muted/10"
                      )}
                    >
                      {/* Card Header Tags */}
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
                          {feedback && (
                            <span className="text-xs text-emerald-800 bg-emerald-500/15 px-2 py-0.5 rounded-md font-medium animate-fade-in">
                              {feedback}
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
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-300",
                                item.isOverdue ? "bg-rose-500" : "bg-primary"
                              )}
                              style={{ width: `${Math.min(100, item.progressPercent)}%` }}
                            />
                          </div>
                          <span className="font-mono tabular-nums text-foreground/70">{item.progressPercent}%</span>
                        </div>
                      </div>

                      {/* Inline Quick Actions Bar */}
                      <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap text-xs">
                        {/* Left action group: Progress Quick Adjust */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground font-medium mr-0.5">Tiến độ:</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isItemUpdating || item.status === "COMPLETED"}
                            onClick={() => handleQuickProgress(item, 10)}
                            className="h-6 px-1.5 text-[11px] font-mono rounded hover:bg-primary/10 hover:text-primary"
                            title="Tăng 10% tiến độ"
                          >
                            +10%
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={isItemUpdating || item.status === "COMPLETED"}
                            onClick={() => handleQuickProgress(item, 25)}
                            className="h-6 px-1.5 text-[11px] font-mono rounded hover:bg-primary/10 hover:text-primary"
                            title="Tăng 25% tiến độ"
                          >
                            +25%
                          </Button>
                          {item.status !== "COMPLETED" && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isItemUpdating}
                              onClick={() => handleQuickComplete(item)}
                              className="h-6 px-2 text-[11px] rounded text-emerald-800 hover:bg-emerald-500/10 hover:text-emerald-900"
                              title="Đánh dấu hoàn thành 100%"
                            >
                              <CheckCircle2 size={12} strokeWidth={1.5} className="mr-1" />
                              <span>Hoàn thành</span>
                            </Button>
                          )}
                        </div>

                        {/* Right action group: Review Actions (For Manager / Executive) */}
                        {canReview && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              disabled={isItemUpdating}
                              onClick={() => handleQuickApprove(item)}
                              className="h-6 px-2 text-[11px] font-medium rounded-md bg-emerald-700 hover:bg-emerald-800 text-white gap-1"
                            >
                              <Check size={12} strokeWidth={1.5} />
                              <span>{effectiveRole === "EXECUTIVE" ? "Duyệt L2" : "Duyệt L1"}</span>
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={isItemUpdating}
                              onClick={() => {
                                setRevisionTaskId(isRevisionOpen ? null : item.id);
                                setRevisionText("");
                              }}
                              className={cn(
                                "h-6 px-2 text-[11px] font-medium rounded-md gap-1",
                                isRevisionOpen
                                  ? "bg-amber-500/15 text-amber-900 border-amber-500/30"
                                  : "hover:bg-amber-500/10 hover:text-amber-900 text-muted-foreground"
                              )}
                            >
                              <RotateCcw size={11} strokeWidth={1.5} />
                              <span>Yêu cầu sửa</span>
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Inline Revision Input Drawer */}
                      {isRevisionOpen && (
                        <div className="p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/[0.04] space-y-2 animate-fade-in">
                          <div className="flex items-center justify-between text-xs text-amber-900 font-medium">
                            <span>Ghi chú yêu cầu chỉnh sửa/bổ sung minh chứng:</span>
                            <button
                              type="button"
                              onClick={() => setRevisionTaskId(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X size={12} strokeWidth={1.5} />
                            </button>
                          </div>
                          <Input
                            type="text"
                            value={revisionText}
                            onChange={(e) => setRevisionText(e.target.value)}
                            placeholder="Ví dụ: Bổ sung biên bản nghiệm thu hoặc làm rõ số liệu..."
                            className="h-7 text-xs rounded border-border/80 bg-card"
                            autoFocus
                          />
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setRevisionTaskId(null)}
                              className="h-6 px-2 text-xs"
                            >
                              Hủy
                            </Button>
                            <Button
                              type="button"
                              variant="default"
                              size="sm"
                              disabled={isItemUpdating}
                              onClick={() => handleQuickRequestRevision(item)}
                              className="h-6 px-2.5 text-xs bg-amber-700 hover:bg-amber-800 text-white"
                            >
                              Gửi yêu cầu sửa
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Expand / Collapse and Bottom link to Tasks */}
            <div className="pt-2 border-t border-border/40 flex items-center justify-between gap-3 flex-wrap">
              {searchFilteredItems.length > MAX_VISIBLE_DEFAULT && (
                <button
                  type="button"
                  onClick={() => setShowAllItems(!showAllItems)}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium underline underline-offset-2 cursor-pointer"
                >
                  {showAllItems
                    ? "Thu gọn"
                    : `Xem thêm ${searchFilteredItems.length - MAX_VISIBLE_DEFAULT} việc khác`}
                </button>
              )}
              <Link
                href={viewAllTasksUrl}
                className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1.5 min-h-[36px] items-center ml-auto"
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
                onSelectTask={
                  onSelectTask
                    ? (item) => {
                        const found = baseTasks.find((t) => t.id === item.id || t.id === item.taskId);
                        if (found) onSelectTask(found);
                      }
                    : undefined
                }
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
