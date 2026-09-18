import type { SchoolTask, StaffTask } from "@/types/dashboard";

export type TaskTimePreset = "today" | "this_week" | "this_month" | "overdue";

export type TaskTimeFilter =
  | { kind: "none" }
  | { kind: "month"; month: number }
  | { kind: "preset"; preset: TaskTimePreset }
  | { kind: "range"; from: string; to: string };

export const NO_TASK_TIME_FILTER: TaskTimeFilter = { kind: "none" };

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isValidTaskDateRange(from?: string, to?: string): boolean {
  return Boolean(from && to && ISO_DATE.test(from) && ISO_DATE.test(to) && from <= to);
}

export function getTaskTimeFilterLabel(filter: TaskTimeFilter): string {
  if (filter.kind === "month") return `Tháng ${filter.month}`;
  if (filter.kind === "range") {
    const short = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;
    return `${short(filter.from)}–${short(filter.to)}`;
  }
  if (filter.kind === "preset") {
    return {
      today: "Hôm nay",
      this_week: "Tuần này",
      this_month: "Tháng này",
      overdue: "Quá hạn",
    }[filter.preset];
  }
  return "Thời gian";
}

function localISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getBounds(filter: Exclude<TaskTimeFilter, { kind: "none" } | { kind: "month" }>, now: Date) {
  const today = localISODate(now);
  if (filter.kind === "range") return { from: filter.from, to: filter.to };
  if (filter.preset === "today" || filter.preset === "overdue") return { from: today, to: today };
  if (filter.preset === "this_month") {
    const from = localISODate(new Date(now.getFullYear(), now.getMonth(), 1));
    const to = localISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    return { from, to };
  }
  const mondayOffset = (now.getDay() + 6) % 7;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - mondayOffset);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return { from: localISODate(monday), to: localISODate(sunday) };
}

function matchesDueDate(task: SchoolTask | StaffTask, filter: TaskTimeFilter, now: Date): boolean {
  if (!task.dueDate) return false;
  const due = String(task.dueDate).slice(0, 10);
  if (filter.kind === "month") return Number(due.slice(5, 7)) === filter.month;
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
