/**
 * QCET E-Office — Canonical Deadline & Overdue Calculations
 * Single Source of Truth for task deadlines, reference dates, and overdue states.
 * All date operations are grounded in Indochina Time (ICT, Asia/Ho_Chi_Minh, UTC+7).
 */

import {
  getSystemReferenceDate,
  getSystemReferenceDateStr,
  isTaskPastDue,
  isTaskOverdue,
} from '@/lib/academic-calendar';

export { getSystemReferenceDate, getSystemReferenceDateStr, isTaskPastDue, isTaskOverdue };

/**
 * Returns the ICT (Asia/Ho_Chi_Minh, UTC+7) start-of-day Date instance for a reference date.
 * For example, "2026-09-09" -> Date representing 2026-09-09T00:00:00+07:00 (which is 2026-09-08T17:00:00.000Z in UTC).
 *
 * In Prisma queries, filtering `dueDate: { lt: getIctReferenceDateStart(refDate) }` precisely
 * selects tasks whose due date in ICT falls strictly before the reference date, matching
 * `isTaskPastDue(dueDate, refDate)` exactly and eliminating status bifurcation.
 */
export function getIctReferenceDateStart(refDateVal?: string | Date | null): Date {
  if (refDateVal instanceof Date && !isNaN(refDateVal.getTime())) {
    // Extract YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(refDateVal);
    return new Date(`${dateStr}T00:00:00+07:00`);
  }

  const str = typeof refDateVal === 'string' && refDateVal.trim().length >= 10
    ? refDateVal.trim().slice(0, 10)
    : getSystemReferenceDateStr();

  return new Date(`${str}T00:00:00+07:00`);
}

/**
 * Compute a human-readable due-status label and overdue flag from a due date.
 *
 * Pure presentation helper — previously lived in `task-identity-block.tsx` but
 * is domain-level date arithmetic, not a UI concern.  All calendar comparisons
 * use the runtime's local clock (ICT in production).
 */
export function computeDueStatus(
  dueDate?: string | Date | null,
): { text: string; isOverdue: boolean } {
  if (!dueDate) return { text: 'Chưa đặt hạn', isOverdue: false };
  const target = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  if (isNaN(target.getTime())) return { text: 'Chưa đặt hạn', isOverdue: false };
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { text: `Quá hạn ${Math.abs(diffDays)} ngày`, isOverdue: true };
  if (diffDays === 0) return { text: 'Hôm nay', isOverdue: false };
  if (diffDays === 1) return { text: 'Ngày mai', isOverdue: false };
  return { text: `Còn ${diffDays} ngày`, isOverdue: false };
}

/**
 * Returns whether a task is overdue given its lifecycle status, due date, and optional reference date.
 * Reconciles status bifurcation by evaluating both persisted OVERDUE status and dynamic calendar deadline.
 */
export function checkTaskOverdueStatus(
  status: string,
  dueDate?: string | Date | null,
  referenceDate: string = getSystemReferenceDateStr()
): boolean {
  return isTaskOverdue(status, dueDate, referenceDate);
}
