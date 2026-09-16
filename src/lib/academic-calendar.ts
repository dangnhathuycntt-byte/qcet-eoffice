/**
 * Calendar Cycle & Time Period Engine for QCET E-Office
 * Standardized to Gregorian Solar Calendar (Lịch dương) & ICT Timezone (Asia/Ho_Chi_Minh)
 *
 * Rules:
 * - Months start on day 01 and end on the last day of the month (28/29/30/31).
 * - Years start on 01/01 and end on 31/12 (Calendar Year).
 * - Quarters (Quý):
 *   - Quý 1: Tháng 1–3 (01/01 – 31/03)
 *   - Quý 2: Tháng 4–6 (01/04 – 30/06)
 *   - Quý 3: Tháng 7–9 (01/07 – 30/09)
 *   - Quý 4: Tháng 10–12 (01/10 – 31/12)
 * - Academic Year (Năm học) is distinct from Calendar Year: 01/09/(N) to 31/08/(N+1).
 * - Timezone: Asia/Ho_Chi_Minh (ICT, UTC+7), leap-year safe (năm nhuận tháng 2 có 29 ngày).
 */

import type { SchoolTask } from "@/types/dashboard";

export interface AcademicMonthPeriod {
  monthNumber: number; // 1 to 12
  monthIndexInYear: number; // 0 for Month 1, 11 for Month 12
  academicYear: string; // e.g. "2026-2027"
  calendarYear: number; // e.g. 2026
  startDate: string; // YYYY-MM-01
  endDate: string; // YYYY-MM-(lastDay)
  nextPeriodStartDate: string; // First day of next month (YYYY-MM-01)
  label: string; // "Tháng 9"
  fullLabel: string; // "Tháng 9 / 2026 (01/09 - 30/09)"
  shortDateSpan: string; // "01/09 - 30/09"
  dateSpanVi?: string;
  quarter: number; // 1, 2, 3, or 4
}

export type AcademicMonthInfo = AcademicMonthPeriod;

export interface QuarterPeriod {
  quarter: number; // 1, 2, 3, 4
  year: number; // e.g. 2026
  startDate: string; // YYYY-MM-01
  endDate: string; // YYYY-MM-(lastDay)
  nextQuarterStartDate: string;
  label: string; // "Quý 1"
  fullLabel: string; // "Quý 1 / 2026 (01/01 - 31/03)"
  shortDateSpan: string; // "01/01 - 31/03"
  months: number[]; // [1, 2, 3] for Q1, etc.
}

export interface CurrentAcademicPeriod {
  academicYear: string; // e.g. "2026-2027"
  calendarYear: number; // e.g. 2026
  semester: number; // 1 or 2
  quarter: number; // 1 to 4
  month: number; // 1-12
  label: string; // e.g. "Học kỳ I (2026 - 2027)"
}

/**
 * 12 months ordered chronologically by solar calendar (Tháng 1 -> Tháng 12).
 */
export const CALENDAR_MONTH_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
export const ACADEMIC_MONTH_ORDER = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;

/**
 * Check if a calendar year is a leap year (năm nhuận).
 */
export function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * Get the exact number of days in a given calendar month, handling leap years.
 */
export function getDaysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  if (month === 4 || month === 6 || month === 9 || month === 11) {
    return 30;
  }
  return 31;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/**
 * Determine Quarter (1-4) for a given month (1-12).
 */
export function getQuarterFromMonth(month: number): number {
  if (month >= 1 && month <= 3) return 1;
  if (month >= 4 && month <= 6) return 2;
  if (month >= 7 && month <= 9) return 3;
  return 4;
}

/**
 * Trả về chuỗi ngày hệ thống chuẩn (YYYY-MM-DD) theo múi giờ Việt Nam (Asia/Ho_Chi_Minh).
 */
export function getSystemReferenceDate(): string {
  if (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_REFERENCE_DATE) {
    return process.env.NEXT_PUBLIC_REFERENCE_DATE;
  }
  return "2026-09-09";
}

