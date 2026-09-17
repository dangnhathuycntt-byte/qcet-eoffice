"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleDot,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  type AcademicMonthPeriod,
  generateAcademicMonthGrid,
  getSystemReferenceDate,
  getTodayIctDate,
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

function StatusIcon({ state, className }: { state: CalendarAttentionState; className?: string }) {
  const common = cn("size-3 shrink-0", className);
  switch (state) {
    case "overdue":
      return <AlertTriangle className={cn(common, "text-rose-600")} aria-hidden="true" />;
    case "waiting":
      return <CircleDot className={cn(common, "text-amber-600")} aria-hidden="true" />;
    case "due_today":
      return <CircleDot className={cn(common, "text-orange-600")} aria-hidden="true" />;
    case "in_progress":
      return <CircleDot className={cn(common, "text-blue-600")} aria-hidden="true" />;
    case "completed":
      return <CheckCircle2 className={cn(common, "text-emerald-700")} aria-hidden="true" />;
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
  const referenceDate = getTodayIctDate();
  const gridCells = React.useMemo(() => generateAcademicMonthGrid(period, referenceDate), [period, referenceDate]);
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
                maxTotalPreviews: 3,
                maxEventPreviews: 1,
              });
            } else {
              legacyDayItems = tasksByDate.get(cell.dateString) ?? [];
              const legacyEntries: CalendarEntry[] = legacyDayItems.map((item) =>
                dayTaskItemToCalendarEntry(item, cell.dateString)
              );
              cellPresentation = getMonthCellPresentation(cell.dateString, legacyEntries, referenceDate, {
                maxTotalPreviews: 3,
                maxEventPreviews: 1,
              });
            }

            const { total, overdueCount, waitingCount, eventPreviews, taskPreviews, hiddenCount } =
              cellPresentation;

            const isSelected = selectedDate === cell.dateString;
            // Show max 2 items in compact cells (1 event + 1 task, or 2 tasks)
            const maxVisibleTasks = Math.max(0, 2 - eventPreviews.length);
            const visibleTasks = taskPreviews.slice(0, maxVisibleTasks);
            const extraHidden = hiddenCount + (taskPreviews.length - visibleTasks.length);

            return (
              <section
                key={cell.dateString}
                onClick={() => openDay(cell.dateString)}
                className={cn(
                  "relative min-h-[100px] p-1.5 flex flex-col overflow-hidden transition-all text-left cursor-pointer group/cell",
                  !cell.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                  cell.isCurrentMonth && "bg-card hover:bg-muted/[0.06]",
                  cell.isWeekend && cell.isCurrentMonth && "bg-muted/[0.04]",
                  cell.isToday && "bg-primary/[0.04] border-primary/30",
                  isSelected && "ring-2 ring-primary/40 ring-inset z-10 shadow-xs"
                )}
                data-date={cell.dateString}
                aria-label={`${cell.dateString}: ${total} mục lịch`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openDay(cell.dateString);
                  }
                }}
              >
                {/* Row 1: Date number + attention dots */}
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={cn(
                      "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-xs font-medium tabular-nums",
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : isSelected
                          ? "ring-1.5 ring-primary text-primary font-bold"
                          : cell.isCurrentMonth
                            ? "text-foreground"
                            : "text-muted-foreground/40"
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {/* Compact attention dots: overdue (rose) / waiting (amber) */}
                  {(overdueCount > 0 || waitingCount > 0) && (
                    <div className="flex items-center gap-1">
                      {overdueCount > 0 && (
                        <span className="inline-flex items-center gap-0.5" title={`${overdueCount} quá hạn`}>
                          <span className="size-1.5 rounded-full bg-rose-500" />
                          <span className="text-xs font-semibold text-rose-600 tabular-nums">{overdueCount}</span>
                        </span>
                      )}
                      {waitingCount > 0 && (
                        <span className="inline-flex items-center gap-0.5" title={`${waitingCount} chờ duyệt`}>
                          <span className="size-1.5 rounded-full bg-amber-500" />
                          <span className="text-xs font-semibold text-amber-600 tabular-nums">{waitingCount}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Row 2: Compact item previews (max 2 items) */}
                <div className="mt-1 flex-1 space-y-0.5 overflow-hidden min-h-0">
                  {/* Event preview: icon + title */}
                  {eventPreviews.map((ev) => (
                    <div
                      key={ev.id}
                      className="flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate bg-sky-500/5 border border-sky-500/15 text-foreground"
                      title={`Sự kiện · ${ev.title}`}
                    >
                      <CalendarIcon className="size-3 shrink-0 text-sky-600" aria-hidden="true" />
                      <span className="truncate leading-tight">{ev.title}</span>
                    </div>
                  ))}

                  {/* Task previews: status icon + title */}
                  {visibleTasks.map((taskEntry) => {
                    const state = getCalendarAttentionState(
                      { id: taskEntry.id, title: taskEntry.title, status: taskEntry.status, dueDate: taskEntry.dueDate },
                      referenceDate
                    );
                    const isDone = state === "completed";
                    return (
                      <button
                        key={taskEntry.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const legacyItem = entriesByDate === null
                            ? legacyDayItems.find((d) => d.id === taskEntry.id)
                            : undefined;
                          if (legacyItem?.originalTask) {
                            onSelectTask?.(legacyItem.originalTask);
                          } else {
                            openDay(cell.dateString);
                          }
                        }}
                        className={cn(
                          "w-full text-left flex items-center gap-1 rounded px-1 py-0.5 text-xs truncate transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                          "hover:bg-accent",
                          isDone && "opacity-50 line-through"
                        )}
                        title={taskEntry.title}
                        aria-label={taskEntry.title}
                      >
                        <StatusIcon state={state} className="size-2.5" />
                        <span className="truncate leading-tight">{taskEntry.title}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Row 3: "+N việc" overflow button */}
                {extraHidden > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openDay(cell.dateString);
                    }}
                    className="mt-0.5 w-full text-left rounded px-1 py-0.5 text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors tabular-nums focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Xem thêm ${extraHidden} việc ngày ${cell.dateString}`}
                  >
                    +{extraHidden} việc
                  </button>
                )}
              </section>
            );
          })}
        </div>

        {/* Compact legend footer */}
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><CheckCircle2 className="size-3 text-emerald-700" aria-hidden="true" />Hoàn thành</span>
          <span className="inline-flex items-center gap-1"><CircleDot className="size-3 text-blue-600" aria-hidden="true" />Đang thực hiện</span>
          <span className="inline-flex items-center gap-1"><AlertTriangle className="size-3 text-rose-600" aria-hidden="true" />Quá hạn</span>
          <span className="inline-flex items-center gap-1"><CalendarIcon className="size-3 text-sky-600" aria-hidden="true" />Sự kiện</span>
        </div>
      </div>
    </div>
  );
}
