import type { SchoolTask, StaffTask } from "@qcet/contracts/types/dashboard";
import { addCalendarDays, getAcademicYear, getDaysInMonth, parseStrictDateOnly } from "@qcet/shared/lib/academic-calendar";

export type TaskTimePreset = "today" | "this_week" | "this_month" | "overdue";

export type TaskTimeFilter =
  | { kind: "none" }
  | { kind: "month"; month: number }
  | { kind: "preset"; preset: TaskTimePreset }
  | { kind: "range"; from: string; to: string };

export const NO_TASK_TIME_FILTER: TaskTimeFilter = { kind: "none" };

export function getTaskTimeFilterLabel(filter: TaskTimeFilter): string {
  if (filter.kind === "month") return `Tháng ${filter.month}`;
  if (filter.kind === "range") {
    const short = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
    if (filter.from === filter.to) return short(filter.from);
    return `${short(filter.from)}–${short(filter.to)}`;
  }
  if (filter.kind === "preset") {
    return {
      today: "Hôm nay",
      this_week: "Tuần này",
      this_month: "Tháng này",
      overdue: "Trễ hạn",
    }[filter.preset];
  }
  return "Thời gian";
}

/** Ngày hôm nay theo giờ Việt Nam (Asia/Ho_Chi_Minh), không theo múi giờ của trình duyệt. */
function ictDateOnly(date: Date): string {
  return parseStrictDateOnly(date) ?? date.toISOString().slice(0, 10);
}

function getBounds(filter: Exclude<TaskTimeFilter, { kind: "none" } | { kind: "month" }>, now: Date) {
  const today = ictDateOnly(now);
  if (filter.kind === "range") return { from: filter.from, to: filter.to };
  if (filter.preset === "today" || filter.preset === "overdue") return { from: today, to: today };
  if (filter.preset === "this_month") {
    const [year, month] = today.split("-").map(Number);
    const prefix = today.slice(0, 8);
    return { from: `${prefix}01`, to: `${prefix}${String(getDaysInMonth(year, month)).padStart(2, "0")}` };
  }
  const mondayOffset = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const monday = addCalendarDays(today, -mondayOffset) ?? today;
  return { from: monday, to: addCalendarDays(monday, 6) ?? monday };
}

function matchesDueDate(task: SchoolTask | StaffTask, filter: TaskTimeFilter, now: Date): boolean {
  if (!task.dueDate) return false;
  const due = String(task.dueDate).slice(0, 10);
  if (filter.kind === "month") {
    // Tháng thuộc năm học hiện tại (T9–T12 năm đầu, T1–T8 năm sau), không khớp cùng tháng của năm khác
    const startYear = Number(getAcademicYear(ictDateOnly(now)).slice(0, 4));
    const year = filter.month >= 9 ? startYear : startYear + 1;
    return due.slice(0, 7) === `${year}-${String(filter.month).padStart(2, "0")}`;
  }
  if (filter.kind === "none") return true;
  const { from, to } = getBounds(filter, now);
  if (filter.kind === "preset" && filter.preset === "overdue") {
    return due < from && task.status !== "COMPLETED" && task.status !== "CANCELLED";
  }
  return due >= from && due <= to;
}

/** Keep a parent visible when either it or one of its children matches. */
export function filterTasksByTime(
  tasks: SchoolTask[],
  filter: TaskTimeFilter,
  now = new Date()
): SchoolTask[] {
  if (filter.kind === "none") return tasks;
  return tasks.filter(
    (task) => matchesDueDate(task, filter, now) || Boolean(task.subTasks?.some((child) => matchesDueDate(child, filter, now)))
  );
}
