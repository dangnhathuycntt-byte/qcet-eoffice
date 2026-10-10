/**
 * Quy tắc hết hạn bảo quản và xét hủy hồ sơ (V-07). Hàm thuần, theo năm dương lịch.
 *
 * Thời hạn bảo quản tính từ khi hồ sơ được lưu trữ cơ quan (archivedAt) cộng số năm của bảng
 * thời hạn và số năm đã gia hạn. Bảng thời hạn không có số năm nghĩa là bảo quản vĩnh viễn,
 * không bao giờ hết hạn. Tổng thời hạn có hạn không quá 70 năm (ProcQ10).
 */

export const MAX_RETENTION_YEARS = 70;

/** Nộp vào lưu trữ cơ quan trong 1 năm kể từ khi hồ sơ đóng, nhắc trước 30 ngày (ProcQ10). */
export const SUBMIT_DEADLINE_YEARS = 1;
export const SUBMIT_REMINDER_DAYS = 30;

function addYears(date: Date, years: number): Date {
  const result = new Date(date.getTime());
  result.setUTCFullYear(result.getUTCFullYear() + years);
  return result;
}

export function retentionEnd(input: { archivedAt: Date | null; ruleYears: number | null; extraYears: number }): Date | null {
  if (!input.archivedAt || input.ruleYears === null) return null;
  return addYears(input.archivedAt, input.ruleYears + input.extraYears);
}

export function isRetentionExpired(
  input: { archivedAt: Date | null; ruleYears: number | null; extraYears: number },
  now: Date
): boolean {
  const end = retentionEnd(input);
  return end !== null && end.getTime() <= now.getTime();
}

export function isPermanent(ruleYears: number | null): boolean {
  return ruleYears === null;
}

/** Số năm gia hạn thêm hợp lệ: nguyên dương và không làm tổng vượt giới hạn. */
export function validateExtendYears(ruleYears: number | null, currentExtra: number, extend: number): string | null {
  if (ruleYears === null) return "Hồ sơ bảo quản vĩnh viễn không cần gia hạn";
  if (!Number.isInteger(extend) || extend < 1) return "Số năm gia hạn phải là số nguyên từ 1";
  if (ruleYears + currentExtra + extend > MAX_RETENTION_YEARS) {
    return `Tổng thời hạn bảo quản không quá ${MAX_RETENTION_YEARS} năm (hiện ${ruleYears + currentExtra} năm)`;
  }
  return null;
}

/** Hạn nộp lưu trữ cơ quan của hồ sơ đã đóng. */
export function submitDeadline(closedAt: Date | null): Date | null {
  return closedAt ? addYears(closedAt, SUBMIT_DEADLINE_YEARS) : null;
}

/** Đã đến mốc nhắc nộp lưu (còn không quá 30 ngày hoặc đã qua hạn). */
export function isSubmitReminderDue(closedAt: Date | null, now: Date): boolean {
  const deadline = submitDeadline(closedAt);
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime() - SUBMIT_REMINDER_DAYS * 86_400_000;
}
