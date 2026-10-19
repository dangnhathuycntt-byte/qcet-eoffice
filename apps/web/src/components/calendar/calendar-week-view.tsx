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
  Plus,
  User,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@qcet/contracts/types/dashboard";
import { cn } from "@/lib/utils";
import { getTodayIctDate } from "@qcet/shared/lib/academic-calendar";
import {
  type CalendarAttentionState,
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "@/lib/calendar/calendar-presentation";
import { getWeekDays } from "@/lib/calendar/calendar-week";
import { type DayTaskItem } from "./calendar-day-sheet";
import { groupDayTaskItemsByDate } from "./day-task-items";
import type { CalendarScope } from "./calendar-toolbar";

import { Pressable } from "@/components/ui/pressable";
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
      return "Trễ hạn";
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
      return <AlertTriangle className={cn(common, "text-destructive")} aria-hidden="true" />;
    case "waiting":
      return <Clock3 className={cn(common, "text-warning")} aria-hidden="true" />;
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
  const referenceDate = getTodayIctDate();
  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  const weekDays = React.useMemo(() => {
    return getWeekDays(currentDate, { showWeekends, today: referenceDate, referenceDate });
  }, [currentDate, showWeekends, referenceDate]);

  // Tasks & Events mapped by date
  const { tasks: tasksByDate, events: eventsByDate } = React.useMemo(
    () =>
      groupDayTaskItemsByDate(tasks, events, {
        scope,
        currentUserId,
        currentUserName,
        query: deferredQuery,
        statusFilter,
        levelFilter,
        referenceDate,
      }),
    [tasks, events, scope, currentUserId, currentUserName, deferredQuery, statusFilter, levelFilter, referenceDate]
  );

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
              <Pressable
                key={day.date}
                onClick={() => {
                  onSelectDate(day.date);
                  onOpenDaySheet(day.date);
                }}
                className={cn(
                  "py-2.5 px-1 sm:px-2 flex flex-col items-center justify-center gap-0.5 transition-colors text-center min-h-[44px]",
                  day.isToday && "bg-muted/40 font-semibold",
                  isSelected && "bg-selected",
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
                    day.isToday && "bg-foreground/85 text-background shadow-xs",
                    !day.isToday && isSelected && "ring-1.5 ring-foreground/40 text-foreground font-semibold",
                    !day.isToday && !isSelected && "text-foreground"
                  )}
                >
                  {day.dayNumber}
                </div>
              </Pressable>
            );
          })}
        </div>
      </div>

      {/* 2. Top section: "NHIỆM VỤ ĐẾN HẠN TRONG NGÀY" (Deadlines lane) */}
      <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b-2 border-border/70 bg-muted/20">
        <div className="py-2.5 px-2 border-r border-border/50 flex flex-col items-center justify-center text-center">
          <CheckSquare className="size-3.5 text-muted-foreground mb-1" />
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
                  day.isToday && "bg-muted/20"
                )}
              >
                {/* Per-day attention count summary — click opens Day Sheet */}
                {totalCount > 0 && (
                  <Pressable
                    onClick={() => {
                      onSelectDate(day.date);
                      onOpenDaySheet(day.date);
                    }}
                    className="flex items-center gap-1 flex-wrap rounded-xs"
                    aria-label={`${totalCount} nhiệm vụ đến hạn ngày ${day.date}${overdueCount > 0 ? `, ${overdueCount} trễ hạn` : ""}`}
                  >
                    <span className="text-xs font-bold text-foreground tabular-nums">
                      {totalCount} việc
                    </span>
                    {overdueCount > 0 && (
                      <span className="text-xs font-semibold text-destructive tabular-nums">
                        {overdueCount} trễ hạn
                      </span>
                    )}
                  </Pressable>
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
                      <Pressable
                        key={task.id}
                        onClick={() => {
                          if (task.originalTask) {
                            onSelectTask?.(task.originalTask);
                          } else {
                            onSelectDate(day.date);
                            onOpenDaySheet(day.date);
                          }
                        }}
                        className={cn(
                          "w-full text-left rounded-md p-1.5 border border-border/60 bg-card hover:border-primary/40 hover:shadow-2xs transition-all flex flex-col gap-1 group",
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
                          <span className="inline-flex items-center gap-0.5 text-xs font-semibold px-1 rounded-xs bg-muted/40 text-foreground border border-border/40">
                            <CheckSquare className="size-2.5 shrink-0" />
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
                        {!compactMode && task.assigneeName && (
                          <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                            <User className="size-2.5 shrink-0" />
                            {task.assigneeName}
                          </p>
                        )}
                      </Pressable>
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
          <div className="grid grid-cols-[64px_1fr] sm:grid-cols-[72px_1fr] border-b-2 border-border/60 bg-muted/20">
            <div className="py-2 px-1 sm:px-2 border-r border-border/50 text-right pr-2 sm:pr-3 text-xs font-mono font-medium text-muted-foreground tabular-nums select-none flex items-center justify-end">
              <Clock className="size-3 mr-0.5" aria-hidden="true" />
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
                      day.isToday && "bg-muted/20"
                    )}
                  >
                    {overflowEvents.map((ev) => (
                      <Pressable
                        key={ev.id}
                        onClick={() => {
                          if (onSelectEvent) {
                            onSelectEvent(ev);
                          } else {
                            onSelectDate(day.date);
                            onOpenDaySheet(day.date);
                          }
                        }}
                        className="w-full text-left rounded-md px-1.5 py-1 border border-border/80 bg-background hover:bg-muted/50 hover:border-border transition-all shadow-2xs flex items-center gap-1"
                        aria-label={`Sự kiện: ${ev.title}${ev.time ? ` lúc ${ev.time}` : ""}`}
                      >
                        <CalendarIcon className="size-2.5 text-muted-foreground shrink-0" aria-hidden="true" />
                        <span className="text-xs font-medium text-foreground truncate">
                          {ev.time ? `${ev.time} ` : ""}{ev.title}
                        </span>
                      </Pressable>
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
                        day.isToday && "bg-muted/20"
                      )}
                    >
                      {/* Sự kiện diễn ra trong giờ này */}
                      {hourEvents.map((ev) => (
                        <Pressable
                          key={ev.id}
                          onClick={() => {
                            if (onSelectEvent) {
                              onSelectEvent(ev);
                            } else {
                              onSelectDate(day.date);
                              onOpenDaySheet(day.date);
                            }
                          }}
                          className="w-full text-left rounded-lg p-2 border border-border/80 bg-background hover:bg-muted/50 hover:border-border transition-all text-foreground shadow-2xs space-y-1 z-10"
                          aria-label={`Sự kiện: ${ev.title} lúc ${ev.time || hourLabel}`}
                        >
                          <div className="flex items-center justify-between gap-1 text-xs font-mono tabular-nums text-muted-foreground">
                            <span className="font-semibold inline-flex items-center gap-1 text-foreground">
                              <CalendarIcon className="size-2.5 text-muted-foreground" />
                              {ev.time || hourLabel}
                            </span>
                            {ev.location && (
                              <span className="truncate max-w-[90px] text-muted-foreground">
                                {ev.location}
                              </span>
                            )}
                          </div>
                          <h4 className={cn("text-xs font-semibold text-foreground leading-tight", compactMode ? "line-clamp-1" : "line-clamp-2")}>
                            {ev.title}
                          </h4>
                          {!compactMode && (ev.host || ev.assigneeName) && (
                            <p className="text-xs text-muted-foreground truncate">
                              Chủ trì: {ev.host || ev.assigneeName}
                            </p>
                          )}
                        </Pressable>
                      ))}

                      {/* Nút thêm sự kiện khi hover hoặc chạm vào ô trống */}
                      {onAddEventOnDate && (
                        <Pressable
                          onClick={() => {
                            const startLabel = formatHourLabel(hour);
                            const endLabel = formatHourLabel(Math.min(hour + 1, HOUR_END));
                            onAddEventOnDate(day.date, startLabel, endLabel);
                          }}
                          className="absolute inset-0 opacity-0 group-hover/slot:opacity-100 focus:opacity-100 bg-primary/5 hover:bg-primary/10 transition-opacity flex items-center justify-center text-primary rounded-xs min-h-[44px]"
                          aria-label={`Thêm sự kiện ngày ${day.date} lúc ${formatHourLabel(hour)}`}
                        >
                          <Plus className="size-4" />
                        </Pressable>
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
