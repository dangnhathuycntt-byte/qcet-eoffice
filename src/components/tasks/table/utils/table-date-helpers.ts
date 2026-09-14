import {
  getSystemReferenceDate,
  isTaskPastDue as calendarIsTaskPastDue,
} from "@/lib/academic-calendar";
import { DATE_FALLBACK } from "@/lib/format/date";
import type { TaskStatus } from "@/types/dashboard";
import type { SlaBadgeStatus } from "../types";

export { getSystemReferenceDate };

/**
 * Trích xuất chuỗi ngày định dạng chuẩn YYYY-MM-DD từ string hoặc Date.
 * Loại bỏ thành phần giờ, phút và tránh lệch múi giờ.
 */
export function extractIsoDateString(val?: string | Date | null): string | null {
  if (!val) return null;
  if (typeof val === "string") {
    const clean = val.trim();
    if (!clean) return null;
    const match = clean.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    const dt = new Date(clean);
    if (isNaN(dt.getTime())) return null;
    return dt.toISOString().slice(0, 10);
  }
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return null;
    return val.toISOString().slice(0, 10);
  }
  return null;
}

/**
 * Kiểm tra xem ngày hạn chót có quá hạn so với ngày tham chiếu hay không (UTC-safe).
 */
export function isTaskPastDue(
  dueDate?: string | Date | null,
  referenceDate: string | Date = getSystemReferenceDate()
): boolean {
  const refStr = typeof referenceDate === "string" ? referenceDate : extractIsoDateString(referenceDate) || getSystemReferenceDate();
  return calendarIsTaskPastDue(dueDate, refStr);
}

/**
 * Kiểm tra hạn chót có rơi vào đúng ngày tham chiếu (hôm nay) hay không.
 */
export function isTaskDueToday(
  dueDate?: string | Date | null,
  referenceDate: string | Date = getSystemReferenceDate()
): boolean {
  const cleanDue = extractIsoDateString(dueDate);
  const cleanRef = extractIsoDateString(referenceDate);
  if (!cleanDue || !cleanRef) return false;
  return cleanDue === cleanRef;
}

/**
 * Tính số ngày còn lại đến hạn chót (so với ngày tham chiếu hệ thống).
 * - > 0: Còn N ngày (tương lai)
 * - = 0: Đúng ngày hôm nay
 * - < 0: Đã quá hạn N ngày (quá khứ)
 * - null: Không có hạn chót hợp lệ
 */
export function getDaysRemaining(
  dueDate?: string | Date | null,
  referenceDate: string | Date = getSystemReferenceDate()
): number | null {
  const cleanDue = extractIsoDateString(dueDate);
  const cleanRef = extractIsoDateString(referenceDate);
  if (!cleanDue || !cleanRef) return null;

  const [y1, m1, d1] = cleanDue.split("-").map(Number);
  const [y2, m2, d2] = cleanRef.split("-").map(Number);

  const utcDue = Date.UTC(y1, m1 - 1, d1);
  const utcRef = Date.UTC(y2, m2 - 1, d2);

  const msPerDay = 86_400_000;
  return Math.round((utcDue - utcRef) / msPerDay);
}

/**
 * Định dạng ngày hiển thị bảng công việc theo chuẩn Việt Nam (DD/MM/YYYY).
 */
