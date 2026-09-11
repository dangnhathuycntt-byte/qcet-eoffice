import { isTaskOverdue } from "@/lib/academic-calendar";

export type CalendarAttentionState =
  | "overdue"
  | "waiting"
  | "due_today"
  | "in_progress"
  | "pending"
  | "completed";

export type CalendarDayFilter = "attention" | "overdue" | "waiting" | "all";

export interface CalendarAttentionItem {
  id: string;
  title: string;
  status: string;
  dueDate?: string | null;
}

export interface CalendarDaySummary {
  total: number;
  attention: number;
  overdue: number;
  waiting: number;
  dueToday: number;
  inProgress: number;
  pending: number;
  completed: number;
}

const STATE_PRIORITY: Record<CalendarAttentionState, number> = {
  overdue: 0,
  waiting: 1,
  due_today: 2,
  in_progress: 3,
  pending: 4,
  completed: 5,
};

const WAITING_STATUSES = new Set([
  "WAITING_APPROVAL",
  "PENDING_EXECUTIVE_APPROVAL",
  "NEEDS_REVIEW",
  "BLOCKED",
]);

const COMPLETED_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

function cleanDate(value?: string | null): string | null {
  if (!value) return null;
  return value.length > 10 ? value.slice(0, 10) : value;
}

export function getCalendarAttentionState(
  item: CalendarAttentionItem,
  referenceDate: string
): CalendarAttentionState {
  const status = (item.status || "").toUpperCase();

  if (COMPLETED_STATUSES.has(status)) {
    return "completed";
  }

  if (isTaskOverdue(status, item.dueDate, referenceDate)) {
    return "overdue";
  }

  if (WAITING_STATUSES.has(status)) {
    return "waiting";
  }

  const dueDate = cleanDate(item.dueDate);
  if (dueDate === cleanDate(referenceDate)) {
    return "due_today";
  }

  if (status === "IN_PROGRESS") {
    return "in_progress";
  }

  return "pending";
}

export function sortCalendarItemsByAttention<T extends CalendarAttentionItem>(
  items: readonly T[],
  referenceDate: string
): T[] {
  return items
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftPriority = STATE_PRIORITY[getCalendarAttentionState(left.entry, referenceDate)];
      const rightPriority = STATE_PRIORITY[getCalendarAttentionState(right.entry, referenceDate)];

      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }

      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export function getCalendarDaySummary(
  items: readonly CalendarAttentionItem[],
  referenceDate: string
): CalendarDaySummary {
  const summary: CalendarDaySummary = {
    total: items.length,
    attention: 0,
    overdue: 0,
    waiting: 0,
    dueToday: 0,
    inProgress: 0,
    pending: 0,
    completed: 0,
  };

  for (const item of items) {
    const state = getCalendarAttentionState(item, referenceDate);

    switch (state) {
      case "overdue":
        summary.overdue += 1;
        summary.attention += 1;
        break;
      case "waiting":
        summary.waiting += 1;
        summary.attention += 1;
        break;
      case "due_today":
        summary.dueToday += 1;
        summary.attention += 1;
        break;
      case "in_progress":
        summary.inProgress += 1;
        break;
      case "pending":
        summary.pending += 1;
        break;
      case "completed":
        summary.completed += 1;
        break;
    }
  }

  return summary;
}

export function filterCalendarItems<T extends CalendarAttentionItem>(
  items: readonly T[],
  filter: CalendarDayFilter,
  referenceDate: string
): T[] {
  const ranked = sortCalendarItemsByAttention(items, referenceDate);

  if (filter === "all") {
    return ranked;
  }

  return ranked.filter((item) => {
    const state = getCalendarAttentionState(item, referenceDate);
    if (filter === "attention") {
      return state === "overdue" || state === "waiting" || state === "due_today";
    }
    return state === filter;
  });
}
