"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleDot,
  Clock3,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  type AcademicMonthPeriod,
  generateAcademicMonthGrid,
  getSystemReferenceDate,
} from "@/lib/academic-calendar";
import {
  getCalendarAttentionState,
  getMonthCellPresentation,
  groupCalendarEntriesByDate,
  sortCalendarItemsByAttention,
  type CalendarAttentionState,
  type CalendarEntry,
  type CalendarTaskEntry,
  type CalendarEventEntry,
} from "@/lib/calendar/calendar-presentation";
import { type DayTaskItem } from "./calendar-day-sheet";

export type CalendarScope = "school" | "unit" | "my";

export interface CalendarMonthGridProps {
  period: AcademicMonthPeriod;
  tasks: SchoolTask[];
  events?: DayTaskItem[];
  /** Canonical CalendarEntry[] for progressive adoption. When provided, month
   *  cells are rendered through getMonthCellPresentation and tasksByDate
   *  derivation is skipped. The legacy tasks/events props remain for
   *  backward compatibility during transition. */
  entries?: CalendarEntry[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDaySheet: (dateStr: string) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  scope?: CalendarScope;
  currentUserId?: string;
  currentUserName?: string;
  /** Kept for backward compatibility with page-level state; month grid always
   *  renders month only. Agenda mode is owned by the page-level agenda-view. */
  viewMode?: "month" | "agenda";
  searchQuery?: string;
  statusFilter?: string;
  levelFilter?: string;
  className?: string;
}

const WEEK_DAYS = [
  { label: "T2", fullName: "Thứ Hai" },
  { label: "T3", fullName: "Thứ Ba" },
  { label: "T4", fullName: "Thứ Tư" },
  { label: "T5", fullName: "Thứ Năm" },
  { label: "T6", fullName: "Thứ Sáu" },
  { label: "T7", fullName: "Thứ Bảy" },
  { label: "CN", fullName: "Chủ Nhật" },
];

function getStatusLabel(state: CalendarAttentionState): string {
  switch (state) {
    case "overdue":
      return "Quá hạn";
    case "waiting":
      return "Chờ xét duyệt";
    case "due_today":
      return "Đến hạn hôm nay";
    case "in_progress":
      return "Đang thực hiện";
    case "completed":
      return "Hoàn thành";
    default:
      return "Chờ thực hiện";
  }
}

function StatusIcon({ state, className }: { state: CalendarAttentionState; className?: string }) {
  const common = cn("size-3 shrink-0", className);
  switch (state) {
    case "overdue":
      return <AlertTriangle className={cn(common, "text-rose-600")} aria-hidden="true" />;
    case "waiting":
      return <Clock3 className={cn(common, "text-amber-600")} aria-hidden="true" />;
    case "due_today":
      return <Clock3 className={cn(common, "text-orange-600")} aria-hidden="true" />;
    case "in_progress":
      return <CircleDot className={cn(common, "text-blue-600")} aria-hidden="true" />;
    case "completed":
      return <CheckCircle2 className={cn(common, "text-emerald-600")} aria-hidden="true" />;
    default:
      return <CircleDot className={cn(common, "text-muted-foreground")} aria-hidden="true" />;
  }
}

/** Adapt a legacy DayTaskItem to a minimal CalendarTaskEntry for use with
 *  getMonthCellPresentation. No SchoolTask->subTasks traversal is performed;
 *  the data is already flattened into DayTaskItem by the caller. */
function dayTaskItemToCalendarEntry(item: DayTaskItem, dateKey: string): CalendarEntry {
  if (item.isEvent) {
    return {
      kind: "event",
      id: item.id,
      meetingId: item.id,
      date: dateKey,
      title: item.title,
      startTime: item.time?.split(" - ")[0] ?? "00:00",
      endTime: item.time?.split(" - ")[1],
      location: item.location,
      organizerName: item.host ?? item.assigneeName,
      level: item.level,
    } satisfies CalendarEventEntry;
  }
  return {
    kind: "task",
    id: item.id,
    sourceTaskId: item.parentSchoolTaskId ?? item.id,
    date: dateKey,
    title: item.title,
    level: item.level,
    dueDate: item.dueDate,
    status: item.status as string,
    assigneeName: item.assigneeName,
    parentSchoolTaskId: item.parentSchoolTaskId,
    progressPercent: item.progressPercent,
    originalTask: item.originalTask,
  } satisfies CalendarTaskEntry;
}

export function CalendarMonthGrid({
  period,
  tasks = [],
  events = [],
  entries,
  selectedDate,
  onSelectDate,
  onOpenDaySheet,
  onSelectTask,
  scope = "school",
  currentUserId,
  currentUserName,
  // viewMode is accepted but ignored; this component always renders month.
  // Agenda mode is handled by the page-level agenda-view component.
  viewMode: _viewMode,
  searchQuery = "",
  statusFilter = "ALL",
  levelFilter = "ALL",
  className,
}: CalendarMonthGridProps) {
  const referenceDate = getSystemReferenceDate();
  const gridCells = React.useMemo(() => generateAcademicMonthGrid(period), [period]);
  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  // --- Canonical CalendarEntry path ---
  const entriesByDate = React.useMemo(() => {
    if (!entries || entries.length === 0) return null;
    return groupCalendarEntriesByDate(entries);
  }, [entries]);

  // --- Legacy DayTaskItem path (backward compat while entries not yet wired) ---
  const tasksByDate = React.useMemo(() => {
    // If canonical entries are provided, skip legacy derivation entirely.
    if (entriesByDate !== null) return new Map<string, DayTaskItem[]>();

    const map = new Map<string, DayTaskItem[]>();

    const matchesStatus = (status: string, dueDate?: string) => {
      if (!statusFilter || statusFilter === "ALL") return true;
      if (statusFilter === "OVERDUE") {
        return getCalendarAttentionState(
          { id: "filter", title: "filter", status, dueDate },
          referenceDate
        ) === "overdue";
      }
      return status === statusFilter;
    };

    const addItem = (dateKey: string, item: DayTaskItem) => {
      const existing = map.get(dateKey);
      if (existing) existing.push(item);
      else map.set(dateKey, [item]);
    };

    for (const st of tasks) {
      const matchesSchoolLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "TRUONG";
      const isSchoolMatchScope =
        scope === "school" ||
        (scope === "my" &&
          ((currentUserId && st.leadAssigneeId === currentUserId) ||
            (currentUserName && st.leadAssigneeName === currentUserName)));

      if (
        isSchoolMatchScope &&
        matchesSchoolLevel &&
        st.dueDate &&
        matchesStatus(st.status, st.dueDate)
      ) {
        const matchesQuery =
          !deferredQuery ||
          st.title.toLowerCase().includes(deferredQuery) ||
          Boolean(st.leadAssigneeName?.toLowerCase().includes(deferredQuery));

        if (matchesQuery) {
          addItem(st.dueDate.split("T")[0], {
            id: st.id,
            title: st.title,
            level: "Trường",
            category: st.category,
            categoryLabel: st.categoryLabel,
            assigneeName: st.leadAssigneeName,
            assigneeAvatar: st.leadAssigneeAvatar,
            dueDate: st.dueDate,
            status: st.status,
            progressPercent: st.progressPercent,
            originalTask: st,
          });
        }
      }

      const matchesSubLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "DON_VI";
      if (!matchesSubLevel || !Array.isArray(st.subTasks)) continue;

      for (const sub of st.subTasks) {
        const isUnitMatchScope =
          scope === "unit" ||
          (scope === "my" &&
            ((currentUserId && sub.assigneeId === currentUserId) ||
              (currentUserName && sub.assigneeName === currentUserName)));

        if (!isUnitMatchScope || !sub.dueDate || !matchesStatus(sub.status, sub.dueDate)) continue;

        const matchesQuery =
          !deferredQuery ||
          sub.title.toLowerCase().includes(deferredQuery) ||
          Boolean(sub.assigneeName?.toLowerCase().includes(deferredQuery));
        if (!matchesQuery) continue;

        addItem(sub.dueDate.split("T")[0], {
          id: sub.id,
          title: sub.title,
          level: "Đơn vị",
          category: st.category,
          categoryLabel: st.categoryLabel,
          assigneeName: sub.assigneeName,
          assigneeAvatar: sub.assigneeAvatar,
          dueDate: sub.dueDate,
          status: sub.status,
          parentSchoolTaskId: st.id,
          parentSchoolTaskTitle: st.title,
          originalTask: sub,
        });
      }
    }

    if (statusFilter === "ALL") {
      for (const event of events) {
        const matchesLevel =
          levelFilter === "ALL" ||
          (levelFilter === "TRUONG" && event.level === "Trường") ||
          (levelFilter === "DON_VI" && event.level === "Đơn vị");
        const matchesScope =
          scope === "my" ||
          (scope === "school" && event.level === "Trường") ||
          (scope === "unit" && event.level === "Đơn vị");
        const matchesQuery =
          !deferredQuery ||
          [event.title, event.assigneeName, event.host, event.location]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(deferredQuery));

        if (matchesLevel && matchesScope && matchesQuery && event.dueDate) {
          addItem(event.dueDate.split("T")[0], event);
        }
      }
    }

    for (const [dateKey, items] of map) {
      map.set(dateKey, sortCalendarItemsByAttention(items, referenceDate));
    }

    return map;
  }, [
    entriesByDate,
    tasks,
    events,
    scope,
    currentUserId,
    currentUserName,
    deferredQuery,
    statusFilter,
    levelFilter,
    referenceDate,
  ]);

