/**
 * Quy tắc nhắc hạn nhiệm vụ (T-06). Hàm thuần theo giờ Việt Nam; không đọc DB.
 *
 * Mốc theo Quy trình 4, 2 và 11: nhắc trước hạn 1 ngày, báo trễ hạn một lần, người duyệt
 * chưa duyệt sau 2 ngày thì nhắc, sau 4 ngày thì báo người giao; yêu cầu gia hạn và từ chối
 * nhận việc chưa được xử lý theo cùng hai mốc 2 và 4 ngày.
 */

export const ICT_TIMEZONE = "Asia/Ho_Chi_Minh";

/** Giờ gửi nhắc trong ngày (giờ Việt Nam): gửi từ 07:00 để không đánh thức người nhận lúc nửa đêm. */
export const REMINDER_SEND_HOUR = 7;

export const FIRST_ESCALATION_HOURS = 48;
export const SECOND_ESCALATION_HOURS = 96;

/** Không báo trễ hạn cho nhiệm vụ trễ quá lâu: tránh gửi dồn khi mới bật bộ quét. */
export const OVERDUE_LOOKBACK_DAYS = 30;

export const REMINDER_KINDS = [
  "DUE_SOON",
  "OVERDUE",
  "REVIEW_PENDING_2D",
  "REVIEW_PENDING_4D",
  "EXTENSION_PENDING_2D",
  "EXTENSION_PENDING_4D",
  "DECLINE_PENDING_2D",
  "DECLINE_PENDING_4D",
  "BACKUP_REVIEWER_ACTIVATED",
] as const;

export type ReminderKind = (typeof REMINDER_KINDS)[number];

/** Ngày YYYY-MM-DD theo giờ Việt Nam. */
export function ictDayKey(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: ICT_TIMEZONE });
}

/** Giờ (0-23) theo giờ Việt Nam. */
export function ictHour(date: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hourCycle: "h23", timeZone: ICT_TIMEZONE }).format(date)
  );
}

/** Mốc 00:00 giờ Việt Nam của một ngày YYYY-MM-DD. */
export function ictDayStart(dayKey: string): Date {
  return new Date(`${dayKey}T00:00:00+07:00`);
}

/** Số ngày lịch từ `from` đến `to` (YYYY-MM-DD); dương nếu `to` sau `from`. */
export function dayDiff(from: string, to: string): number {
  const a = Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1, Number(from.slice(8, 10)));
  const b = Date.UTC(Number(to.slice(0, 4)), Number(to.slice(5, 7)) - 1, Number(to.slice(8, 10)));
  return Math.round((b - a) / 86_400_000);
}

export function isPastReminderHour(now: Date): boolean {
  return ictHour(now) >= REMINDER_SEND_HOUR;
}

/** Còn đúng 1 ngày đến hạn (ngày mai là ngày hạn) và đã qua giờ gửi. */
export function isDueSoon(dueDate: Date, now: Date): boolean {
  return dayDiff(ictDayKey(now), ictDayKey(dueDate)) === 1 && isPastReminderHour(now);
}

/** Đã qua ngày hạn nhưng chưa quá cửa sổ báo trễ; giờ gửi như nhắc trước hạn. */
export function isOverdueNotifiable(dueDate: Date, now: Date): boolean {
  const late = dayDiff(ictDayKey(dueDate), ictDayKey(now));
  return late >= 1 && late <= OVERDUE_LOOKBACK_DAYS && isPastReminderHour(now);
}

export function hoursSince(since: Date, now: Date): number {
  return (now.getTime() - since.getTime()) / 3_600_000;
}

export type EscalationStage = "NONE" | "FIRST" | "SECOND";

/** Mốc leo thang theo thời gian chờ: dưới 48 giờ chưa nhắc, từ 48 giờ nhắc, từ 96 giờ báo cấp trên. */
export function escalationStage(since: Date, now: Date): EscalationStage {
  const hours = hoursSince(since, now);
  if (hours >= SECOND_ESCALATION_HOURS) return "SECOND";
  if (hours >= FIRST_ESCALATION_HOURS) return "FIRST";
  return "NONE";
}
