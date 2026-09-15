"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock3,
  MapPin,
  Plus,
  User,
} from "lucide-react";
import type { SchoolTask, StaffTask } from "@/types/dashboard";
import { cn } from "@/lib/utils";
import {
  type AcademicMonthPeriod,
  getSystemReferenceDate,
} from "@/lib/academic-calendar";
import {
  type CalendarAttentionState,
  getCalendarAttentionState,
  sortCalendarItemsByAttention,
} from "@/lib/calendar/calendar-presentation";
import { type DayTaskItem } from "./calendar-day-sheet";
import type { CalendarScope } from "./calendar-toolbar";

export interface CalendarAgendaViewProps {
  period?: AcademicMonthPeriod;
  tasks: SchoolTask[];
  events?: DayTaskItem[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDaySheet: (dateStr: string) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
  onAddEventOnDate?: (dateStr: string) => void;
  scope?: CalendarScope;
  currentUserId?: string;
  currentUserName?: string;
  searchQuery?: string;
  statusFilter?: string;
  levelFilter?: string;
  className?: string;
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

/** Attention badge color for task rows — prominent left placement */
function attentionBadgeClass(state: CalendarAttentionState): string {
  switch (state) {
    case "overdue":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "waiting":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "due_today":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "in_progress":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "completed":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    default:
      return "border-border/60 bg-muted/30 text-muted-foreground";
  }
}

function formatDateVi(dateStr: string): string {
  try {
    const clean = dateStr.split("T")[0];
    const [year, month, day] = clean.split("-");
    const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
    const dayNames = [
      "Chủ Nhật",
      "Thứ Hai",
      "Thứ Ba",
      "Thứ Tư",
      "Thứ Năm",
      "Thứ Sáu",
      "Thứ Bảy",
    ];
    const dayName = dayNames[dateObj.getDay()] || "";
    return `${dayName}, ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/** Render a single task row — attention state is the primary visual signal */
function TaskRow({
  item,
  state,
  onActivate,
}: {
  item: DayTaskItem;
  state: CalendarAttentionState;
  onActivate: () => void;
}) {
  const isDone = state === "completed";
  return (
    <div
      onClick={onActivate}
      className={cn(
        "w-full min-h-[44px] sm:min-h-[52px] px-4 py-2 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset",
        isDone && "opacity-55 bg-muted/10"
      )}
      role="button"
      tabIndex={0}
      aria-label={`${item.title}, ${getStatusLabel(state)}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {/* Attention badge — leftmost, prominent for tasks */}
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-semibold shrink-0",
          attentionBadgeClass(state)
        )}
        aria-hidden="true"
      >
        <StatusIcon state={state} />
        <span className="hidden sm:inline">{getStatusLabel(state)}</span>
      </span>

      {/* Task type badge */}
      <span className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium border border-border/50 bg-muted/20 text-foreground shrink-0" aria-hidden="true">
        <CheckSquare className="size-3 text-primary" strokeWidth={1.5} />
        <span className="hidden sm:inline">{item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}</span>
      </span>

      {/* Title + sub-context */}
      <div className="min-w-0 flex-1">
        <h4
          className={cn(
            "text-xs sm:text-sm font-semibold text-foreground truncate leading-snug",
            isDone && "line-through text-muted-foreground"
          )}
        >
          {item.title}
        </h4>
        {item.parentSchoolTaskTitle && (
          <p className="text-xs text-muted-foreground truncate" aria-hidden="true">
            Thuộc: {item.parentSchoolTaskTitle}
          </p>
        )}
      </div>

      {/* Assignee + due date — trailing, de-emphasised */}
      <div className="flex items-center gap-3 shrink-0">
        {item.assigneeName && (
          <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1 max-w-[120px] truncate">
            <User className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
            <span className="truncate">{item.assigneeName}</span>
          </span>
        )}
        {item.dueDate && (
          <span className="text-xs font-mono tabular-nums text-muted-foreground hidden sm:inline">
            {item.dueDate.split("T")[0]}
          </span>
        )}
      </div>
    </div>
  );
}

