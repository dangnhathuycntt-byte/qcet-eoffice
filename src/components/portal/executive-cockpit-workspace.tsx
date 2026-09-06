"use client";

import * as React from "react";
import Link from "next/link";
import {
  Building2,
  AlertTriangle,
  TrendingUp,
  CheckCircle2,
  ShieldAlert,
  ShieldCheck,
  Layers,
  Eye,
  ArrowRight,
  Search,
  FileCheck,
  Clock,
  User,
  Plus,
  ExternalLink,
  FileText,
  Filter,
  X,
  ChevronRight,
  Send,
  Sparkles,
  CheckSquare,
  Bell,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
  DepartmentHealthSummary as WorkspaceDepartmentHealthSummary,
} from "@/types/workspace";
import {
  QCET_DEPARTMENT_DEFINITIONS,
  computeDepartmentHealthMatrix,
  resolveDepartmentId,
  type DepartmentHealthSummary as MatrixDepartmentHealthSummary,
} from "@/lib/executive-matrix-aggregator";
import { isTaskPastDue, TODAY_ISO } from "@/lib/unified-task-hub";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { ReviewActionDialog } from "./review-action-dialog";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";
import {
  getDaysRemaining,
  getDeadlineBadgeInfo,
} from "./lecturer-focus-workspace";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// 1. Types & Interfaces
// ============================================================================

export type ExecutiveCockpitTab =
  | "BOTTLENECKS"
  | "APPROVAL_QUEUE"
  | "HEALTH_RADAR"
  | "STRATEGIC_TASKS";

export interface ExecutiveCockpitMetrics {
  bottlenecksCount: number;
  pendingInstitutionalApprovalCount: number;
  totalSchoolCompletionRate: number;
  activeTasksCount: number;
  totalTasksCount: number;
  completedTasksCount: number;
  delayedDepartmentsCount: number;
}

export interface ElevenDepartmentRadarItem {
  departmentCode: string;
  departmentName: string;
  leadName: string;
  totalTasks: number;
  completedTasks: number;
  delayedTasks: number;
  blockedTasks: number;
  completionRate: number;
  healthStatus: "GREEN" | "YELLOW" | "RED";
}

export interface SchoolBottleneckItem {
  id: string;
  title: string;
  departmentCode: string;
  departmentName: string;
  assigneeName: string;
  dueDate: string;
  daysRemaining: number | null;
  isOverdue: boolean;
  isBlocked: boolean;
  blockedReason?: string;
  progressPercent: number;
  taskType: "SCHOOL_TASK" | "STAFF_TASK";
  parentSchoolTaskId?: string;
  originalTask: SchoolTask | StaffTask;
}

export interface InstitutionalApprovalItem {
  id: string;
  title: string;
  departmentCode: string;
  departmentName: string;
  submittedByName: string;
  submittedDate?: string;
  dueDate: string;
  progressPercent: number;
  deliverablesCount: number;
  deliverables?: Array<{
    id: string;
    name: string;
    url?: string;
    fileType?: string;
  }>;
  deliverableDescription?: string;
  executiveCriteria?: string;
  taskType: "SCHOOL_TASK" | "STAFF_TASK";
  originalTask: SchoolTask | StaffTask;
}

export interface ExecutiveCockpitWorkspaceProps {
  user: AuthUser;
  tasks?: SchoolTask[];
  staffTasks?: StaffTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onReview?: (payload: ApprovalActionPayload) => Promise<void> | void;
  onSubmitDeliverable?: (
    payload: DeliverableSubmissionPayload
  ) => Promise<void> | void;
  onCreateDirective?: () => void;
  onSendReminder?: (deptCode: string, reason?: string) => void;
  referenceDate?: string;
  tasksUrl?: string;
  className?: string;
}

// ============================================================================
// 2. Pure Calculation Helpers (Exported for Testing)
// ============================================================================

/**
 * Calculates health status of a department based on completed, delayed, and total tasks.
 * Contract:
 * - total === 0 => GREEN
 * - delayed > 2 => RED
 * - delayed > 0 => YELLOW
 * - otherwise => GREEN
 */
export function calculateDepartmentHealth(
  completed: number,
  delayed: number,
  total: number
): "GREEN" | "YELLOW" | "RED" {
  if (total === 0) return "GREEN";
  if (delayed > 2) return "RED";
  if (delayed > 0) return "YELLOW";
  return "GREEN";
}

/** Alias for brief test compliance */
export const calculateHealth = calculateDepartmentHealth;

/**
 * Computes high-altitude metrics for executive cockpit strip.
 */
