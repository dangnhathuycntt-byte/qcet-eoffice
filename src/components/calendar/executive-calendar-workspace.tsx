"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Clock,
  Plus,
  MapPin,
  Users,
  AlertTriangle,
  LayoutGrid,
  List,
  Filter,
  Layers,
  Sparkles,
  Building2,
  CheckCircle2,
  X,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask } from "@/types/dashboard";

export interface CalendarTimeEvent {
  id: string;
  title: string;
  startTime: string; // "HH:MM" e.g. "08:00"
  endTime: string;   // "HH:MM" e.g. "09:30"
  date: string;      // "YYYY-MM-DD" e.g. "2026-09-14"
  type?: "meeting" | "deliverable" | "academic" | "urgent" | "internal" | string;
  description?: string;
  location?: string;
  attendees?: string[];
  department?: string;
  status?: "upcoming" | "in_progress" | "completed" | "cancelled";
  isAllDay?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
}

export interface EventLayout {
  topPercent: number;
  heightPercent: number;
  widthPercent: number;
  leftPercent: number;
  hasCollision: boolean;
}

export interface WeekDayInfo {
  date: Date;
  dateString: string; // "YYYY-MM-DD"
  dayOfWeek: number;   // 1 (Monday) to 7 (Sunday)
  dayOfWeekLabel: string; // "T2", "T3", "T4", "T5", "T6", "T7", "CN"
  fullDayLabel: string; // "Thứ Hai", "Thứ Ba", ...
  dayOfMonth: number;
  month: number;
  isToday: boolean;
}

export interface ExecutiveCalendarWorkspaceProps {
  events?: CalendarTimeEvent[];
  tasks?: SchoolTask[];
  initialDate?: string | Date;
  initialViewMode?: "week_grid" | "agenda_list";
  onSelectEvent?: (event: CalendarTimeEvent) => void;
  onAddTask?: (date?: string) => void;
  className?: string;
  isExecutive?: boolean;
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.split(":");
  const hours = parseInt(parts[0], 10) || 0;
  const minutes = parseInt(parts[1], 10) || 0;
  return hours * 60 + minutes;
}

export function calculateEventLayout(
  event: CalendarTimeEvent,
  startHour: number = 7,
  endHour: number = 18,
  collidingEvents?: CalendarTimeEvent[]
): EventLayout {
  const dayStartMins = startHour * 60;
  const dayEndMins = endHour * 60;
  const totalDayMins = dayEndMins - dayStartMins;

  const eventStartMins = parseTimeToMinutes(event.startTime);
  const eventEndMins = parseTimeToMinutes(event.endTime);

  const topPercent = Math.max(0, ((eventStartMins - dayStartMins) / totalDayMins) * 100);
  const heightPercent = Math.max(0, ((eventEndMins - eventStartMins) / totalDayMins) * 100);

  // Deduplicate events by id
  const candidateEvents = collidingEvents ? [event, ...collidingEvents] : [event];
  const uniqueMap = new Map<string, CalendarTimeEvent>();
  for (const ev of candidateEvents) {
    uniqueMap.set(ev.id, ev);
  }
  const allEvents = Array.from(uniqueMap.values());

  const overlapping = allEvents.filter((other) => {
    if (other.id === event.id) return true;
    const otherStart = parseTimeToMinutes(other.startTime);
    const otherEnd = parseTimeToMinutes(other.endTime);
    return eventStartMins < otherEnd && eventEndMins > otherStart;
  });

  const hasCollision = overlapping.length > 1;
  const totalInGroup = overlapping.length;

  overlapping.sort((a, b) => {
    const diff = parseTimeToMinutes(a.startTime) - parseTimeToMinutes(b.startTime);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id);
  });

  const indexInGroup = overlapping.findIndex((e) => e.id === event.id);

  const widthPercent = hasCollision ? 100 / totalInGroup : 100;
  const leftPercent = hasCollision ? (Math.max(0, indexInGroup) * 100) / totalInGroup : 0;

  return {
    topPercent,
    heightPercent,
    widthPercent,
    leftPercent,
    hasCollision,
  };
}

