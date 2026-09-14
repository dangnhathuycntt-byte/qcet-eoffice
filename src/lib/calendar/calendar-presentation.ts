import { isTaskOverdue } from "@/lib/academic-calendar";

export interface CalendarBaseEntry {
  id: string;
  date: string;
  title: string;
  level?: "Trường" | "Đơn vị";
}

export interface CalendarTaskEntry extends CalendarBaseEntry {
  kind: "task";
  sourceTaskId: string;
  parentSchoolTaskId?: string;
  dueDate: string;
  dueTime?: string;
  status: string;
  assigneeId?: string;
  assigneeName?: string;
  departmentId?: string;
  departmentName?: string;
  progressPercent?: number;
  originalTask?: any;
}

export interface CalendarEventEntry extends CalendarBaseEntry {
  kind: "event";
  meetingId: string;
  startTime: string;
  endTime?: string;
  location?: string;
  organizerId?: string;
  organizerName?: string;
  unitId?: string;
  unitName?: string;
}

export type CalendarEntry = CalendarTaskEntry | CalendarEventEntry;

export type CalendarScope = "school" | "department" | "unit" | "personal" | "my";

export interface CalendarUserContext {
  id?: string;
  name?: string;
  departmentId?: string;
  departmentName?: string;
}

export function isCalendarTaskEntry(entry: CalendarEntry): entry is CalendarTaskEntry {
  return entry.kind === "task";
}

export function isCalendarEventEntry(entry: CalendarEntry): entry is CalendarEventEntry {
  return entry.kind === "event";
}

export function matchesCalendarScope(
  entry: CalendarEntry,
  scope: CalendarScope,
  user?: CalendarUserContext
): boolean {
  if (scope === "school") {
    return entry.level === "Trường" || (!entry.level && entry.kind === "task" && !entry.parentSchoolTaskId && !entry.departmentId);
  }

  if (scope === "department" || scope === "unit") {
    if (user?.departmentId) {
      if (entry.kind === "task") {
        return entry.departmentId === user.departmentId;
      }
      if (entry.kind === "event") {
        return entry.unitId === user.departmentId;
      }
    }
    if (user?.departmentName) {
      if (entry.kind === "task") {
        return Boolean(entry.departmentName && entry.departmentName.toLowerCase().includes(user.departmentName.toLowerCase()));
      }
      if (entry.kind === "event") {
        return Boolean(entry.unitName && entry.unitName.toLowerCase().includes(user.departmentName.toLowerCase()));
      }
    }
    return entry.level === "Đơn vị" || (entry.kind === "task" && Boolean(entry.parentSchoolTaskId || entry.departmentId)) || (entry.kind === "event" && Boolean(entry.unitId));
  }

  if (scope === "personal" || scope === "my") {
    if (!user) return false;
    if (entry.kind === "task") {
      const matchId = Boolean(user.id && entry.assigneeId === user.id);
      const matchName = Boolean(user.name && entry.assigneeName && entry.assigneeName.toLowerCase().includes(user.name.toLowerCase()));
      return matchId || matchName;
    }
    if (entry.kind === "event") {
      const matchId = Boolean(user.id && entry.organizerId === user.id);
      const matchName = Boolean(user.name && entry.organizerName && entry.organizerName.toLowerCase().includes(user.name.toLowerCase()));
      return matchId || matchName;
    }
    return false;
  }

  return true;
}

export function filterCalendarEntriesByScope(
  entries: readonly CalendarEntry[],
  scope: CalendarScope,
  user?: CalendarUserContext
): CalendarEntry[] {
  return entries.filter((entry) => matchesCalendarScope(entry, scope, user));
}

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

/**
 * Thin display-filter wrapper over matchesCalendarScope.
 * Scope is a visual dataset filter only — it never grants, narrows, or widens
 * operational authorization. Never use role as scope.
 */
export function isCalendarEntryVisibleForScope(
  entry: CalendarEntry,
  scope: CalendarScope,
  user?: CalendarUserContext
): boolean {
  return matchesCalendarScope(entry, scope, user);
}

/**
 * Pure grouping of calendar entries by their date-only key (YYYY-MM-DD).
 * Preserves input order within each day; no ranking applied here.
 */
export function groupCalendarEntriesByDate(
  entries: readonly CalendarEntry[]
): Map<string, CalendarEntry[]> {
  const grouped = new Map<string, CalendarEntry[]>();
  for (const entry of entries) {
    const key = cleanDate(entry.date);
    if (!key) continue;
    const list = grouped.get(key);
    if (list) {
      list.push(entry);
    } else {
      grouped.set(key, [entry]);
    }
  }
  return grouped;
}

function getCalendarEntryAttentionPriority(
  entry: CalendarEntry,
  referenceDate: string
): number {
  if (entry.kind === "task") {
    return STATE_PRIORITY[
      getCalendarAttentionState(
        { id: entry.id, title: entry.title, status: entry.status, dueDate: entry.dueDate },
        referenceDate
      )
    ];
  }
  // Timed events carry no task status; rank with pending work so urgent
  // tasks always stay ahead while ordering remains deterministic.
  return STATE_PRIORITY["pending"];
}

