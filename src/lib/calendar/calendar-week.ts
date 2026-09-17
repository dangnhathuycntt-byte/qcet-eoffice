import { getSystemReferenceDate, getTodayIctDate } from "@/lib/academic-calendar";

export interface WeekDayItem {
  date: string;
  dayOfWeek: number;
  label: string;
  dayLabelVi: string;
  displayDate: string;
  dayNumber: number;
  isToday: boolean;
}

export type CalendarWeekDay = WeekDayItem;

export interface GetWeekDaysOptions {
  showWeekends?: boolean;
  today?: string;
  referenceDate?: string;
}

const WEEK_LABELS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"] as const;

function cleanDateString(dateStr: string): string {
  if (!dateStr) return "";
  if (dateStr.includes("T")) {
    return dateStr.split("T")[0];
  }
  const match = dateStr.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) return match[1];
  return dateStr.trim();
}

/**
 * Calculates calendar week days centered around a reference date.
 * Guarantees Monday is day 1 and Sunday is day 7.
 * Uses safe date arithmetic to prevent UTC day-shifting bugs.
 */
export function getWeekDays(
  referenceDate: string,
  options?: GetWeekDaysOptions
): WeekDayItem[] {
  const cleanRef = cleanDateString(referenceDate || getSystemReferenceDate());
  const [year, month, day] = cleanRef.split("-").map(Number);

  // Use local noon to protect against timezone/DST shifting
  const targetDate = new Date(year, month - 1, day, 12, 0, 0);
  const jsDay = targetDate.getDay();
  // Monday is 1, Tuesday is 2, ..., Sunday is 7
  const dayOfWeek1To7 = jsDay === 0 ? 7 : jsDay;
  const diffToMonday = dayOfWeek1To7 - 1;

  const mondayDate = new Date(year, month - 1, day - diffToMonday, 12, 0, 0);

  const todayStr = cleanDateString(options?.today || getTodayIctDate());
  const totalDays = options?.showWeekends === false ? 5 : 7;

  const result: WeekDayItem[] = [];

  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(
      mondayDate.getFullYear(),
      mondayDate.getMonth(),
      mondayDate.getDate() + i,
      12,
      0,
      0
    );

    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, "0");
    const d = String(cur.getDate()).padStart(2, "0");
    const dateString = `${y}-${m}-${d}`;

    result.push({
      date: dateString,
      dayOfWeek: i + 1,
      label: WEEK_LABELS[i],
      dayLabelVi: WEEK_LABELS[i],
      displayDate: `${d}/${m}`,
      dayNumber: cur.getDate(),
      isToday: dateString === todayStr,
    });
  }

  return result;
}
