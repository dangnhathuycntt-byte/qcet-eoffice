"use client";

import * as React from "react";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleDot,
  Clock3,
  User,
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
  getCalendarDaySummary,
  sortCalendarItemsByAttention,
  type CalendarAttentionState,
} from "@/lib/calendar/calendar-presentation";
import { type DayTaskItem } from "./calendar-day-sheet";

export type CalendarScope = "school" | "unit" | "my";

export interface CalendarMonthGridProps {
  period: AcademicMonthPeriod;
  tasks: SchoolTask[];
  events?: DayTaskItem[];
  selectedDate: string | null;
  onSelectDate: (dateStr: string) => void;
  onOpenDaySheet: (dateStr: string) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  scope?: CalendarScope;
  currentUserId?: string;
  currentUserName?: string;
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

function ItemStatus({ item, state }: { item: DayTaskItem; state: CalendarAttentionState }) {
  if (item.isEvent) {
    return (
      <>
        <CalendarIcon className="size-3 shrink-0 text-sky-600" aria-hidden="true" />
        <span>Sự kiện</span>
      </>
    );
  }
  return (
    <>
      <StatusIcon state={state} />
      <span>{getStatusLabel(state)}</span>
    </>
  );
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

export function CalendarMonthGrid({
  period,
  tasks = [],
  events = [],
  selectedDate,
  onSelectDate,
  onOpenDaySheet,
  onSelectTask,
  scope = "school",
  currentUserId,
  currentUserName,
  viewMode = "month",
  searchQuery = "",
  statusFilter = "ALL",
  levelFilter = "ALL",
  className,
}: CalendarMonthGridProps) {
  const referenceDate = getSystemReferenceDate();
  const gridCells = React.useMemo(() => generateAcademicMonthGrid(period), [period]);
  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  const tasksByDate = React.useMemo(() => {
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

  const agendaGroups = React.useMemo(() => {
    return gridCells
      .filter((cell) => cell.isCurrentMonth)
      .map((cell) => ({
        dateString: cell.dateString,
        dayHeaderVi: formatDateVi(cell.dateString),
        isToday: cell.isToday,
        items: tasksByDate.get(cell.dateString) || [],
      }))
      .filter((group) => group.items.length > 0);
  }, [gridCells, tasksByDate]);

  const openDay = React.useCallback(
    (dateString: string) => {
      onSelectDate(dateString);
      onOpenDaySheet(dateString);
    },
    [onOpenDaySheet, onSelectDate]
  );

  const renderAgendaList = (slotName: string) => (
    <div className="space-y-4" data-slot={slotName}>
      {agendaGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border/70 bg-card/60 space-y-3">
          <CalendarIcon className="size-10 text-muted-foreground/40" strokeWidth={1.5} />
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">Không có lịch công tác hoặc sự kiện</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Không có nhiệm vụ nào đến hạn trong chu kỳ vận hành {period.label} ({period.shortDateSpan}).
            </p>
          </div>
        </div>
      ) : (
        agendaGroups.map((group) => {
          const summary = getCalendarDaySummary(group.items, referenceDate);
          return (
            <section
              key={group.dateString}
              className={cn(
                "rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all",
                group.isToday && "border-primary/50 ring-1 ring-primary/20"
              )}
              aria-label={`${group.dayHeaderVi}, ${summary.total} mục lịch`}
            >
              <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/50">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-xs sm:text-sm font-bold text-foreground font-mono tabular-nums">
                      {group.dayHeaderVi}
                    </h3>
                    {group.isToday && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground uppercase">
                        Hôm nay
                      </span>
                    )}
                  </div>
                  {summary.attention > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {summary.overdue > 0 && <span className="font-semibold text-rose-700">{summary.overdue} quá hạn</span>}
                      {summary.overdue > 0 && summary.waiting > 0 && <span> · </span>}
                      {summary.waiting > 0 && <span className="font-semibold text-amber-700">{summary.waiting} chờ duyệt</span>}
                      {(summary.overdue > 0 || summary.waiting > 0) && summary.dueToday > 0 && <span> · </span>}
                      {summary.dueToday > 0 && <span>{summary.dueToday} đến hạn hôm nay</span>}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => openDay(group.dateString)}
                  className="min-h-9 shrink-0 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  Xem tất cả {summary.total} →
                </button>
              </div>

              <div className="divide-y divide-border/40">
                {group.items.map((item) => {
                  const state = getCalendarAttentionState(item, referenceDate);
                  const isDone = state === "completed";
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (item.originalTask) onSelectTask?.(item.originalTask);
                        else openDay(group.dateString);
                      }}
                      className={cn(
                        "w-full p-3.5 flex flex-col gap-2 hover:bg-muted/30 active:bg-muted/50 transition-colors text-left focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                        isDone && "opacity-65 bg-muted/10"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border bg-muted/30 text-foreground border-border/60">
                          {item.isEvent ? "Lịch" : item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                        </span>
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                          <ItemStatus item={item} state={state} />
                        </span>
                      </div>
                      <h4 className={cn("text-xs sm:text-sm font-semibold text-foreground leading-snug", isDone && "line-through text-muted-foreground")}>{item.title}</h4>
                      {(item.assigneeName || item.host) && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <User className="size-3" strokeWidth={1.5} aria-hidden="true" />
                          <span>Phụ trách: {item.assigneeName || item.host}</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );

  if (viewMode === "agenda") {
    return <div className={cn("space-y-4", className)}>{renderAgendaList("calendar-agenda-view")}</div>;
  }

  return (
    <div className={cn("flex flex-col space-y-4", className)} data-slot="calendar-month-grid">
      <div className="block sm:hidden" data-slot="mobile-responsive-agenda-feed">
        {renderAgendaList("mobile-responsive-agenda-feed")}
      </div>

      <div
        className="hidden sm:flex sm:flex-col rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden transition-all"
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
            const dayTasks = tasksByDate.get(cell.dateString) || [];
            const summary = getCalendarDaySummary(dayTasks, referenceDate);
            const displayedTasks = dayTasks.slice(0, 2);
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
                  isSelected && "ring-1.5 ring-primary ring-inset bg-primary/[0.06] z-10 shadow-xs"
                )}
                data-date={cell.dateString}
                aria-label={`${cell.dateString}: ${summary.total} mục lịch`}
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => openDay(cell.dateString)}
                    className={cn(
                      "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 font-mono text-xs font-medium tabular-nums transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : cell.isCurrentMonth
                          ? "text-foreground hover:bg-muted/60"
                          : "text-muted-foreground/40 hover:bg-muted/40",
                      isSelected && !cell.isToday && "font-bold text-primary"
                    )}
                    aria-label={`Mở lịch ngày ${cell.dateString}`}
                  >
                    {cell.dayNumber}
                  </button>

                  {summary.total > 0 && (
                    <span className="text-xs font-mono tabular-nums text-muted-foreground">
                      {summary.total} việc
                    </span>
                  )}
                </div>

                {summary.total > 0 && (
                  <div className="mt-1.5 min-h-[18px] flex items-center gap-2 overflow-hidden whitespace-nowrap text-xs leading-none">
                    {summary.overdue > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-rose-700" title={`${summary.overdue} nhiệm vụ quá hạn`}>
                        <AlertTriangle className="size-3" aria-hidden="true" />
                        {summary.overdue} quá hạn
                      </span>
                    )}
                    {summary.waiting > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-amber-700" title={`${summary.waiting} nhiệm vụ chờ duyệt`}>
                        <Clock3 className="size-3" aria-hidden="true" />
                        {summary.waiting} chờ duyệt
                      </span>
                    )}
                    {summary.overdue === 0 && summary.waiting === 0 && summary.dueToday > 0 && (
                      <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
                        <Clock3 className="size-3" aria-hidden="true" />
                        {summary.dueToday} hôm nay
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-1.5 flex-1 space-y-1 overflow-hidden min-h-0">
                  {displayedTasks.map((item) => {
                    const state = getCalendarAttentionState(item, referenceDate);
                    const isDone = state === "completed";
                    const itemLabel = item.isEvent ? "Sự kiện" : getStatusLabel(state);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          if (item.originalTask) onSelectTask?.(item.originalTask);
                          else openDay(cell.dateString);
                        }}
                        className={cn(
                          "w-full min-h-6 text-left flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium transition-colors border truncate shadow-2xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                          item.isEvent
                            ? "bg-sky-500/5 border-sky-500/20 text-foreground hover:border-sky-500/40 hover:bg-sky-500/10"
                            : item.level === "Trường"
                              ? "bg-background/90 border-border/70 text-foreground hover:border-primary/50 hover:bg-accent"
                              : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent",
                          isDone && "opacity-60 line-through bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                        )}
                        title={`${itemLabel} · ${item.title}`}
                        aria-label={`${itemLabel}: ${item.title}`}
                      >
                        {item.isEvent ? <CalendarIcon className="size-3 shrink-0 text-sky-600" aria-hidden="true" /> : <StatusIcon state={state} />}
                        <span className="truncate font-sans text-xs leading-tight">{item.title}</span>
                      </button>
                    );
                  })}
                </div>

                {summary.total > 0 && (
                  <button
                    type="button"
                    onClick={() => openDay(cell.dateString)}
                    className="mt-1 min-h-6 w-full rounded-md px-1.5 text-left text-xs font-semibold text-primary hover:bg-primary/10 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label={`Xem tất cả ${summary.total} mục lịch ngày ${cell.dateString}`}
                  >
                    Xem tất cả {summary.total} →
                  </button>
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
