/**
 * Canonical Task Metrics Calculation & Data Correctness Engine for QCET E-Office.
 *
 * Enforces Architectural Invariants:
 * 1. Single source of reference date: getSystemReferenceDate() in ICT (Asia/Ho_Chi_Minh).
 * 2. Strict denominator separation: parent task metrics count ONLY parent tasks, never mixing subtasks into denominator.
 * 3. Consistent overdue calculation: evaluated against system reference date.
 * 4. Academic periods: derived from academic-calendar.ts.
 */

import {
  getSystemReferenceDate,
  isTaskPastDue,
  getCurrentAcademicPeriod,
  getAcademicMonthInfo,
  getAcademicYear,
  ACADEMIC_MONTH_ORDER,
  type AcademicMonthPeriod,
  type CurrentAcademicPeriod,
} from './academic-calendar';
import type { TaskMetricsDomain } from '@/domain/tasks/types';

// Re-export calendar cycle definitions to provide single canonical access
export {
  getSystemReferenceDate,
  isTaskPastDue,
  getCurrentAcademicPeriod,
  getAcademicMonthInfo,
  getAcademicYear,
  ACADEMIC_MONTH_ORDER,
  type AcademicMonthPeriod,
  type CurrentAcademicPeriod,
};

export interface TaskMetricItem {
  id?: string;
  status: string;
  dueDate?: string | Date | null;
  parentTaskId?: string | null;
  scope?: string | null;
  progressPercent?: number | null;
}

export interface CalculateTaskMetricsOptions {
  /**
   * Reference date override (defaults to getSystemReferenceDate()).
   */
  referenceDate?: string;
  /**
   * Enforce strict denominator separation: true filters out subtasks so denominator is parent count only.
   * Default is true to maintain institutional data integrity.
   */
  onlyParentTasks?: boolean;
}

/**
 * Calculates canonical task metrics with guaranteed denominator separation.
 * Ensures parent task metrics never mix subtasks into the denominator.
 */
export function calculateTaskMetrics(
  tasks: TaskMetricItem[],
  options?: CalculateTaskMetricsOptions
): TaskMetricsDomain {
  const referenceDate = options?.referenceDate ?? getSystemReferenceDate();
  const onlyParentTasks = options?.onlyParentTasks ?? true;

  // Filter tasks based on denominator separation
  const targetTasks = onlyParentTasks
    ? tasks.filter((t) => !t.parentTaskId)
    : tasks;

  const total = targetTasks.length;
  let completed = 0;
  let inProgress = 0;
  let waitingApproval = 0;
  let overdue = 0;
  let cancelled = 0;

  for (const t of targetTasks) {
    const rawStatus = (t.status || '').toUpperCase();

    if (rawStatus === 'COMPLETED') {
      completed++;
    } else if (rawStatus === 'WAITING_APPROVAL' || rawStatus === 'NEEDS_REVIEW') {
      waitingApproval++;
    } else if (rawStatus === 'IN_PROGRESS' || rawStatus === 'NOT_STARTED' || rawStatus === 'NEW') {
      inProgress++;
    } else if (rawStatus === 'CANCELLED') {
      cancelled++;
    }

    // Overdue calculation:
    // Status is explicitly OVERDUE or task is active (not completed, not cancelled) and past dueDate
    const isCompletedOrCancelled = rawStatus === 'COMPLETED' || rawStatus === 'CANCELLED';
    if (
      !isCompletedOrCancelled &&
      (rawStatus === 'OVERDUE' || isTaskPastDue(t.dueDate, referenceDate))
    ) {
      overdue++;
    }
  }

  const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    total,
    completed,
    inProgress,
    waitingApproval,
    overdue,
    cancelled,
    completionRate,
    referenceDate,
    isDenominatorSeparated: onlyParentTasks,
  };
}

/**
 * Validates whether a given task is overdue relative to system reference date.
 */
export function isTaskOverdue(
  task: { status: string; dueDate?: string | Date | null },
  referenceDate: string = getSystemReferenceDate()
): boolean {
  const status = (task.status || '').toUpperCase();
  if (status === 'COMPLETED' || status === 'CANCELLED') {
    return false;
  }
  if (status === 'OVERDUE') {
    return true;
  }
  return isTaskPastDue(task.dueDate, referenceDate);
}