export const getSystemReferenceDateStr = getSystemReferenceDate;

/**
 * Kiểm tra quá hạn an toàn theo phép so sánh chuỗi ISO YYYY-MM-DD.
 * Sử dụng múi giờ Việt Nam (Asia/Ho_Chi_Minh) khi trích xuất ngày từ đối tượng Date.
 */
export function isTaskPastDue(
  dateStr?: string | Date | null,
  referenceDate: string = getSystemReferenceDate()
): boolean {
  if (!dateStr) return false;
  let clean: string;
  if (typeof dateStr === "string") {
    clean = dateStr.length > 10 ? dateStr.slice(0, 10) : dateStr;
  } else if (dateStr instanceof Date) {
    if (isNaN(dateStr.getTime())) return false;
    clean = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(dateStr);
  } else {
    return false;
  }
  const cleanRef =
    typeof referenceDate === "string" && referenceDate.length > 10
      ? referenceDate.slice(0, 10)
      : String(referenceDate);
  return clean < cleanRef;
}

/**
 * Hàm kiểm tra trạng thái quá hạn quy chuẩn toàn hệ thống.
 */
export function isTaskOverdue(
  status: string,
  dueDate?: string | Date | null,
  referenceDate: string = getSystemReferenceDate()
): boolean {
  const s = (status || "").toUpperCase();
  const isCompletedOrCancelled = s === "COMPLETED" || s === "CANCELLED";
  if (isCompletedOrCancelled) return false;
  return s === "OVERDUE" || isTaskPastDue(dueDate, referenceDate);
}

/**
 * Parse date parts according to Asia/Ho_Chi_Minh timezone.
 */
export function parseDateParts(dateInput: unknown): { year: number; month: number; day: number } | null {
  if (!dateInput) return null;
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (!trimmed) return null;
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10),
        day: parseInt(match[3], 10),
      };
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return parseDateParts(d);
  }
  if (dateInput instanceof Date) {
    if (isNaN(dateInput.getTime())) return null;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const parts = formatter.formatToParts(dateInput);
    const y = parts.find((p) => p.type === "year")?.value;
    const m = parts.find((p) => p.type === "month")?.value;
    const d = parts.find((p) => p.type === "day")?.value;
    if (!y || !m || !d) return null;
    return {
      year: parseInt(y, 10),
      month: parseInt(m, 10),
      day: parseInt(d, 10),
    };
  }
  return null;
}

/**
 * Internal helper to build Gregorian Solar Month Period: Day 01 to Last Day of Month.
 */
function buildAcademicMonthPeriod(
  calendarYearForMonth: number,
  namedMonth: number,
  academicYear?: string
): AcademicMonthPeriod {
  const lastDay = getDaysInMonth(calendarYearForMonth, namedMonth);
  const startDate = `${calendarYearForMonth}-${pad(namedMonth)}-01`;
  const endDate = `${calendarYearForMonth}-${pad(namedMonth)}-${pad(lastDay)}`;

  // Next period start date (first day of following month) for interval queries [start, nextStart)
  const nextMonthYear = namedMonth === 12 ? calendarYearForMonth + 1 : calendarYearForMonth;
  const nextMonthNum = namedMonth === 12 ? 1 : namedMonth + 1;
  const nextPeriodStartDate = `${nextMonthYear}-${pad(nextMonthNum)}-01`;

  const shortDateSpan = `01/${pad(namedMonth)} - ${pad(lastDay)}/${pad(namedMonth)}`;
  const label = `Tháng ${namedMonth}`;
  const fullLabel = `Tháng ${namedMonth} / ${calendarYearForMonth} (${shortDateSpan})`;
  const monthIndexInYear = namedMonth - 1;

  const derivedAcademicYear =
    academicYear ??
    (namedMonth >= 9
      ? `${calendarYearForMonth}-${calendarYearForMonth + 1}`
      : `${calendarYearForMonth - 1}-${calendarYearForMonth}`);

  const quarter = getQuarterFromMonth(namedMonth);

  return {
    monthNumber: namedMonth,
    monthIndexInYear,
    academicYear: derivedAcademicYear,
    calendarYear: calendarYearForMonth,
    startDate,
    endDate,
    nextPeriodStartDate,
    label,
    fullLabel,
    shortDateSpan,
    dateSpanVi: shortDateSpan,
    quarter,
  };
}

