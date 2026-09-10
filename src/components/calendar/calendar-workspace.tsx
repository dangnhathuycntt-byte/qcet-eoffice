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
  Search,
  Building2,
  CheckCircle2,
  X,
  FileText,
  Layers,
  CalendarRange,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask, StaffTask, TaskStatus } from "@/types/dashboard";
import { getSystemReferenceDate } from "@/lib/academic-calendar";
import {
  transformTasksToCalendarOperations,
  getPriorOverdueWorkItems,
  filterWorkCalendarItems,
  type WorkCalendarItem,
  type WorkItemType,
  type WorkCalendarFilters,
} from "@/lib/work-calendar-adapter";
import {
  calculateEventLayout,
  getSemanticEventStyle,
  getWeekDays,
  WorkCalendarCard,
  PriorOverdueBacklogBanner,
  type CalendarTimeEvent,
  type EventLayout,
  type WeekDayInfo,
  QCET_DEPARTMENT_FILTER_OPTIONS,
} from "@/components/calendar/executive-calendar-workspace";
import { CalendarMonthView } from "@/components/calendar/calendar-month-view";

export type CalendarViewMode = "month_grid" | "week_grid" | "day_view" | "agenda_list";

export interface CalendarWorkspaceProps {
  tasks?: SchoolTask[];
  events?: CalendarTimeEvent[];
  initialDate?: string | Date;
  initialViewMode?: CalendarViewMode;
  onSelectEvent?: (event: CalendarTimeEvent) => void;
  onSelectWorkItem?: (item: WorkCalendarItem) => void;
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onSelectNonTaskEvent?: (event: CalendarTimeEvent) => void;
  onAddTask?: (date?: string) => void;
  onOpenAddTask?: (date?: string) => void;
  onDateChange?: (dateStr: string) => void;
  onViewChange?: (view: CalendarViewMode) => void;
  className?: string;
  isExecutive?: boolean;
}

export const QCET_ITEM_TYPE_OPTIONS = [
  { id: "ALL", label: "Tất cả loại hình" },
  { id: "school_milestone", label: "Mốc cấp Trường" },
  { id: "subtask", label: "Nhiệm vụ Đơn vị" },
  { id: "deliverable", label: "Sản phẩm DACUM" },
  { id: "urgent_overdue", label: "Khẩn / Quá hạn" },
];

