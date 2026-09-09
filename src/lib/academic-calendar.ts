/**
 * Academic Calendar Cycle & Operational Month Engine for QCET
 *
 * Operational cycle rules:
 * - Operational month begins on day 25 of prior month and ends on day 24 of the named month.
 *   Example: Tháng 9 starts on 25/08 and ends on 24/09.
 * - Academic year starts on 25/08 (start of Tháng 9) and ends on 24/08 (end of Tháng 8).
 *   Example: "2026-2027" runs from 2026-08-25 to 2027-08-24.
 * - 12 operational months ordered: 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8
 */

import type { SchoolTask } from "@/types/dashboard";

export interface AcademicMonthPeriod {
  monthNumber: number; // 1 to 12 (12 operational months: 9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8)
  monthIndexInYear: number; // 0 for Month 9, 11 for Month 8
  academicYear: string; // e.g. "2026-2027"
  startDate: string; // YYYY-MM-25
  endDate: string; // YYYY-MM-24
  label: string; // "Tháng 9"
  fullLabel: string; // "Tháng 9 / 2026 (25/08 - 24/09)"
  shortDateSpan: string; // "25/08 - 24/09"
}

export type AcademicMonthInfo = AcademicMonthPeriod;

/**
 * The 12 operational academic months ordered according to QCET cycle:
 * Month 9, 10, 11, 12 in the fall, followed by 1, 2, 3, 4, 5 in the spring, and 6, 7, 8 in the summer.
 */
export const ACADEMIC_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8] as const;


function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseDateParts(dateInput: string | Date): { year: number; month: number; day: number } {
  if (typeof dateInput === "string") {
    const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
      };
    }
    const d = new Date(dateInput);
    return {
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      day: d.getDate(),
    };
  }
  return {
    year: dateInput.getFullYear(),
    month: dateInput.getMonth() + 1,
    day: dateInput.getDate(),
  };
}

function buildAcademicMonthPeriod(
  calendarYearForMonth: number,
  namedMonth: number,
  academicYear?: string
): AcademicMonthPeriod {
  const prevYear = namedMonth === 1 ? calendarYearForMonth - 1 : calendarYearForMonth;
  const prevMonth = namedMonth === 1 ? 12 : namedMonth - 1;
  const startDate = `${prevYear}-${pad(prevMonth)}-25`;
  const endDate = `${calendarYearForMonth}-${pad(namedMonth)}-24`;
  const shortDateSpan = `25/${pad(prevMonth)} - 24/${pad(namedMonth)}`;
  const label = `Tháng ${namedMonth}`;
  const fullLabel = `Tháng ${namedMonth} / ${calendarYearForMonth} (${shortDateSpan})`;
  const monthIndexInYear = namedMonth >= 9 ? namedMonth - 9 : namedMonth + 3;
  const derivedAcademicYear =
    academicYear ??
    (namedMonth >= 9
      ? `${calendarYearForMonth}-${calendarYearForMonth + 1}`
      : `${calendarYearForMonth - 1}-${calendarYearForMonth}`);

  return {
    monthNumber: namedMonth,
    monthIndexInYear,
    academicYear: derivedAcademicYear,
    startDate,
    endDate,
    label,
    fullLabel,
    shortDateSpan,
  };
}

/**
 * Returns the academic year string "YYYY-(YYYY+1)" for any given date.
 * Academic year cut-off is 25/08:
 * - Dates on or after 25/08 belong to currentYear - (currentYear + 1)
 * - Dates on or before 24/08 belong to (currentYear - 1) - currentYear
 */