/**
 * Returns QuarterPeriod object for a given quarter (1-4) and year.
 */
export function getQuarterPeriod(quarter: number, year: number = 2026): QuarterPeriod {
  const clampedQuarter = Math.max(1, Math.min(4, quarter));
  const startMonth = (clampedQuarter - 1) * 3 + 1;
  const endMonth = clampedQuarter * 3;
  const lastDay = getDaysInMonth(year, endMonth);

  const startDate = `${year}-${pad(startMonth)}-01`;
  const endDate = `${year}-${pad(endMonth)}-${pad(lastDay)}`;

  const nextQuarterYear = clampedQuarter === 4 ? year + 1 : year;
  const nextQuarterStartMonth = clampedQuarter === 4 ? 1 : endMonth + 1;
  const nextQuarterStartDate = `${nextQuarterYear}-${pad(nextQuarterStartMonth)}-01`;

  const shortDateSpan = `01/${pad(startMonth)} - ${pad(lastDay)}/${pad(endMonth)}`;
  const label = `Quý ${clampedQuarter}`;
  const fullLabel = `Quý ${clampedQuarter} / ${year} (${shortDateSpan})`;
  const months = [startMonth, startMonth + 1, endMonth];

  return {
    quarter: clampedQuarter,
    year,
    startDate,
    endDate,
    nextQuarterStartDate,
    label,
    fullLabel,
    shortDateSpan,
    months,
  };
}

/**
 * Returns the Academic Year string "YYYY-(YYYY+1)" for any given date.
 * Academic year cut-off is 01/09:
 * - Dates on or after 01/09 belong to currentYear - (currentYear + 1)
 * - Dates on or before 31/08 belong to (currentYear - 1) - currentYear
 */
export function getAcademicYear(dateInput: unknown): string {
  const parts = parseDateParts(dateInput);
  if (!parts) {
    return "2026-2027";
  }
  const { year, month } = parts;
  if (month >= 9) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Returns the Calendar Year number (e.g. 2026) for any given date.
 * Year starts on 01/01 and ends on 31/12.
 */
export function getCalendarYear(dateInput: unknown): number {
  const parts = parseDateParts(dateInput);
  if (!parts) {
    return 2026;
  }
  return parts.year;
}

/**
 * Returns available academic years.
 */
export function getAvailableAcademicYears(referenceDateInput?: unknown): string[] {
  const ref = referenceDateInput ?? getSystemReferenceDate();
  const currentYearStr = getAcademicYear(ref);
  const startYear = parseInt(currentYearStr.split("-")[0], 10);
  return [
    `${startYear - 1}-${startYear}`,
    `${startYear}-${startYear + 1}`,
    `${startYear + 1}-${startYear + 2}`,
  ];
}

/**
 * Returns available calendar years.
 */
export function getAvailableCalendarYears(referenceDateInput?: unknown): number[] {
  const ref = referenceDateInput ?? getSystemReferenceDate();
  const year = getCalendarYear(ref);
  return [year - 1, year, year + 1];
}

export interface CalendarDayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
}

/**
 * Tạo danh sách các ô ngày lịch theo tháng dương lịch (ngày 01 đến ngày cuối tháng).
 * Lưới bắt đầu từ Thứ Hai (T2) và kết thúc ở Chủ Nhật (CN).
 * Đảm bảo số ô là b��i số của 7 (35 hoặc 42 ô).
 */
