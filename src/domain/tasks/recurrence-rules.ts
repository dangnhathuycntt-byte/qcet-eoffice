/**
 * Quy tắc mẫu và nhiệm vụ lặp lại (T-09, Q9). Hàm thuần theo giờ Việt Nam; không đọc DB.
 *
 * Kỳ (period_key) là tháng `YYYY-MM` theo giờ Việt Nam của hạn chót, nên cùng khớp với
 * `academicMonth` và năm học của nhiệm vụ sinh ra (N10).
 */
import { z } from "zod";
import { getAcademicYear } from "@/lib/academic-calendar";
import { ICT_TIMEZONE } from "./reminder-rules";

export const PERIOD_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
export const MAX_TEMPLATE_ITEMS = 20;

export const TemplateBodySchema = z
  .object({
    name: z.string().trim().min(1, "Cần đặt tên mẫu").max(200),
    unitId: z.string().trim().min(1),
    title: z.string().trim().min(1, "Cần tiêu đề nhiệm vụ").max(500),
    description: z.string().trim().max(5000).nullable().optional(),
    priority: z.enum(["URGENT", "HIGH", "NORMAL", "LOW"]).default("NORMAL"),
    dueDay: z.number().int().min(1).max(28).default(28),
    criteria: z.array(z.string().trim().min(1).max(300)).max(MAX_TEMPLATE_ITEMS).default([]),
    subtasks: z.array(z.string().trim().min(1).max(500)).max(MAX_TEMPLATE_ITEMS).default([]),
  })
  .strict();

/** Giới hạn bù để bật muộn không sinh dồn quá nhiều nhiệm vụ một lúc. */
export const MAX_CATCH_UP_MONTHS = 3;

export const RecurrenceBodySchema = z
  .object({
    templateId: z.string().trim().min(1),
    driUserId: z.string().trim().min(1),
    collaboratorIds: z.array(z.string().trim().min(1)).max(50).default([]),
    reviewerUserId: z.string().trim().min(1).nullable().optional(),
    everyMonths: z.number().int().min(1).max(12).default(1),
    startPeriod: z.string().regex(PERIOD_RE, "Kỳ bắt đầu phải có dạng YYYY-MM"),
    endPeriod: z.string().regex(PERIOD_RE, "Kỳ kết thúc phải có dạng YYYY-MM").nullable().optional(),
    /** Số tháng trước tháng hiện tại còn được bù khi bật muộn; 0 là chỉ sinh kỳ hiện tại. */
    catchUpPeriods: z.number().int().min(0).max(MAX_CATCH_UP_MONTHS).default(0),
  })
  .strict()
  .refine((v) => !v.endPeriod || v.endPeriod >= v.startPeriod, { message: "Kỳ kết thúc không được trước kỳ bắt đầu", path: ["endPeriod"] });

/** Tháng `YYYY-MM` theo giờ Việt Nam của một mốc thời gian. */
export function periodKeyOf(date: Date): string {
  return date.toLocaleDateString("sv-SE", { timeZone: ICT_TIMEZONE }).slice(0, 7);
}

function monthIndex(key: string): number {
  return Number(key.slice(0, 4)) * 12 + (Number(key.slice(5, 7)) - 1);
}

export interface RecurrenceSchedule {
  startPeriod: string;
  endPeriod: string | null;
  everyMonths: number;
}

/** Kỳ `currentKey` có phải kỳ phải sinh nhiệm vụ không: trong khoảng bắt đầu, kết thúc và đúng bước `everyMonths`. */
export function isPeriodDue(schedule: RecurrenceSchedule, currentKey: string): boolean {
  if (currentKey < schedule.startPeriod) return false;
  if (schedule.endPeriod && currentKey > schedule.endPeriod) return false;
  return (monthIndex(currentKey) - monthIndex(schedule.startPeriod)) % schedule.everyMonths === 0;
}

function addMonths(key: string, delta: number): string {
  const index = monthIndex(key) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/**
 * Các kỳ phải sinh nhiệm vụ tính đến `currentKey`, từ cũ đến mới: kỳ hiện tại và (nếu bật bù) tối đa
 * `catchUpPeriods` tháng trước đó. Kỳ nào cũng chịu cùng điều kiện của `isPeriodDue`.
 */
export function duePeriods(schedule: RecurrenceSchedule, currentKey: string, catchUpPeriods = 0): string[] {
  const back = Math.min(Math.max(Math.trunc(catchUpPeriods), 0), MAX_CATCH_UP_MONTHS);
  const keys: string[] = [];
  for (let offset = back; offset >= 0; offset--) {
    const key = addMonths(currentKey, -offset);
    if (isPeriodDue(schedule, key)) keys.push(key);
  }
  return keys;
}

/** Hạn chót: 00:00 giờ Việt Nam của ngày `dueDay` trong kỳ (cùng quy ước các hạn khác). */
export function dueDateForPeriod(periodKey: string, dueDay: number): Date {
  const day = String(Math.min(Math.max(dueDay, 1), 28)).padStart(2, "0");
  return new Date(`${periodKey}-${day}T00:00:00+07:00`);
}

/** Thay `{thang}` (MM/YYYY), `{nam}` (YYYY) và `{nam_hoc}` (YYYY-YYYY) trong tiêu đề mẫu. */
export function renderTitle(template: string, periodKey: string): string {
  const year = periodKey.slice(0, 4);
  const month = periodKey.slice(5, 7);
  return template
    .replaceAll("{thang}", `${month}/${year}`)
    .replaceAll("{nam_hoc}", getAcademicYear(`${periodKey}-15`))
    .replaceAll("{nam}", year);
}