  const openDay = React.useCallback(
    (dateString: string) => {
      onSelectDate(dateString);
      onOpenDaySheet(dateString);
    },
    [onOpenDaySheet, onSelectDate]
  );

  return (
    <div className={cn("flex flex-col space-y-4", className)} data-slot="calendar-month-grid">
      <div
        className="flex flex-col rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden transition-all"
        data-slot="desktop-responsive-month-grid"
      >
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 text-center select-none">
          {WEEK_DAYS.map((weekday, idx) => (
            <div
              key={weekday.label}
              className={cn(
                "py-2.5 text-xs font-semibold text-muted-foreground border-r border-border/40 last:border-r-0",
                idx >= 5 && "text-muted-foreground/70 bg-muted/20"
              )}
              title={weekday.fullName}
            >
              {weekday.fullName}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 divide-x divide-y divide-border/40 bg-border/20">
          {gridCells.map((cell) => {
            // Derive cell presentation from canonical entries or legacy items.
            let cellPresentation: ReturnType<typeof getMonthCellPresentation>;
            let legacyDayItems: DayTaskItem[] = [];

            if (entriesByDate !== null) {
              const dayEntries = entriesByDate.get(cell.dateString) ?? [];
              cellPresentation = getMonthCellPresentation(cell.dateString, dayEntries, referenceDate, {
                maxEventPreviews: 1,
              });
            } else {
              legacyDayItems = tasksByDate.get(cell.dateString) ?? [];
              const legacyEntries: CalendarEntry[] = legacyDayItems.map((item) =>
                dayTaskItemToCalendarEntry(item, cell.dateString)
              );
              cellPresentation = getMonthCellPresentation(cell.dateString, legacyEntries, referenceDate, {
                maxEventPreviews: 1,
              });
            }

            const { total, overdueCount, waitingCount, dueCount, eventPreviews, taskPreviews, hiddenCount } =
              cellPresentation;

            const isSelected = selectedDate === cell.dateString;

            return (
              <section
                key={cell.dateString}
                className={cn(
                  "relative min-h-[124px] max-h-[150px] p-2 flex flex-col overflow-hidden transition-all text-left",
                  !cell.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                  cell.isCurrentMonth && "bg-card",
                  cell.isWeekend && cell.isCurrentMonth && "bg-muted/[0.04]",
                  cell.isToday && "bg-primary/[0.04] border-primary/30",
                  // Selected: ring indicator — visually distinct from today (filled circle) and urgent (rose/amber)
                  isSelected && "ring-2 ring-primary/40 ring-inset z-10 shadow-xs"
                )}
                data-date={cell.dateString}
                aria-label={`${cell.dateString}: ${total} mục lịch`}
              >
                <div className="flex items-center justify-between gap-2">
                  {/* Date number: today = filled primary circle; selected ≠ today = bold primary text; other = plain */}
                  <button
                    type="button"
                    onClick={() => openDay(cell.dateString)}
                    className={cn(
                      "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-xs font-medium tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : isSelected
                          ? "ring-1.5 ring-primary text-primary font-bold"
                          : cell.isCurrentMonth
                            ? "text-foreground hover:bg-muted/60"
                            : "text-muted-foreground/40 hover:bg-muted/40"
                    )}
                    aria-label={`Mở lịch ngày ${cell.dateString}`}
                  >
                    {cell.dayNumber}
                  </button>

                  {total > 0 && (
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {total} việc
                    </span>
                  )}
                </div>

                {/* Attention summary row: overdue / waiting / due-today counts */}
                {total > 0 && (
                  <button
                    type="button"
                    onClick={() => openDay(cell.dateString)}
                    className="mt-1.5 min-h-[18px] flex items-center gap-2 overflow-hidden whitespace-nowrap text-xs leading-none w-full text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded"
                    aria-label={`Xem chi tiết ngày ${cell.dateString}`}
                    tabIndex={total === 0 ? -1 : 0}
                  >
                    {overdueCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 font-semibold text-rose-700"
                        title={`${overdueCount} nhiệm vụ quá hạn`}
                      >
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {overdueCount} quá hạn
                      </span>
                    )}
                    {waitingCount > 0 && (
                      <span
                        className="inline-flex items-center gap-1 font-semibold text-amber-700"
                        title={`${waitingCount} nhiệm vụ chờ duyệt`}
                      >
                        <Clock3 className="size-3" aria-hidden="true" />
                        {waitingCount} chờ duyệt
                      </span>
                    )}
                    {overdueCount === 0 && waitingCount === 0 && dueCount > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {dueCount} hôm nay
                      </span>
                    )}
                  </button>
                )}

                <div className="mt-1.5 flex-1 space-y-1 overflow-hidden min-h-0">
                  {/* At most 1 high-value timed event preview */}
                  {eventPreviews.map((ev) => (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => openDay(cell.dateString)}
                      className="w-full min-h-6 text-left flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition-colors border truncate shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary bg-sky-500/5 border-sky-500/20 text-foreground hover:border-sky-500/40 hover:bg-sky-500/10"
                      title={`Sự kiện · ${ev.title}${ev.startTime ? ` · ${ev.startTime}` : ""}`}
                      aria-label={`Sự kiện: ${ev.title}`}
                    >
                      <CalendarIcon className="size-3 shrink-0 text-sky-600" aria-hidden="true" />
                      <span className="truncate font-sans text-xs leading-tight">{ev.title}</span>
                    </button>
                  ))}

                  {/* Attention-ranked task previews (completed suppressed) */}
                  {taskPreviews.map((taskEntry) => {
                    const state = getCalendarAttentionState(
                      { id: taskEntry.id, title: taskEntry.title, status: taskEntry.status, dueDate: taskEntry.dueDate },
                      referenceDate
                    );
                    const isDone = state === "completed";
                    const itemLabel = getStatusLabel(state);
                    // For legacy path: retrieve originalTask from DayTaskItem for onSelectTask
                    const legacyItem = entriesByDate === null
                      ? legacyDayItems.find((d) => d.id === taskEntry.id)
                      : undefined;
                    return (
                      <button
                        key={taskEntry.id}
                        type="button"
                        onClick={() => {
                          if (legacyItem?.originalTask) {
                            onSelectTask?.(legacyItem.originalTask);
                          } else {
                            openDay(cell.dateString);
                          }
                        }}
                        className={cn(
                          "w-full min-h-6 text-left flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition-colors border truncate shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                          taskEntry.level === "Trường"
                            ? "bg-background/90 border-border/70 text-foreground hover:border-primary/50 hover:bg-accent"
                            : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent",
                          isDone && "opacity-60 line-through bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                        )}
                        title={`${itemLabel} · ${taskEntry.title}`}
                        aria-label={`${itemLabel}: ${taskEntry.title}`}
                      >
                        <StatusIcon state={state} />
                        <span className="truncate font-sans text-xs leading-tight">{taskEntry.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Dim muted overflow count — opens Day Sheet on cell click, not a separate pill */}
                {hiddenCount > 0 && (
                  <span
                    className="mt-1 block px-1.5 text-xs text-muted-foreground/60 tabular-nums leading-tight select-none"
                    aria-hidden="true"
                  >
                    {hiddenCount} việc
                  </span>
                )}
              </section>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Trạng thái:</span>
          <div className="flex flex-wrap items-center gap-4">
            <span className="inline-flex items-center gap-1.5"><CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />Hoàn thành</span>
            <span className="inline-flex items-center gap-1.5"><CircleDot className="size-3.5 text-blue-600" aria-hidden="true" />Đang thực hiện</span>
            <span className="inline-flex items-center gap-1.5"><Clock3 className="size-3.5 text-amber-600" aria-hidden="true" />Chờ xét duyệt</span>
            <span className="inline-flex items-center gap-1.5"><AlertTriangle className="size-3.5 text-rose-600" aria-hidden="true" />Quá hạn</span>
            <span className="inline-flex items-center gap-1.5"><CalendarIcon className="size-3.5 text-sky-600" aria-hidden="true" />Sự kiện</span>
          </div>
          <span className="hidden md:inline font-mono tabular-nums">Chu kỳ: 25/tháng trước - 24/tháng này</span>
        </div>
      </div>
    </div>
  );
}