export function getAcademicYear(dateInput: string | Date): string {
  const { year, month, day } = parseDateParts(dateInput);
  if (month > 8 || (month === 8 && day >= 25)) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Returns the complete AcademicMonthPeriod for a given date.
 */
export function getAcademicMonthInfo(dateInput: string | Date): AcademicMonthPeriod {
  const { year, month, day } = parseDateParts(dateInput);

  let namedMonth: number;
  let calendarYearForMonth: number;

  if (day >= 25) {
    if (month === 12) {
      namedMonth = 1;
      calendarYearForMonth = year + 1;
    } else {
      namedMonth = month + 1;
      calendarYearForMonth = year;
    }
  } else {
    namedMonth = month;
    calendarYearForMonth = year;
  }

  return buildAcademicMonthPeriod(calendarYearForMonth, namedMonth);
}

/**
 * Returns all 12 operational academic months for the specified academic year (e.g. "2026-2027").
 * Ordered from Month 9 (index 0) to Month 8 (index 11).
 */
export function getAcademicMonthsForYear(academicYear: string): AcademicMonthPeriod[] {
  const parts = academicYear.split("-").map((p) => parseInt(p.trim(), 10));
  const startYear = parts[0];
  const months: AcademicMonthPeriod[] = [];

  // Indices 0 to 3: Months 9, 10, 11, 12 in startYear
  for (let m = 9; m <= 12; m++) {
    months.push(buildAcademicMonthPeriod(startYear, m, academicYear));
  }

  // Indices 4 to 11: Months 1, 2, 3, 4, 5, 6, 7, 8 in startYear + 1
  for (let m = 1; m <= 8; m++) {
    months.push(buildAcademicMonthPeriod(startYear + 1, m, academicYear));
  }

  return months;
}

/**
 * Checks if a given date falls inside the operational month window.
 */
export function isDateInAcademicMonth(
  dateInput: string | Date,
  monthNumber: number,
  academicYear?: string
): boolean {
  const info = getAcademicMonthInfo(dateInput);
  if (info.monthNumber !== monthNumber) {
    return false;
  }
  if (academicYear && info.academicYear !== academicYear) {
    return false;
  }
  return true;
}

/**
 * Calculates the adjacent academic month period given a delta (+1, -1, etc.).
 */
export function getAdjacentAcademicMonth(
  period: AcademicMonthPeriod,
  delta: number
): AcademicMonthPeriod {
  const startYear = parseInt(period.academicYear.split("-")[0], 10);
  const calendarYearForMonth = period.monthNumber >= 9 ? startYear : startYear + 1;

  // Use day 10 to comfortably sit inside the target month
  const target = new Date(calendarYearForMonth, period.monthNumber - 1 + delta, 10);
  const targetYear = target.getFullYear();
  const targetMonth = target.getMonth() + 1;

  return buildAcademicMonthPeriod(targetYear, targetMonth);
}

export interface SubTask {
  id: string;
  taskId?: string;
  parentSchoolTaskId?: string;
  title: string;
  status: string;
  dueDate: string;
  assignedToDepartmentId?: string;
  assignedToDepartmentName?: string;
  assigneeName?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: any;
}

export interface MonthPartitionBucket<T = SchoolTask> {
  monthNumber: number;
  academicYear: string;
  period: AcademicMonthPeriod;
  tasks: T[];
  priorOverdueBacklog: T[];
  stats: {
    totalTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
    completionRate: number;
  };
}

/**
 * Resolves the operational AcademicMonthPeriod for a given month number (1-12) and academic year.
 */
export function getAcademicMonthPeriod(
  monthNumber: number,
  academicYear?: string
): AcademicMonthPeriod {
  const yearStr = academicYear || getAcademicYear(new Date());
  const startYear = parseInt(yearStr.split("-")[0], 10);
  const calendarYear = monthNumber >= 9 ? startYear : startYear + 1;
  return buildAcademicMonthPeriod(calendarYear, monthNumber, yearStr);
}

function extractDateString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dt = new Date(val);
    if (!isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
    }
    return null;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return `${val.getFullYear()}-${pad(val.getMonth() + 1)}-${pad(val.getDate())}`;
  }
  return null;
}

/**
 * Lọc các nhiệm vụ thuộc về tháng nghiệp vụ chỉ định theo chu kỳ 25 - 24.
 * Hỗ trợ "ALL" để giữ nguyên toàn bộ nhiệm vụ.
 * Cắt tỉa (prune) các subtask không thuộc tháng đang lọc để đảm bảo thống kê chính xác.
 */
