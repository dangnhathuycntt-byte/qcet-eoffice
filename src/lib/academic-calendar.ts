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
  calendarYear?: number;
  dateSpanVi?: string;
}

export type AcademicMonthInfo = AcademicMonthPeriod;

export interface CurrentAcademicPeriod {
  academicYear: string; // e.g. "2026-2027"
  semester: number; // 1 or 2
  month: number; // 1-12 (operational month number, e.g. 9)
  label: string; // e.g. "Học kỳ I (2026 - 2027)"
}

/**
 * Trả về thông tin chu kỳ học vụ hiện tại (năm học, học kỳ, tháng vận hành và nhãn hiển thị).
 * Mặc định sử dụng ngày tham chiếu hệ thống getSystemReferenceDate().
 */
export function getCurrentAcademicPeriod(referenceDateInput?: unknown): CurrentAcademicPeriod {
  const refDate = referenceDateInput ?? getSystemReferenceDate();
  const info = getAcademicMonthInfo(refDate);
  const month = info.monthNumber;
  const academicYear = info.academicYear;
  // Tháng 9, 10, 11, 12 thuộc Học kỳ I; Tháng 1..8 thuộc Học kỳ II
  const semester = month >= 9 && month <= 12 ? 1 : 2;
  const roman = semester === 1 ? "I" : "II";
  const formattedYear = academicYear.includes(" - ")
    ? academicYear
    : academicYear.replace("-", " - ");
  const label = `Học kỳ ${roman} (${formattedYear})`;

  return {
    academicYear,
    semester,
    month,
    label,
  };
}

/**
 * The 12 operational academic months ordered according to QCET cycle:
 * Month 9, 10, 11, 12 in the fall, followed by 1, 2, 3, 4, 5 in the spring, and 6, 7, 8 in the summer.
 */
export const ACADEMIC_MONTH_ORDER = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8] as const;

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
 * Loại trừ hoàn toàn lỗi parse UTC nửa đêm làm quá hạn sớm trong ngày làm việc.
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
 * Hàm kiểm tra trạng thái quá hạn quy chuẩn toàn hệ thống (Single Source of Truth).
 * Một nhiệm vụ bị xem là quá hạn nếu:
 * 1. Không ở trạng thái kết thúc (COMPLETED, CANCELLED).
 * 2. Trạng thái bản ghi là OVERDUE HOẶC hạn chót (dueDate) trước ngày tham chiếu hệ thống.
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


function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

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
    calendarYear: calendarYearForMonth,
    dateSpanVi: shortDateSpan,
  };
}

/**
 * Returns the academic year string "YYYY-(YYYY+1)" for any given date.
 * Academic year cut-off is 25/08:
 * - Dates on or after 25/08 belong to currentYear - (currentYear + 1)
 * - Dates on or before 24/08 belong to (currentYear - 1) - currentYear
 */
export function getAcademicYear(dateInput: unknown): string {
  const parts = parseDateParts(dateInput);
  if (!parts) {
    return "2026-2027";
  }
  const { year, month, day } = parts;
  if (month > 8 || (month === 8 && day >= 25)) {
    return `${year}-${year + 1}`;
  }
  return `${year - 1}-${year}`;
}

/**
 * Trả về danh sách các năm học khả dụng (ví dụ: ["2025-2026", "2026-2027", "2027-2028"]).
 * Tự động suy biến xung quanh năm học hiện tại theo quy tắc không hardcode.
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
 * Tạo danh sách các ô ngày lịch theo chu kỳ vận hành học vụ (25 tháng trước đến 24 tháng này).
 * Lưới bắt đầu từ Thứ Hai (T2) và kết thúc ở Chủ Nhật (CN).
 * Đảm bảo số ô là bội số của 7 (35 hoặc 42 ô).
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

  // 1. Preceding days before startDate (starting from Monday of that week)
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

  // 2. Active operational period days (from 25th of prev month to 24th of current month)
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
 * Returns the complete AcademicMonthPeriod for a given date.
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
  const { year, month, day } = parts;

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
  const yearStr = academicYear || getAcademicYear(getSystemReferenceDate());
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
 * Nghiêm ngặt xác thực một chuỗi date-only `YYYY-MM-DD`.
 *
 * Khác với {@link parseDateParts} (vốn chỉ khớp regex và chấp nhận cả ngày không
 * tồn tại như `2026-02-30`), hàm này kiểm tra ngày đó có thật trên lịch hay không
 * bằng cách dựng lại qua `Date.UTC` rồi đối chiếu từng thành phần.
 *
 * Trả về chuỗi `YYYY-MM-DD` đã chuẩn hoá, hoặc `null` nếu không hợp lệ.
 * KHÔNG bao giờ fallback về "hôm nay" — ngày lỗi phải được giữ nguyên là missing.
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
  if (day < 1 || day > 31) return null;

  // Round-trip through UTC: an impossible date like 2026-02-30 normalises to
  // 2026-03-02, so the component comparison catches it.
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

/** Số ngày của cửa sổ "hạn chót sắp tới" — bao gồm D và D+6 (7 ngày lịch). */
export const UPCOMING_WINDOW_DAYS = 6;

/**
 * Cộng thêm `days` ngày lịch vào một chuỗi date-only, theo phép tính ngày lịch
 * (không cộng mili-giây vào timestamp), nên an toàn qua ranh giới tháng/năm.
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
  /** The real task/subtask id, so the caller can open the correct detail. */
  taskId: string;
  title: string;
  dueDate: string;
  assigneeName: string;
  level: "Trường" | "Đơn vị";
  isOverdue: false;
}

export interface UpcomingDeadlineSelection<T> {
  /** Every task inside the window, sorted. The full set — not a preview. */
  items: T[];
  /** Total size of the window. Equal to `items.length`; carried explicitly so a
   *  caller can never mistake a preview slice's length for the full total. */
  total: number;
  /** First `previewLimit` rows of the sorted full set. */
  preview: T[];
}

/**
 * Chọn các nhiệm vụ còn hiệu lực có hạn trong cửa sổ [referenceDate, +windowDays].
 *
 * Quy tắc (plan T05 "Deadline"):
 *  - Chỉ nhận ngày date-only hợp lệ theo lịch; ngày lỗi/không tồn tại bị loại,
 *    KHÔNG được quy về hôm nay.
 *  - Nhiệm vụ đã hoàn thành hoặc đã huỷ bị loại.
 *  - Việc quá hạn KHÔNG bao giờ xuất hiện ở đây.
 *  - Sắp xếp: hạn tăng dần → ưu tiên giảm dần → id tăng dần.
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
      // Window is inclusive on both ends: D <= due <= D+windowDays.
      // Anything before D is overdue and must not appear here.
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