export function formatTableDate(dateStr?: string | Date | null): string {
  if (!dateStr) return DATE_FALLBACK;
  const iso = extractIsoDateString(dateStr);
  if (!iso) {
    return DATE_FALLBACK;
  }
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * Trả về đối tượng Date của ngày tham chiếu hệ thống.
 */
export function getTaskTableReferenceDate(ref?: string | Date): Date {
  if (ref instanceof Date) return ref;
  if (typeof ref === "string") {
    const d = new Date(ref);
    if (!isNaN(d.getTime())) return d;
  }
  const sysRef = getSystemReferenceDate();
  return new Date(`${sysRef}T00:00:00.000Z`);
}

/**
 * Kiểm tra xem một nhiệm vụ có bị quá hạn hay không (UTC-safe và tôn trọng trạng thái hoàn thành).
 */
export function isTableTaskPastDue(
  task: { dueDate?: string | Date | null; status?: string },
  referenceDate?: string | Date
): boolean {
  if (task.status === "COMPLETED") return false;
  const refStr =
    referenceDate instanceof Date
      ? referenceDate.toISOString().slice(0, 10)
      : referenceDate || getSystemReferenceDate();
  return isTaskPastDue(task.dueDate, refStr);
}

/**
 * Kiểm tra xem một nhiệm vụ có đến hạn vào đúng ngày tham chiếu hay không.
 */
export function isTableTaskDueToday(
  task: { dueDate?: string | Date | null },
  referenceDate?: string | Date
): boolean {
  const refStr =
    referenceDate instanceof Date
      ? referenceDate.toISOString().slice(0, 10)
      : referenceDate || getSystemReferenceDate();
  return isTaskDueToday(task.dueDate, refStr);
}

/**
 * Tính toán chênh lệch số ngày so với ngày tham chiếu.
 */
export function getDaysDifference(
  dueDate?: string | Date | null,
  referenceDate?: string | Date
): number | null {
  const refStr =
    referenceDate instanceof Date
      ? referenceDate.toISOString().slice(0, 10)
      : referenceDate || getSystemReferenceDate();
  return getDaysRemaining(dueDate, refStr);
}

/**
 * Tính toán trạng thái và nhãn hiển thị SLA hạn chót cho hàng công việc.
 */
export function getSlaBadgeStatus(
  dueDate?: string | Date | null,
  status?: TaskStatus | string,
  referenceDate: string = getSystemReferenceDate()
): Omit<SlaBadgeStatus, "label"> & { label: string | null } {
  const formattedDate = formatTableDate(dueDate);
  const daysRemaining = getDaysRemaining(dueDate, referenceDate);

  if (!dueDate || daysRemaining === null) {
    return {
      label: null,
      colorClass: "text-zinc-400 bg-transparent border-transparent",
      isOverdue: false,
      isToday: false,
      daysRemaining: null,
      formattedDate: DATE_FALLBACK,
    };
  }

  // Nếu nhiệm vụ đã hoàn thành hoặc đã hủy -> không báo quá hạn
  if (status === "COMPLETED") {
    return {
      label: "Đã hoàn thành",
      colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200/60",
      isOverdue: false,
      isToday: false,
      daysRemaining,
      formattedDate,
    };
  }

  if (status === "CANCELLED") {
    return {
      label: "Đã hủy",
      colorClass: "text-zinc-600 bg-zinc-100 border-zinc-200",
      isOverdue: false,
      isToday: false,
      daysRemaining,
      formattedDate,
    };
  }

  // Quá hạn
  if (daysRemaining < 0) {
    const overdueDays = Math.abs(daysRemaining);
    return {
      label: `Quá hạn ${overdueDays} ngày`,
      colorClass: "text-rose-700 bg-rose-50 border-rose-200/60 font-medium",
      isOverdue: true,
      isToday: false,
      daysRemaining,
      formattedDate,
    };
  }

  // Đến hạn hôm nay
  if (daysRemaining === 0) {
    return {
      label: "Hôm nay",
      colorClass: "text-amber-700 bg-amber-50 border-amber-200/60 font-medium",
      isOverdue: false,
      isToday: true,
      daysRemaining,
      formattedDate,
    };
  }

  // Đến hạn ngày mai
  if (daysRemaining === 1) {
    return {
      label: "Ngày mai",
      colorClass: "text-blue-700 bg-blue-50 border-blue-200/60",
      isOverdue: false,
      isToday: false,
      daysRemaining,
      formattedDate,
    };
  }

  // Còn dưới hoặc bằng 3 ngày
  if (daysRemaining <= 3) {
    return {
      label: `Còn ${daysRemaining} ngày`,
      colorClass: "text-blue-700 bg-blue-50 border-blue-200/60",
      isOverdue: false,
      isToday: false,
      daysRemaining,
      formattedDate,
    };
  }

  // Bình thường (> 3 ngày): không render badge SLA dư thừa
  return {
    label: null,
    colorClass: "text-zinc-600 bg-zinc-50 border-zinc-200/60",
    isOverdue: false,
    isToday: false,
    daysRemaining,
    formattedDate,
  };
}
