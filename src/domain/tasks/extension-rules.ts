/**
 * Quy tắc xin gia hạn nhiệm vụ (T-01). Hàm thuần: không đọc DB, không có side effect.
 *
 * Hạn của nhiệm vụ chỉ đổi khi người giao đồng ý. Việc con không có hạn muộn hơn hạn
 * nhiệm vụ cha (Quy trình 3); cần dài hơn thì xin gia hạn nhiệm vụ cha.
 */
import { TaskStatus } from "@prisma/client";

/** Trạng thái được xin gia hạn. Đang chờ duyệt thì không (quyết định Q2). */
export const EXTENSION_REQUESTABLE_STATUSES: ReadonlySet<TaskStatus> = new Set([
  TaskStatus.NOT_STARTED,
  TaskStatus.IN_PROGRESS,
]);

/** Lần gia hạn thứ ba trở đi được gắn nhãn "gia hạn nhiều lần" trong Hoạt động. */
export const REPEATED_EXTENSION_THRESHOLD = 3;

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Ngày nhập dạng YYYY-MM-DD hiểu là 00:00 giờ Việt Nam, khớp cách lưu hạn hiện có. */
export function parseDueDateInput(value: string | Date): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const text = value.trim();
  const date = DATE_ONLY.test(text) ? new Date(`${text}T00:00:00+07:00`) : new Date(text);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type ExtensionDateError =
  | "NOT_AFTER_CURRENT"
  | "EXCEEDS_PARENT_DUE"
  | null;

/** Hạn mới phải sau hạn hiện tại và, với việc con, không muộn hơn hạn nhiệm vụ cha. */
export function validateRequestedDueDate(input: {
  currentDueDate: Date;
  requestedDueDate: Date;
  parentDueDate?: Date | null;
}): ExtensionDateError {
  if (input.requestedDueDate.getTime() <= input.currentDueDate.getTime()) return "NOT_AFTER_CURRENT";
  if (input.parentDueDate && input.requestedDueDate.getTime() > input.parentDueDate.getTime()) {
    return "EXCEEDS_PARENT_DUE";
  }
  return null;
}

export const EXTENSION_DATE_ERROR_MESSAGE: Record<Exclude<ExtensionDateError, null>, string> = {
  NOT_AFTER_CURRENT: "Hạn mới phải sau hạn hiện tại",
  EXCEEDS_PARENT_DUE: "Hạn việc con không được muộn hơn hạn nhiệm vụ cha. Xin gia hạn nhiệm vụ cha trước",
};

export function formatDueDateVi(date: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(date);
}

export function isRepeatedExtension(approvedCount: number): boolean {
  return approvedCount >= REPEATED_EXTENSION_THRESHOLD;
}
