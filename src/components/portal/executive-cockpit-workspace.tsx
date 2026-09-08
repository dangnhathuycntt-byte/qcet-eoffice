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
  RefreshCw,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import type { AuthUser } from "@/types/auth";
import type {
  ApprovalActionPayload,
  DeliverableSubmissionPayload,
  DepartmentHealthSummary as WorkspaceDepartmentHealthSummary,
  SchoolBottleneckItem,
} from "@/types/workspace";
import type { ExecutiveResolutionPayload } from "@/types/executive-resolution";
import {
  QCET_DEPARTMENT_DEFINITIONS,
  computeDepartmentHealthMatrix,
  resolveDepartmentId,
  type DepartmentHealthSummary as MatrixDepartmentHealthSummary,
} from "@/lib/executive-matrix-aggregator";
import { isTaskPastDue, TODAY_ISO } from "@/lib/unified-task-hub";
import { applyExecutiveResolution } from "@/lib/executive-resolution-state";
import { DepartmentProgressMatrix } from "@/components/dashboard/department-progress-matrix";
import { ReviewActionDialog } from "./review-action-dialog";
import { SubmitDeliverableModal } from "./submit-deliverable-modal";
import { ExecutiveResolutionDrawer } from "./executive-resolution-drawer";
import { ExecutiveBottleneckCard } from "./executive-bottleneck-card";
import { ExecutiveUnitRadar } from "./executive-unit-radar";
import { ExecutiveBriefingModal } from "./executive-briefing-modal";
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

