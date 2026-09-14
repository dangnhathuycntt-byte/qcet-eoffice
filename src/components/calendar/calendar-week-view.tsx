"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock,
  Clock3,
  MapPin,
  Plus,
  User,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import { getSystemReferenceDate } from "@/lib/academic-calendar";
import {
  type CalendarAttentionState,
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "@/lib/calendar/calendar-presentation";
import { getWeekDays, type CalendarWeekDay } from "@/lib/calendar/calendar-week";
import { type DayTaskItem } from "./calendar-day-sheet";
import type { CalendarScope } from "./calendar-toolbar";

export interface CalendarWeekViewProps {
  currentDate: string;
  tasks: SchoolTask[];
  events?: DayTaskItem[];
  selectedDate?: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDaySheet: (dateStr: string) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onSelectEvent?: (event: DayTaskItem) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
  onAddEventOnDate?: (dateStr: string, startTime?: string, endTime?: string) => void;
  scope?: CalendarScope;
  currentUserId?: string;
  currentUserName?: string;
  showWeekends?: boolean;
  compactMode?: boolean;
  searchQuery?: string;
  statusFilter?: string;
  levelFilter?: string;
  className?: string;
}

// 07:00–18:00 display window. Events outside this range go to the all-day/overflow row.
const HOUR_START = 7;
const HOUR_END = 18;
const HOURS = Array.from({ length: HOUR_END - HOUR_START + 1 }, (_, i) => HOUR_START + i);

function formatHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

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

function parseHourFromTimeString(timeStr?: string): number | null {
  if (!timeStr) return null;
  const match = timeStr.match(/(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const hour = parseInt(match[1], 10);
  return isNaN(hour) ? null : hour;
}

/** Returns true when the event has a time that falls within the visible grid window. */
function isEventInWindow(ev: DayTaskItem): boolean {
  const h = parseHourFromTimeString(ev.time);
  return h !== null && h >= HOUR_START && h <= HOUR_END;
}

export function CalendarWeekView({
  currentDate,
  tasks = [],
  events = [],
  selectedDate,
  onSelectDate,
  onOpenDaySheet,
  onSelectTask,
  onSelectEvent,
  onAddTaskOnDate,
  onAddEventOnDate,
  scope = "school",
  currentUserId,
  currentUserName,
  showWeekends = true,
  compactMode = false,
  searchQuery = "",
  statusFilter = "ALL",
  levelFilter = "ALL",
  className,
}: CalendarWeekViewProps) {
  const referenceDate = getSystemReferenceDate();
  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  const weekDays = React.useMemo(() => {
    return getWeekDays(currentDate, { showWeekends, referenceDate });
  }, [currentDate, showWeekends, referenceDate]);

  // Tasks & Events mapped by date
  const { tasksByDate, eventsByDate } = React.useMemo(() => {
    const taskMap = new Map<string, DayTaskItem[]>();
    const eventMap = new Map<string, DayTaskItem[]>();

    const matchesStatus = (status: string, dueDate?: string) => {
      if (!statusFilter || statusFilter === "ALL") return true;
      if (statusFilter === "OVERDUE") {
        return (
          getCalendarAttentionState(
            { id: "filter", title: "filter", status, dueDate },
            referenceDate
          ) === "overdue"
        );
      }
      return status === statusFilter;
    };

    const addTaskItem = (dateKey: string, item: DayTaskItem) => {
      const list = taskMap.get(dateKey) || [];
      list.push(item);
      taskMap.set(dateKey, list);
    };

    const addEventItem = (dateKey: string, item: DayTaskItem) => {
      const list = eventMap.get(dateKey) || [];
      list.push(item);
      eventMap.set(dateKey, list);
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
          addTaskItem(st.dueDate.split("T")[0], {
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

        addTaskItem(sub.dueDate.split("T")[0], {
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
          addEventItem(event.dueDate.split("T")[0], event);
        }
      }
    }

    for (const [key, items] of taskMap) {
      taskMap.set(key, sortCalendarItemsByAttention(items, referenceDate));
    }

    return { tasksByDate: taskMap, eventsByDate: eventMap };
  }, [
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

  const numCols = weekDays.length; // 5 or 7
  const gridColClass = numCols === 5 ? "grid-cols-5" : "grid-cols-7";

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border border-border/70 bg-card shadow-card overflow-hidden transition-all",
        className
      )}
      data-slot="calendar-week-view"
      data-time-grid="true"
    >
      {/* 1. Header các ngày trong tuần */}
      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b border-border/60 bg-muted/30">
        <div className="py-3 px-2 border-r border-border/50 text-center text-xs font-semibold text-muted-foreground flex items-center justify-center">
          Giờ
        </div>
        <div className={cn("grid divide-x divide-border/40", gridColClass)}>
          {weekDays.map((day) => {
            const isSelected = selectedDate === day.date;
            return (
              <button
                key={day.date}
                type="button"
                onClick={() => {
                  onSelectDate(day.date);
                  onOpenDaySheet(day.date);
                }}
                className={cn(
                  "py-2.5 px-1 sm:px-2 flex flex-col items-center justify-center gap-0.5 transition-colors text-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]",
                  day.isToday && "bg-primary/5 font-bold",
                  isSelected && "bg-primary/10",
                  !day.isToday && !isSelected && "hover:bg-muted/40"
                )}
                aria-label={`${day.dayLabelVi} ${day.displayDate}`}
              >
                <span className="text-xs font-medium text-muted-foreground">
                  {day.dayLabelVi}
                </span>
                <div
                  className={cn(
                    "inline-flex items-center justify-center size-7 rounded-full text-xs font-mono font-bold tabular-nums",
                    day.isToday && "bg-primary text-primary-foreground shadow-xs",
                    !day.isToday && isSelected && "ring-1.5 ring-primary text-primary",
                    !day.isToday && !isSelected && "text-foreground"
                  )}
                >
                  {day.dayNumber}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Top section: "NHIỆM VỤ ĐẾN HẠN TRONG NGÀY" (Deadlines lane) */}
      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b-2 border-border/70 bg-amber-500/[0.03]">
        <div className="py-2.5 px-2 border-r border-border/50 flex flex-col items-center justify-center text-center">
          <CheckSquare className="size-3.5 text-primary mb-1" strokeWidth={1.5} />
          <span className="text-xs font-bold text-muted-foreground leading-tight">
            Hạn chót
          </span>
        </div>

        <div className={cn("grid divide-x divide-border/40 min-h-[72px]", gridColClass)}>
          {weekDays.map((day) => {
            const dayTasks = tasksByDate.get(day.date) || [];
            const overdueCount = dayTasks.filter(
              (t) => getCalendarAttentionState(t, referenceDate) === "overdue"
            ).length;
            const totalCount = dayTasks.length;
            return (
              <div
                key={`deadlines-${day.date}`}
                className={cn(
                  "p-1.5 flex flex-col gap-1.5 overflow-y-auto max-h-36 transition-colors",
                  day.isToday && "bg-primary/[0.02]"
                )}
              >
                {/* Per-day attention count summary — click opens Day Sheet */}
                {totalCount > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      onSelectDate(day.date);
                      onOpenDaySheet(day.date);
                    }}
                    className="flex items-center gap-1 flex-wrap focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded-xs"
                    aria-label={`${totalCount} nhiệm vụ đến hạn ngày ${day.date}${overdueCount > 0 ? `, ${overdueCount} quá hạn` : ""}`}
                  >
                    <span className="text-xs font-bold text-foreground tabular-nums">
                      {totalCount} việc
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs font-semibold text-rose-600 tabular-nums">
                        {overdueCount} quá hạn
                      </span>
                    )}
                  </button>
                )}
                {dayTasks.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground/40 italic select-none">
                    -
                  </div>
                ) : (
                  dayTasks.map((task) => {
                    const state = getCalendarAttentionState(task, referenceDate);
                    const isDone = state === "completed";
                    return (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => {
                          if (task.originalTask) {
                            onSelectTask?.(task.originalTask);
                          } else {
                            onSelectDate(day.date);
                            onOpenDaySheet(day.date);
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-md p-1.5 border border-border/60 bg-card hover:border-primary/40 hover:shadow-2xs transition-all flex flex-col gap-1 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                          isDone && "opacity-60 bg-muted/20"
                        )}
                        title={task.title}
                        aria-label={`Nhiệm vụ: ${task.title}`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
                            <StatusIcon state={state} className="size-2.5" />
                            <span className="truncate">{getStatusLabel(state)}</span>
                          </span>
                          <span className="text-xs font-semibold px-1 rounded-xs bg-muted/40 text-foreground border border-border/40">
                            {task.level === "Trường" ? "Trường" : "ĐV"}
                          </span>
                        </div>
                        <p
                          className={cn(
                            "text-xs font-semibold text-foreground leading-tight group-hover:text-primary transition-colors",
                            compactMode ? "line-clamp-1" : "line-clamp-2",
                            isDone && "line-through text-muted-foreground"
                          )}
                        >
                          {task.title}
                        </p>
                      </button>
                    );
                  })
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom/main section: Timed schedule (07:00 đến 18:00) cho Sự kiện / Họp */}
      <div className="flex-1 overflow-y-auto max-h-[640px]">
        {/* Outside-window events row: events with no time or time outside 07-18 */}
        {weekDays.some((day) => (eventsByDate.get(day.date) || []).some((ev) => !isEventInWindow(ev))) && (
          <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b-2 border-border/60 bg-sky-500/[0.03]">
            <div className="py-2 px-1 sm:px-2 border-r border-border/50 text-right pr-2 sm:pr-3 text-xs font-mono font-medium text-muted-foreground tabular-nums select-none flex items-center justify-end">
              <Clock className="size-3 mr-0.5" strokeWidth={1.5} aria-hidden="true" />
            </div>
            <div className={cn("grid divide-x divide-border/40", gridColClass)}>
              {weekDays.map((day) => {
                const overflowEvents = (eventsByDate.get(day.date) || []).filter(
                  (ev) => !isEventInWindow(ev)
                );
                if (overflowEvents.length === 0) {
                  return (
                    <div key={`overflow-${day.date}`} className="p-1 min-h-[32px]" />
                  );
                }
                return (
                  <div
                    key={`overflow-${day.date}`}
                    className={cn(
                      "p-1 flex flex-col gap-1",
                      day.isToday && "bg-primary/[0.015]"
                    )}
                  >
                    {overflowEvents.map((ev) => (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => {
                          if (onSelectEvent) {
                            onSelectEvent(ev);
                          } else {
                            onSelectDate(day.date);
                            onOpenDaySheet(day.date);
                          }
                        }}
                        className="w-full text-left rounded-md px-1.5 py-1 border border-sky-200 bg-sky-50 hover:bg-sky-100/80 hover:border-sky-300 transition-all shadow-2xs flex items-center gap-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500"
                        aria-label={`Sự kiện: ${ev.title}${ev.time ? ` lúc ${ev.time}` : ""}`}
                      >
                        <CalendarIcon className="size-2.5 text-sky-700 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span className="text-xs font-semibold text-sky-950 truncate">
                          {ev.time ? `${ev.time} ` : ""}{ev.title}
                        </span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {HOURS.map((hour) => {
          const hourLabel = formatHourLabel(hour);
          const slotHeightClass = compactMode ? "min-h-[48px]" : "min-h-[60px]";

          return (
            <div
              key={hour}
              className={cn(
                "grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b border-border/40 last:border-b-0",
                slotHeightClass
              )}
            >
              {/* Giờ mốc */}
              <div className="py-2 px-1 sm:px-2 border-r border-border/50 text-right pr-2 sm:pr-3 text-xs font-mono font-medium text-muted-foreground tabular-nums select-none flex items-start justify-end">
                {hourLabel}
              </div>

              {/* Các ô ngày trong giờ đó */}
              <div className={cn("grid divide-x divide-border/40 relative", gridColClass)}>
                {weekDays.map((day) => {
                  const dayEvents = eventsByDate.get(day.date) || [];
                  const hourEvents = dayEvents.filter((ev) => {
                    const evHour = parseHourFromTimeString(ev.time);
                    return evHour === hour;
                  });

                  return (
                    <div
                      key={`${day.date}-${hour}`}
                      className={cn(
                        "relative p-1 transition-colors flex flex-col gap-1 group/slot",
                        day.isToday && "bg-primary/[0.015]"
                      )}
                    >
                      {/* Sự kiện diễn ra trong giờ này */}
                      {hourEvents.map((ev) => (
                        <button
                          key={ev.id}
                          type="button"
                          onClick={() => {
                            if (onSelectEvent) {
                              onSelectEvent(ev);
                            } else {
                              onSelectDate(day.date);
                              onOpenDaySheet(day.date);
                            }
                          }}
                          className="w-full text-left rounded-lg p-2 border border-sky-200 bg-sky-50 hover:bg-sky-100/80 hover:border-sky-300 transition-all text-foreground shadow-2xs space-y-1 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-sky-500 z-10"
                          aria-label={`Sự kiện: ${ev.title} lúc ${ev.time || hourLabel}`}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-mono tabular-nums text-sky-800">
                            <span className="font-bold inline-flex items-center gap-1">
                              <CalendarIcon className="size-2.5 text-sky-700" strokeWidth={1.5} />
                              {ev.time || hourLabel}
                            </span>
                            {ev.location && (
                              <span className="truncate max-w-[90px] text-muted-foreground">
                                {ev.location}
                              </span>
                            )}
                          </div>
                          <h4 className={cn("text-xs font-bold text-sky-950 leading-tight", compactMode ? "line-clamp-1" : "line-clamp-2")}>
                            {ev.title}
                          </h4>
                          {!compactMode && (ev.host || ev.assigneeName) && (
                            <p className="text-xs text-sky-800/80 truncate">
                              Chủ trì: {ev.host || ev.assigneeName}
                            </p>
                          )}
                        </button>
                      ))}

                      {/* Nút thêm sự kiện khi hover hoặc chạm vào ô trống */}
                      {onAddEventOnDate && (
                        <button
                          type="button"
                          onClick={() => {
                            const startLabel = formatHourLabel(hour);
                            const endLabel = formatHourLabel(Math.min(hour + 1, HOUR_END));
                            onAddEventOnDate(day.date, startLabel, endLabel);
                          }}
                          className="absolute inset-0 opacity-0 group-hover/slot:opacity-100 focus:opacity-100 bg-primary/5 hover:bg-primary/10 transition-opacity flex items-center justify-center text-primary rounded-xs min-h-[44px]"
                          aria-label={`Thêm sự kiện ngày ${day.date} lúc ${formatHourLabel(hour)}`}
                        >
                          <Plus className="size-4" strokeWidth={1.5} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