/**
 * Attention-first deterministic ranking for agenda lists.
 * Primary: attention priority (overdue > waiting > due_today > pending events).
 * Tie-breakers: date, event startTime, title, id, then stable input order.
 */
export function sortAgendaEntries(
  entries: readonly CalendarEntry[],
  referenceDate: string
): CalendarEntry[] {
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => {
      const leftPriority = getCalendarEntryAttentionPriority(left.entry, referenceDate);
      const rightPriority = getCalendarEntryAttentionPriority(right.entry, referenceDate);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      const leftDate = cleanDate(left.entry.date) ?? "";
      const rightDate = cleanDate(right.entry.date) ?? "";
      if (leftDate !== rightDate) {
        return leftDate < rightDate ? -1 : 1;
      }
      const leftTime = left.entry.kind === "event" ? left.entry.startTime ?? "" : "";
      const rightTime = right.entry.kind === "event" ? right.entry.startTime ?? "" : "";
      if (leftTime !== rightTime) {
        return leftTime < rightTime ? -1 : 1;
      }
      if (left.entry.title !== right.entry.title) {
        return left.entry.title < right.entry.title ? -1 : 1;
      }
      if (left.entry.id !== right.entry.id) {
        return left.entry.id < right.entry.id ? -1 : 1;
      }
      return left.index - right.index;
    })
    .map(({ entry }) => entry);
}

export interface MonthCellPresentation {
  date: string;
  total: number;
  overdueCount: number;
  waitingCount: number;
  dueCount: number;
  hiddenCount: number;
  eventPreviews: CalendarEventEntry[];
  taskPreviews: CalendarTaskEntry[];
}

export interface MonthCellPresentationOptions {
  maxTotalPreviews?: number;
  maxEventPreviews?: number;
  includeCompleted?: boolean;
}

function toAttentionItem(entry: CalendarTaskEntry): CalendarAttentionItem {
  return { id: entry.id, title: entry.title, status: entry.status, dueDate: entry.dueDate };
}

/**
 * Dense month-cell summary. Shows at most 1 high-value timed event preview
 * (earliest real startTime) plus attention-ranked task previews. Completed
 * task titles are suppressed by default; counts still include every entry.
 */
export function getMonthCellPresentation(
  date: string,
  entries: readonly CalendarEntry[],
  referenceDate: string,
  options?: MonthCellPresentationOptions
): MonthCellPresentation {
  const maxTotal = options?.maxTotalPreviews ?? 3;
  const maxEvents = Math.min(options?.maxEventPreviews ?? 1, maxTotal);
  const includeCompleted = options?.includeCompleted ?? false;

  let overdueCount = 0;
  let waitingCount = 0;
  let dueCount = 0;
  const tasks: CalendarTaskEntry[] = [];
  const events: CalendarEventEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === "event") {
      events.push(entry);
    } else {
      tasks.push(entry);
      const state = getCalendarAttentionState(toAttentionItem(entry), referenceDate);
      if (state === "overdue") overdueCount += 1;
      else if (state === "waiting") waitingCount += 1;
      else if (state === "due_today") dueCount += 1;
    }
  }

  const rankedEvents = [...events].sort((a, b) => {
    if (a.startTime !== b.startTime) return a.startTime < b.startTime ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const eventPreviews = rankedEvents.slice(0, Math.max(0, maxEvents));

  const visibleTasks = includeCompleted
    ? tasks
    : tasks.filter((task) => getCalendarAttentionState(toAttentionItem(task), referenceDate) !== "completed");
  const rankedTasks = sortCalendarItemsByAttention(visibleTasks, referenceDate);
  const taskSlots = Math.max(0, maxTotal - eventPreviews.length);
  const taskPreviews = rankedTasks.slice(0, taskSlots);

  return {
    date: cleanDate(date) ?? date,
    total: entries.length,
    overdueCount,
    waitingCount,
    dueCount,
    hiddenCount: Math.max(0, entries.length - eventPreviews.length - taskPreviews.length),
    eventPreviews,
    taskPreviews,
  };
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  dueToday: number;
  upcoming: number;
  completed: number;
}

/**
 * Deadline-focused rollup derived from the single canonical attention state
 * model (same classifier as getCalendarDaySummary). Upcoming aggregates the
 * non-urgent open states (waiting + in_progress + pending).
 */
export function getDeadlineSummary(
  items: readonly CalendarAttentionItem[],
  referenceDate: string
): DeadlineSummary {
  let overdue = 0;
  let dueToday = 0;
  let upcoming = 0;
  let completed = 0;

  for (const item of items) {
    const state = getCalendarAttentionState(item, referenceDate);
    if (state === "overdue") overdue += 1;
    else if (state === "due_today") dueToday += 1;
    else if (state === "completed") completed += 1;
    else upcoming += 1;
  }

  return { total: items.length, overdue, dueToday, upcoming, completed };
}