export type { SchoolBottleneckItem };

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
  onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
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
  const radar = computeElevenDepartmentRadar(tasks, referenceDate);
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
  referenceDate: string = TODAY_ISO
): ElevenDepartmentRadarItem[] {
  // Use aggregator matrix as baseline
  const matrixData = computeDepartmentHealthMatrix(tasks, referenceDate);

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
  referenceDate: string = TODAY_ISO
): SchoolBottleneckItem[] {
  const bottlenecks: SchoolBottleneckItem[] = [];

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
        assigneeName: task.leadDepartment || "Ban Giám hiệu",
        dueDate: task.dueDate,
        daysRemaining: daysLeft,
        daysOverdue:
          daysLeft !== null && daysLeft < 0
            ? Math.abs(daysLeft)
            : isPastDue
              ? 1
              : undefined,
        isOverdue: isPastDue,
        isBlocked,
        blockedReason: (task as any).blockedReason,
        progressPercent: task.progressPercent || 0,
        taskType: "SCHOOL_TASK",
        originalTask: task,
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
  tasks: SchoolTask[] = []
): InstitutionalApprovalItem[] {
  const queue: InstitutionalApprovalItem[] = [];

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
        submittedByName: task.leadDepartment || "Ban Giám hiệu",
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

  // Dialog & Drawer states
  const [reviewingTask, setReviewingTask] = React.useState<
    StaffTask | SchoolTask | null
  >(null);
  const [submittingTask, setSubmittingTask] = React.useState<StaffTask | null>(
    null
  );
  const [activeResolvingBottleneck, setActiveResolvingBottleneck] =
    React.useState<SchoolBottleneckItem | null>(null);

  // Undo state for optimistic resolutions
  const [undoState, setUndoState] = React.useState<{
    item: SchoolBottleneckItem;
    summary: string;
    expiresAt: number;
  } | null>(null);

  // Sync time state & refresh
  const [lastSyncTime, setLastSyncTime] = React.useState<string>("hôm nay");
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  React.useEffect(() => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setLastSyncTime(`${hours}:${minutes}`);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    setLastSyncTime(`${hours}:${minutes}`);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 400);
  };

  // Local notification banner state
  const [reminderNotice, setReminderNotice] = React.useState<string | null>(
    null
  );

  // Initial bottlenecks extracted from props
  const initialBottlenecks = React.useMemo(() => {
    return extractSchoolBottlenecks(tasks, referenceDate);
  }, [tasks, referenceDate]);

  // Active bottlenecks and resolved IDs for optimistic update flow
  const [activeBottlenecks, setActiveBottlenecks] =
    React.useState<SchoolBottleneckItem[]>(initialBottlenecks);
  const [resolvedTaskIds, setResolvedTaskIds] = React.useState<Set<string>>(
    new Set()
  );

  // Sync activeBottlenecks when initialBottlenecks changes, preserving optimistic resolutions
  React.useEffect(() => {
    setActiveBottlenecks(
      initialBottlenecks.filter((item) => !resolvedTaskIds.has(item.id))
    );
  }, [initialBottlenecks, resolvedTaskIds]);

  // Auto-expire undo toast after 5s
  React.useEffect(() => {
    if (!undoState) return;
    const remaining = undoState.expiresAt - Date.now();
    if (remaining <= 0) {
      setUndoState(null);
      return;
    }
    const timer = setTimeout(() => {
      setUndoState(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [undoState]);

  // Handler: Confirm resolution in drawer
  const handleConfirmResolution = (payload: ExecutiveResolutionPayload) => {
    const result = applyExecutiveResolution(activeBottlenecks, payload);
    setActiveBottlenecks(result.updatedBottlenecks);
    setResolvedTaskIds((prev) => new Set([...prev, payload.taskId]));
    setActiveResolvingBottleneck(null);

    if (result.resolvedItem) {
      setUndoState({
        item: result.resolvedItem,
        summary: result.actionSummary,
        expiresAt: Date.now() + 5000,
      });
    }

    if (onReview && payload.type === "EXTEND_DEADLINE") {
      // notify parent if applicable
    }
  };

  // Handler: Undo resolution within 5s
  const handleUndo = () => {
    if (!undoState) return;
    const restoredItem = undoState.item;
    setActiveBottlenecks((prev) => [restoredItem, ...prev]);
    setResolvedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(restoredItem.id);
      return next;
    });
    setUndoState(null);
  };

  // Active tasks with resolved items marked as IN_PROGRESS for metrics/radar
  const activeTasks = React.useMemo(() => {
    if (resolvedTaskIds.size === 0) return tasks;
    return tasks.map((t) => {
      if (resolvedTaskIds.has(t.id)) {
        return { ...t, status: "IN_PROGRESS" as const };
      }
      if (t.subTasks && t.subTasks.some((s) => resolvedTaskIds.has(s.id))) {
        return {
          ...t,
          subTasks: t.subTasks.map((s) =>
            resolvedTaskIds.has(s.id)
              ? { ...s, status: "IN_PROGRESS" as const, blockedReason: undefined }
              : s
          ),
        };
      }
      return t;
    });
  }, [tasks, resolvedTaskIds]);

  const activeStaffTasks = React.useMemo(() => {
    if (resolvedTaskIds.size === 0) return staffTasks;
    return staffTasks.map((s) =>
      resolvedTaskIds.has(s.id)
        ? { ...s, status: "IN_PROGRESS" as const, blockedReason: undefined }
        : s
    );
  }, [staffTasks, resolvedTaskIds]);

  // Metrics computation with overridden bottlenecks count
  const baseMetrics = React.useMemo(() => {
    return computeExecutiveCockpitMetrics(
      activeTasks,
      activeStaffTasks,
      referenceDate
    );
  }, [activeTasks, activeStaffTasks, referenceDate]);

  const metrics = React.useMemo(() => {
    return {
      ...baseMetrics,
      bottlenecksCount: activeBottlenecks.length,
    };
  }, [baseMetrics, activeBottlenecks.length]);

  // Health radar computation for 11 units
  const radarItems = React.useMemo(() => {
    return computeElevenDepartmentRadar(
      activeTasks,
      referenceDate
    );
  }, [activeTasks, referenceDate]);

  // Matrix data for DepartmentProgressMatrix
  const matrixDepartments = React.useMemo(() => {
    return computeDepartmentHealthMatrix(activeTasks, referenceDate);
  }, [activeTasks, referenceDate]);

  // Institutional approval queue
  const approvalQueue = React.useMemo(() => {
    return extractInstitutionalApprovalQueue(activeTasks);
  }, [activeTasks]);

  // Sub-filtering states for Bottlenecks tab
  const [bottleneckSearch, setBottleneckSearch] = React.useState("");
  const [bottleneckFilter, setBottleneckFilter] = React.useState<"ALL" | "OVERDUE_3D" | "BLOCKED">("ALL");

  // Sub-filtering state for Approval Queue tab
  const [approvalSearch, setApprovalSearch] = React.useState("");
  const [approvalCategory, setApprovalCategory] = React.useState<string>("ALL");

  // Sub-filtering state for 11 Units Radar tab
  const [unitCategoryFilter, setUnitCategoryFilter] = React.useState<"ALL" | "FACULTY" | "ADMIN" | "CENTER">("ALL");
  const [unitSortBy, setUnitSortBy] = React.useState<"PRIORITY" | "COMPLETION" | "NAME">("PRIORITY");

  // Briefing modal state for Executive Meeting Review
  const [showBriefingModal, setShowBriefingModal] = React.useState(false);

  // Affected units count
  const affectedUnitsCount = React.useMemo(() => {
    const depts = new Set(activeBottlenecks.map((b) => b.departmentCode));
    return depts.size;
  }, [activeBottlenecks]);

  // Filtered strategic tasks
  const filteredStrategicTasks = React.useMemo(() => {
    return filterStrategicTasks(activeTasks, {
      searchTerm,
      statusFilter: strategicStatusFilter,
      departmentFilter: selectedDepartment,
      referenceDate,
    });
  }, [
    activeTasks,
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

  // Displayed bottlenecks filtered by department, status and search
  const displayedBottlenecks = React.useMemo(() => {
    let list = activeBottlenecks;
    if (selectedDepartment !== "ALL") {
      list = list.filter((b) => b.departmentCode === selectedDepartment);
    }
    if (bottleneckFilter === "OVERDUE_3D") {
      list = list.filter((b) => (b.daysOverdue ?? 0) >= 3 || b.isOverdue);
    } else if (bottleneckFilter === "BLOCKED") {
      list = list.filter((b) => b.isBlocked);
    }
    if (bottleneckSearch.trim()) {
      const q = bottleneckSearch.trim().toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.assigneeName && b.assigneeName.toLowerCase().includes(q)) ||
          (b.departmentName && b.departmentName.toLowerCase().includes(q)) ||
          (b.departmentCode && b.departmentCode.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeBottlenecks, selectedDepartment, bottleneckFilter, bottleneckSearch]);

  // Filtered approval queue with category filter and search
  const filteredApprovalQueue = React.useMemo(() => {
    let list = approvalQueue;
    if (approvalCategory !== "ALL") {
      list = list.filter((item) => {
        const cat = (item.originalTask as any)?.category || "";
        if (approvalCategory === "DE_AN") {
          return (
            cat === "CHUYEN_DOI_SO" ||
            cat === "DAI_TRA" ||
            cat === "CHIEN_LUOC" ||
            item.title.toLowerCase().includes("đề án") ||
            item.title.toLowerCase().includes("kế hoạch")
          );
        }
        if (approvalCategory === "KHAO_THI") {
          return (
            cat === "BAO_CAO" ||
            cat === "KHAO_THI" ||
            item.departmentCode === "KHAO_THI" ||
            item.title.toLowerCase().includes("kiểm định") ||
            item.title.toLowerCase().includes("khảo thí")
          );
        }
        if (approvalCategory === "CO_SO") {
          return (
            item.departmentCode === "QTTB" ||
            item.departmentCode === "HC_QT" ||
            item.title.toLowerCase().includes("thiết bị") ||
            item.title.toLowerCase().includes("cơ sở")
          );
        }
        return true;
      });
    }
    if (!approvalSearch.trim()) return list;
    const q = approvalSearch.trim().toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(q) ||
        item.departmentName.toLowerCase().includes(q) ||
        item.departmentCode.toLowerCase().includes(q) ||
        item.submittedByName.toLowerCase().includes(q)
    );
  }, [approvalQueue, approvalSearch, approvalCategory]);

  // Filtered radar items
  const filteredRadarItems = React.useMemo(() => {
    if (unitCategoryFilter === "ALL") return radarItems;
    if (unitCategoryFilter === "FACULTY") {
      return radarItems.filter((item) =>
        ["CNTT", "CO_KHI", "DIEN", "KT_DL", "KHCB"].includes(item.departmentCode)
      );
    }
    if (unitCategoryFilter === "ADMIN") {
      return radarItems.filter((item) =>
        ["DAO_TAO", "HC_QT", "QTTB"].includes(item.departmentCode)
      );
    }
    if (unitCategoryFilter === "CENTER") {
      return radarItems.filter((item) =>
        ["TT_TT_SH", "TT_NC_XH", "BGH"].includes(item.departmentCode)
      );
    }
    return radarItems;
  }, [radarItems, unitCategoryFilter]);

  // Sorted and filtered radar items
  const sortedFilteredRadarItems = React.useMemo(() => {
    const list = [...filteredRadarItems];
    if (unitSortBy === "PRIORITY") {
      return list;
    }
    if (unitSortBy === "COMPLETION") {
      return list.sort((a, b) => b.completionRate - a.completionRate);
    }
    if (unitSortBy === "NAME") {
      return list.sort((a, b) =>
        a.departmentName.localeCompare(b.departmentName, "vi")
      );
    }
    return list;
  }, [filteredRadarItems, unitSortBy]);

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

  // Handler: Bulk reminder for all delayed units
  const handleRemindAll = () => {
    const delayedDepts = radarItems.filter((d) => d.healthStatus !== "GREEN");
    if (onSendReminder) {
      delayedDepts.forEach((d) =>
        onSendReminder(d.departmentCode, "Chỉ đạo đôn đốc khẩn cấp toàn trường")
      );
    }
    setReminderNotice(
      `Đã phát lệnh đôn đốc đồng loạt tới ${
        delayedDepts.length > 0
          ? `${delayedDepts.length} đơn vị có cảnh báo tiến độ`
          : "tất cả 11 đơn vị"
      }.`
    );
    setTimeout(() => {
      setReminderNotice(null);
    }, 4000);
  };

  // Handler: Quick extend bottleneck deadline
  const handleExtend = (item: SchoolBottleneckItem, extensionDays: 3 | 7 = 3) => {
    handleConfirmResolution({
      taskId: item.id,
      type: "EXTEND_DEADLINE",
      extensionDays,
      directiveNote: `Ban Giám Hiệu gia hạn thêm ${extensionDays} ngày`,
    });
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
      {/* 1. Unified Single Header (~56px) */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4 min-h-[56px]">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1
              className="text-base font-bold tracking-tight text-foreground"
              aria-label="Khoang điều hành BGH"
              data-title="KHOANG ĐIỀU HÀNH BGH"
            >
              Khoang điều hành BGH
            </h1>
            <Badge
              variant="outline"
              className="bg-indigo-500/10 text-indigo-700 border-indigo-500/30 text-xs px-2.5 py-0.5 font-semibold"
            >
              Ban Giám Hiệu
            </Badge>
            <span className="hidden md:inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/60 text-xs font-medium text-muted-foreground border border-border/50">
              Năm học 2026-2027 · Học kỳ I
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground/80">{user.name}</span>
            <span className="text-muted-foreground/40">·</span>
            <span>11 đơn vị</span>
            <span className="text-muted-foreground/40">·</span>
            <span
              className={cn(
                "font-semibold",
                activeBottlenecks.length > 0
                  ? "text-rose-600"
                  : "text-emerald-600"
              )}
            >
              {activeBottlenecks.length} điểm nghẽn
            </span>
            <span className="text-muted-foreground/40">·</span>
            <span>{metrics.pendingInstitutionalApprovalCount} chờ duyệt</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-muted-foreground/70">
              Đồng bộ lúc {lastSyncTime}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            onClick={() => {
              if (onCreateDirective) {
                onCreateDirective();
              } else {
                window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
              }
            }}
            size="sm"
            className="h-8 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs text-xs font-semibold rounded-lg cursor-pointer active:scale-95"
            title="Giao chỉ đạo nhiệm vụ BGH trọng tâm cấp trường"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={1.5} />
            <span>+ Giao nhiệm vụ</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowBriefingModal(true)}
            className="text-xs h-8 gap-1.5 whitespace-nowrap rounded-lg border-border/80 hover:bg-muted cursor-pointer"
            title="Xem báo cáo giao ban điều hành BGH"
          >
            <FileText className="w-3.5 h-3.5 shrink-0 text-indigo-600" strokeWidth={1.5} />
            <span>Báo cáo giao ban</span>
          </Button>

          <Button
            asChild
            variant="outline"
            size="sm"
            className="text-xs h-8 gap-1.5 whitespace-nowrap rounded-lg border-border/80"
          >
            <Link href={tasksUrl} className="inline-flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 shrink-0" strokeWidth={1.5} />
              <span>Kho nhiệm vụ</span>
            </Link>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            className="text-xs h-8 gap-1.5 whitespace-nowrap rounded-lg border-border/80 hover:bg-muted cursor-pointer"
            title="Làm mới dữ liệu khoang điều hành"
          >
            <RefreshCw
              className={cn("w-3.5 h-3.5 shrink-0", isRefreshing && "animate-spin")}
              strokeWidth={1.5}
            />
            <span>Làm mới</span>
          </Button>
        </div>
      </div>

      {/* Optimistic Resolution Undo Banner */}
      {undoState && (
        <div
          role="status"
          className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] left-4 right-4 z-40 md:relative md:bottom-auto md:left-auto md:right-auto md:z-auto flex items-center justify-between gap-3 p-3.5 rounded-xl border border-emerald-500/40 bg-background/95 backdrop-blur-md text-foreground shadow-lg text-xs font-medium animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <CheckCircle2
              className="w-4 h-4 shrink-0 text-emerald-600"
              strokeWidth={1.5}
            />
            <span className="truncate">
              {undoState.summary} ({undoState.item.title})
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="min-h-[36px] px-3 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-xs cursor-pointer"
            >
              Hoàn tác (5s)
            </Button>
            <button
              type="button"
              onClick={() => setUndoState(null)}
              className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
              aria-label="Đóng thông báo"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Local reminder notification banner */}
      {reminderNotice && (
        <div
          role="status"
          className="flex items-center justify-between gap-2 p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-800 text-xs font-medium animate-in fade-in duration-200"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2
              className="w-4 h-4 shrink-0 text-emerald-600"
              strokeWidth={1.5}
            />
            <span>{reminderNotice}</span>
          </div>
          <button
            type="button"
            onClick={() => setReminderNotice(null)}
            className="text-muted-foreground hover:text-foreground cursor-pointer p-1"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. High-Altitude Cockpit Strip */}
      <div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4"
        data-slot="executive-cockpit-strip"
      >
        {/* Metric 1: Hero KPI Card (Visual Dominance) */}
        <button
          type="button"
          onClick={() => setActiveTab("BOTTLENECKS")}
          className={cn(
            "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer min-h-[110px] hover:-translate-y-0.5 hover:shadow-xs",
            metrics.bottlenecksCount > 0
              ? activeTab === "BOTTLENECKS"
                ? "border-rose-500/60 bg-rose-500/[0.06] ring-1 ring-rose-500/20 text-rose-600 shadow-xs"
                : "border-rose-500/40 bg-rose-500/[0.03] hover:border-rose-500/60 text-rose-600"
              : activeTab === "BOTTLENECKS"
                ? "border-emerald-500/40 bg-emerald-500/[0.06] ring-1 ring-emerald-500/20 text-emerald-600 shadow-xs"
                : "border-emerald-500/30 bg-emerald-500/[0.03] hover:border-emerald-500/50 text-emerald-600"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-foreground">
              Tắc nghẽn cần tháo gỡ
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.bottlenecksCount > 0
                  ? "bg-rose-500/15 text-rose-600"
                  : "bg-emerald-500/15 text-emerald-600"
              )}
            >
              {metrics.bottlenecksCount > 0 ? (
                <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
              ) : (
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
              )}
            </div>
          </div>

          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-3xl font-extrabold tracking-tight tabular-nums",
                metrics.bottlenecksCount > 0
                  ? "text-rose-600"
                  : "text-emerald-600"
              )}
            >
              {metrics.bottlenecksCount}
            </span>
            <span
              className={cn(
                "text-xs font-medium",
                metrics.bottlenecksCount > 0
                  ? "text-rose-600/80"
                  : "text-emerald-600/80"
              )}
            >
              điểm nghẽn
            </span>
          </div>

          <div className="flex items-center gap-1.5 text-xs font-medium">
            {metrics.bottlenecksCount > 0 ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-rose-600 animate-pulse shrink-0" />
                <span className="text-rose-600 truncate">
                  {affectedUnitsCount} đơn vị bị ảnh hưởng
                </span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-600 shrink-0" />
                <span className="text-emerald-600 truncate">
                  Tiến độ toàn trường thông suốt
                </span>
              </>
            )}
          </div>
        </button>

        {/* Metric 2: Hồ sơ chờ phê duyệt cấp Trường (Operational Priority Tier) */}
        <button
          type="button"
          onClick={() => setActiveTab("APPROVAL_QUEUE")}
          className={cn(
            "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer min-h-[110px] hover:-translate-y-0.5 hover:shadow-xs",
            activeTab === "APPROVAL_QUEUE"
              ? "border-indigo-500/60 bg-indigo-500/15 shadow-xs ring-1 ring-indigo-500/30 text-indigo-600"
              : metrics.pendingInstitutionalApprovalCount > 0
              ? "border-indigo-500/40 bg-indigo-500/[0.08] text-foreground hover:bg-indigo-500/[0.12] hover:border-indigo-500/60 shadow-xs"
              : "border-border/70 bg-card text-foreground hover:bg-muted/40 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold text-foreground">
              Hồ sơ chờ phê duyệt cấp Trường
            </span>
            <div
              className={cn(
                "p-1.5 rounded-lg",
                metrics.pendingInstitutionalApprovalCount > 0
                  ? "bg-indigo-500/20 text-indigo-600"
                  : "bg-muted text-muted-foreground"
              )}
            >
              <CheckCircle2 className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums",
                metrics.pendingInstitutionalApprovalCount > 0
                  ? "text-indigo-600"
                  : "text-foreground"
              )}
            >
              {metrics.pendingInstitutionalApprovalCount}
            </span>
            <span className="text-xs font-medium text-muted-foreground">tờ trình</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-medium">
            {metrics.pendingInstitutionalApprovalCount > 0 ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 shrink-0" />
                <span className="text-indigo-600 truncate">
                  Chờ BGH thẩm định & ký duyệt
                </span>
              </>
            ) : (
              <span className="text-muted-foreground truncate">
                Không có tờ trình tồn đọng
              </span>
            )}
          </div>
        </button>

        {/* Metric 3: Chỉ số hoàn thành toàn trường */}
        <button
          type="button"
          onClick={() => setActiveTab("HEALTH_RADAR")}
          className={cn(
            "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer min-h-[110px] hover:-translate-y-0.5 hover:shadow-xs",
            activeTab === "HEALTH_RADAR"
              ? "border-emerald-500/60 bg-emerald-500/15 shadow-xs ring-1 ring-emerald-500/30 text-emerald-600"
              : "border-emerald-500/30 bg-emerald-500/[0.04] text-foreground hover:bg-emerald-500/[0.08] hover:border-emerald-500/50 shadow-2xs"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Chỉ số hoàn thành toàn trường
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600">
              <TrendingUp className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-600 tabular-nums">
              {metrics.totalSchoolCompletionRate}%
            </span>
            <span className="text-xs text-muted-foreground">kế hoạch</span>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground line-clamp-1">
              {metrics.completedTasksCount}/{metrics.totalTasksCount} nhiệm vụ đã hoàn thành
            </p>
            <div className="w-full h-1 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, metrics.totalSchoolCompletionRate))}%`,
                }}
              />
            </div>
          </div>
        </button>

        {/* Metric 4: Tổng số nhiệm vụ đang chạy */}
        <button
          type="button"
          onClick={() => setActiveTab("STRATEGIC_TASKS")}
          className={cn(
            "flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer min-h-[110px] hover:-translate-y-0.5 hover:shadow-xs",
            activeTab === "STRATEGIC_TASKS"
              ? "border-blue-500/60 bg-blue-500/15 shadow-xs ring-1 ring-blue-500/30 text-blue-600"
              : "border-border/80 bg-muted/30 text-foreground hover:bg-muted/50 hover:border-border"
          )}
        >
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium text-foreground">
              Tổng số nhiệm vụ đang chạy
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600">
              <Layers className="w-4 h-4" strokeWidth={1.5} />
            </div>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground tabular-nums">
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
          title="Cảnh báo thắt nút cổ chai & Tắc nghẽn"
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "BOTTLENECKS"
              ? "border-rose-600 text-rose-600 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <span className="hidden xl:inline">Cảnh báo thắt nút cổ chai & Tắc nghẽn</span>
          <span className="xl:hidden">Điểm nghẽn</span>
          {metrics.bottlenecksCount > 0 && (
            <Badge
              variant="destructive"
              className="text-xs px-1.5 py-0 h-4 bg-rose-500 tabular-nums"
            >
              {metrics.bottlenecksCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("APPROVAL_QUEUE")}
          title="Hàng đợi Phê duyệt Chiến lược"
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "APPROVAL_QUEUE"
              ? "border-indigo-600 text-indigo-600 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <span className="hidden xl:inline">Hàng đợi Phê duyệt Chiến lược</span>
          <span className="xl:hidden">Chờ phê duyệt</span>
          {metrics.pendingInstitutionalApprovalCount > 0 && (
            <Badge className="text-xs px-1.5 py-0 h-4 bg-indigo-600 text-white tabular-nums">
              {metrics.pendingInstitutionalApprovalCount}
            </Badge>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("HEALTH_RADAR")}
          title="Radar Sức Khỏe 11 Đơn Vị"
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "HEALTH_RADAR"
              ? "border-emerald-600 text-emerald-600 font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <span className="hidden xl:inline">Radar Sức Khỏe 11 Đơn Vị</span>
          <span className="xl:hidden">Sức khỏe 11 đơn vị</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("STRATEGIC_TASKS")}
          title="Nhiệm vụ Chiến lược cấp Trường"
          className={cn(
            "flex items-center gap-2 px-3.5 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap cursor-pointer",
            activeTab === "STRATEGIC_TASKS"
              ? "border-primary text-primary font-semibold"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/30"
          )}
        >
          <span className="hidden xl:inline">Nhiệm vụ Chiến lược cấp Trường</span>
          <span className="xl:hidden">Nhiệm vụ chiến lược</span>
        </button>
      </div>

      {/* ==================================================================== */}
      {/* 4. Tab 1: BOTTLENECKS (70/30 Layout: Bottleneck Stream + Unit Radar)  */}
      {/* ==================================================================== */}
      {activeTab === "BOTTLENECKS" && (
        <div className="space-y-4" data-slot="bottlenecks-section">
          {activeBottlenecks.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-rose-500/25 bg-rose-500/[0.04]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-rose-500/10 text-rose-600 shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div className="text-xs">
                  <span className="font-semibold text-foreground">
                    Phân luồng can thiệp lãnh đạo:{" "}
                  </span>
                  <span className="text-muted-foreground">
                    BGH có thẩm quyền ban hành chỉ đạo khẩn, gia hạn nhiệm vụ, điều phối bổ sung nhân lực hoặc chấp thuận giải tỏa đặc cách.
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRemindAll}
                className="text-xs h-7.5 gap-1.5 border-rose-500/30 text-rose-700 hover:bg-rose-500/10 shrink-0 whitespace-nowrap cursor-pointer"
              >
                <Send className="w-3 h-3" />
                <span>Đôn đốc tất cả ({affectedUnitsCount} đơn vị)</span>
              </Button>
            </div>
          )}

          {activeBottlenecks.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border border-emerald-500/30 rounded-xl bg-emerald-500/[0.04]">
              <div className="p-3 bg-emerald-500/15 text-emerald-600 rounded-full mb-3">
                <CheckCircle2 className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-foreground">
                Tất cả 11 đơn vị đang vận hành thông suốt — 0 điểm nghẽn
              </h3>
              <p className="text-xs text-muted-foreground max-w-lg mt-1.5">
                Không có đầu việc nào bị chậm hạn hoặc tắc nghẽn cần BGH can thiệp tháo gỡ.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (70% ~ lg:col-span-8): Bottleneck Action Stream */}
              <div className="lg:col-span-8 space-y-3.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-sm sm:text-base font-bold tracking-tight text-foreground flex items-center gap-2">
                      <AlertTriangle
                        className="w-4 h-4 text-rose-600 shrink-0"
                        strokeWidth={1.5}
                      />
                      <span>Dòng tác vụ điểm nghẽn cần tháo gỡ</span>
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      Xử lý trực tiếp các điểm nghẽn bằng cách gia hạn, điều chuyển nhân sự hoặc ban hành chỉ đạo.
                    </p>
                  </div>
                  {activeBottlenecks.length > 0 && (
                    <Badge
                      variant="destructive"
                      className="self-start text-xs font-semibold bg-rose-600 tabular-nums"
                    >
                      {displayedBottlenecks.length}/{activeBottlenecks.length} điểm nghẽn
                    </Badge>
                  )}
                </div>

                {/* Sub-search & filter bar for bottlenecks */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      value={bottleneckSearch}
                      onChange={(e) => setBottleneckSearch(e.target.value)}
                      placeholder="Tìm theo tên việc, cán bộ, đơn vị..."
                      className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-rose-500/30"
                    />
                    {bottleneckSearch && (
                      <button
                        type="button"
                        onClick={() => setBottleneckSearch("")}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                        aria-label="Xóa tìm kiếm"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {[
                      { id: "ALL", label: "Tất cả" },
                      { id: "OVERDUE_3D", label: "Quá hạn >3 ngày" },
                      { id: "BLOCKED", label: "Bị tắc nghẽn" },
                    ].map((btn) => (
                      <Button
                        key={btn.id}
                        type="button"
                        variant={bottleneckFilter === btn.id ? "default" : "outline"}
                        size="sm"
                        onClick={() => setBottleneckFilter(btn.id as any)}
                        className={cn(
                          "text-xs h-7.5 px-2.5 whitespace-nowrap",
                          bottleneckFilter === btn.id &&
                            "bg-rose-600 hover:bg-rose-700 text-white border-rose-600"
                        )}
                      >
                        {btn.label}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Filter chip if unit selected */}
                {selectedDepartment !== "ALL" && (
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/60 border border-border text-xs text-muted-foreground">
                    <span>
                      Đang lọc theo đơn vị:{" "}
                      <strong className="text-foreground">
                        {selectedDeptDef?.name || selectedDepartment}
                      </strong>{" "}
                      ({displayedBottlenecks.length} điểm nghẽn)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedDepartment("ALL")}
                      className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>Bỏ lọc</span>
                    </Button>
                  </div>
                )}

                {/* Bottleneck cards stream */}
                {displayedBottlenecks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed rounded-xl bg-card">
                    <CheckCircle2
                      className="w-6 h-6 text-emerald-600 mb-2"
                      strokeWidth={1.5}
                    />
                    <p className="text-xs text-muted-foreground">
                      Đơn vị này hiện không có điểm nghẽn nào cần tháo gỡ.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {displayedBottlenecks.map((item) => (
                      <div key={item.id} className="space-y-2">
                        {/* Mobile Optimized Single-Column Card (md:hidden) */}
                        <div
                          className="md:hidden flex flex-col justify-between gap-3 rounded-xl border border-rose-500/30 bg-card p-3.5 shadow-2xs"
                          data-slot="mobile-bottleneck-card"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-500/10 px-2 py-0.5 text-xs font-semibold text-rose-700 border border-rose-500/20">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-pulse" />
                              <span className="tabular-nums uppercase tracking-wide">
                                {typeof item.daysOverdue === "number" && item.daysOverdue > 0
                                  ? `QUÁ HẠN ${item.daysOverdue} NGÀY`
                                  : item.isBlocked
                                    ? "ĐANG BỊ TẮC NGHẼN"
                                    : item.isOverdue
                                      ? "ĐÃ QUÁ HẠN"
                                      : "ĐIỂM NGHẼN CẤP THIẾT"}
                              </span>
                            </span>

                            <Badge
                              variant="outline"
                              className="text-xs font-medium text-muted-foreground border-border/70 bg-muted/40 px-2 py-0.5 shrink-0"
                            >
                              {item.departmentCode || item.departmentName || "QCET"}
                            </Badge>
                          </div>

                          <div className="min-w-0">
                            <h4 className="text-sm font-semibold text-foreground leading-snug line-clamp-2">
                              {item.title}
                            </h4>
                            {item.blockedReason && (
                              <p className="mt-1 text-xs text-rose-600/90 line-clamp-1 italic flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>Vướng mắc: {item.blockedReason}</span>
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5 border-t border-border/40 flex-wrap">
                            <span className="flex items-center gap-1 font-medium text-foreground/80">
                              <User className="w-3.5 h-3.5 text-muted-foreground/70" />
                              <span className="truncate">{item.assigneeName || "Chưa phân công"}</span>
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="flex items-center gap-1 tabular-nums font-mono">
                              <Clock className="w-3.5 h-3.5 text-muted-foreground/60" />
                              <span>Hạn {item.dueDate ? item.dueDate.split("T")[0] : "Chưa đặt"}</span>
                            </span>
                          </div>

                          {/* 1-tap mobile triage action buttons (min-h-[40px] px-3.5) */}
                          <div className="grid grid-cols-2 gap-2 pt-1">
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => handleTriggerReminder(item.departmentCode, item.title)}
                              className="min-h-[40px] h-10 px-3.5 text-xs font-medium hover:bg-muted border-border/70 gap-1.5 cursor-pointer active:scale-95 transition-all"
                              title="Gửi thông báo đôn đốc tức thì tới đơn vị"
                            >
                              <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                              <span>Đôn đốc</span>
                            </Button>
                            <Button
                              type="button"
                              onClick={() => handleExtend(item, 3)}
                              className="min-h-[40px] h-10 px-3.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white shadow-xs gap-1.5 cursor-pointer active:scale-95 transition-all"
                              title="Gia hạn tiến độ thêm 3 ngày và gỡ nghẽn tức thì"
                            >
                              <Clock className="w-3.5 h-3.5" />
                              <span>Gia hạn (+3 ngày)</span>
                            </Button>
                          </div>
                        </div>

                        {/* Desktop Card (hidden md:block) */}
                        <div className="hidden md:block">
                          <ExecutiveBottleneckCard
                            item={item}
                            onResolve={(target) =>
                              setActiveResolvingBottleneck(target)
                            }
                            onRemind={(deptCode, title) =>
                              handleTriggerReminder(deptCode, title)
                            }
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Right Column (30% ~ lg:col-span-4): Executive 11-Unit Mini-Radar */}
              <div className="lg:col-span-4 space-y-4">
                <ExecutiveUnitRadar
                  radarItems={radarItems}
                  selectedDepartment={selectedDepartment}
                  onSelectDepartment={(deptId) =>
                    setSelectedDepartment((prev) =>
                      prev === deptId ? "ALL" : deptId
                    )
                  }
                  onRemindAll={handleRemindAll}
                />
              </div>
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
                <CheckCircle2 className="w-5 h-5 text-indigo-600" />
                <span>Hồ sơ và tờ trình chờ Ban Giám Hiệu phê duyệt</span>
              </h2>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Các nhiệm vụ trọng tâm đã qua Trưởng đơn vị thẩm định hoặc đã hoàn tất báo cáo kết quả cấp trường.
              </p>
            </div>
            {approvalQueue.length > 0 && (
              <Badge className="self-start text-xs bg-indigo-600 text-white tabular-nums">
                {filteredApprovalQueue.length}/{approvalQueue.length} hồ sơ
              </Badge>
            )}
          </div>

          {/* Search bar & Category filters for Approval Queue */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={approvalSearch}
                onChange={(e) => setApprovalSearch(e.target.value)}
                placeholder="Tìm tờ trình theo tên, đơn vị, người trình..."
                className="w-full pl-8 pr-7 py-1.5 text-xs rounded-lg border bg-background text-foreground placeholder:text-muted-foreground focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              />
              {approvalSearch && (
                <button
                  type="button"
                  onClick={() => setApprovalSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  aria-label="Xóa tìm kiếm"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[
                { id: "ALL", label: "Tất cả hồ sơ" },
                { id: "DE_AN", label: "Đề án & Kế hoạch" },
                { id: "KHAO_THI", label: "Kiểm định & Khảo thí" },
                { id: "CO_SO", label: "Cơ sở & Thiết bị" },
              ].map((c) => (
                <Button
                  key={c.id}
                  type="button"
                  variant={approvalCategory === c.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setApprovalCategory(c.id)}
                  className={cn(
                    "text-xs h-7.5 px-2.5 whitespace-nowrap",
                    approvalCategory === c.id &&
                      "bg-indigo-600 hover:bg-indigo-700 text-white border-indigo-600"
                  )}
                >
                  {c.label}
                </Button>
              ))}
            </div>
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
          ) : filteredApprovalQueue.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-10 text-center border rounded-xl bg-card border-dashed">
              <p className="text-xs text-muted-foreground">
                Không tìm thấy tờ trình nào khớp với từ khóa &ldquo;{approvalSearch}&rdquo;.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredApprovalQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl border bg-card hover:border-indigo-500/40 hover:shadow-xs transition-all"
                >
                  <div className="space-y-2 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className="bg-muted text-foreground text-xs font-mono px-1.5 py-0.5"
                      >
                        {item.id}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="bg-indigo-500/10 text-indigo-700 border-indigo-500/30 text-xs"
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

                    {(() => {
                      const task = item.originalTask as any;
                      const summary = task.description || task.deliverableDescription;
                      if (!summary) return null;
                      return (
                        <p className="text-xs p-2 rounded-lg bg-muted/40 border border-border/50 text-foreground/80 line-clamp-2">
                          <span className="font-semibold text-foreground">Trích yếu: </span>
                          <span>{summary}</span>
                        </p>
                      );
                    })()}

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
                          <span className="flex items-center gap-1 text-indigo-600 font-medium">
                            <FileText className="w-3.5 h-3.5" />
                            {item.deliverablesCount} tệp minh chứng đính kèm
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-center shrink-0 flex-wrap">
                    {onSelectTask && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onSelectTask(item.originalTask)}
                        className="text-xs min-h-[40px] h-10 sm:h-8 px-3.5 sm:px-3 gap-1 cursor-pointer"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Xem chi tiết</span>
                      </Button>
                    )}

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => setReviewingTask(item.originalTask)}
                      className="text-xs min-h-[40px] h-10 sm:h-8 px-3.5 sm:px-3 gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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

            {/* Controls bar: Category filter and Sorting */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-2.5">
              {/* Category filter pills for 11 units */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
                {[
                  { id: "ALL", label: "Tất cả 11 đơn vị" },
                  { id: "FACULTY", label: "5 Khoa chuyên môn" },
                  { id: "ADMIN", label: "3 Phòng chức năng" },
                  { id: "CENTER", label: "3 Trung tâm & BGH" },
                ].map((btn) => (
                  <Button
                    key={btn.id}
                    type="button"
                    variant={unitCategoryFilter === btn.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setUnitCategoryFilter(btn.id as any)}
                    className={cn(
                      "text-xs h-7.5 px-3 whitespace-nowrap",
                      unitCategoryFilter === btn.id &&
                        "bg-primary text-primary-foreground font-semibold"
                    )}
                  >
                    {btn.label}
                  </Button>
                ))}
              </div>

              {/* Sort controls */}
              <div className="flex items-center gap-1.5 self-end md:self-center">
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  Sắp xếp:
                </span>
                {[
                  { id: "PRIORITY", label: "Cảnh báo (Đỏ trước)" },
                  { id: "COMPLETION", label: "Tiến độ cao nhất" },
                  { id: "NAME", label: "Tên A-Z" },
                ].map((s) => (
                  <Button
                    key={s.id}
                    type="button"
                    variant={unitSortBy === s.id ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => setUnitSortBy(s.id as any)}
                    className={cn(
                      "text-xs h-7 px-2 border cursor-pointer",
                      unitSortBy === s.id
                        ? "bg-muted font-semibold border-border"
                        : "text-muted-foreground border-transparent hover:border-border"
                    )}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedFilteredRadarItems.map((dept) => {
                const isSelected = selectedDepartment === dept.departmentCode;

                const healthBadgeClass =
                  dept.healthStatus === "RED"
                    ? "bg-rose-500/10 text-rose-700 border-rose-500/30"
                    : dept.healthStatus === "YELLOW"
                      ? "bg-amber-500/10 text-amber-700 border-amber-500/30"
                      : "bg-emerald-500/10 text-emerald-700 border-emerald-500/30";

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
                          className={cn("text-xs", healthBadgeClass)}
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
                          <div className="text-xs text-muted-foreground">
                            Tổng số
                          </div>
                        </div>
                        <div className="p-1.5 rounded bg-emerald-500/10">
                          <div className="font-semibold text-emerald-600">
                            {dept.completedTasks}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Hoàn thành
                          </div>
                        </div>
                        <div
                          className={cn(
                            "p-1.5 rounded",
                            dept.delayedTasks + dept.blockedTasks > 0
                              ? "bg-rose-500/10 text-rose-600 font-semibold"
                              : "bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <div>{dept.delayedTasks + dept.blockedTasks}</div>
                          <div className="text-xs">Chậm/Nghẽn</div>
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
                          className="text-xs h-7 gap-1 hover:bg-rose-500/10 hover:text-rose-700"
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
                          className="bg-muted text-foreground text-xs font-mono px-1.5 py-0.5"
                        >
                          {task.id}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="bg-primary/5 text-primary border-primary/20 text-xs"
                        >
                          {task.leadDepartmentCode || "BGH"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="text-xs bg-muted/40 text-muted-foreground"
                        >
                          {task.categoryLabel || "Chiến lược"}
                        </Badge>
                        {isOverdue && (
                          <Badge
                            variant="destructive"
                            className="text-xs bg-rose-500"
                          >
                            Quá hạn
                          </Badge>
                        )}
                        {isPendingApproval && (
                          <Badge className="text-xs bg-indigo-600 text-white">
                            Chờ BGH phê duyệt
                          </Badge>
                        )}
                        {task.status === "COMPLETED" && (
                          <Badge
                            variant="outline"
                            className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
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
                        <div className="flex justify-between text-xs text-muted-foreground">
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

      {/* Executive Resolution Action Drawer */}
      <ExecutiveResolutionDrawer
        isOpen={Boolean(activeResolvingBottleneck)}
        onClose={() => setActiveResolvingBottleneck(null)}
        bottleneck={activeResolvingBottleneck}
        onConfirm={handleConfirmResolution}
      />

      {/* Executive Briefing Modal (Báo cáo Giao ban Lãnh đạo BGH) */}
      <ExecutiveBriefingModal
        isOpen={showBriefingModal}
        onClose={() => setShowBriefingModal(false)}
        user={user}
        metrics={metrics}
        radarItems={radarItems}
        bottlenecks={activeBottlenecks}
        approvalQueue={approvalQueue}
        referenceDate={referenceDate}
      />
    </div>
  );
}

/** Default and alias exports for maximum compatibility */
export const ExecutiveWorkspace = ExecutiveCockpitWorkspace;
export default ExecutiveCockpitWorkspace;