export function computeExecutiveCockpitMetrics(
  tasks: SchoolTask[] = [],
  staffTasks: StaffTask[] = [],
  referenceDate: string = TODAY_ISO
): ExecutiveCockpitMetrics {
  let blockedCount = 0;
  let overdueCount = 0;
  let pendingApprovalCount = 0;
  let activeCount = 0;
  let completedCount = 0;
  let totalProgressSum = 0;

  // Track checked IDs to prevent duplicate counting if subtasks are passed in both lists
  const seenSubTaskIds = new Set<string>();

  // Process SchoolTasks
  for (const task of tasks) {
    const isCompleted = task.status === "COMPLETED";
    const isBlocked = (task.status as string) === "BLOCKED";
    const isPastDue = isTaskPastDue(task.dueDate, referenceDate);

    if (isCompleted) {
      completedCount++;
      totalProgressSum += 100;
    } else {
      totalProgressSum +=
        typeof task.progressPercent === "number" ? task.progressPercent : 0;
      if (task.status === "IN_PROGRESS" || (task.status as string) === "NEW") {
        activeCount++;
      }
    }

    if (!isCompleted && isBlocked) {
      blockedCount++;
    }
    if (!isCompleted && isPastDue) {
      overdueCount++;
    }

    // Pending institutional approval: progress 100% or PENDING_EXECUTIVE_APPROVAL
    if (
      !isCompleted &&
      (task.status === "PENDING_EXECUTIVE_APPROVAL" ||
        task.progressPercent === 100)
    ) {
      pendingApprovalCount++;
    }

    // Process nested subTasks
    for (const sub of task.subTasks || []) {
      seenSubTaskIds.add(sub.id);
      const subCompleted = sub.status === "COMPLETED";
      const subBlocked = sub.status === "BLOCKED";
      const subPastDue = isTaskPastDue(sub.dueDate, referenceDate);

      if (!subCompleted && subBlocked) {
        blockedCount++;
      }
      if (!subCompleted && subPastDue) {
        overdueCount++;
      }
      if (
        !subCompleted &&
        (sub.status === "NEEDS_REVIEW" || sub.requiresReview === true)
      ) {
        pendingApprovalCount++;
      }
    }
  }

  // Process any external staff tasks not nested in tasks
  for (const sub of staffTasks) {
    if (seenSubTaskIds.has(sub.id)) continue;
    const subCompleted = sub.status === "COMPLETED";
    const subBlocked = sub.status === "BLOCKED";
    const subPastDue = isTaskPastDue(sub.dueDate, referenceDate);

    if (!subCompleted && subBlocked) {
      blockedCount++;
    }
    if (!subCompleted && subPastDue) {
      overdueCount++;
    }
    if (
      !subCompleted &&
      (sub.status === "NEEDS_REVIEW" || sub.requiresReview === true)
    ) {
      pendingApprovalCount++;
    }
  }

  const totalTasksCount = tasks.length;
  const totalSchoolCompletionRate =
    totalTasksCount > 0 ? Math.round(totalProgressSum / totalTasksCount) : 0;

  // Calculate health radar to get count of delayed departments
  const radar = computeElevenDepartmentRadar(tasks, staffTasks, referenceDate);
  const delayedDepartmentsCount = radar.filter(
    (d) => d.healthStatus !== "GREEN"
  ).length;

  return {
    bottlenecksCount: blockedCount + overdueCount,
    pendingInstitutionalApprovalCount: pendingApprovalCount,
    totalSchoolCompletionRate,
    activeTasksCount: activeCount,
    totalTasksCount,
    completedTasksCount: completedCount,
    delayedDepartmentsCount,
  };
}

/**
 * Computes the 11-Department Health Radar.
 * Guaranteed to return all 11 QCET units, sorted RED first, then YELLOW, then GREEN.
 */
export function computeElevenDepartmentRadar(
  tasks: SchoolTask[] = [],
  staffTasks: StaffTask[] = [],
  referenceDate: string = TODAY_ISO
): ElevenDepartmentRadarItem[] {
  // Use aggregator matrix as baseline
  const matrixData = computeDepartmentHealthMatrix(tasks, referenceDate);

  // Group staff tasks by department
  const subTaskMap = new Map<string, StaffTask[]>();
  for (const sub of staffTasks) {
    const deptId =
      resolveDepartmentId(sub.departmentCode) ||
      resolveDepartmentId(sub.triageSourceDept) ||
      resolveDepartmentId(undefined, sub.assigneeName) ||
      "CNTT";
    const existing = subTaskMap.get(deptId) || [];
    existing.push(sub);
    subTaskMap.set(deptId, existing);
  }

  const radarItems: ElevenDepartmentRadarItem[] =
    QCET_DEPARTMENT_DEFINITIONS.map((def) => {
      const summary = matrixData.find((m) => m.departmentId === def.id);
      const total = summary ? summary.totalTasksCount : 0;
      const completed = summary ? summary.completedTasksCount : 0;
      const overdue = summary ? summary.overdueTasksCount : 0;
      const blocked = summary ? summary.blockedTasksCount : 0;
      const delayed = overdue + blocked;

      const completionRate =
        summary && summary.averageProgressPercent !== undefined
          ? summary.averageProgressPercent
          : total > 0
            ? Math.round((completed / total) * 100)
            : 100;

      const healthStatus = calculateDepartmentHealth(completed, delayed, total);

      return {
        departmentCode: def.id,
        departmentName: def.name,
        leadName: def.leadName,
        totalTasks: total,
        completedTasks: completed,
        delayedTasks: overdue,
        blockedTasks: blocked,
        completionRate,
        healthStatus,
      };
    });

  // Sort: RED first, then YELLOW, then GREEN
  const SEVERITY_ORDER: Record<string, number> = {
    RED: 0,
    YELLOW: 1,
    GREEN: 2,
  };

  return radarItems.sort((a, b) => {
    const orderDiff =
      SEVERITY_ORDER[a.healthStatus] - SEVERITY_ORDER[b.healthStatus];
    if (orderDiff !== 0) return orderDiff;
    // Tie-breaker: higher delayed tasks count first
    const delayedA = a.delayedTasks + a.blockedTasks;
    const delayedB = b.delayedTasks + b.blockedTasks;
    if (delayedB !== delayedA) return delayedB - delayedA;
    // Lower completion rate first
    return a.completionRate - b.completionRate;
  });
}

/**
 * Extracts school bottleneck items for rapid executive triage.
 */
