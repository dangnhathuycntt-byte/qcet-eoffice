"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileCheck,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  Search,
  CheckCircle2,
  Clock,
  Building2,
  User,
  Plus,
  ArrowRight,
  ExternalLink,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Layers,
  X,
  CheckCircle,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
} from "@/types/workspace";
import { matchesUser } from "@/lib/role-task-filter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReviewActionDialog } from "./review-action-dialog";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";
import {
  getDaysRemaining,
  getDeadlineBadgeInfo,
  type StaffTaskWithContext,
} from "./lecturer-focus-workspace";

// ============================================================================
// 1. Types & Interfaces
// ============================================================================

export type ManagerWorkspaceTab = "APPROVAL_QUEUE" | "UNIT_PROGRESS" | "MY_TASKS";

export interface DepartmentManagerMetrics {
  waitingReviewCount: number;
  overdueCount: number;
  focusTaskCount: number;
  averageProgressPercent: number;
  totalDepartmentTasks: number;
  completedDepartmentTasks: number;
  myDirectTasksCount: number;
}

export interface DepartmentManagerWorkspaceProps {
  user: AuthUser;
  tasks?: SchoolTask[];
  staffTasks?: StaffTask[];
  onSelectTask?: (task: StaffTask | SchoolTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (
    payload: DeliverableSubmissionPayload
  ) => Promise<void> | void;
  onStatusChange?: (
    taskId: string,
    newStatus: TaskStatus,
    note?: string
  ) => void;
  onCreateSubTask?: (parentTaskId: string) => void;
  referenceDate?: string;
  tasksUrl?: string;
  className?: string;
}

// ============================================================================
// 2. Pure Helper Functions (Exported for Testing)
// ============================================================================

/**
 * Filters staff tasks by department code.
 */
export function filterDepartmentStaffTasks<T extends StaffTask>(
  tasks: T[],
  deptCode?: string
): T[] {
  if (!deptCode || deptCode === "ALL") return tasks;
  const cleanDept = deptCode.trim().toUpperCase();
  return tasks.filter((task) => {
    const taskDept = (
      task.departmentCode ||
      task.triageSourceDept ||
      ""
    ).toUpperCase();
    return taskDept === cleanDept;
  });
}

/**
 * Filters school tasks by department code (matches lead department or co-departments).
 */
export function filterDepartmentSchoolTasks(
  tasks: SchoolTask[],
  deptCode?: string
): SchoolTask[] {
  if (!deptCode || deptCode === "ALL") return tasks;
  const cleanDept = deptCode.trim().toUpperCase();
  return tasks.filter((task) => {
    const leadDept = (task.leadDepartmentCode || "").toUpperCase();
    if (leadDept === cleanDept) return true;
    if (
      task.coDepartmentCodes &&
      task.coDepartmentCodes.some((c) => c.toUpperCase() === cleanDept)
    ) {
      return true;
    }
    return false;
  });
}

/**
 * Extracts and consolidates all staff tasks with their parent SchoolTask context.
 */
export function extractAllDepartmentStaffTasks(
  schoolTasks: SchoolTask[] = [],
  explicitStaffTasks: StaffTask[] = []
): StaffTaskWithContext[] {
  const map = new Map<string, StaffTaskWithContext>();

  // Add explicit staff tasks
  for (const st of explicitStaffTasks) {
    map.set(st.id, {
      ...st,
      parentSchoolTaskId: st.parentSchoolTaskId || "",
    });
  }

  // Extract from school tasks
  for (const st of schoolTasks) {
    if (!st.subTasks) continue;
    for (const sub of st.subTasks) {
      const existing = map.get(sub.id);
      map.set(sub.id, {
        ...(existing || sub),
        parentSchoolTaskId: st.id,
        parentTaskTitle: st.title,
        parentTaskCategory: st.category,
        parentCategoryLabel: st.categoryLabel,
        departmentCode: sub.departmentCode || st.leadDepartmentCode,
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Retrieves the approval queue (tasks needing review) strictly for the department.
 */
export function getApprovalQueue<T extends StaffTask>(
  tasks: T[],
  deptCode?: string
): T[] {
  const deptTasks = filterDepartmentStaffTasks(tasks, deptCode);
  return deptTasks.filter(
    (t) => t.status === "NEEDS_REVIEW" || Boolean(t.requiresReview)
  );
}

/**
 * Filters tasks assigned directly to the manager.
 */
export function getManagerDirectTasks<T extends StaffTask>(
  tasks: T[],
  user: AuthUser
): T[] {
  return tasks.filter((t) => {
    if (t.assigneeId && t.assigneeId === user.id) return true;
    return matchesUser(t.assigneeName, user);
  });
}

/**
 * Computes Executive Strip metrics for the Department Manager.
 */
export function computeDepartmentManagerMetrics(
  staffTasks: StaffTask[],
  schoolTasks: SchoolTask[],
  deptCode?: string,
  referenceDate?: string,
  user?: AuthUser
): DepartmentManagerMetrics {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);

  const deptStaffTasks = filterDepartmentStaffTasks(staffTasks, deptCode);
  const deptSchoolTasks = filterDepartmentSchoolTasks(schoolTasks, deptCode);

  let waitingReviewCount = 0;
  let overdueCount = 0;
  let focusTaskCount = 0;
  let completedCount = 0;

  for (const task of deptStaffTasks) {
    if (task.status === "COMPLETED") {
      completedCount++;
      continue;
    }

    if (task.status === "NEEDS_REVIEW" || task.requiresReview) {
      waitingReviewCount++;
    }

    const taskDueDate = task.dueDate ? task.dueDate.slice(0, 10) : "";
    const daysLeft = getDaysRemaining(taskDueDate, refDate);

    const isOverdue = daysLeft !== null && daysLeft < 0;
    if (isOverdue) {
      overdueCount++;
    }

    // Focus tasks: blocked, needs review, overdue, or due within 3 days
    if (
      task.status === "BLOCKED" ||
      task.status === "NEEDS_REVIEW" ||
      isOverdue ||
      (daysLeft !== null && daysLeft >= 0 && daysLeft <= 3) ||
      Boolean(task.rejectionReason && task.rejectionReason.trim().length > 0)
    ) {
      focusTaskCount++;
    }
  }

  // Calculate average progress percent
  let averageProgressPercent = 0;
  if (deptSchoolTasks.length > 0) {
    const sumProgress = deptSchoolTasks.reduce(
      (acc, t) => acc + (t.progressPercent || 0),
      0
    );
    averageProgressPercent = Math.round(sumProgress / deptSchoolTasks.length);
  } else if (deptStaffTasks.length > 0) {
    averageProgressPercent = Math.round(
      (completedCount / deptStaffTasks.length) * 100
    );
  }

  // Count manager's direct tasks
  let myDirectTasksCount = 0;
  if (user) {
    myDirectTasksCount = getManagerDirectTasks(staffTasks, user).length;
  }

  return {
    waitingReviewCount,
    overdueCount,
    focusTaskCount,
    averageProgressPercent,
    totalDepartmentTasks: deptStaffTasks.length,
    completedDepartmentTasks: completedCount,
    myDirectTasksCount,
  };
}

/**
 * Filter manager tasks by search query and urgency/status tab.
 */
export function filterManagerTasks<T extends StaffTaskWithContext>(
  tasks: T[],
  searchTerm: string = "",
  subFilter: string = "ALL",
  referenceDate?: string
): T[] {
  const refDate = referenceDate || new Date().toISOString().slice(0, 10);
  const cleanSearch = searchTerm.trim().toLowerCase();

  return tasks.filter((task) => {
    // Search keyword
    if (cleanSearch) {
      const matchTitle = (task.title || "").toLowerCase().includes(cleanSearch);
      const matchId = (task.id || "").toLowerCase().includes(cleanSearch);
      const matchAssignee = (task.assigneeName || "")
        .toLowerCase()
        .includes(cleanSearch);
      const matchParentId = (task.parentSchoolTaskId || "")
        .toLowerCase()
        .includes(cleanSearch);
      const matchParentTitle = (task.parentTaskTitle || "")
        .toLowerCase()
        .includes(cleanSearch);
      if (
        !matchTitle &&
        !matchId &&
        !matchAssignee &&
        !matchParentId &&
        !matchParentTitle
      ) {
        return false;
      }
    }

    if (subFilter === "ALL") return true;

    const daysLeft = getDaysRemaining(task.dueDate, refDate);

    if (subFilter === "IN_PROGRESS") {
      return (
        task.status === "IN_PROGRESS" ||
        task.status === "NEW" ||
        task.status === "BLOCKED"
      );
    }
    if (subFilter === "OVERDUE") {
      return task.status !== "COMPLETED" && daysLeft !== null && daysLeft < 0;
    }
    if (subFilter === "COMPLETED") {
      return task.status === "COMPLETED";
    }
    if (subFilter === "NEEDS_REVIEW") {
      return task.status === "NEEDS_REVIEW" || Boolean(task.requiresReview);
    }

    return true;
  });
}

// ============================================================================
// 3. UI Helpers
// ============================================================================

function renderStatusBadge(status: TaskStatus) {
  switch (status) {
    case "IN_PROGRESS":
      return (
        <Badge
          variant="outline"
          className="bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30 text-[11px] font-medium"
        >
          Đang thực hiện
        </Badge>
      );
    case "NEEDS_REVIEW":
      return (
        <Badge
          variant="outline"
          className="bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30 text-[11px] font-medium"
        >
          Chờ thẩm định
        </Badge>
      );
    case "BLOCKED":
      return (
        <Badge
          variant="outline"
          className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[11px] font-medium"
        >
          Đang tắc nghẽn
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge
          variant="outline"
          className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-medium"
        >
          Đã hoàn thành
        </Badge>
      );
    case "NEW":
    default:
      return (
        <Badge
          variant="outline"
          className="bg-muted text-muted-foreground border-border text-[11px] font-medium"
        >
          Mới giao
        </Badge>
      );
  }
}

// ============================================================================
// 4. Main Component: DepartmentManagerWorkspace
// ============================================================================

export function DepartmentManagerWorkspace({
  user,
  tasks = [],
  staffTasks = [],
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onStatusChange,
  onCreateSubTask,
  referenceDate,
  tasksUrl = "/tasks",
  className,
}: DepartmentManagerWorkspaceProps) {
  const [activeTab, setActiveTab] =
    React.useState<ManagerWorkspaceTab>("APPROVAL_QUEUE");
  const [searchTerm, setSearchTerm] = React.useState("");
  const [unitFilter, setUnitFilter] = React.useState<string>("ALL");
  const [myTasksFilter, setMyTasksFilter] = React.useState<string>("ALL");

  // Dialog States
  const [reviewingTask, setReviewingTask] = React.useState<StaffTask | null>(
    null
  );
  const [submittingTask, setSubmittingTask] = React.useState<StaffTask | null>(
    null
  );

  const deptCode = user.departmentCode || "CNTT";

  // Consolidate staff tasks with school tasks
  const consolidatedStaffTasks = React.useMemo(() => {
    return extractAllDepartmentStaffTasks(tasks, staffTasks);
  }, [tasks, staffTasks]);

  // Metrics computation
  const metrics = React.useMemo(() => {
    return computeDepartmentManagerMetrics(
      consolidatedStaffTasks,
      tasks,
      deptCode,
      referenceDate,
      user
    );
  }, [consolidatedStaffTasks, tasks, deptCode, referenceDate, user]);

  // Tab 1: Approval Queue tasks
  const approvalQueueTasks = React.useMemo(() => {
    const queue = getApprovalQueue(consolidatedStaffTasks, deptCode);
    return filterManagerTasks(queue, searchTerm, "ALL", referenceDate);
  }, [consolidatedStaffTasks, deptCode, searchTerm, referenceDate]);

  // Tab 2: Unit School Tasks and Unit Staff Tasks
  const unitSchoolTasks = React.useMemo(() => {
    const filtered = filterDepartmentSchoolTasks(tasks, deptCode);
    if (!searchTerm.trim()) return filtered;
    const clean = searchTerm.trim().toLowerCase();
    return filtered.filter(
      (t) =>
        t.title.toLowerCase().includes(clean) ||
        t.id.toLowerCase().includes(clean) ||
        t.categoryLabel.toLowerCase().includes(clean)
    );
  }, [tasks, deptCode, searchTerm]);

  const unitStaffTasks = React.useMemo(() => {
    const deptOnly = filterDepartmentStaffTasks(
      consolidatedStaffTasks,
      deptCode
    );
    return filterManagerTasks(deptOnly, searchTerm, unitFilter, referenceDate);
  }, [consolidatedStaffTasks, deptCode, searchTerm, unitFilter, referenceDate]);

  // Tab 3: My direct tasks
  const myDirectTasks = React.useMemo(() => {
    const direct = getManagerDirectTasks(consolidatedStaffTasks, user);
    return filterManagerTasks(
      direct,
      searchTerm,
      myTasksFilter,
      referenceDate
    );
  }, [consolidatedStaffTasks, user, searchTerm, myTasksFilter, referenceDate]);

  // Rejection alert tasks for my own tasks
  const revisionNeededTasks = React.useMemo(() => {
    return myDirectTasks.filter(
      (t) =>
        t.status !== "COMPLETED" &&
        Boolean(t.rejectionReason && t.rejectionReason.trim().length > 0)
    );
  }, [myDirectTasks]);

  // Handlers
  const handleOpenReview = (task: StaffTask) => {
    setReviewingTask(task);
  };

  const handleCloseReview = () => {
    setReviewingTask(null);
  };

  const handleOpenSubmit = (task: StaffTask) => {
    setSubmittingTask(task);
  };

  const handleCloseSubmit = () => {
    setSubmittingTask(null);
  };

  const handleReviewSubmit = async (payload: ApprovalActionPayload) => {
    if (onReview) {
      await onReview(payload);
    }
    if (onStatusChange && reviewingTask) {
      const nextStatus: TaskStatus =
        payload.decision === "approved" ? "COMPLETED" : "IN_PROGRESS";
      onStatusChange(reviewingTask.id, nextStatus, payload.comment);
    }
    setReviewingTask(null);
  };

  const handleDeliverableSubmit = async (
    payload: DeliverableSubmissionPayload
  ) => {
    if (onSubmitDeliverable) {
      await onSubmitDeliverable(payload);
    }
    if (onStatusChange && submittingTask) {
      onStatusChange(submittingTask.id, "NEEDS_REVIEW", payload.note);
    }
    setSubmittingTask(null);
  };

  return (
    <div
      className={cn("w-full space-y-6", className)}
      data-slot="department-manager-workspace"
    >
      {/* 1. Header & Context */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-5">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-foreground">
              Xin chào, {user.name}
            </h1>
            <Badge
              variant="outline"
              className="bg-primary/5 text-primary border-primary/20 text-xs px-2 py-0.5"
            >
              {deptCode}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{user.roleLabel || "Trưởng đơn vị"}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>{user.department || "Khoa / Ban đơn vị"}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 whitespace-nowrap"
          >
            <Link href={tasksUrl} className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 shrink-0" />
              <span>Xem bảng giao việc đầy đủ</span>
              <ArrowRight className="w-3 h-3 ml-0.5 shrink-0" />
            </Link>
          </Button>
        </div>
      </div>

      {/* 2. Executive Strip for Unit Manager */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        data-slot="executive-stat-strip"
      >
        {/* Metric 1: Chờ thẩm định (Highest Priority) */}
        <button
          type="button"
          onClick={() => setActiveTab("APPROVAL_QUEUE")}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "APPROVAL_QUEUE"
              ? "border-purple-500/50 bg-purple-500/10 shadow-xs ring-1 ring-purple-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Chờ thẩm định
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.waitingReviewCount > 0
                  ? "bg-purple-500/20 text-purple-600 dark:text-purple-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <FileCheck className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.waitingReviewCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Hồ sơ cần phê duyệt
            </p>
          </div>
        </button>

        {/* Metric 2: Đang chậm tiến độ */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("UNIT_PROGRESS");
            setUnitFilter("OVERDUE");
          }}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "UNIT_PROGRESS" && unitFilter === "OVERDUE"
              ? "border-rose-500/50 bg-rose-500/10 shadow-xs ring-1 ring-rose-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Đang chậm tiến độ
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.overdueCount > 0
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.overdueCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Nhiệm vụ quá hạn
            </p>
          </div>
        </button>

        {/* Metric 3: Nhiệm vụ trọng tâm */}
        <button
          type="button"
          onClick={() => {
            setActiveTab("UNIT_PROGRESS");
            setUnitFilter("IN_PROGRESS");
          }}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "UNIT_PROGRESS" && unitFilter === "IN_PROGRESS"
              ? "border-amber-500/50 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Nhiệm vụ trọng tâm
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.focusTaskCount}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cần ưu tiên xử lý
            </p>
          </div>
        </button>

        {/* Metric 4: Tiến độ chung đơn vị */}
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Tiến độ chung đơn vị
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tracking-tight text-foreground">
              {metrics.averageProgressPercent}%
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {metrics.completedDepartmentTasks}/{metrics.totalDepartmentTasks} việc hoàn thành
            </p>
          </div>
        </div>
      </div>

      {/* 3. Navigation Tabs & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl border">
          <button
            type="button"
            onClick={() => setActiveTab("APPROVAL_QUEUE")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
              activeTab === "APPROVAL_QUEUE"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileCheck className="w-3.5 h-3.5" />
            <span>Hàng đợi thẩm định</span>
            {metrics.waitingReviewCount > 0 && (
              <Badge
                variant="destructive"
                className="ml-0.5 h-4 px-1.5 text-[10px] font-semibold"
              >
                {metrics.waitingReviewCount}
              </Badge>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("UNIT_PROGRESS")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
              activeTab === "UNIT_PROGRESS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>Tiến độ nhiệm vụ đơn vị</span>
            <Badge
              variant="secondary"
              className="ml-0.5 h-4 px-1.5 text-[10px]"
            >
              {metrics.totalDepartmentTasks}
            </Badge>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("MY_TASKS")}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all cursor-pointer",
              activeTab === "MY_TASKS"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <User className="w-3.5 h-3.5" />
            <span>Nhiệm vụ trực tiếp của tôi</span>
            {metrics.myDirectTasksCount > 0 && (
              <Badge
                variant="outline"
                className="ml-0.5 h-4 px-1.5 text-[10px]"
              >
                {metrics.myDirectTasksCount}
              </Badge>
            )}
          </button>
        </div>

        {/* Search input */}
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm theo tên việc, người làm..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full h-8 pl-8 pr-3 text-xs bg-background border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Tab 1 Content: Approval Queue */}
      {activeTab === "APPROVAL_QUEUE" && (
        <div className="space-y-4" data-slot="approval-queue-tab">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Danh sách hồ sơ minh chứng cần Trưởng đơn vị thẩm định</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Các hồ sơ do giảng viên, chuyên viên gửi lên. Thẩm định để hoàn tất nghiệm thu hoặc yêu cầu bổ sung.
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-medium">
              {approvalQueueTasks.length} hồ sơ chờ duyệt
            </Badge>
          </div>

          {approvalQueueTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed bg-card/50">
              <div className="p-3 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Hàng đợi thẩm định trống
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Hiện không có hồ sơ nào đang chờ duyệt từ các giảng viên / chuyên viên trong đơn vị.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvalQueueTasks.map((task) => {
                const deadline = getDeadlineBadgeInfo(task.dueDate, referenceDate);
                const firstDeliverable =
                  task.deliverables && task.deliverables.length > 0
                    ? task.deliverables[0]
                    : null;

                return (
                  <div
                    key={task.id}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:border-purple-500/40 transition-colors"
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline" className="text-[10px] font-mono">
                          {task.id}
                        </Badge>
                        {task.parentTaskTitle && (
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-muted/60 text-muted-foreground truncate max-w-[240px]"
                          >
                            Thuộc: {task.parentTaskTitle}
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-medium",
                            deadline.variant === "urgent" &&
                              "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
                            deadline.variant === "warning" &&
                              "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
                            deadline.variant === "neutral" &&
                              "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          <Clock className="w-3 h-3 mr-1 inline" />
                          {deadline.label}
                        </Badge>
                        {task.aiReview && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              task.aiReview.status === "CLEAN" &&
                                "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
                              task.aiReview.status === "NEEDS_ATTENTION" &&
                                "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
                              task.aiReview.status === "HIGH_RISK" &&
                                "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                            )}
                          >
                            <ShieldCheck className="w-3 h-3 mr-1 inline" />
                            AI: {task.aiReview.complianceScore}% phù hợp
                          </Badge>
                        )}
                      </div>

                      <h3
                        onClick={() => onSelectTask?.(task)}
                        className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer transition-colors"
                      >
                        {task.title}
                      </h3>

                      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>Người nộp:</span>
                          <strong className="text-foreground font-medium">
                            {task.assigneeName}
                          </strong>
                        </span>
                        {task.updatedAt && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Cập nhật: {task.updatedAt}</span>
                          </span>
                        )}
                      </div>

                      {/* Deliverable preview / attachment snippet */}
                      {(firstDeliverable || task.deliverableDescription) && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/40 border text-xs">
                          <FileText className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground shrink-0">
                            Minh chứng đính kèm:
                          </span>
                          <span className="font-medium text-foreground truncate">
                            {firstDeliverable?.name || task.deliverableDescription}
                          </span>
                          {firstDeliverable?.url && (
                            <a
                              href={firstDeliverable.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="ml-auto text-primary hover:underline flex items-center gap-0.5 text-[11px] shrink-0"
                            >
                              <span>Xem file</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0">
                      <Button
                        size="sm"
                        onClick={() => handleOpenReview(task)}
                        className="text-xs h-8 bg-purple-600 hover:bg-purple-700 text-white gap-1.5"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                        <span>Thẩm định ngay</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 5. Tab 2 Content: Unit Progress & Execution Matrix */}
      {activeTab === "UNIT_PROGRESS" && (
        <div className="space-y-6" data-slot="unit-progress-tab">
          {/* Section A: School Tasks assigned to this unit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  <span>Nhiệm vụ cấp Trường giao đơn vị chủ trì</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Các kế hoạch và chương trình công tác trường giao trực tiếp cho {user.department || "Khoa / Ban"}.
                </p>
              </div>
              <Badge variant="outline" className="text-xs">
                {unitSchoolTasks.length} nhiệm vụ
              </Badge>
            </div>

            {unitSchoolTasks.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed text-xs text-muted-foreground">
                Không tìm thấy nhiệm vụ cấp Trường nào phù hợp với bộ lọc.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {unitSchoolTasks.map((st) => {
                  const deadline = getDeadlineBadgeInfo(st.dueDate, referenceDate);
                  return (
                    <div
                      key={st.id}
                      className="flex flex-col justify-between p-4 rounded-xl border bg-card hover:shadow-xs transition-shadow gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <Badge
                            variant="secondary"
                            className="text-[10px] font-medium"
                          >
                            {st.categoryLabel}
                          </Badge>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              deadline.variant === "urgent" &&
                                "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
                              deadline.variant === "warning" &&
                                "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            )}
                          >
                            <Clock className="w-3 h-3 mr-1 inline" />
                            {deadline.label}
                          </Badge>
                        </div>

                        <h3
                          onClick={() => onSelectTask?.(st)}
                          className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer line-clamp-2"
                        >
                          {st.title}
                        </h3>

                        {/* Progress bar */}
                        <div className="space-y-1 pt-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">Tiến độ hoàn thành:</span>
                            <strong className="text-foreground font-semibold">
                              {st.progressPercent}%
                            </strong>
                          </div>
                          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                "h-full transition-all duration-300",
                                st.progressPercent >= 80
                                  ? "bg-emerald-500"
                                  : st.progressPercent >= 50
                                  ? "bg-amber-500"
                                  : "bg-blue-500"
                              )}
                              style={{ width: `${st.progressPercent}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                          <span>
                            Việc con:{" "}
                            <strong className="text-foreground">
                              {st.completedSubTasks}/{st.totalSubTasks}
                            </strong>
                          </span>
                          <span>Chủ trì: {st.leadAssigneeName}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t pt-2 mt-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectTask?.(st)}
                          className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                        >
                          <span>Xem chi tiết</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onCreateSubTask?.(st.id)}
                          className="text-xs h-7 px-2 gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Giao việc con</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section B: All Unit Staff Tasks */}
          <div className="space-y-3 pt-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Layers className="w-4 h-4 text-muted-foreground" />
                  <span>Danh sách chi tiết các đầu việc trong đơn vị</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Theo dõi tiến độ thực hiện của từng giảng viên và chuyên viên.
                </p>
              </div>

              {/* Sub-filter tabs */}
              <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border text-xs">
                {[
                  { id: "ALL", label: "Tất cả" },
                  { id: "IN_PROGRESS", label: "Đang làm" },
                  { id: "OVERDUE", label: "Quá hạn" },
                  { id: "COMPLETED", label: "Hoàn thành" },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setUnitFilter(tab.id)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                      unitFilter === tab.id
                        ? "bg-background text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {unitStaffTasks.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-dashed text-xs text-muted-foreground">
                Không có đầu việc nào phù hợp với bộ lọc hiện tại.
              </div>
            ) : (
              <div className="space-y-2">
                {unitStaffTasks.map((task) => {
                  const deadline = getDeadlineBadgeInfo(task.dueDate, referenceDate);
                  return (
                    <div
                      key={task.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg border bg-card hover:bg-muted/20 transition-colors"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[11px] font-mono text-muted-foreground">
                            {task.id}
                          </span>
                          {renderStatusBadge(task.status)}
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px]",
                              deadline.variant === "urgent" &&
                                "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
                              deadline.variant === "warning" &&
                                "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                            )}
                          >
                            {deadline.label}
                          </Badge>
                        </div>
                        <h4
                          onClick={() => onSelectTask?.(task)}
                          className="text-xs font-semibold text-foreground hover:text-primary cursor-pointer"
                        >
                          {task.title}
                        </h4>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                          <span>
                            Người làm:{" "}
                            <strong className="text-foreground">
                              {task.assigneeName}
                            </strong>
                          </span>
                          {task.parentTaskTitle && (
                            <span className="truncate max-w-[200px]">
                              Nhiệm vụ cha: {task.parentTaskTitle}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {task.status === "NEEDS_REVIEW" && (
                          <Button
                            size="sm"
                            onClick={() => handleOpenReview(task)}
                            className="text-xs h-7 bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                          >
                            <span>Thẩm định ngay</span>
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onSelectTask?.(task)}
                          className="text-xs h-7 text-muted-foreground hover:text-foreground cursor-pointer"
                        >
                          <span>Chi tiết</span>
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. Tab 3 Content: My Direct Tasks */}
      {activeTab === "MY_TASKS" && (
        <div className="space-y-4" data-slot="my-tasks-tab">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="w-4 h-4 text-primary" />
                <span>Nhiệm vụ trực tiếp giao cho Trưởng đơn vị</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Các đầu việc mà bạn là người trực tiếp chịu trách nhiệm thực hiện và nộp minh chứng.
              </p>
            </div>

            <div className="flex items-center gap-1 bg-muted/40 p-1 rounded-lg border text-xs">
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "IN_PROGRESS", label: "Đang làm" },
                { id: "NEEDS_REVIEW", label: "Chờ duyệt" },
                { id: "COMPLETED", label: "Hoàn thành" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMyTasksFilter(tab.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer",
                    myTasksFilter === tab.id
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Revision Banner if any of manager's tasks require revision */}
          {revisionNeededTasks.length > 0 && (
            <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 space-y-2">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 font-semibold text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Yêu cầu chỉnh sửa từ Lãnh đạo cấp trên</span>
              </div>
              {revisionNeededTasks.map((t) => (
                <div
                  key={t.id}
                  className="text-xs text-foreground/90 pl-6 border-l-2 border-amber-500/50"
                >
                  <p className="font-medium">{t.title}</p>
                  <p className="text-muted-foreground text-[11px] mt-0.5">
                    Lý do: {t.rejectionReason}
                  </p>
                </div>
              ))}
            </div>
          )}

          {myDirectTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-xl border border-dashed bg-card/50">
              <div className="p-3 rounded-full bg-muted text-muted-foreground mb-3">
                <CheckCircle className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Không có nhiệm vụ trực tiếp nào
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mt-1">
                Bạn không có đầu việc cá nhân nào cần xử lý hoặc nộp minh chứng tại thời điểm này.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myDirectTasks.map((task) => {
                const deadline = getDeadlineBadgeInfo(task.dueDate, referenceDate);
                return (
                  <div
                    key={task.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          {task.id}
                        </span>
                        {renderStatusBadge(task.status)}
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px]",
                            deadline.variant === "urgent" &&
                              "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30",
                            deadline.variant === "warning" &&
                              "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                          )}
                        >
                          <Clock className="w-3 h-3 mr-1 inline" />
                          {deadline.label}
                        </Badge>
                      </div>

                      <h3
                        onClick={() => onSelectTask?.(task)}
                        className="text-sm font-semibold text-foreground hover:text-primary cursor-pointer"
                      >
                        {task.title}
                      </h3>

                      {task.parentTaskTitle && (
                        <p className="text-xs text-muted-foreground">
                          Nhiệm vụ cấp Trường: {task.parentTaskTitle}
                        </p>
                      )}

                      {task.deliverableDescription && (
                        <p className="text-xs text-muted-foreground/80 italic">
                          Yêu cầu minh chứng: {task.deliverableDescription}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {task.status !== "COMPLETED" && (
                        <Button
                          size="sm"
                          onClick={() => handleOpenSubmit(task)}
                          className="text-xs h-8 bg-primary text-primary-foreground gap-1.5 cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Nộp minh chứng</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 7. Review Action Dialog */}
      {reviewingTask && (
        <ReviewActionDialog
          isOpen={Boolean(reviewingTask)}
          onClose={handleCloseReview}
          task={reviewingTask}
          taskId={reviewingTask.id}
          taskTitle={reviewingTask.title}
          deliverableSummary={
            reviewingTask.deliverables && reviewingTask.deliverables.length > 0
              ? reviewingTask.deliverables[0].name
              : reviewingTask.deliverableDescription
          }
          deliverableUrl={
            reviewingTask.deliverables && reviewingTask.deliverables.length > 0
              ? reviewingTask.deliverables[0].url
              : undefined
          }
          reviewerRole="MANAGER"
          reviewerName={user.name}
          onReview={handleReviewSubmit}
        />
      )}

      {/* 8. Submit Deliverable Modal */}
      {submittingTask && (
        <SubmitDeliverableModal
          isOpen={Boolean(submittingTask)}
          onClose={handleCloseSubmit}
          task={submittingTask}
          taskId={submittingTask.id}
          taskTitle={submittingTask.title}
          onSubmit={handleDeliverableSubmit}
        />
      )}
    </div>
  );
}

// ============================================================================
// 5. Aliases & Re-exports
// ============================================================================

export const ManagerWorkspace = DepartmentManagerWorkspace;
export default DepartmentManagerWorkspace;