export function getSemanticEventStyle(type?: string): string {
  switch (type) {
    case "meeting":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "deliverable":
      return "bg-violet-500/10 text-violet-700 border-violet-500/20";
    case "academic":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "urgent":
      return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    case "internal":
      return "bg-zinc-500/10 text-zinc-700 border-zinc-500/20";
    default:
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
  }
}

export function getWeekDays(baseDate: Date | string): WeekDayInfo[] {
  const d = typeof baseDate === "string" ? new Date(baseDate) : new Date(baseDate.getTime());
  const day = d.getDay();
  // Monday is start of week: day 0 (Sun) -> -6, day 1 (Mon) -> 0, day 2 -> -1, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const shortLabels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
  const fullLabels = [
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
    "Chủ Nhật",
  ];

  const result: WeekDayInfo[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateString = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    result.push({
      date: cur,
      dateString,
      dayOfWeek: i + 1,
      dayOfWeekLabel: shortLabels[i],
      fullDayLabel: fullLabels[i],
      dayOfMonth: cur.getDate(),
      month: cur.getMonth() + 1,
      isToday: dateString === todayStr,
    });
  }

  return result;
}

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function formatWeekSpan(days: WeekDayInfo[]): string {
  if (!days || days.length === 0) return "";
  const first = days[0];
  const last = days[days.length - 1];
  const weekNum = getWeekNumber(first.date);
  return `Tuần ${weekNum} (${pad(first.dayOfMonth)}/${pad(first.month)} - ${pad(last.dayOfMonth)}/${pad(last.month)}/${last.date.getFullYear()})`;
}

const DEFAULT_SAMPLE_EVENTS: CalendarTimeEvent[] = [
  {
    id: "sample-evt-1",
    title: "Họp Giao ban Ban Giám hiệu (Định kỳ Thứ Hai)",
    startTime: "08:00",
    endTime: "09:30",
    date: "2026-09-14",
    type: "meeting",
    location: "Phòng họp A1 - Khu Hiệu bộ",
    attendees: ["Ban Giám hiệu", "Trưởng các Phòng/Khoa"],
    priority: "high",
  },
  {
    id: "sample-evt-2",
    title: "Tiếp đoàn chuyên gia ĐBCL & Kiểm định Quốc tế",
    startTime: "09:30",
    endTime: "11:30",
    date: "2026-09-15",
    type: "meeting",
    location: "Hội trường Hội thảo tầng 3",
    attendees: ["Ban Giám hiệu", "Phòng ĐBCL", "Khoa CNTT"],
    priority: "urgent",
  },
  {
    id: "sample-evt-3",
    title: "Họp Thẩm định Đề cương & Ma trận DACUM Khoa CNTT",
    startTime: "14:00",
    endTime: "16:00",
    date: "2026-09-16",
    type: "deliverable",
    location: "Phòng họp chuyên môn B2",
    attendees: ["Hội đồng Khoa học", "Giảng viên bộ môn"],
    priority: "high",
  },
  {
    id: "sample-evt-4",
    title: "Lễ Khai mạc Tuần sinh hoạt công dân sinh viên khóa mới",
    startTime: "08:00",
    endTime: "10:30",
    date: "2026-09-17",
    type: "academic",
    location: "Hội trường Lớn C1",
    attendees: ["Ban Giám hiệu", "Phòng Đào tạo & CTSV"],
    priority: "medium",
  },
  {
    id: "sample-evt-5",
    title: "Hạn chót phê duyệt Kế hoạch Ngân sách quý IV",
    startTime: "16:30",
    endTime: "17:30",
    date: "2026-09-18",
    type: "urgent",
    location: "Phòng Kế hoạch - Tài chính",
    priority: "urgent",
  },
  {
    id: "sample-evt-6",
    title: "Sinh hoạt chuyên môn & Đánh giá nội bộ Khoa Cơ điện",
    startTime: "08:30",
    endTime: "10:30",
    date: "2026-09-19",
    type: "internal",
    location: "Xưởng thực hành E3",
    priority: "low",
  },
  {
    id: "sample-evt-all-day-1",
    title: "Hạn nghiệm thu sản phẩm DACUM Học kỳ I (2026 - 2027)",
    startTime: "07:00",
    endTime: "18:00",
    date: "2026-09-18",
    isAllDay: true,
    type: "deliverable",
    description: "Nghiệm thu toàn bộ tài liệu ma trận kỹ năng nghề DACUM",
    priority: "urgent",
  },
];