export function extractSchoolBottlenecks(
  tasks: SchoolTask[] = [],
  staffTasks: StaffTask[] = [],
  referenceDate: string = TODAY_ISO
): SchoolBottleneckItem[] {
  const bottlenecks: SchoolBottleneckItem[] = [];
  const seenSubIds = new Set<string>();

  // Check SchoolTasks
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const isPastDue = isTaskPastDue(task.dueDate, referenceDate);
    const isBlocked = (task.status as string) === "BLOCKED";
    const daysLeft = getDaysRemaining(task.dueDate, referenceDate);

    if (isPastDue || isBlocked) {
      bottlenecks.push({
        id: task.id,
        title: task.title,
        departmentCode: task.leadDepartmentCode || "BGH",
        departmentName: task.leadDepartment || "Ban Giám hiệu",
        assigneeName: task.leadAssigneeName,
        dueDate: task.dueDate,
        daysRemaining: daysLeft,
        isOverdue: isPastDue,
        isBlocked,
        progressPercent: task.progressPercent || 0,
        taskType: "SCHOOL_TASK",
        originalTask: task,
      });
    }

    // Check nested subTasks
    for (const sub of task.subTasks || []) {
      seenSubIds.add(sub.id);
      if (sub.status === "COMPLETED") continue;
      const subPastDue = isTaskPastDue(sub.dueDate, referenceDate);
      const subBlocked = sub.status === "BLOCKED";
      const subDaysLeft = getDaysRemaining(sub.dueDate, referenceDate);

      if (subPastDue || subBlocked) {
        bottlenecks.push({
          id: sub.id,
          title: sub.title,
          departmentCode: sub.departmentCode || task.leadDepartmentCode || "CNTT",
          departmentName: task.leadDepartment || "Khoa / Đơn vị",
          assigneeName: sub.assigneeName,
          dueDate: sub.dueDate,
          daysRemaining: subDaysLeft,
          isOverdue: subPastDue,
          isBlocked: subBlocked,
          blockedReason: sub.blockedReason,
          progressPercent: sub.status === "NEEDS_REVIEW" ? 90 : 40,
          taskType: "STAFF_TASK",
          parentSchoolTaskId: task.id,
          originalTask: sub,
        });
      }
    }
  }

  // Check external staff tasks
  for (const sub of staffTasks) {
    if (seenSubIds.has(sub.id)) continue;
    if (sub.status === "COMPLETED") continue;
    const subPastDue = isTaskPastDue(sub.dueDate, referenceDate);
    const subBlocked = sub.status === "BLOCKED";
    const subDaysLeft = getDaysRemaining(sub.dueDate, referenceDate);

    if (subPastDue || subBlocked) {
      bottlenecks.push({
        id: sub.id,
        title: sub.title,
        departmentCode: sub.departmentCode || "CNTT",
        departmentName: "Khoa / Đơn vị",
        assigneeName: sub.assigneeName,
        dueDate: sub.dueDate,
        daysRemaining: subDaysLeft,
        isOverdue: subPastDue,
        isBlocked: subBlocked,
        blockedReason: sub.blockedReason,
        progressPercent: sub.status === "NEEDS_REVIEW" ? 90 : 30,
        taskType: "STAFF_TASK",
        parentSchoolTaskId: sub.parentSchoolTaskId,
        originalTask: sub,
      });
    }
  }

  // Sort: blocked first, then worst overdue
  return bottlenecks.sort((a, b) => {
    if (a.isBlocked && !b.isBlocked) return -1;
    if (!a.isBlocked && b.isBlocked) return 1;
    const aDays = a.daysRemaining ?? 0;
    const bDays = b.daysRemaining ?? 0;
    return aDays - bDays;
  });
}

/**
 * Extracts items waiting for institutional/school-level approval.
 */
export function extractInstitutionalApprovalQueue(
  tasks: SchoolTask[] = [],
  staffTasks: StaffTask[] = []
): InstitutionalApprovalItem[] {
  const queue: InstitutionalApprovalItem[] = [];
  const seenSubIds = new Set<string>();

  // SchoolTasks with 100% progress or PENDING_EXECUTIVE_APPROVAL
  for (const task of tasks) {
    if (task.status === "COMPLETED") continue;
    const isSchoolPending =
      task.status === "PENDING_EXECUTIVE_APPROVAL" ||
      task.progressPercent === 100;

    if (isSchoolPending) {
      queue.push({
        id: task.id,
        title: task.title,
        departmentCode: task.leadDepartmentCode || "BGH",
        departmentName: task.leadDepartment || "Ban Giám hiệu",
        submittedByName: task.completionReport?.submittedBy || task.leadAssigneeName,
        submittedDate: task.completionReport?.submittedAt || task.assignedDate,
        dueDate: task.dueDate,
        progressPercent: task.progressPercent || 100,
        deliverablesCount: task.completionReport?.reportUrl ? 1 : 0,
        deliverables: task.completionReport?.reportUrl
          ? [
              {
                id: `rep-${task.id}`,
                name: "Báo cáo nghiệm thu hoàn thành",
                url: task.completionReport.reportUrl,
                fileType: "pdf",
              },
            ]
          : [],
        executiveCriteria: task.executiveCriteria,
        taskType: "SCHOOL_TASK",
        originalTask: task,
      });
    }

    // Nested subTasks requiring review
    for (const sub of task.subTasks || []) {
      seenSubIds.add(sub.id);
      if (sub.status === "COMPLETED") continue;
      if (sub.status === "NEEDS_REVIEW" || sub.requiresReview === true) {
        queue.push({
          id: sub.id,
          title: sub.title,
          departmentCode: sub.departmentCode || task.leadDepartmentCode || "CNTT",
          departmentName: task.leadDepartment || "Khoa / Đơn vị",
          submittedByName: sub.assigneeName,
          submittedDate: sub.updatedAt,
          dueDate: sub.dueDate,
          progressPercent: 95,
          deliverablesCount: (sub.deliverables || []).length,
          deliverables: sub.deliverables,
          deliverableDescription: sub.deliverableDescription,
          taskType: "STAFF_TASK",
          originalTask: sub,
        });
      }
    }
  }

  // External staff tasks requiring review
  for (const sub of staffTasks) {
    if (seenSubIds.has(sub.id)) continue;
    if (sub.status === "COMPLETED") continue;
    if (sub.status === "NEEDS_REVIEW" || sub.requiresReview === true) {
      queue.push({
        id: sub.id,
        title: sub.title,
        departmentCode: sub.departmentCode || "CNTT",
        departmentName: "Khoa / Đơn vị",
        submittedByName: sub.assigneeName,
        submittedDate: sub.updatedAt,
        dueDate: sub.dueDate,
        progressPercent: 95,
        deliverablesCount: (sub.deliverables || []).length,
        deliverables: sub.deliverables,
        deliverableDescription: sub.deliverableDescription,
        taskType: "STAFF_TASK",
        originalTask: sub,
      });
    }
  }

  return queue;
}