export function filterTasksByAcademicMonthStrict<T extends { dueDate?: string | Date | null } = SchoolTask>(
  tasks: T[],
  month: number | "ALL",
  academicYear?: string
): T[] {
  if (month === "ALL") {
    return tasks;
  }

  const period = getAcademicMonthPeriod(month, academicYear);

  return tasks.reduce<T[]>((acc, task) => {
    const taskDue = extractDateString(task.dueDate);
    const taskStart =
      extractDateString(
        (task as any).startDate || (task as any).assignedDate || (task as any).createdAt
      ) || taskDue;

    const rawSubTasks = (task as any).subTasks;
    const hasSubTasks = Array.isArray(rawSubTasks);

    // 1. Task dueDate falls in period
    const dueInPeriod = Boolean(taskDue && taskDue >= period.startDate && taskDue <= period.endDate);

    // 2. Multi-month spanning task (startDate <= period.endDate && dueDate >= period.startDate)
    const spanInPeriod = Boolean(
      taskStart && taskDue && taskStart <= period.endDate && taskDue >= period.startDate
    );

    // 3. Any subtask dueDate falls in period
    const subDueInPeriod =
      hasSubTasks &&
      rawSubTasks.some((st: any) => {
        const stDue = extractDateString(st.dueDate);
        return stDue && stDue >= period.startDate && stDue <= period.endDate;
      });

    if (!dueInPeriod && !spanInPeriod && !subDueInPeriod) {
      return acc;
    }

    if (hasSubTasks) {
      const prunedSubTasks = rawSubTasks.filter((st: any) => {
        const stDue = extractDateString(st.dueDate);
        if (!stDue) return dueInPeriod || spanInPeriod;
        return stDue >= period.startDate && stDue <= period.endDate;
      });

      const totalSubTasks = prunedSubTasks.length;
      const completedSubTasks = prunedSubTasks.filter((st: any) => st.status === "COMPLETED").length;

      acc.push({
        ...task,
        subTasks: prunedSubTasks,
        totalSubTasks,
        completedSubTasks,
      });
    } else {
      acc.push(task);
    }

    return acc;
  }, []);
}

/**
 * Tính toán danh sách nợ đọng/tồn đọng (overdue backlog) từ các chu kỳ trước chưa hoàn thành.
 * Nhiệm vụ có hạn chót trước ngày bắt đầu của tháng nghiệp vụ hiện tại và chưa hoàn thành.
 */
export function computePriorOverdueBacklog<
  T extends { dueDate?: string | Date | null; status?: string } = SchoolTask,
>(
  tasks: T[],
  month: number,
  academicYear: string,
  referenceDate?: string
): T[] {
  const period = getAcademicMonthPeriod(month, academicYear);
  const cutoffDate =
    referenceDate && referenceDate < period.startDate ? referenceDate : period.startDate;

  return tasks.filter((t) => {
    if (!t.dueDate) return false;
    if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") return false;
    const due = extractDateString(t.dueDate);
    if (!due) return false;
    return due < cutoffDate;
  });
}

/**
 * Phân vùng dữ liệu nhiệm vụ cho một tháng học thuật cụ thể cùng với backlog từ trước và thống kê hoàn chỉnh.
 */
export function computeMonthPartitionBucket<
  T extends { dueDate?: string | Date | null; status?: string } = SchoolTask,
>(
  tasks: T[],
  month: number,
  academicYear: string,
  referenceDate?: string
): MonthPartitionBucket<T> {
  const period = getAcademicMonthPeriod(month, academicYear);
  const monthTasks = filterTasksByAcademicMonthStrict(tasks, month, academicYear);
  const priorOverdueBacklog = computePriorOverdueBacklog(tasks, month, academicYear, referenceDate);

  const refDateStr = referenceDate
    ? extractDateString(referenceDate)
    : extractDateString(new Date());

  const totalTasks = monthTasks.length;
  const completedTasks = monthTasks.filter((t) => t.status === "COMPLETED").length;
  const inProgressTasks = monthTasks.filter(
    (t) => t.status !== "COMPLETED" && (t.status as string) !== "CANCELLED"
  ).length;

  const overdueTasks = monthTasks.filter((t) => {
    if (t.status === "COMPLETED" || (t.status as string) === "CANCELLED") return false;
    if ((t.status as string) === "OVERDUE") return true;
    const due = extractDateString(t.dueDate);
    return Boolean(due && refDateStr && due < refDateStr);
  }).length;

  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    monthNumber: month,
    academicYear,
    period,
    tasks: monthTasks,
    priorOverdueBacklog,
    stats: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate,
    },
  };
}