export function generateAcademicMonthGrid(period: AcademicMonthPeriod): CalendarDayCell[] {
  const sysDate = getSystemReferenceDate();
  const [startYear, startMonth, startDay] = period.startDate
    .split("-")
    .map((s) => parseInt(s, 10));
  const [endYear, endMonth, endDay] = period.endDate
    .split("-")
    .map((s) => parseInt(s, 10));

  const startDateObj = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  const startDayOfWeek = startDateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const mondayOffset = (startDayOfWeek + 6) % 7; // Monday-start offset

  const grid: CalendarDayCell[] = [];

  // 1. Preceding days before 1st of month (starting from Monday of that week)
  for (let i = mondayOffset; i >= 1; i--) {
    const prevDate = new Date(startYear, startMonth - 1, startDay - i, 12, 0, 0);
    const dateString = `${prevDate.getFullYear()}-${pad(prevDate.getMonth() + 1)}-${pad(prevDate.getDate())}`;
    const dayOfWeek = prevDate.getDay();

    grid.push({
      date: prevDate,
      dateString,
      dayNumber: prevDate.getDate(),
      isCurrentMonth: false,
      isToday: dateString === sysDate,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  // 2. Active calendar days in month (01 to lastDay)
  const endDateObj = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
  let curr = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  while (curr <= endDateObj) {
    const dateString = `${curr.getFullYear()}-${pad(curr.getMonth() + 1)}-${pad(curr.getDate())}`;
    const dayOfWeek = curr.getDay();

    grid.push({
      date: curr,
      dateString,
      dayNumber: curr.getDate(),
      isCurrentMonth: true,
      isToday: dateString === sysDate,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });

    curr = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + 1, 12, 0, 0);
  }

  // 3. Trailing days to complete 7-day rows (at least 35 cells, up to 42 cells)
  const totalCells = Math.max(35, Math.ceil(grid.length / 7) * 7);
  const trailingDaysNeeded = totalCells - grid.length;

  for (let d = 1; d <= trailingDaysNeeded; d++) {
    const nextDate = new Date(endYear, endMonth - 1, endDay + d, 12, 0, 0);
    const dateString = `${nextDate.getFullYear()}-${pad(nextDate.getMonth() + 1)}-${pad(nextDate.getDate())}`;
    const dayOfWeek = nextDate.getDay();

    grid.push({
      date: nextDate,
      dateString,
      dayNumber: nextDate.getDate(),
      isCurrentMonth: false,
      isToday: dateString === sysDate,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  return grid;
}

/**
 * Returns the complete AcademicMonthPeriod for a given date or month number.
 */
export function getAcademicMonthInfo(dateInput: unknown): AcademicMonthPeriod {
  if (typeof dateInput === "number" && dateInput >= 1 && dateInput <= 12) {
    return getAcademicMonthPeriod(dateInput);
  }
  const parts = parseDateParts(dateInput) || {
    year: 2026,
    month: 9,
    day: 1,
  };
  const { year, month } = parts;

  return buildAcademicMonthPeriod(year, month);
}

/**
 * Returns all 12 solar calendar months for the specified year (e.g. "2026" or "2026-2027").
 * Ordered from Month 1 (index 0) to Month 12 (index 11).
 */
export function getAcademicMonthsForYear(yearOrAcademicYear: string | number = "2026"): AcademicMonthPeriod[] {
  let targetYear: number;
  let academicYearTag: string | undefined;

  if (typeof yearOrAcademicYear === "number") {
    targetYear = yearOrAcademicYear;
  } else {
    const trimmed = String(yearOrAcademicYear).trim();
    if (trimmed.includes("-")) {
      academicYearTag = trimmed;
      targetYear = parseInt(trimmed.split("-")[0], 10);
    } else {
      targetYear = parseInt(trimmed, 10) || 2026;
    }
  }

  const months: AcademicMonthPeriod[] = [];
  for (let m = 1; m <= 12; m++) {
    months.push(buildAcademicMonthPeriod(targetYear, m, academicYearTag));
  }

  return months;
}

/**
 * Checks if a given date falls inside the solar calendar month window.
 */
export function isDateInAcademicMonth(
  dateInput: string | Date,
  monthNumber: number,
  year?: number | string
): boolean {
  const parts = parseDateParts(dateInput);
  if (!parts) return false;
  if (parts.month !== monthNumber) return false;
  if (year !== undefined) {
    const targetYear = typeof year === "number" ? year : parseInt(String(year).split("-")[0], 10);
    if (!isNaN(targetYear) && parts.year !== targetYear) return false;
  }
  return true;
}

/**
 * Checks if a given date falls inside a Quarter (1-4).
 */
export function isDateInQuarter(
  dateInput: string | Date,
  quarter: number,
  year?: number
): boolean {
  const parts = parseDateParts(dateInput);
  if (!parts) return false;
  const q = getQuarterFromMonth(parts.month);
  if (q !== quarter) return false;
  if (year !== undefined && parts.year !== year) return false;
  return true;
}

/**
 * Calculates the adjacent calendar month period given a delta (+1, -1, etc.).
 */
export function getAdjacentAcademicMonth(
  period: AcademicMonthPeriod,
  delta: number
): AcademicMonthPeriod {
  const target = new Date(period.calendarYear, period.monthNumber - 1 + delta, 1);
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
 * Resolves the operational AcademicMonthPeriod for a given month number (1-12) and year.
 */
export function getAcademicMonthPeriod(
  monthNumber: number,
  yearOrAcademicYear?: string | number
): AcademicMonthPeriod {
  const ref = getSystemReferenceDate();
  let calendarYear = getCalendarYear(ref);
  let academicYear: string | undefined;

  if (typeof yearOrAcademicYear === "number") {
    calendarYear = yearOrAcademicYear;
  } else if (typeof yearOrAcademicYear === "string") {
    const trimmed = yearOrAcademicYear.trim();
    if (trimmed.includes("-")) {
      academicYear = trimmed;
      const startYear = parseInt(trimmed.split("-")[0], 10);
      calendarYear = monthNumber >= 9 ? startYear : startYear + 1;
    } else {
      calendarYear = parseInt(trimmed, 10) || calendarYear;
    }
  }

  return buildAcademicMonthPeriod(calendarYear, monthNumber, academicYear);
}

function extractDateString(val: unknown): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const match = val.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dt = new Date(val);
    if (!isNaN(dt.getTime())) {
      return new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Ho_Chi_Minh",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(dt);
    }
    return null;
  }
  if (val instanceof Date && !isNaN(val.getTime())) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(val);
  }
  return null;
}

/**
 * Lọc các nhiệm vụ thuộc về tháng dương lịch chỉ định (ngày 01 đến ngày cuối tháng).
 * Sử dụng truy vấn khoảng [startDate, endDate] hoặc [startDate, nextPeriodStartDate).
 * Cắt tỉa (prune) các subtask không thuộc tháng đang lọc để đảm bảo thống kê chính xác.
 */
export function filterTasksByAcademicMonthStrict<T extends { dueDate?: string | Date | null } = SchoolTask>(
  tasks: T[],
  month: number | "ALL",
  yearOrAcademicYear?: string | number
): T[] {
  if (month === "ALL") {
    return tasks;
  }

  const period = getAcademicMonthPeriod(month, yearOrAcademicYear);

  return tasks.reduce<T[]>((acc, task) => {
    const rawSubTasks = (task as any).subTasks;
    const hasSubTasks = Array.isArray(rawSubTasks);

    // 1. Nếu có trường academicMonth tường minh, ưu tiên số 1
    if (typeof (task as any).academicMonth === "number") {
      if ((task as any).academicMonth === month) {
        if (hasSubTasks) {
          const prunedSubTasks = rawSubTasks.filter((st: any) => {
            const stDue = extractDateString(st.dueDate);
            if (!stDue) return true;
            return stDue >= period.startDate && stDue <= period.endDate;
          });
          acc.push({
            ...task,
            subTasks: prunedSubTasks,
            totalSubTasks: prunedSubTasks.length,
            completedSubTasks: prunedSubTasks.filter((st: any) => st.status === "COMPLETED").length,
          });
        } else {
          acc.push(task);
        }
      }
      return acc;
    }

    const taskDue = extractDateString(task.dueDate);
    const dueInPeriod = Boolean(taskDue && taskDue >= period.startDate && taskDue <= period.endDate);

    const subDueInPeriod =
      hasSubTasks &&
      rawSubTasks.some((st: any) => {
        const stDue = extractDateString(st.dueDate);
        return stDue && stDue >= period.startDate && stDue <= period.endDate;
      });

    if (!dueInPeriod && !subDueInPeriod) {
      return acc;
    }

    if (hasSubTasks) {
      const prunedSubTasks = rawSubTasks.filter((st: any) => {
        const stDue = extractDateString(st.dueDate);
        if (!stDue) return dueInPeriod;
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
 * Tính toán danh sách nợ đọng/tồn đọng (overdue backlog) từ trước ngày 01 của tháng đang chọn chưa hoàn thành.
 */
export function computePriorOverdueBacklog<
  T extends { dueDate?: string | Date | null; status?: string } = SchoolTask,
>(
  tasks: T[],
  month: number,
  yearOrAcademicYear?: string | number,
  referenceDate?: string
): T[] {
  const period = getAcademicMonthPeriod(month, yearOrAcademicYear);
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
 * Tạo bucket phân vùng nhiệm vụ theo tháng kèm thống kê và danh sách nợ đọng.
 */
export function computeMonthPartitionBucket<
  T extends { dueDate?: string | Date | null; status?: string } = SchoolTask,
>(
  tasks: T[],
  month: number,
  yearOrAcademicYear?: string | number,
  referenceDate?: string
): MonthPartitionBucket<T> {
  const period = getAcademicMonthPeriod(month, yearOrAcademicYear);
  const filteredTasks = filterTasksByAcademicMonthStrict(tasks, month, yearOrAcademicYear);
  const priorBacklog = computePriorOverdueBacklog(tasks, month, yearOrAcademicYear, referenceDate);
  const ref = referenceDate ?? getSystemReferenceDate();

  let completedTasks = 0;
  let inProgressTasks = 0;
  let overdueTasks = 0;

  for (const t of filteredTasks) {
    const s = String(t.status || "").toUpperCase();
    if (s === "COMPLETED") {
      completedTasks++;
    } else if (s === "IN_PROGRESS" || s === "NOT_STARTED" || s === "NEW") {
      inProgressTasks++;
    }
    if (isTaskOverdue(s, t.dueDate, ref)) {
      overdueTasks++;
    }
  }

  const totalTasks = filteredTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    monthNumber: month,
    academicYear: period.academicYear,
    period,
    tasks: filteredTasks,
    priorOverdueBacklog: priorBacklog,
    stats: {
      totalTasks,
      completedTasks,
      inProgressTasks,
      overdueTasks,
      completionRate,
    },
  };
}

/**
 * Trả về thông tin chu kỳ hiện tại (năm dương lịch, năm học, quý, học kỳ, tháng và nhãn hiển thị).
 */
export function getCurrentAcademicPeriod(referenceDateInput?: unknown): CurrentAcademicPeriod {
  const refDate = referenceDateInput ?? getSystemReferenceDate();
  const info = getAcademicMonthInfo(refDate);
  const month = info.monthNumber;
  const calendarYear = info.calendarYear;
  const academicYear = info.academicYear;
  const quarter = getQuarterFromMonth(month);

  // Học kỳ I: Tháng 9 - 12 (hoặc tháng 9 - 1), Học kỳ II: Tháng 1 - 5 (hoặc 2 - 6)
  const semester = month >= 9 && month <= 12 ? 1 : 2;
  const roman = semester === 1 ? "I" : "II";
  const formattedYear = academicYear.includes(" - ")
    ? academicYear
    : academicYear.replace("-", " - ");
  const label = `Học kỳ ${roman} (${formattedYear})`;

  return {
    academicYear,
    calendarYear,
    semester,
    quarter,
    month,
    label,
  };
}

/**
 * Xác thực chuỗi date-only YYYY-MM-DD.
 */
export function parseStrictDateOnly(input: unknown): string | null {
  if (input == null) return null;

  let candidate: string;
  if (typeof input === "string") {
    candidate = input.trim().slice(0, 10);
  } else if (input instanceof Date) {
    if (isNaN(input.getTime())) return null;
    candidate = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(input);
  } else {
    return null;
  }

  const match = candidate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) return null;
  const maxDay = getDaysInMonth(year, month);
  if (day < 1 || day > maxDay) return null;

  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    return null;
  }

  return `${match[1]}-${match[2]}-${match[3]}`;
}

export const UPCOMING_WINDOW_DAYS = 6;

/**
 * Cộng thêm ngày lịch an toàn qua ranh giới tháng/năm.
 */
export function addCalendarDays(dateOnly: string, days: number): string | null {
  const strict = parseStrictDateOnly(dateOnly);
  if (!strict) return null;
  const [y, m, d] = strict.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d + days));
  if (isNaN(shifted.getTime())) return null;
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}

export interface UpcomingDeadlineCandidate {
  taskId: string;
  title: string;
  dueDate: string;
  assigneeName: string;
  level: "Trường" | "Đơn vị";
  isOverdue: false;
}

export interface UpcomingDeadlineSelection<T> {
  items: T[];
  total: number;
  preview: T[];
}

/**
 * Chọn các nhiệm vụ có hạn trong cửa sổ [referenceDate, +windowDays].
 */
export function selectUpcomingDeadlines<
  T extends {
    id: string;
    title?: string;
    dueDate?: string | Date | null;
    status?: string;
    priority?: string;
    leadAssigneeName?: string;
    assigneeName?: string;
  } = SchoolTask,
>(
  tasks: T[],
  referenceDate: string,
  options: { windowDays?: number; previewLimit?: number } = {}
): UpcomingDeadlineSelection<T> {
  const windowDays = options.windowDays ?? UPCOMING_WINDOW_DAYS;
  const previewLimit = options.previewLimit ?? 5;

  const ref = parseStrictDateOnly(referenceDate);
  if (!ref) {
    return { items: [], total: 0, preview: [] };
  }
  const windowEnd = addCalendarDays(ref, windowDays);
  if (!windowEnd) {
    return { items: [], total: 0, preview: [] };
  }

  const priorityWeight: Record<string, number> = {
    URGENT: 3,
    HIGH: 2,
    NORMAL: 1,
    MEDIUM: 1,
    LOW: 0,
  };

  const items = tasks
    .filter((t) => {
      const status = String(t.status ?? "").toUpperCase();
      if (status === "COMPLETED" || status === "CANCELLED") return false;
      const due = parseStrictDateOnly(t.dueDate);
      if (!due) return false;
      return due >= ref && due <= windowEnd;
    })
    .sort((a, b) => {
      const dueA = parseStrictDateOnly(a.dueDate)!;
      const dueB = parseStrictDateOnly(b.dueDate)!;
      if (dueA !== dueB) return dueA < dueB ? -1 : 1;
      const prA = priorityWeight[String(a.priority ?? "").toUpperCase()] ?? 1;
      const prB = priorityWeight[String(b.priority ?? "").toUpperCase()] ?? 1;
      if (prA !== prB) return prB - prA;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

  return {
    items,
    total: items.length,
    preview: items.slice(0, previewLimit),
  };
}