/**
 * Filter strategic school tasks by search, status, and department.
 */
export function filterStrategicTasks(
  tasks: SchoolTask[] = [],
  options: {
    searchTerm?: string;
    statusFilter?: string;
    departmentFilter?: string;
    referenceDate?: string;
  } = {}
): SchoolTask[] {
  const {
    searchTerm = "",
    statusFilter = "ALL",
    departmentFilter = "ALL",
    referenceDate = TODAY_ISO,
  } = options;

  const cleanSearch = searchTerm.trim().toLowerCase();

  return tasks.filter((task) => {
    // 1. Department filter
    if (departmentFilter && departmentFilter !== "ALL") {
      const taskDept = (
        task.leadDepartmentCode ||
        task.leadDepartmentId ||
        ""
      ).toUpperCase();
      const targetDept = departmentFilter.trim().toUpperCase();
      if (taskDept !== targetDept) {
        // Also check subtasks
        const hasSubMatching = (task.subTasks || []).some((s) => {
          const subDept = (s.departmentCode || "").toUpperCase();
          return subDept === targetDept;
        });
        if (!hasSubMatching) return false;
      }
    }

    // 2. Search query
    if (cleanSearch) {
      const matchTitle = (task.title || "").toLowerCase().includes(cleanSearch);
      const matchId = (task.id || "").toLowerCase().includes(cleanSearch);
      const matchLead = (task.leadAssigneeName || "")
        .toLowerCase()
        .includes(cleanSearch);
      const matchDept = (task.leadDepartment || "")
        .toLowerCase()
        .includes(cleanSearch);
      const matchCategory = (task.categoryLabel || "")
        .toLowerCase()
        .includes(cleanSearch);

      if (
        !matchTitle &&
        !matchId &&
        !matchLead &&
        !matchDept &&
        !matchCategory
      ) {
        return false;
      }
    }

    // 3. Status filter
    if (statusFilter === "ALL") return true;

    if (statusFilter === "IN_PROGRESS") {
      return task.status === "IN_PROGRESS";
    }

    if (statusFilter === "PENDING_APPROVAL") {
      return (
        task.status === "PENDING_EXECUTIVE_APPROVAL" ||
        (task.status !== "COMPLETED" && task.progressPercent === 100) ||
        (task.subTasks || []).some((s) => s.status === "NEEDS_REVIEW")
      );
    }

    if (statusFilter === "BOTTLENECK") {
      const isPastDue = isTaskPastDue(task.dueDate, referenceDate);
      const isBlocked = (task.status as string) === "BLOCKED";
      const hasSubBottleneck = (task.subTasks || []).some(
        (s) =>
          s.status === "BLOCKED" ||
          (s.status !== "COMPLETED" && isTaskPastDue(s.dueDate, referenceDate))
      );
      return (
        (task.status !== "COMPLETED" && (isPastDue || isBlocked)) ||
        hasSubBottleneck
      );
    }

    if (statusFilter === "COMPLETED") {
      return task.status === "COMPLETED";
    }

    return true;
  });
}

// ============================================================================
// 3. Main Component: ExecutiveCockpitWorkspace
// ============================================================================