/** Render a single event row — real time is the primary visual signal */
function EventRow({
  item,
  onActivate,
}: {
  item: DayTaskItem;
  onActivate: () => void;
}) {
  return (
    <div
      onClick={onActivate}
      className="w-full min-h-[44px] sm:min-h-[52px] px-4 py-2 flex items-center gap-3 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset"
      role="button"
      tabIndex={0}
      aria-label={`Sự kiện: ${item.title}${item.time ? ` lúc ${item.time}` : ""}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      {/* Time — leftmost prominent signal for events (no badge, clean tabular) */}
      <span
        className="inline-flex items-center gap-1 text-xs font-mono tabular-nums font-semibold text-sky-700 shrink-0 min-w-[48px]"
        aria-label={item.time ? `lúc ${item.time}` : "Cả ngày"}
      >
        <Clock3 className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
        {item.time ?? "Cả ngày"}
      </span>

      {/* Event type tag */}
      <span className="inline-flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 text-sky-700 px-1.5 py-0.5 text-xs font-semibold shrink-0" aria-hidden="true">
        <CalendarIcon className="size-3" strokeWidth={1.5} />
        <span className="hidden sm:inline">Sự kiện</span>
      </span>

      {/* Title */}
      <div className="min-w-0 flex-1">
        <h4 className="text-xs sm:text-sm font-semibold text-foreground truncate leading-snug">
          {item.title}
        </h4>
        {item.location && (
          <p className="text-xs text-muted-foreground truncate" aria-hidden="true">
            <MapPin className="size-3 inline mr-0.5" strokeWidth={1.5} />
            {item.location}
          </p>
        )}
      </div>

      {/* Host — trailing */}
      {(item.host || item.assigneeName) && (
        <span className="text-xs text-muted-foreground hidden md:inline-flex items-center gap-1 max-w-[120px] truncate">
          <User className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
          <span className="truncate">{item.host ?? item.assigneeName}</span>
        </span>
      )}
    </div>
  );
}

export function CalendarAgendaView({
  period,
  tasks = [],
  events = [],
  selectedDate,
  onSelectDate,
  onOpenDaySheet,
  onSelectTask,
  onAddTaskOnDate,
  onAddEventOnDate,
  scope = "school",
  currentUserId,
  currentUserName,
  searchQuery = "",
  statusFilter = "ALL",
  levelFilter = "ALL",
  className,
}: CalendarAgendaViewProps) {
  const referenceDate = getSystemReferenceDate();
  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  // Per-day expanded-completed state: key = dateStr, value = boolean
  const [expandedCompleted, setExpandedCompleted] = React.useState<Record<string, boolean>>({});

  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, DayTaskItem[]>();

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

    // Attention-first sort within each day
    for (const [dateKey, items] of map) {
      map.set(dateKey, sortCalendarItemsByAttention(items, referenceDate));
    }

    return map;
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

  const sortedDates = React.useMemo(() => {
    const dates = Array.from(tasksByDate.keys()).sort();
    if (period) {
      return dates.filter(
        (d) => d >= period.startDate && d <= period.endDate
      );
    }
    return dates;
  }, [tasksByDate, period]);

  const openDay = React.useCallback(
    (dateString: string) => {
      onSelectDate(dateString);
      onOpenDaySheet(dateString);
    },
    [onOpenDaySheet, onSelectDate]
  );

  const isFilterActive = Boolean(
    searchQuery.trim() ||
    (statusFilter && statusFilter !== "ALL") ||
    (levelFilter && levelFilter !== "ALL")
  );

  // Tự động cuộn đến ngày hôm nay khi không có filter active
  React.useEffect(() => {
    if (!isFilterActive) {
      const todayEl = document.getElementById("agenda-today");
      if (todayEl) {
        // Cho một chút delay để layout ổn định sau initial render
        const timer = setTimeout(() => {
          todayEl.scrollIntoView({ behavior: "smooth", block: "start" });
        }, 100);
        return () => clearTimeout(timer);
      }
    }
  }, [isFilterActive]);

  return (
    <div className={cn("space-y-0", className)} data-slot="calendar-agenda-view">
      {sortedDates.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border/70 bg-card/60 space-y-3"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          <CalendarIcon className="size-10 text-muted-foreground/40" strokeWidth={1.5} aria-hidden="true" />
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">
              {isFilterActive ? "Không tìm thấy kết quả phù hợp" : "Không có lịch công tác hoặc sự kiện"}
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isFilterActive
                ? "Không có nhiệm vụ hoặc sự kiện nào khớp với tiêu chí tìm kiếm/lọc hiện tại."
                : period
                  ? `Không có nhiệm vụ nào trong chu kỳ vận hành ${period.label} (${period.shortDateSpan}).`
                  : "Không có lịch công tác hoặc sự kiện nào trong chu kỳ này."}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs divide-y divide-border/60">
          {sortedDates.map((dateString) => {
            const allItems = tasksByDate.get(dateString) || [];
            const isToday = dateString === referenceDate;
            const isSelected = selectedDate === dateString;
            const dayHeaderVi = formatDateVi(dateString);

            const activeItems = allItems.filter(
              (item) => getCalendarAttentionState(item, referenceDate) !== "completed"
            );
            const completedItems = allItems.filter(
              (item) => getCalendarAttentionState(item, referenceDate) === "completed"
            );
            const isCompletedExpanded = expandedCompleted[dateString] ?? false;

            const activeCount = activeItems.length;
            const completedCount = completedItems.length;
            const totalCount = allItems.length;

            return (
              <section
                key={dateString}
                id={isToday ? "agenda-today" : undefined}
                data-today={isToday ? "true" : undefined}
                className={cn(
                  "transition-all",
                  isToday && "ring-1 ring-inset ring-primary/20",
                  isSelected && "ring-2 ring-inset ring-primary/40"
                )}
                aria-label={`${dayHeaderVi}, ${activeCount} việc đang chờ${completedCount > 0 ? `, ${completedCount} đã hoàn thành` : ""}`}
              >
                {/* Sticky date header */}
                <div
                  className={cn(
                    "sticky top-0 z-10 flex items-center justify-between gap-3 px-4 py-2.5 border-b border-border/50 bg-muted/50 backdrop-blur-sm",
                    isToday && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-foreground">
                      {dayHeaderVi}
                    </h3>
                    {isToday && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground uppercase">
                        Hôm nay
                      </span>
                    )}
                    {/* Per-day count in tabular-nums */}
                    <span className="text-xs font-mono tabular-nums font-medium text-muted-foreground">
                      {activeCount > 0 && (
                        <>{activeCount} việc</>
                      )}
                      {activeCount > 0 && completedCount > 0 && " · "}
                      {completedCount > 0 && (
                        <span className="text-emerald-600">{completedCount} xong</span>
                      )}
                      {totalCount === 0 && "0 mục"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {onAddTaskOnDate && (
                      <button
                        type="button"
                        onClick={() => onAddTaskOnDate(dateString)}
                        className="inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Thêm việc ngày ${dayHeaderVi}`}
                      >
                        <Plus className="size-3" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Việc</span>
                      </button>
                    )}
                    {onAddEventOnDate && (
                      <button
                        type="button"
                        onClick={() => onAddEventOnDate(dateString)}
                        className="inline-flex min-h-[44px] sm:min-h-8 sm:h-8 items-center gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                        aria-label={`Thêm sự kiện ngày ${dayHeaderVi}`}
                      >
                        <Plus className="size-3" strokeWidth={1.5} />
                        <span className="hidden sm:inline">Sự kiện</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openDay(dateString)}
                      className="min-h-[44px] sm:min-h-8 sm:h-8 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary inline-flex items-center"
                      aria-label={`Xem chi tiết ngày ${dayHeaderVi}`}
                    >
                      Xem chi tiết →
                    </button>
                  </div>
                </div>

                {/* Active items list */}
                {activeItems.length > 0 && (
                  <div className="divide-y divide-border/30" role="list" aria-label="Việc đang chờ và sự kiện">
                    {activeItems.map((item) => {
                      const state = getCalendarAttentionState(item, referenceDate);
                      return (
                        <div key={item.id} role="listitem">
                          {item.isEvent ? (
                            <EventRow
                              item={item}
                              onActivate={() =>
                                item.originalTask
                                  ? onSelectTask?.(item.originalTask)
                                  : openDay(dateString)
                              }
                            />
                          ) : (
                            <TaskRow
                              item={item}
                              state={state}
                              onActivate={() =>
                                item.originalTask
                                  ? onSelectTask?.(item.originalTask)
                                  : openDay(dateString)
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Completed items — collapsed by default, expand on demand */}
                {completedItems.length > 0 && (
                  <div className="border-t border-border/30">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedCompleted((prev) => ({
                          ...prev,
                          [dateString]: !prev[dateString],
                        }))
                      }
                      className="w-full min-h-[44px] flex items-center gap-2 px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                      aria-expanded={isCompletedExpanded}
                      aria-controls={`completed-${dateString}`}
                    >
                      <ChevronDown
                        className={cn(
                          "size-3 shrink-0 transition-transform duration-150",
                          isCompletedExpanded && "rotate-180"
                        )}
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                      <span className="font-mono tabular-nums">
                        {completedCount} việc đã hoàn thành
                      </span>
                    </button>

                    {isCompletedExpanded && (
                      <div
                        id={`completed-${dateString}`}
                        className="divide-y divide-border/20"
                        role="list"
                        aria-label="Việc đã hoàn thành"
                      >
                        {completedItems.map((item) => (
                          <div key={item.id} role="listitem" className="opacity-55">
                            {item.isEvent ? (
                              <EventRow
                                item={item}
                                onActivate={() =>
                                  item.originalTask
                                    ? onSelectTask?.(item.originalTask)
                                    : openDay(dateString)
                                }
                              />
                            ) : (
                              <TaskRow
                                item={item}
                                state="completed"
                                onActivate={() =>
                                  item.originalTask
                                    ? onSelectTask?.(item.originalTask)
                                    : openDay(dateString)
                                }
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