export const QCET_STATUS_FILTER_OPTIONS = [
  { id: "ALL", label: "Mọi trạng thái" },
  { id: "IN_PROGRESS", label: "Đang thực hiện" },
  { id: "COMPLETED", label: "Hoàn thành" },
  { id: "OVERDUE", label: "Đã quá hạn" },
];

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function parseTimeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function formatDateString(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatWeekSpan(days: WeekDayInfo[]): string {
  if (days.length === 0) return "";
  const first = days[0];
  const last = days[days.length - 1];
  return `Tuần: ${pad(first.dayOfMonth)}/${pad(first.month)} - ${pad(last.dayOfMonth)}/${pad(last.month)}/${last.date.getFullYear()}`;
}

function formatDayHeaderVi(date: Date): string {
  const dayNames = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy",
  ];
  const dayName = dayNames[date.getDay()];
  return `${dayName}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function convertItemToTimeEvent(item: WorkCalendarItem): CalendarTimeEvent {
  let startTime = "08:00";
  let endTime = "09:30";
  if (item.dueTime) {
    const dueMins = parseTimeToMinutes(item.dueTime);
    const startMins = Math.max(7 * 60, dueMins - 60);
    const sh = Math.floor(startMins / 60);
    const sm = startMins % 60;
    startTime = `${pad(sh)}:${pad(sm)}`;
    endTime = item.dueTime;
  }
  return {
    id: item.id,
    taskId: item.sourceTaskId,
    title: item.title,
    startTime,
    endTime,
    date: item.dueDate,
    type: item.type,
    description: item.deliverableSummary,
    department: item.departmentName,
    departmentId: item.departmentId,
    departmentName: item.departmentName,
    assigneeName: item.assigneeName,
    code: item.code,
    progressPercent: item.progressPercent,
    isOverdue: item.isOverdue,
    daysOverdue: item.daysOverdue,
    status: item.status === "COMPLETED" ? "completed" : item.isOverdue ? "cancelled" : "in_progress",
    priority: item.priority.toLowerCase() as any,
    workItem: item,
  };
}

/**
 * Lightweight Event Detail Modal for calendar events without a backing task
 * (e.g. Board meetings, conferences, administrative schedules).
 */
export function CalendarEventDetailModal({
  event,
  isOpen,
  onClose,
}: {
  event: CalendarTimeEvent | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !event) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="calendar-event-title"
    >
      <div className="relative w-full max-w-lg rounded-2xl border border-border/70 bg-card p-6 shadow-2xl space-y-5 text-xs text-foreground">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border/60 pb-3">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <CalendarIcon className="size-3" strokeWidth={1.5} />
              <span>Sự kiện lịch biểu</span>
            </span>
            <h3 id="calendar-event-title" className="text-base font-bold text-foreground leading-snug font-heading">
              {event.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
            aria-label="Đóng chi tiết sự kiện"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Event Details Grid */}
        <div className="space-y-3">
          {/* Time and Date */}
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
            <Clock className="size-4 text-primary shrink-0" strokeWidth={1.5} />
            <div>
              <div className="font-semibold text-foreground font-mono tabular-nums">
                {event.startTime && event.endTime ? `${event.startTime} - ${event.endTime}` : "Cả ngày"}
              </div>
              <div className="text-muted-foreground text-xs font-mono tabular-nums">
                Ngày: {event.date}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
              <MapPin className="size-4 text-amber-600 shrink-0" strokeWidth={1.5} />
              <div>
                <span className="font-semibold text-foreground">Địa điểm:</span>{" "}
                <span className="text-muted-foreground">{event.location}</span>
              </div>
            </div>
          )}

          {/* Department / Unit */}
          {(event.departmentName || event.department) && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
              <Building2 className="size-4 text-sky-600 shrink-0" strokeWidth={1.5} />
              <div>
                <span className="font-semibold text-foreground">Đơn vị chủ trì:</span>{" "}
                <span className="text-muted-foreground">{event.departmentName || event.department}</span>
              </div>
            </div>
          )}

          {/* Attendees / Host */}
          {(event.attendees?.length || event.assigneeName) && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/30 border border-border/50">
              <Users className="size-4 text-emerald-600 shrink-0" strokeWidth={1.5} />
              <div>
                <span className="font-semibold text-foreground">Thành phần tham dự:</span>{" "}
                <span className="text-muted-foreground">
                  {event.attendees && event.attendees.length > 0 ? event.attendees.join(", ") : event.assigneeName}
                </span>
              </div>
            </div>
          )}

          {/* Description */}
          {event.description && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-foreground">
                <FileText className="size-3.5 text-muted-foreground" strokeWidth={1.5} />
                <span>Nội dung / Ghi chú:</span>
              </div>
              <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {event.description}
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/50">
          <Button
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs rounded-xl h-9 min-h-[44px] md:min-h-0 cursor-pointer"
          >
            Đóng
          </Button>
        </div>
      </div>
    </div>
  );
}

export function CalendarWorkspace({
  tasks = [],
  events: propEvents = [],
  initialDate,
  initialViewMode,
  onSelectEvent,
  onSelectWorkItem,
  onSelectTask,
  onSelectNonTaskEvent,
  onAddTask,
  onOpenAddTask,
  onDateChange,
  onViewChange,
  className,
  isExecutive = false,
}: CalendarWorkspaceProps) {
  // Mobile breakpoint state (< 768px)
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  // Active date tracking
  const [currentDate, setCurrentDate] = React.useState<Date>(() => {
    if (initialDate) {
      if (typeof initialDate === "string") {
        const clean = initialDate.split("T")[0];
        const [y, m, d] = clean.split("-").map(Number);
        if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
          return new Date(y, m - 1, d, 0, 0, 0, 0);
        }
      } else if (initialDate instanceof Date) {
        return initialDate;
      }
    }
    const sysDate = getSystemReferenceDate();
    const [y, m, day] = sysDate.split("-").map(Number);
    return new Date(y, m - 1, day, 0, 0, 0, 0);
  });

  // Active view mode: Desktop (≥768px) supports month/week/day, Mobile (<768px) defaults to agenda_list
  const [viewMode, setViewModeState] = React.useState<CalendarViewMode>(() => {
    if (initialViewMode) return initialViewMode;
    return "week_grid";
  });

  // Check screen width on mount and prioritize agenda view for mobile
  React.useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile && !initialViewMode) {
        setViewModeState("agenda_list");
      }
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [initialViewMode]);

  const setViewMode = React.useCallback((mode: CalendarViewMode) => {
    setViewModeState(mode);
    onViewChange?.(mode);
  }, [onViewChange]);

  // Filters state
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("ALL");
  const [selectedItemType, setSelectedItemType] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");

  // Non-task lightweight event modal state
  const [selectedNonTaskEvent, setSelectedNonTaskEvent] = React.useState<CalendarTimeEvent | null>(null);

  // Days of the active week
  const weekDays = React.useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekSpanText = React.useMemo(() => formatWeekSpan(weekDays), [weekDays]);

  // Transform tasks to operational calendar items
  const liveWorkItems = React.useMemo(() => {
    if (tasks && tasks.length > 0) {
      return transformTasksToCalendarOperations(tasks);
    }
    return [];
  }, [tasks]);

  // Extract prior overdue backlog
  const priorOverdueItems = React.useMemo(() => {
    if (tasks && tasks.length > 0) {
      return getPriorOverdueWorkItems(tasks);
    }
    return [];
  }, [tasks]);

  // Combine with explicit propEvents
  const combinedWorkItems = React.useMemo<WorkCalendarItem[]>(() => {
    const list: WorkCalendarItem[] = [...liveWorkItems];

    if (propEvents && propEvents.length > 0) {
      for (const ev of propEvents) {
        // If event has taskId, map it as work item
        if (ev.taskId) {
          list.push({
            id: ev.id,
            sourceTaskId: ev.taskId,
            title: ev.title,
            code: ev.code,
            dueDate: ev.date,
            dueTime: ev.startTime || "08:00",
            type: (ev.type as WorkItemType) || "school_milestone",
            priority: (ev.priority?.toUpperCase() as any) || "MEDIUM",
            status: ev.status === "completed" ? "COMPLETED" : "IN_PROGRESS",
            progressPercent: ev.progressPercent ?? (ev.status === "completed" ? 100 : 50),
            departmentId: ev.departmentId || ev.department || "BGH",
            departmentName: ev.departmentName || ev.department || "Ban Giám hiệu",
            assigneeName: ev.assigneeName || ev.attendees?.[0] || "Lãnh đạo phụ trách",
            isOverdue: Boolean(ev.isOverdue),
            daysOverdue: ev.daysOverdue,
          });
        }
      }
    }

    return list;
  }, [liveWorkItems, propEvents]);

  // Filter combined work items
  const filteredWorkItems = React.useMemo(() => {
    const filters: WorkCalendarFilters = {
      departmentId: selectedDepartment === "ALL" ? undefined : selectedDepartment,
      itemType: selectedItemType === "ALL" ? undefined : (selectedItemType as WorkItemType),
      statusFilter: selectedStatus === "ALL" ? undefined : (selectedStatus as any),
      searchQuery: searchQuery.trim() || undefined,
    };
    return filterWorkCalendarItems(combinedWorkItems, filters);
  }, [combinedWorkItems, selectedDepartment, selectedItemType, selectedStatus, searchQuery]);

  // Non-task calendar events
  const nonTaskEvents = React.useMemo(() => {
    return propEvents.filter((ev) => !ev.taskId);
  }, [propEvents]);

  // Group items by date for the active week
  const dayItemsMap = React.useMemo(() => {
    const map = new Map<string, WorkCalendarItem[]>();
    for (const d of weekDays) {
      map.set(d.dateString, []);
    }
    for (const item of filteredWorkItems) {
      const list = map.get(item.dueDate);
      if (list) {
        list.push(item);
      }
    }
    return map;
  }, [weekDays, filteredWorkItems]);

  // Group non-task events by date
  const dayNonTaskEventsMap = React.useMemo(() => {
    const map = new Map<string, CalendarTimeEvent[]>();
    for (const d of weekDays) {
      map.set(d.dateString, []);
    }
    for (const ev of nonTaskEvents) {
      const list = map.get(ev.date);
      if (list) {
        list.push(ev);
      }
    }
    return map;
  }, [weekDays, nonTaskEvents]);

  // Date Navigation Handlers
  const handlePrev = React.useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "day_view") {
        next.setDate(next.getDate() - 1);
      } else if (viewMode === "month_grid") {
        next.setMonth(next.getMonth() - 1);
      } else {
        next.setDate(next.getDate() - 7);
      }
      const str = formatDateString(next);
      onDateChange?.(str);
      return next;
    });
  }, [viewMode, onDateChange]);

  const handleNext = React.useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "day_view") {
        next.setDate(next.getDate() + 1);
      } else if (viewMode === "month_grid") {
        next.setMonth(next.getMonth() + 1);
      } else {
        next.setDate(next.getDate() + 7);
      }
      const str = formatDateString(next);
      onDateChange?.(str);
      return next;
    });
  }, [viewMode, onDateChange]);

  const handleToday = React.useCallback(() => {
    const sysDate = getSystemReferenceDate();
    const [y, m, day] = sysDate.split("-").map(Number);
    const today = new Date(y, m - 1, day, 0, 0, 0, 0);
    setCurrentDate(today);
    onDateChange?.(sysDate);
  }, [onDateChange]);

  const handleAddSlotClick = React.useCallback(
    (dateStr?: string) => {
      if (onOpenAddTask) {
        onOpenAddTask(dateStr);
      } else if (onAddTask) {
        onAddTask(dateStr);
      }
    },
    [onOpenAddTask, onAddTask]
  );

  // Unified Item Click Handler
  const handleItemClick = React.useCallback(
    (item: WorkCalendarItem) => {
      // If task-based, prioritize onSelectTask, onSelectWorkItem, or onSelectEvent
      if (item.sourceTaskId) {
        if (onSelectTask && tasks.length > 0) {
          const schoolTask = tasks.find(
            (t) => t.id === item.sourceTaskId || t.id === item.parentSchoolTaskId
          );
          if (schoolTask) {
            if (schoolTask.id === item.sourceTaskId) {
              onSelectTask(schoolTask);
              return;
            }
            if (schoolTask.subTasks) {
              const sub = schoolTask.subTasks.find((s) => s.id === item.sourceTaskId);
              if (sub) {
                onSelectTask(sub);
                return;
              }
            }
            onSelectTask(schoolTask);
            return;
          }
        }
        if (onSelectWorkItem) {
          onSelectWorkItem(item);
          return;
        }
        if (onSelectEvent) {
          onSelectEvent(convertItemToTimeEvent(item));
          return;
        }
      }

      // If no task backing, open lightweight event modal
      const ev = convertItemToTimeEvent(item);
      if (onSelectNonTaskEvent) {
        onSelectNonTaskEvent(ev);
      } else {
        setSelectedNonTaskEvent(ev);
      }
    },
    [tasks, onSelectTask, onSelectWorkItem, onSelectEvent, onSelectNonTaskEvent]
  );

  // Non-task Event Click Handler
  const handleNonTaskEventClick = React.useCallback(
    (event: CalendarTimeEvent) => {
      if (event.taskId) {
        // Event has taskId -> routes to task selection
        if (onSelectEvent) {
          onSelectEvent(event);
          return;
        }
        if (onSelectTask && tasks.length > 0) {
          const matched = tasks.find((t) => t.id === event.taskId);
          if (matched) {
            onSelectTask(matched);
            return;
          }
          for (const t of tasks) {
            const sub = t.subTasks?.find((s) => s.id === event.taskId);
            if (sub) {
              onSelectTask(sub);
              return;
            }
          }
        }
      }

      // Event has no taskId -> open lightweight event modal
      if (onSelectNonTaskEvent) {
        onSelectNonTaskEvent(event);
      } else {
        setSelectedNonTaskEvent(event);
      }
    },
    [tasks, onSelectEvent, onSelectTask, onSelectNonTaskEvent]
  );

  const hours = Array.from({ length: 12 }, (_, i) => i + 7); // 07:00 to 18:00
  const activeDateStr = formatDateString(currentDate);

  return (
    <div
      data-slot="calendar-workspace"
      className={cn("space-y-4 text-foreground", className)}
    >
      {/* 1. Prior Overdue Backlog Banner */}
      {priorOverdueItems.length > 0 && (
        <PriorOverdueBacklogBanner
          overdueItems={priorOverdueItems}
          onSelectWorkItem={handleItemClick}
        />
      )}

      {/* 2. Unified Control Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-xs">
        {/* Date Navigation */}
        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-xl border border-border/70 bg-muted/20 p-0.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={handlePrev}
              className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
              title="Kỳ trước"
              aria-label="Kỳ trước"
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
              onClick={handleNext}
              className="h-8 w-8 p-0 rounded-lg hover:bg-muted"
              title="Kỳ sau"
              aria-label="Kỳ sau"
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <CalendarIcon className="size-4 text-primary shrink-0" strokeWidth={1.5} />
            <h2 className="font-heading text-sm sm:text-base font-bold text-foreground font-mono tabular-nums tracking-tight">
              {viewMode === "day_view"
                ? formatDayHeaderVi(currentDate)
                : viewMode === "month_grid"
                ? `Tháng ${pad(currentDate.getMonth() + 1)} / ${currentDate.getFullYear()}`
                : weekSpanText}
            </h2>
          </div>
        </div>

        {/* View Switcher & Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* View Mode Switcher Segmented Control */}
          <div className="flex items-center rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs overflow-x-auto">
            <button
              type="button"
              onClick={() => setViewMode("month_grid")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                viewMode === "month_grid"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <CalendarRange className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Lưới tháng</span>
              <span className="sm:hidden">Tháng</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("week_grid")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                viewMode === "week_grid"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <LayoutGrid className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Lưới tuần</span>
              <span className="sm:hidden">Tuần</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("day_view")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                viewMode === "day_view"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <Clock className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Lịch ngày</span>
              <span className="sm:hidden">Ngày</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("agenda_list")}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0",
                viewMode === "agenda_list"
                  ? "bg-primary text-primary-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              <List className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Nghị sự điều hành</span>
              <span className="sm:hidden">Nghị sự</span>
            </button>
          </div>

          {/* Quick Add Action */}
          {isExecutive && (
            <Button
              size="sm"
              onClick={() => handleAddSlotClick(activeDateStr)}
              className="gap-1.5 text-xs font-semibold rounded-xl h-8.5 cursor-pointer shrink-0"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Thêm nhiệm vụ</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Filters Toolbar */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-xl border border-border/60 bg-muted/20 p-2.5 text-xs">
        {/* Search Query Input */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Tìm kiếm công việc, đơn vị, DRI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-full rounded-xl border border-border/70 bg-card pl-8 pr-7 text-xs text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
            >
              <X className="size-3" />
            </button>
          )}
        </div>

        {/* Department Selector */}
        <div className="flex items-center gap-1.5">
          <Building2 className="size-3.5 text-muted-foreground shrink-0" />
          <select
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="h-8 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
            aria-label="Lọc theo đơn vị"
          >
            {QCET_DEPARTMENT_FILTER_OPTIONS.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* Item Type Selector */}
        <div className="flex items-center gap-1.5">
          <Layers className="size-3.5 text-muted-foreground shrink-0" />
          <select
            value={selectedItemType}
            onChange={(e) => setSelectedItemType(e.target.value)}
            className="h-8 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
            aria-label="Lọc theo loại hình"
          >
            {QCET_ITEM_TYPE_OPTIONS.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5 text-muted-foreground shrink-0" />
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="h-8 rounded-xl border border-border/70 bg-card px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
            aria-label="Lọc theo trạng thái"
          >
            {QCET_STATUS_FILTER_OPTIONS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. Active Calendar View Body */}
      {viewMode === "month_grid" ? (
        /* Month Grid: Desktop 7-column academic month grid */
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
          <CalendarMonthView
            tasks={tasks}
            initialYear={currentDate.getFullYear()}
            initialMonth={currentDate.getMonth() + 1}
            onSelectTask={onSelectTask}
            onAddTask={handleAddSlotClick}
          />
        </div>
      ) : viewMode === "week_grid" ? (
        /* Week Grid: Desktop 7-column hourly grid */
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="min-w-[800px]">
            {/* Header: 7-Day Columns */}
            <div className="flex border-b border-border/70 bg-muted/20">
              <div className="w-14 shrink-0 border-r border-border/60 p-2 text-right font-mono text-xs text-muted-foreground font-semibold">
                GMT+7
              </div>
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
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-primary text-primary-foreground font-mono">
                          Hôm nay
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Time Grid: 07:00 to 18:00 */}
            <div className="flex relative">
              {/* Left Hour Gutter */}
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

              {/* 7 Columns for Days */}
              <div data-time-grid="true" className="grid grid-cols-7 divide-x divide-border/60 flex-1 relative">
                {weekDays.map((d) => {
                  const dayWorkItems = dayItemsMap.get(d.dateString) || [];
                  const timeEvents = dayWorkItems.map(convertItemToTimeEvent);
                  const dayNonTasks = dayNonTaskEventsMap.get(d.dateString) || [];

                  return (
                    <div
                      key={d.dateString}
                      onClick={() => handleAddSlotClick(d.dateString)}
                      className={cn(
                        "relative h-[704px] border-b border-border/60 cursor-pointer hover:bg-muted/10 transition-colors",
                        d.isToday && "bg-primary/[0.02]"
                      )}
                      title={`Nhấp để thêm công việc ngày ${d.dateString}`}
                    >
                      {/* Horizontal Hour Dividing Lines */}
                      {hours.map((h) => (
                        <div
                          key={h}
                          className="h-16 border-t border-border/40 pointer-events-none"
                        />
                      ))}

                      {/* Work Item Cards Placed into Column */}
                      {dayWorkItems.map((item) => {
                        const timeEv = convertItemToTimeEvent(item);
                        const layout = calculateEventLayout(timeEv, 7, 18, timeEvents);

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleItemClick(item);
                            }}
                            className={cn(
                              "absolute z-10 p-0.5 transition-all select-none",
                              layout.hasCollision && "ring-1 ring-amber-500/40 rounded-lg"
                            )}
                            style={{
                              top: `${layout.topPercent}%`,
                              height: `${Math.max(layout.heightPercent, 12)}%`,
                              left: `${layout.leftPercent}%`,
                              width: `${layout.widthPercent}%`,
                            }}
                          >
                            <WorkCalendarCard
                              item={item}
                              compact
                              onClick={() => handleItemClick(item)}
                            />
                          </div>
                        );
                      })}

                      {/* Non-Task Events Placed into Column */}
                      {dayNonTasks.map((ev) => {
                        const layout = calculateEventLayout(ev, 7, 18, [...timeEvents, ...dayNonTasks]);
                        return (
                          <div
                            key={ev.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleNonTaskEventClick(ev);
                            }}
                            className="absolute z-10 p-0.5 transition-all select-none"
                            style={{
                              top: `${layout.topPercent}%`,
                              height: `${Math.max(layout.heightPercent, 10)}%`,
                              left: `${layout.leftPercent}%`,
                              width: `${layout.widthPercent}%`,
                            }}
                          >
                            <div className="h-full w-full rounded-lg border border-primary/30 bg-primary/10 p-1.5 text-xs text-foreground cursor-pointer hover:bg-primary/15 transition-colors overflow-hidden">
                              <div className="font-semibold truncate">{ev.title}</div>
                              <div className="text-muted-foreground font-mono tabular-nums text-xs">
                                {ev.startTime} - {ev.endTime}
                              </div>
                            </div>
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
      ) : viewMode === "day_view" ? (
        /* Day View: Detailed single-day hourly schedule */
        <div className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-xs">
          {/* Day View Header */}
          <div className="flex items-center justify-between border-b border-border/70 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="size-4 text-primary" strokeWidth={1.5} />
              <span className="font-heading font-bold text-sm sm:text-base">
                {formatDayHeaderVi(currentDate)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground font-mono tabular-nums">
              {(dayItemsMap.get(activeDateStr) || []).length} nhiệm vụ / sự kiện
            </div>
          </div>

          {/* Hourly Timeline */}
          <div className="flex relative min-h-[600px]">
            {/* Hour Gutter */}
            <div className="w-16 shrink-0 border-r border-border/60 select-none py-2">
              {hours.map((h) => (
                <div
                  key={h}
                  className="h-16 text-right pr-3 font-mono text-xs tabular-nums text-muted-foreground -mt-2"
                >
                  {pad(h)}:00
                </div>
              ))}
            </div>

            {/* Day Hourly Content */}
            <div className="flex-1 relative py-2">
              {hours.map((h) => (
                <div
                  key={h}
                  onClick={() => handleAddSlotClick(activeDateStr)}
                  className="h-16 border-t border-border/40 hover:bg-muted/10 transition-colors cursor-pointer px-4 flex items-center justify-between group"
                >
                  <span className="text-xs text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-colors font-mono">
                    + Thêm công việc lúc {pad(h)}:00
                  </span>
                </div>
              ))}

              {/* Day Events overlay */}
              <div className="absolute inset-0 pl-4 pr-4 pointer-events-none space-y-2 py-2">
                {(dayItemsMap.get(activeDateStr) || []).map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className="pointer-events-auto cursor-pointer"
                  >
                    <WorkCalendarCard item={item} onClick={() => handleItemClick(item)} />
                  </div>
                ))}
                {(dayNonTaskEventsMap.get(activeDateStr) || []).map((ev) => (
                  <div
                    key={ev.id}
                    onClick={() => handleNonTaskEventClick(ev)}
                    className="pointer-events-auto cursor-pointer p-3 rounded-xl border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground">{ev.title}</span>
                      <span className="font-mono tabular-nums text-primary font-semibold">
                        {ev.startTime} - {ev.endTime}
                      </span>
                    </div>
                    {ev.location && (
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="size-3 text-muted-foreground" />
                        <span>{ev.location}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Agenda List View: Chronological list prioritized for mobile (<768px) */
        <div className="space-y-4">
          {filteredWorkItems.length === 0 && nonTaskEvents.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-muted/10 space-y-2">
              <CalendarDays className="size-8 mx-auto text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground">
                Không có công việc hoặc sự kiện
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc trong kỳ này.
              </p>
              {isExecutive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSlotClick()}
                  className="mt-2 text-xs rounded-xl min-h-[44px] md:min-h-0"
                >
                  <Plus className="size-3.5 mr-1" />
                  Tạo nhiệm vụ mới
                </Button>
              )}
            </div>
          ) : (
            weekDays.map((d) => {
              const items = dayItemsMap.get(d.dateString) || [];
              const nonTasks = dayNonTaskEventsMap.get(d.dateString) || [];
              if (items.length === 0 && nonTasks.length === 0) return null;

              return (
                <div
                  key={d.dateString}
                  className="rounded-xl border border-border/70 bg-card overflow-hidden shadow-2xs"
                >
                  {/* Day Header */}
                  <div
                    className={cn(
                      "flex items-center justify-between border-b border-border/60 px-4 py-2.5",
                      d.isToday ? "bg-primary/10" : "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {d.fullDayLabel}
                      </span>
                      <span className="font-mono text-xs tabular-nums text-muted-foreground">
                        {pad(d.dayOfMonth)}/{pad(d.month)}/{d.date.getFullYear()}
                      </span>
                      {d.isToday && (
                        <span className="px-1.5 py-0.5 rounded text-xs font-semibold bg-primary text-primary-foreground font-mono">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">
                      {items.length + nonTasks.length} mục
                    </span>
                  </div>

                  {/* Day Items List */}
                  <div className="divide-y divide-border/40 p-2 space-y-2">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleItemClick(item)}
                        className="cursor-pointer active:scale-[0.99] transition-transform min-h-[44px]"
                      >
                        <WorkCalendarCard item={item} onClick={() => handleItemClick(item)} />
                      </div>
                    ))}
                    {nonTasks.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => handleNonTaskEventClick(ev)}
                        className="p-3 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors cursor-pointer min-h-[44px] flex flex-col justify-center gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-foreground text-xs">{ev.title}</span>
                          <span className="font-mono tabular-nums text-xs text-primary font-semibold shrink-0">
                            {ev.startTime} - {ev.endTime}
                          </span>
                        </div>
                        {ev.location && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <MapPin className="size-3 text-muted-foreground shrink-0" />
                            <span>{ev.location}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 5. Lightweight Event Detail Modal for non-task calendar events */}
      <CalendarEventDetailModal
        event={selectedNonTaskEvent}
        isOpen={Boolean(selectedNonTaskEvent)}
        onClose={() => setSelectedNonTaskEvent(null)}
      />
    </div>
  );
}

export type { CalendarTimeEvent, EventLayout, WeekDayInfo };
export { CalendarWorkspace as ExecutiveCalendarWorkspace };
export default CalendarWorkspace;