const FILTER_OPTIONS = [
  { id: "all", label: "Tất cả sự kiện" },
  { id: "meeting", label: "Lịch họp BGH" },
  { id: "deliverable", label: "Hạn nộp Đề án" },
  { id: "academic", label: "Sự kiện Học thuật" },
  { id: "urgent", label: "Việc Khẩn" },
] as const;

export function ExecutiveCalendarWorkspace({
  events: propEvents,
  tasks,
  initialDate,
  initialViewMode = "week_grid",
  onSelectEvent,
  onAddTask,
  className,
  isExecutive = true,
}: ExecutiveCalendarWorkspaceProps) {
  const [currentDate, setCurrentDate] = React.useState<Date>(() => {
    if (initialDate instanceof Date) return initialDate;
    if (typeof initialDate === "string") return new Date(initialDate);
    // Default to current date or standard test date
    return new Date("2026-09-14T08:00:00");
  });

  const [viewMode, setViewMode] = React.useState<"week_grid" | "agenda_list">(initialViewMode);
  const [selectedFilter, setSelectedFilter] = React.useState<string>("all");
  const [selectedPreviewEvent, setSelectedPreviewEvent] = React.useState<CalendarTimeEvent | null>(null);

  // Calculate the 7 days of the active week
  const weekDays = React.useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekSpanText = React.useMemo(() => formatWeekSpan(weekDays), [weekDays]);

  // Merge tasks with events if provided
  const combinedEvents = React.useMemo<CalendarTimeEvent[]>(() => {
    let list: CalendarTimeEvent[] = propEvents && propEvents.length > 0 ? propEvents : DEFAULT_SAMPLE_EVENTS;

    if (tasks && tasks.length > 0) {
      const taskEvents: CalendarTimeEvent[] = tasks
        .filter((t) => !!t.dueDate)
        .map((t) => {
          const dateStr = t.dueDate ? t.dueDate.split("T")[0] : "";
          const isDacum = Boolean(t.dacumTaskDefId || t.dacumTaskDef || t.category === "BAO_CAO");
          return {
            id: `task-evt-${t.id}`,
            title: t.title,
            startTime: "08:00",
            endTime: "09:30",
            date: dateStr,
            type: isDacum ? "deliverable" : "internal",
            description: t.executiveCriteria || t.dacumTaskDef?.dutyTitle || t.categoryLabel,
            department: t.leadDepartment || t.department,
            status: t.status === "COMPLETED" ? "completed" : "in_progress",
            priority: t.status === "PENDING_EXECUTIVE_APPROVAL" ? "urgent" : "medium",
            isAllDay: true,
          };
        });
      list = [...list, ...taskEvents];
    }

    return list;
  }, [propEvents, tasks]);

  // Filter events based on active category
  const filteredEvents = React.useMemo(() => {
    if (selectedFilter === "all") return combinedEvents;
    return combinedEvents.filter((e) => e.type === selectedFilter);
  }, [combinedEvents, selectedFilter]);

  // Current time position indicator (07:00 - 18:00 = 660 mins)
  const currentTimeIndicator = React.useMemo(() => {
    const now = new Date();
    const curHour = now.getHours();
    const curMin = now.getMinutes();
    const totalMin = curHour * 60 + curMin;
    const startMin = 7 * 60;
    const endMin = 18 * 60;
    if (totalMin < startMin || totalMin > endMin) return null;
    return ((totalMin - startMin) / (endMin - startMin)) * 100;
  }, []);

  // Navigation handlers
  const handlePrevWeek = React.useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  }, []);

  const handleNextWeek = React.useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  }, []);

  const handleToday = React.useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const handleEventClick = React.useCallback(
    (ev: CalendarTimeEvent) => {
      setSelectedPreviewEvent(ev);
      onSelectEvent?.(ev);
    },
    [onSelectEvent]
  );

  // Split events for each day
  const dayEventsMap = React.useMemo(() => {
    const map = new Map<string, { timed: CalendarTimeEvent[]; allDay: CalendarTimeEvent[] }>();
    for (const d of weekDays) {
      map.set(d.dateString, { timed: [], allDay: [] });
    }
    for (const ev of filteredEvents) {
      const entry = map.get(ev.date);
      if (entry) {
        if (ev.isAllDay) {
          entry.allDay.push(ev);
        } else {
          entry.timed.push(ev);
        }
      }
    }
    return map;
  }, [weekDays, filteredEvents]);

  // Check if any day has all-day milestones
  const hasAllDayMilestones = React.useMemo(() => {
    for (const { allDay } of dayEventsMap.values()) {
      if (allDay.length > 0) return true;
    }
    return false;
  }, [dayEventsMap]);

  // Hours array from 07:00 to 18:00 (12 markers, 11 hour slots)
  const hours = React.useMemo(() => Array.from({ length: 12 }, (_, i) => 7 + i), []);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border/80 bg-background p-4 shadow-xs",
        className
      )}
      data-slot="executive-calendar-workspace"
    >
      {/* 1. Top Navigation & Toolbar Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border-b border-border/60 pb-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrevWeek}
              className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
              title="Tuần trước"
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToday}
              className="h-8 px-2.5 text-xs font-semibold rounded-lg hover:bg-muted"
            >
              Hôm nay
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleNextWeek}
              className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
              title="Tuần sau"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary shrink-0" strokeWidth={1.5} />
            <h2 className="font-heading text-base sm:text-lg font-bold text-foreground font-mono tabular-nums tracking-tight">
              {weekSpanText}
            </h2>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Toggle */}
          <div className="flex items-center rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setViewMode("week_grid")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                viewMode === "week_grid"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="size-3.5" strokeWidth={1.5} />
              <span>Lưới tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda_list")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                viewMode === "agenda_list"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <List className="size-3.5" strokeWidth={1.5} />
              <span>Nghị sự điều hành</span>
            </button>
          </div>

          {/* Quick Add Event */}
          {isExecutive && (
            <Button
              size="sm"
              onClick={() => onAddTask?.()}
              className="gap-1.5 text-xs font-semibold rounded-xl h-8.5"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Thêm sự kiện</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Semantic Category Filter Bar */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        <Filter className="size-3.5 text-muted-foreground shrink-0 ml-0.5 mr-1" strokeWidth={1.5} />
        {FILTER_OPTIONS.map((f) => {
          const isActive = selectedFilter === f.id;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setSelectedFilter(f.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border",
                isActive
                  ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                  : "border-border/60 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {/* 3. Main Workspace Body */}
      {viewMode === "week_grid" ? (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="min-w-[760px]">
            {/* Header: Day Labels */}
            <div className="flex border-b border-border/70 bg-muted/20">
              {/* Time gutter spacer 56px */}
              <div className="w-14 shrink-0 border-r border-border/60 p-2 text-right font-mono text-xs text-muted-foreground font-semibold">
                GMT+7
              </div>
              {/* 7 Columns for Days */}
              <div className="grid grid-cols-7 divide-x divide-border/60 flex-1">
                {weekDays.map((d) => (
                  <div
                    key={d.dateString}
                    className={cn(
                      "p-2 text-center transition-colors",
                      d.isToday && "bg-primary/5 font-semibold"
                    )}
                  >
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      {d.dayOfWeekLabel}
                    </div>
                    <div className="flex items-center justify-center gap-1 mt-0.5">
                      <span className="font-mono text-xs tabular-nums font-bold text-foreground">
                        {pad(d.dayOfMonth)}/{pad(d.month)}
                      </span>
                      {d.isToday && (
                        <span className="inline-block px-1.5 py-0.2 rounded text-xs font-semibold bg-primary text-primary-foreground font-mono">
                          Hôm nay
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* All-Day Milestones Bar */}
            {hasAllDayMilestones && (
              <div className="flex border-b border-border/60 bg-muted/10">
                <div className="w-14 shrink-0 border-r border-border/60 p-2 text-right font-mono text-xs text-muted-foreground font-medium flex items-center justify-end">
                  Mốc ngày
                </div>
                <div className="grid grid-cols-7 divide-x divide-border/60 flex-1 p-1">
                  {weekDays.map((d) => {
                    const allDayItems = dayEventsMap.get(d.dateString)?.allDay || [];
                    return (
                      <div key={d.dateString} className="px-1 min-h-[32px] space-y-1">
                        {allDayItems.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => handleEventClick(item)}
                            className={cn(
                              "px-1.5 py-0.5 rounded border text-xs font-medium truncate cursor-pointer transition-all hover:opacity-90 shadow-2xs",
                              getSemanticEventStyle(item.type)
                            )}
                            title={`${item.title} (${item.description || "Hạn chót"})`}
                          >
                            <Pin className="size-3 inline-block mr-1 shrink-0" strokeWidth={1.5} />
                            <span className="truncate">{item.title}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Time-Grid: Left Gutter 56px + 7 Columns */}
            <div className="flex relative">
              {/* Time Gutter 56px */}
              <div className="w-14 shrink-0 border-r border-border/60 select-none py-2">
                {hours.map((h) => (
                  <div
                    key={h}
                    className="h-16 text-right pr-2 font-mono text-xs tabular-nums text-muted-foreground -mt-2"
                  >
                    {pad(h)}:00
                  </div>
                ))}
              </div>

              {/* 7 Columns with Events and Hour Lines */}
              <div className="grid grid-cols-7 divide-x divide-border/60 flex-1 relative">
                {weekDays.map((d) => {
                  const dayEvents = dayEventsMap.get(d.dateString)?.timed || [];
                  return (
                    <div
                      key={d.dateString}
                      className={cn(
                        "relative h-[704px] border-b border-border/60",
                        d.isToday && "bg-primary/[0.02]"
                      )}
                    >
                      {/* Horizontal Hour Dividing Lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="h-16 border-t border-border/40 pointer-events-none"
                        />
                      ))}

                      {/* Current Time Indicator on Today's Column */}
                      {d.isToday && currentTimeIndicator !== null && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                          style={{ top: `${currentTimeIndicator}%` }}
                        >
                          <div className="size-2 -ml-1 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                          <div className="h-[2px] w-full bg-rose-500" />
                        </div>
                      )}

                      {/* Event Cards inside column */}
                      {dayEvents.map((ev) => {
                        const layout = calculateEventLayout(ev, 7, 18, dayEvents);
                        const styleClasses = getSemanticEventStyle(ev.type);

                        return (
                          <div
                            key={ev.id}
                            onClick={() => handleEventClick(ev)}
                            className={cn(
                              "absolute rounded-md border p-1.5 overflow-hidden cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:z-10 select-none",
                              styleClasses,
                              layout.hasCollision && "ring-1 ring-amber-500/50"
                            )}
                            style={{
                              top: `${layout.topPercent}%`,
                              height: `${Math.max(layout.heightPercent, 3.5)}%`,
                              left: `${layout.leftPercent}%`,
                              width: `${layout.widthPercent}%`,
                            }}
                          >
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <span className="font-mono text-xs tabular-nums font-semibold truncate">
                                {ev.startTime} - {ev.endTime}
                              </span>
                              {layout.hasCollision && (
                                <span
                                  className="shrink-0 size-1.5 rounded-full bg-amber-500"
                                  title="Trùng khung giờ"
                                />
                              )}
                            </div>
                            <div className="text-xs font-semibold leading-tight line-clamp-2">
                              {ev.title}
                            </div>
                            {ev.location && (
                              <div className="flex items-center gap-1 mt-1 text-xs opacity-80 truncate">
                                <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
                                <span className="truncate">{ev.location}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 4. Executive Agenda List View */
        <div className="space-y-4">
          {weekDays.map((d) => {
            const dayEvents = filteredEvents.filter((e) => e.date === d.dateString);
            return (
              <div
                key={d.dateString}
                className={cn(
                  "rounded-xl border border-border/70 bg-card p-4 transition-all shadow-2xs",
                  d.isToday && "border-primary/40 bg-primary/[0.02]"
                )}
              >
                <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-primary uppercase font-mono px-2 py-0.5 rounded bg-primary/10">
                      {d.fullDayLabel}
                    </span>
                    <span className="font-mono text-xs tabular-nums text-muted-foreground font-semibold">
                      {pad(d.dayOfMonth)}/{pad(d.month)}/{d.date.getFullYear()}
                    </span>
                    {d.isToday && (
                      <Badge variant="sapphire" className="text-xs">
                        Hôm nay
                      </Badge>
                    )}
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {dayEvents.length} sự kiện / lịch họp
                  </span>
                </div>

                {dayEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    Không có sự kiện hoặc lịch họp trong ngày
                  </p>
                ) : (
                  <div className="divide-y divide-border/40">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => handleEventClick(ev)}
                        className="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-muted/30 px-2 rounded-lg cursor-pointer transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          <div className="shrink-0 w-28 font-mono text-xs tabular-nums font-semibold text-foreground px-2 py-1 rounded bg-muted/60 text-center">
                            {ev.isAllDay ? "Cả ngày" : `${ev.startTime} - ${ev.endTime}`}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-bold text-foreground">
                                {ev.title}
                              </span>
                              <span
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium border",
                                  getSemanticEventStyle(ev.type)
                                )}
                              >
                                {ev.type === "meeting"
                                  ? "Lịch họp BGH"
                                  : ev.type === "deliverable"
                                  ? "Hạn Đề án"
                                  : ev.type === "academic"
                                  ? "Học thuật"
                                  : ev.type === "urgent"
                                  ? "Việc Khẩn"
                                  : "Nội bộ"}
                              </span>
                            </div>

                            {ev.location && (
                              <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                                <MapPin className="size-3 shrink-0" strokeWidth={1.5} />
                                <span>{ev.location}</span>
                              </div>
                            )}
                            {ev.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {ev.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {ev.attendees && ev.attendees.length > 0 && (
                            <span className="text-xs text-muted-foreground font-mono hidden md:inline">
                              {ev.attendees.length} thành phần
                            </span>
                          )}
                          <Button variant="outline" size="sm" className="h-7 text-xs rounded-lg">
                            Chi tiết
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 5. Event Preview Drawer / Modal */}
      {selectedPreviewEvent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span
                  className={cn(
                    "px-2 py-0.5 rounded text-xs font-semibold border inline-block mb-1.5",
                    getSemanticEventStyle(selectedPreviewEvent.type)
                  )}
                >
                  {selectedPreviewEvent.type === "meeting"
                    ? "Lịch họp BGH"
                    : selectedPreviewEvent.type === "deliverable"
                    ? "Hạn nộp Đề án"
                    : selectedPreviewEvent.type === "academic"
                    ? "Sự kiện Học thuật"
                    : selectedPreviewEvent.type === "urgent"
                    ? "Việc Khẩn"
                    : "Nội bộ"}
                </span>
                <h3 className="text-sm font-bold text-foreground leading-snug">
                  {selectedPreviewEvent.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewEvent(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center gap-2 text-foreground font-mono tabular-nums">
                <Clock className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                <span>
                  {selectedPreviewEvent.isAllDay
                    ? `Cả ngày (${selectedPreviewEvent.date})`
                    : `${selectedPreviewEvent.startTime} - ${selectedPreviewEvent.endTime}, ngày ${selectedPreviewEvent.date}`}
                </span>
              </div>

              {selectedPreviewEvent.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />
                  <span>{selectedPreviewEvent.location}</span>
                </div>
              )}

              {selectedPreviewEvent.attendees && selectedPreviewEvent.attendees.length > 0 && (
                <div className="flex items-start gap-2 text-muted-foreground">
                  <Users className="size-3.5 text-muted-foreground shrink-0 mt-0.5" strokeWidth={1.5} />
                  <span>{selectedPreviewEvent.attendees.join(", ")}</span>
                </div>
              )}

              {selectedPreviewEvent.description && (
                <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-foreground/90 mt-2">
                  {selectedPreviewEvent.description}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPreviewEvent(null)}
                className="text-xs rounded-xl"
              >
                Đóng
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExecutiveCalendarWorkspace;
