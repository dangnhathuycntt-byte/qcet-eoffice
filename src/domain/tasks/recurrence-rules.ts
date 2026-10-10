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

export const RecurrenceBodySchema = z
  .object({
    templateId: z.string().trim().min(1),
    driUserId: z.string().trim().min(1),
    collaboratorIds: z.array(z.string().trim().min(1)).max(50).default([]),
    reviewerUserId: z.string().trim().min(1).nullable().optional(),
    everyMonths: z.number().int().min(1).max(12).default(1),
    startPeriod: z.string().regex(PERIOD_RE, "Kỳ bắt đầu phải có dạng YYYY-MM"),
    endPeriod: z.string().regex(PERIOD_RE, "Kỳ kết thúc phải có dạng YYYY-MM").nullable().optional(),
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