export function ExecutiveCockpitWorkspace({
  user,
  tasks = [],
  staffTasks = [],
  onSelectTask,
  onReview,
  onSubmitDeliverable,
  onCreateDirective,
  onSendReminder,
  referenceDate = TODAY_ISO,
  tasksUrl = "/tasks",
  className,
}: ExecutiveCockpitWorkspaceProps) {
  const [activeTab, setActiveTab] =
    React.useState<ExecutiveCockpitTab>("BOTTLENECKS");
  const [selectedDepartment, setSelectedDepartment] =
    React.useState<string>("ALL");
  const [searchTerm, setSearchTerm] = React.useState<string>("");
  const [strategicStatusFilter, setStrategicStatusFilter] =
    React.useState<string>("ALL");

  // Dialog states
  const [reviewingTask, setReviewingTask] = React.useState<
    StaffTask | SchoolTask | null
  >(null);
  const [submittingTask, setSubmittingTask] = React.useState<StaffTask | null>(
    null
  );

  // Local notification banner state
  const [reminderNotice, setReminderNotice] = React.useState<string | null>(
    null
  );

  // Metrics computation
  const metrics = React.useMemo(() => {
    return computeExecutiveCockpitMetrics(tasks, staffTasks, referenceDate);
  }, [tasks, staffTasks, referenceDate]);

  // Health radar computation for 11 units
  const radarItems = React.useMemo(() => {
    return computeElevenDepartmentRadar(tasks, staffTasks, referenceDate);
  }, [tasks, staffTasks, referenceDate]);

  // Matrix data for DepartmentProgressMatrix
  const matrixDepartments = React.useMemo(() => {
    return computeDepartmentHealthMatrix(tasks, referenceDate);
  }, [tasks, referenceDate]);

  // Bottlenecks list
  const bottlenecks = React.useMemo(() => {
    return extractSchoolBottlenecks(tasks, staffTasks, referenceDate);
  }, [tasks, staffTasks, referenceDate]);

  // Institutional approval queue
  const approvalQueue = React.useMemo(() => {
    return extractInstitutionalApprovalQueue(tasks, staffTasks);
  }, [tasks, staffTasks]);

  // Filtered strategic tasks
  const filteredStrategicTasks = React.useMemo(() => {
    return filterStrategicTasks(tasks, {
      searchTerm,
      statusFilter: strategicStatusFilter,
      departmentFilter: selectedDepartment,
      referenceDate,
    });
  }, [
    tasks,
    searchTerm,
    strategicStatusFilter,
    selectedDepartment,
    referenceDate,
  ]);

  // Selected department details
  const selectedDeptDef = React.useMemo(() => {
    if (selectedDepartment === "ALL") return null;
    return QCET_DEPARTMENT_DEFINITIONS.find((d) => d.id === selectedDepartment);
  }, [selectedDepartment]);

  // Handler: Send reminder to unit
  const handleTriggerReminder = (deptCode: string, reason?: string) => {
    if (onSendReminder) {
      onSendReminder(deptCode, reason);
    }
    const deptDef = QCET_DEPARTMENT_DEFINITIONS.find((d) => d.id === deptCode);
    const deptName = deptDef ? deptDef.name : deptCode;
    setReminderNotice(
      `Đã phát lệnh đôn đốc xử lý tiến độ tới ${deptName}${reason ? ` (${reason})` : ""}.`
    );
    setTimeout(() => {
      setReminderNotice(null);
    }, 4000);
  };

  // Handler: Review action submit
  const handleReviewSubmit = async (payload: ApprovalActionPayload) => {
    if (onReview) {
      await onReview(payload);
    }
    setReviewingTask(null);
  };

  return (
    <div
      className={cn("w-full space-y-6", className)}
      data-slot="executive-cockpit-workspace"
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
              className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 text-xs px-2.5 py-0.5 font-medium"
            >
              Lãnh đạo Ban Giám Hiệu
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 flex items-center gap-2">
            <span>{user.roleLabel || "Ban Giám Hiệu"}</span>
            <span className="text-muted-foreground/40">•</span>
            <span>Khoang điều hành chiến lược & Quyết định cấp trường</span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {onCreateDirective && (
            <Button
              type="button"
              onClick={onCreateDirective}
              size="sm"
              className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Giao chỉ đạo nhiệm vụ BGH</span>
            </Button>
          )}

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5"
          >
            <Link href={tasksUrl}>
              <Layers className="w-3.5 h-3.5" />
              <span>Xem bảng giao việc đầy đủ</span>
              <ArrowRight className="w-3 h-3 ml-0.5" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Local reminder notification banner */}
      {reminderNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-medium animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span>{reminderNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setReminderNotice(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 2. High-Altitude Cockpit Strip */}
      <div
        className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        data-slot="executive-cockpit-strip"
      >
        {/* Metric 1: Tắc nghẽn cần tháo gỡ (High Priority) */}
        <button
          type="button"
          onClick={() => setActiveTab("BOTTLENECKS")}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "BOTTLENECKS"
              ? "border-rose-500/50 bg-rose-500/10 shadow-xs ring-1 ring-rose-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Tắc nghẽn cần tháo gỡ
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.bottlenecksCount > 0
                  ? "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-bold tracking-tight",
                metrics.bottlenecksCount > 0
                  ? "text-rose-600 dark:text-rose-400"
                  : "text-foreground"
              )}
            >
              {metrics.bottlenecksCount}
            </span>
            <span className="text-xs text-muted-foreground">điểm nghẽn</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {metrics.bottlenecksCount > 0
              ? `${metrics.delayedDepartmentsCount} đơn vị cần can thiệp xử lý`
              : "Tiến độ toàn trường thông suốt"}
          </p>
        </button>

        {/* Metric 2: Hồ sơ chờ phê duyệt cấp Trường */}
        <button
          type="button"
          onClick={() => setActiveTab("APPROVAL_QUEUE")}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "APPROVAL_QUEUE"
              ? "border-indigo-500/50 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Hồ sơ chờ phê duyệt cấp Trường
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.pendingInstitutionalApprovalCount > 0
                  ? "bg-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-bold tracking-tight",
                metrics.pendingInstitutionalApprovalCount > 0
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-foreground"
              )}
            >
              {metrics.pendingInstitutionalApprovalCount}
            </span>
            <span className="text-xs text-muted-foreground">tờ trình</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {metrics.pendingInstitutionalApprovalCount > 0
              ? "Chờ BGH thẩm định & ký duyệt"
              : "Không có tờ trình tồn đọng"}
          </p>
        </button>

        {/* Metric 3: Chỉ số hoàn thành toàn trường */}
        <button
          type="button"
          onClick={() => setActiveTab("HEALTH_RADAR")}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "HEALTH_RADAR"
              ? "border-emerald-500/50 bg-emerald-500/10 shadow-xs ring-1 ring-emerald-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Chỉ số hoàn thành toàn trường
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
              {metrics.totalSchoolCompletionRate}%
            </span>
            <span className="text-xs text-muted-foreground">kế hoạch</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {metrics.completedTasksCount}/{metrics.totalTasksCount} nhiệm vụ
            đã hoàn thành
          </p>
        </button>

        {/* Metric 4: Tổng số nhiệm vụ đang chạy */}
        <button
          type="button"
          onClick={() => setActiveTab("STRATEGIC_TASKS")}
          className={cn(
            "flex flex-col gap-2 rounded-xl border p-4 text-left transition-all duration-150 cursor-pointer",
            activeTab === "STRATEGIC_TASKS"
              ? "border-blue-500/50 bg-blue-500/10 shadow-xs ring-1 ring-blue-500/30"
              : "border-border bg-card hover:bg-muted/40 hover:border-border/80"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Tổng số nhiệm vụ đang chạy
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              {metrics.activeTasksCount}
            </span>
            <span className="text-xs text-muted-foreground">trọng tâm</span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-1">
            Đang triển khai tại 11 phòng / khoa
          </p>
        </button>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center gap-1 border-b overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveTab("BOTTLENECKS")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "BOTTLENECKS"
              ? "border-rose-600 text-rose-600 dark:text-rose-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Cảnh báo thắt nút cổ chai & Tắc nghẽn</span>
          {metrics.bottlenecksCount > 0 && (
            <Badge
              variant="destructive"
              className="text-[10px] px-1.5 py-0 h-4 bg-rose-500"
            >
              {metrics.bottlenecksCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("APPROVAL_QUEUE")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "APPROVAL_QUEUE"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Hàng đợi Phê duyệt Chiến lược</span>
          {metrics.pendingInstitutionalApprovalCount > 0 && (
            <Badge className="text-[10px] px-1.5 py-0 h-4 bg-indigo-600 text-white">
              {metrics.pendingInstitutionalApprovalCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HEALTH_RADAR")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "HEALTH_RADAR"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <Building2 className="w-4 h-4" />
          <span>Radar Sức Khỏe 11 Đơn Vị</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STRATEGIC_TASKS")}
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "STRATEGIC_TASKS"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <Layers className="w-4 h-4" />
          <span>Nhiệm vụ Chiến lược cấp Trường</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 4. Tab 1: BOTTLENECKS (Tắc nghẽn & Thắt nút cổ chai)                */}
      {/* ==================================================================== */}
      {activeTab === "BOTTLENECKS" && (
        <div className="space-y-4" data-slot="bottlenecks-section">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400" />
                <span>Nhiệm vụ bị vướng mắc hoặc chậm trễ cần tháo gỡ</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Tập trung xử lý các điểm nghẽn liên đơn vị, phê duyệt tháo gỡ khó khăn hoặc phát lệnh chỉ đạo trực tiếp.
              </p>
            </div>
            {bottlenecks.length > 0 && (
              <Badge variant="destructive" className="self-start text-xs">
                {bottlenecks.length} điểm nghẽn khẩn cấp
              </Badge>
            )}
          </div>

          {bottlenecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
              <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full mb-3">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Không có điểm nghẽn nghiêm trọng
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1">
                Tất cả các phòng ban, khoa và trung tâm đều đang vận hành đúng tiến độ và không có báo cáo ách tắc cần BGH can thiệp.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {bottlenecks.map((item) => {
                const daysBadge = getDeadlineBadgeInfo(
                  item.dueDate,
                  referenceDate
                );

                return (
                  <div
                    key={item.id}
                    className="flex flex-col justify-between gap-3 p-4 rounded-xl border border-rose-500/30 bg-rose-500/[0.03] dark:bg-rose-500/[0.05] hover:border-rose-500/50 transition-all shadow-2xs"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <Badge
                            variant="outline"
                            className="bg-muted text-foreground text-[10px] font-mono px-1.5 py-0.5"
                          >
                            {item.id}
                          </Badge>
                          <Badge
                            variant="outline"
                            className="bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30 text-[10px]"
                          >
                            {item.departmentCode}
                          </Badge>
                        </div>
                        {item.isBlocked ? (
                          <Badge
                            variant="destructive"
                            className="text-[10px] bg-rose-600 font-semibold"
                          >
                            Đang bị vướng mắc
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-medium",
                              daysBadge.variant === "urgent"
                                ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                                : daysBadge.variant === "warning"
                                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                                  : "bg-muted text-muted-foreground"
                            )}
                          >
                            {daysBadge.label}
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
                        {item.title}
                      </h4>

                      {item.blockedReason && (
                        <div className="p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300">
                          <span className="font-semibold">Nguyên nhân: </span>
                          <span>{item.blockedReason}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border/40">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5" />
                          <span>{item.assigneeName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Hạn: {item.dueDate}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          handleTriggerReminder(
                            item.departmentCode,
                            item.title
                          )
                        }
                        className="text-xs h-7 gap-1 hover:bg-amber-500/10 hover:text-amber-700 dark:hover:text-amber-400"
                      >
                        <Send className="w-3 h-3" />
                        <span>Gửi đôn đốc</span>
                      </Button>

                      {onSelectTask && (
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => onSelectTask(item.originalTask)}
                          className="text-xs h-7 gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Tháo gỡ ngay</span>
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

      {/* ==================================================================== */}
      {/* 5. Tab 2: APPROVAL_QUEUE (Hàng đợi Phê duyệt Chiến lược cấp Trường)  */}
      {/* ==================================================================== */}
      {activeTab === "APPROVAL_QUEUE" && (
        <div className="space-y-4" data-slot="approval-queue-section">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span>Hồ sơ và tờ trình chờ Ban Giám Hiệu phê duyệt</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Các nhiệm vụ trọng tâm đã qua Trưởng đơn vị thẩm định hoặc đã hoàn tất báo cáo kết quả cấp trường.
              </p>
            </div>
            {approvalQueue.length > 0 && (
              <Badge className="self-start text-xs bg-indigo-600 text-white">
                {approvalQueue.length} hồ sơ chờ duyệt
              </Badge>
            )}
          </div>

          {approvalQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
              <div className="p-3 bg-indigo-500/10 text-indigo-600 rounded-full mb-3">
                <FileCheck className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Hàng đợi phê duyệt đang trống
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1">
                Hiện tại không có tờ trình hoặc hồ sơ nào chờ ký duyệt ban hành. Các quyết định đã được cập nhật đầy đủ.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {approvalQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:border-indigo-500/40 hover:shadow-xs transition-all"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="bg-muted text-foreground text-[10px] font-mono px-1.5 py-0.5"
                      >
                        {item.id}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 border-indigo-500/30 text-[10px]"
                      >
                        {item.departmentCode}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {item.departmentName}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-foreground truncate">
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1">
                        <User className="w-3.5 h-3.5" />
                        Người trình: {item.submittedByName}
                      </span>
                      <span>•</span>
                      <span>Ngày gửi: {item.submittedDate || "Mới cập nhật"}</span>
                      {item.deliverablesCount > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1 text-indigo-600 dark:text-indigo-400 font-medium">
                            <FileText className="w-3.5 h-3.5" />
                            {item.deliverablesCount} tệp minh chứng đính kèm
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                    {onSelectTask && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectTask(item.originalTask)}
                        className="text-xs h-8 gap-1"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem chi tiết</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setReviewingTask(item.originalTask)}
                      className="text-xs h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Ký duyệt ban hành</span>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* 6. Tab 3: HEALTH_RADAR (Tiến độ & Radar Sức Khỏe 11 Đơn Vị)          */}
      {/* ==================================================================== */}
      {activeTab === "HEALTH_RADAR" && (
        <div className="space-y-6" data-slot="health-radar-section">
          {/* Top section: Department Progress Matrix (Heatmap) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-600" />
                  <span>Ma trận tiến độ toàn diện các đơn vị (Heatmap Matrix)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Nhấp vào một đơn vị để lọc nhanh các nhiệm vụ liên quan ở danh sách bên dưới.
                </p>
              </div>
              {selectedDepartment !== "ALL" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedDepartment("ALL")}
                  className="text-xs h-7 gap-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                  <span>Bỏ chọn lọc ({selectedDepartment})</span>
                </Button>
              )}
            </div>

            <DepartmentProgressMatrix
              departments={matrixDepartments}
              selectedDepartment={selectedDepartment}
              onSelectDepartment={(deptId) => setSelectedDepartment(deptId)}
            />
          </div>

          {/* Bottom section: Detailed 11-Unit Health Radar Table */}
          <div className="space-y-3 pt-4 border-t">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  <span>Radar Sức Khỏe 11 Đơn Vị (Được sắp xếp theo mức độ ưu tiên)</span>
                </h3>
                <p className="text-xs text-muted-foreground">
                  Các đơn vị có chỉ số Đỏ (nhiều việc chậm trễ) được xếp lên trên cùng kèm chức năng phát thông điệp nhắc nhở.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {radarItems.map((dept) => {
                const isSelected = selectedDepartment === dept.departmentCode;

                const healthBadgeClass =
                  dept.healthStatus === "RED"
                    ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/30"
                    : dept.healthStatus === "YELLOW"
                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";

                const healthText =
                  dept.healthStatus === "RED"
                    ? "Cảnh báo chậm trễ"
                    : dept.healthStatus === "YELLOW"
                      ? "Cần lưu ý tiến độ"
                      : "Tiến độ đạt chuẩn";

                return (
                  <div
                    key={dept.departmentCode}
                    className={cn(
                      "flex flex-col justify-between gap-3 p-4 rounded-xl border bg-card transition-all",
                      isSelected
                        ? "border-primary ring-2 ring-primary/20 shadow-xs"
                        : "border-border/70 hover:border-border hover:shadow-2xs",
                      dept.healthStatus === "RED" && "bg-rose-500/[0.02]"
                    )}
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Badge
                          variant="outline"
                          className="text-xs font-mono font-semibold"
                        >
                          {dept.departmentCode}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", healthBadgeClass)}
                        >
                          {healthText}
                        </Badge>
                      </div>

                      <div>
                        <h4 className="text-sm font-semibold text-foreground line-clamp-1">
                          {dept.departmentName}
                        </h4>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <User className="w-3 h-3" />
                          <span>Trưởng đơn vị: {dept.leadName}</span>
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1 pt-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Tiến độ</span>
                          <span className="font-semibold text-foreground">
                            {dept.completionRate}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              dept.completionRate >= 80
                                ? "bg-emerald-500"
                                : dept.completionRate >= 50
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, dept.completionRate))}%` }}
                          />
                        </div>
                      </div>

                      {/* Task breakdown */}
                      <div className="grid grid-cols-3 gap-1 pt-1 text-center text-xs">
                        <div className="p-1.5 rounded bg-muted/40">
                          <div className="font-semibold text-foreground">
                            {dept.totalTasks}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Tổng số
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-emerald-500/10">
                          <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {dept.completedTasks}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            Hoàn thành
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-1.5 rounded",
                            dept.delayedTasks + dept.blockedTasks > 0
                              ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold"
                              : "bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <div>{dept.delayedTasks + dept.blockedTasks}</div>
                          <div className="text-[10px]">Chậm/Nghẽn</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
                      <Button
                        type="button"
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() =>
                          setSelectedDepartment(
                            isSelected ? "ALL" : dept.departmentCode
                          )
                        }
                        className="text-xs h-7 flex-1"
                      >
                        {isSelected ? "Bỏ chọn" : "Xem việc"}
                      </Button>

                      {(dept.healthStatus === "RED" ||
                        dept.healthStatus === "YELLOW") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            handleTriggerReminder(
                              dept.departmentCode,
                              "Đôn đốc tiến độ"
                            )
                          }
                          className="text-xs h-7 gap-1 hover:bg-rose-500/10 hover:text-rose-700 dark:hover:text-rose-400"
                        >
                          <Send className="w-3 h-3" />
                          <span>Nhắc nhở</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* 7. Tab 4: STRATEGIC_TASKS (Danh sách nhiệm vụ chiến lược cấp Trường) */}
      {/* ==================================================================== */}
      {activeTab === "STRATEGIC_TASKS" && (
        <div className="space-y-4" data-slot="strategic-tasks-section">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Layers className="w-5 h-5 text-primary" />
                <span>Nhiệm vụ chiến lược cấp Trường</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Theo dõi tiến độ, phân cấp thực thi và chỉ đạo phối hợp giữa các đơn vị toàn trường.
              </p>
            </div>

            {selectedDepartment !== "ALL" && (
              <Badge
                variant="secondary"
                className="self-start sm:self-auto gap-1 text-xs py-1 px-2.5"
              >
                <span>Đang lọc đơn vị: {selectedDepartment}</span>
                <button
                  type="button"
                  onClick={() => setSelectedDepartment("ALL")}
                  className="ml-1 hover:text-destructive cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            )}
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Tìm nhiệm vụ chiến lược, mã số, người chủ trì..."
                className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-primary"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "ALL", label: "Tất cả" },
                { id: "IN_PROGRESS", label: "Đang triển khai" },
                { id: "PENDING_APPROVAL", label: "Chờ phê duyệt" },
                { id: "BOTTLENECK", label: "Chậm / Nghẽn" },
                { id: "COMPLETED", label: "Hoàn thành" },
              ].map((f) => (
                <Button
                  key={f.id}
                  type="button"
                  variant={
                    strategicStatusFilter === f.id ? "default" : "outline"
                  }
                  size="sm"
                  onClick={() => setStrategicStatusFilter(f.id)}
                  className="text-xs h-8 whitespace-nowrap"
                >
                  {f.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Strategic Tasks List */}
          {filteredStrategicTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center border rounded-xl bg-card border-dashed">
              <div className="p-3 bg-muted text-muted-foreground rounded-full mb-3">
                <Search className="w-8 h-8" />
              </div>
              <h3 className="text-sm font-semibold text-foreground">
                Không tìm thấy nhiệm vụ phù hợp
              </h3>
              <p className="text-xs text-muted-foreground max-w-md mt-1">
                Thử đổi từ khóa tìm kiếm hoặc bỏ các bộ lọc để xem toàn bộ danh sách nhiệm vụ toàn trường.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredStrategicTasks.map((task) => {
                const isOverdue =
                  task.status !== "COMPLETED" &&
                  isTaskPastDue(task.dueDate, referenceDate);
                const isPendingApproval =
                  task.status === "PENDING_EXECUTIVE_APPROVAL" ||
                  (task.status !== "COMPLETED" && task.progressPercent === 100);

                return (
                  <div
                    key={task.id}
                    className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:border-primary/40 hover:shadow-xs transition-all"
                  >
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge
                          variant="outline"
                          className="bg-muted text-foreground text-[10px] font-mono px-1.5 py-0.5"
                        >
                          {task.id}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-primary/5 text-primary border-primary/20 text-[10px]"
                        >
                          {task.leadDepartmentCode || "BGH"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-[10px] bg-muted/40 text-muted-foreground"
                        >
                          {task.categoryLabel || "Chiến lược"}
                        </Badge>
                        {isOverdue && (
                          <Badge
                            variant="destructive"
                            className="text-[10px] bg-rose-500"
                          >
                            Quá hạn
                          </Badge>
                        )}
                        {isPendingApproval && (
                          <Badge className="text-[10px] bg-indigo-600 text-white">
                            Chờ BGH phê duyệt
                          </Badge>
                        )}
                        {task.status === "COMPLETED" && (
                          <Badge
                            variant="outline"
                            className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                          >
                            Đã hoàn thành
                          </Badge>
                        )}
                      </div>

                      <h4 className="text-sm font-semibold text-foreground line-clamp-2">
                        {task.title}
                      </h4>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5" />
                          Chủ trì: {task.leadAssigneeName}
                        </span>
                        <span>•</span>
                        <span>Đơn vị: {task.leadDepartment}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          Hạn: {task.dueDate}
                        </span>
                        <span>•</span>
                        <span>
                          {task.completedSubTasks}/{task.totalSubTasks} đầu việc con
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full max-w-md pt-1 space-y-1">
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>Tiến độ thực hiện</span>
                          <span className="font-semibold text-foreground">
                            {task.progressPercent}%
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              "h-full transition-all duration-300",
                              task.progressPercent >= 80
                                ? "bg-emerald-500"
                                : task.progressPercent >= 50
                                  ? "bg-amber-500"
                                  : "bg-primary"
                            )}
                            style={{ width: `${Math.min(100, Math.max(0, task.progressPercent))}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center shrink-0">
                      {isPendingApproval && (
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => setReviewingTask(task)}
                          className="text-xs h-8 gap-1 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ký duyệt</span>
                        </Button>
                      )}

                      {onSelectTask && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onSelectTask(task)}
                          className="text-xs h-8 gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Chi tiết</span>
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

      {/* ==================================================================== */}
      {/* 8. Dialog Integrations                                               */}
      {/* ==================================================================== */}
      {/* Review & Approval Action Dialog */}
      <ReviewActionDialog
        isOpen={Boolean(reviewingTask)}
        onClose={() => setReviewingTask(null)}
        onReview={handleReviewSubmit}
        task={reviewingTask}
        reviewerRole={user.role}
        reviewerName={user.name}
      />

      {/* Deliverable Submission Modal (if BGH submits attachments) */}
      <SubmitDeliverableModal
        isOpen={Boolean(submittingTask)}
        onClose={() => setSubmittingTask(null)}
        onSubmit={async (payload) => {
          if (onSubmitDeliverable) {
            await onSubmitDeliverable(payload);
          }
          setSubmittingTask(null);
        }}
        task={submittingTask}
      />
    </div>
  );
}

/** Default and alias exports for maximum compatibility */
export const ExecutiveWorkspace = ExecutiveCockpitWorkspace;
export default ExecutiveCockpitWorkspace;
