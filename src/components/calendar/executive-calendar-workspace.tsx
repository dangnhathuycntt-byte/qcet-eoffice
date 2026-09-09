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
  Search,
  Building2,
  CheckCircle2,
  X,
  Pin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SchoolTask } from "@/types/dashboard";
import { getSystemReferenceDate } from "@/lib/academic-calendar";
import {
  transformTasksToCalendarOperations,
  getPriorOverdueWorkItems,
  filterWorkCalendarItems,
  type WorkCalendarItem,
  type WorkItemType,
  type WorkCalendarFilters,
} from "@/lib/work-calendar-adapter";

export interface CalendarTimeEvent {
  id: string;
  taskId?: string;
  title: string;
  startTime: string; // "HH:MM" e.g. "08:00"
  endTime: string;   // "HH:MM" e.g. "09:30"
  date: string;      // "YYYY-MM-DD" e.g. "2026-09-14"
  type?: "meeting" | "deliverable" | "academic" | "urgent" | "internal" | "school_milestone" | "subtask" | "urgent_overdue" | string;
  description?: string;
  location?: string;
  attendees?: string[];
  department?: string;
  status?: "upcoming" | "in_progress" | "completed" | "cancelled" | "overdue";
  isAllDay?: boolean;
  priority?: "low" | "medium" | "high" | "urgent";
  code?: string;
  departmentId?: string;
  departmentName?: string;
  assigneeName?: string;
  progressPercent?: number;
  isOverdue?: boolean;
  daysOverdue?: number;
  workItem?: WorkCalendarItem;
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
  onSelectWorkItem?: (item: WorkCalendarItem) => void;
  onAddTask?: (date?: string) => void;
  onAddEvent?: (date?: string) => void;
  onOpenAddTask?: (date?: string) => void;
  className?: string;
  isExecutive?: boolean;
}

export const QCET_DEPARTMENT_FILTER_OPTIONS = [
  { id: "ALL", label: "Tất cả đơn vị" },
  { id: "BGH", label: "Ban Giám hiệu" },
  { id: "P_DTQLKH", label: "P. Đào tạo & QLKH" },
  { id: "P_TCHC", label: "P. Tổ chức - Hành chính" },
  { id: "P_KHTC", label: "P. Kế hoạch - Tài chính" },
  { id: "P_QTTB", label: "P. Quản trị - Thiết bị" },
  { id: "P_QLDT", label: "P. Quản lý Đào tạo" },
  { id: "P_TCDBCL", label: "P. Đảm bảo chất lượng" },
  { id: "K_CNTT", label: "Khoa CNTT" },
  { id: "K_CK", label: "Khoa Cơ khí" },
  { id: "K_CD", label: "Khoa Cơ điện" },
  { id: "K_CNOTO", label: "Khoa Công nghệ Ô tô" },
  { id: "K_DULICH", label: "Khoa Du lịch" },
] as const;

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
    case "school_milestone":
    case "meeting":
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
    case "deliverable":
      return "bg-violet-500/10 text-violet-700 border-violet-500/20";
    case "subtask":
    case "academic":
      return "bg-emerald-500/10 text-emerald-700 border-emerald-500/20";
    case "urgent_overdue":
    case "urgent":
      return "bg-rose-500/10 text-rose-700 border-rose-500/20";
    case "internal":
      return "bg-zinc-500/10 text-zinc-700 border-zinc-500/20";
    default:
      return "bg-blue-500/10 text-blue-700 border-blue-500/20";
  }
}

export function getWeekDays(baseDate: Date | string, referenceDate?: string): WeekDayInfo[] {
  let d: Date;
  if (typeof baseDate === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(baseDate)) {
      const [y, m, day] = baseDate.split("-").map(Number);
      d = new Date(y, m - 1, day, 0, 0, 0, 0);
    } else {
      d = new Date(baseDate);
    }
  } else {
    d = new Date(baseDate.getTime());
  }

  const day = d.getDay();
  // Monday is start of week: day 0 (Sun) -> -6, day 1 (Mon) -> 0, day 2 -> -1, etc.
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const refDate = referenceDate || getSystemReferenceDate();
  const todayStr = refDate.includes("T") ? refDate.split("T")[0] : refDate;

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

export interface WorkCalendarCardProps {
  item: WorkCalendarItem | CalendarTimeEvent;
  onClick?: () => void;
  compact?: boolean;
  className?: string;
}

export function WorkCalendarCard({
  item,
  onClick,
  compact = false,
  className,
}: WorkCalendarCardProps) {
  const isWorkItem = "dueDate" in item;
  const title = item.title;
  const code = item.code;
  const type = item.type;
  const department = isWorkItem
    ? (item as WorkCalendarItem).departmentName
    : (item as CalendarTimeEvent).department || (item as CalendarTimeEvent).departmentName || "QCET";
  const assignee = isWorkItem
    ? (item as WorkCalendarItem).assigneeName
    : (item as CalendarTimeEvent).attendees?.[0] || (item as CalendarTimeEvent).assigneeName || "Phụ trách";
  const progressPercent = isWorkItem
    ? (item as WorkCalendarItem).progressPercent
    : (item as CalendarTimeEvent).progressPercent ?? 0;
  const isOverdue = Boolean(
    isWorkItem
      ? (item as WorkCalendarItem).isOverdue
      : (item as CalendarTimeEvent).isOverdue
  );
  const daysOverdue = isWorkItem
    ? (item as WorkCalendarItem).daysOverdue
    : (item as CalendarTimeEvent).daysOverdue;

  // Type badge definition
  let badgeLabel = "Mốc trường";
  let badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";

  if (type === "deliverable") {
    badgeLabel = "Sản phẩm DACUM";
    badgeStyle = "bg-violet-50 text-violet-700 border-violet-200";
  } else if (type === "subtask") {
    badgeLabel = "Việc đơn vị";
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  } else if (type === "urgent_overdue" || isOverdue) {
    badgeLabel = "Quá hạn";
    badgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
  } else if (type === "meeting") {
    badgeLabel = "Lịch họp BGH";
    badgeStyle = "bg-blue-50 text-blue-700 border-blue-200";
  } else if (type === "academic") {
    badgeLabel = "Học thuật";
    badgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  }

  if (compact) {
    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
        className={cn(
          "h-full rounded-lg border p-1.5 overflow-hidden cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:border-primary/50 text-xs select-none bg-card flex flex-col justify-between",
          isOverdue ? "border-rose-300 bg-rose-50/50" : "border-border/70",
          className
        )}
      >
        <div>
          <div className="flex items-center justify-between gap-1 mb-1">
            <span
              className={cn(
                "px-1.5 py-0.5 rounded text-xs font-semibold border inline-block truncate",
                badgeStyle
              )}
            >
              {badgeLabel}
            </span>
            {code && (
              <span className="font-mono text-xs font-bold text-muted-foreground px-1 py-0.5 bg-muted/60 rounded">
                {code}
              </span>
            )}
          </div>
          <div className="font-semibold text-xs leading-snug line-clamp-2 text-foreground">
            {title}
          </div>
          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground truncate">
            <Building2 className="size-3 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{department}</span>
          </div>
          <div className="flex items-center gap-1 mt-0.5 text-xs text-muted-foreground truncate">
            <Users className="size-3 shrink-0" strokeWidth={1.5} />
            <span className="truncate">{assignee}</span>
          </div>
        </div>

        <div className="mt-1.5 space-y-0.5">
          <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
            <span>Tiến độ</span>
            <span>{progressPercent}%</span>
          </div>
          <div className="h-1 w-full rounded-full bg-muted overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressPercent === 100
                  ? "bg-emerald-500"
                  : isOverdue
                  ? "bg-rose-500"
                  : "bg-primary"
              )}
              style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={cn(
        "rounded-xl border p-3.5 cursor-pointer transition-all shadow-2xs hover:shadow-xs hover:border-primary/40 bg-card space-y-2.5",
        isOverdue ? "border-rose-200 bg-rose-50/20" : "border-border/70",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "px-2 py-0.5 rounded text-xs font-semibold border inline-block",
              badgeStyle
            )}
          >
            {badgeLabel}
          </span>
          {code && (
            <span className="font-mono text-xs font-bold text-foreground/80 px-1.5 py-0.5 bg-muted rounded border border-border/50">
              {code}
            </span>
          )}
        </div>
        {isOverdue && daysOverdue && daysOverdue > 0 && (
          <span className="font-mono text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-md">
            Trễ {daysOverdue} ngày
          </span>
        )}
      </div>

      <div>
        <h4 className="font-semibold text-sm text-foreground leading-snug">
          {title}
        </h4>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 truncate">
          <Building2 className="size-3.5 shrink-0 text-muted-foreground/80" strokeWidth={1.5} />
          <span className="truncate">{department}</span>
        </div>
        <div className="flex items-center gap-1.5 truncate">
          <Users className="size-3.5 shrink-0 text-muted-foreground/80" strokeWidth={1.5} />
          <span className="truncate">{assignee}</span>
        </div>
      </div>

      <div className="space-y-1 pt-1 border-t border-border/40">
        <div className="flex items-center justify-between text-xs text-muted-foreground font-mono">
          <span>Tiến độ thực hiện</span>
          <span className="font-bold text-foreground">{progressPercent}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              progressPercent === 100
                ? "bg-emerald-500"
                : isOverdue
                ? "bg-rose-500"
                : "bg-primary"
            )}
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export interface PriorOverdueBacklogBannerProps {
  overdueItems: WorkCalendarItem[];
  onSelectWorkItem?: (item: WorkCalendarItem) => void;
  className?: string;
}

export function PriorOverdueBacklogBanner({
  overdueItems,
  onSelectWorkItem,
  className,
}: PriorOverdueBacklogBannerProps) {
  if (!overdueItems || overdueItems.length === 0) return null;

  return (
    <div
      className={cn(
        "rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-rose-800 shadow-2xs space-y-2.5",
        className
      )}
      data-slot="prior-overdue-backlog-banner"
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="size-4 text-rose-600 shrink-0" strokeWidth={1.5} />
          <span className="font-semibold text-xs sm:text-sm">
            Công việc trễ hạn tồn đọng ({overdueItems.length} nhiệm vụ cần xử lý gấp)
          </span>
        </div>
        <span className="text-xs font-medium text-rose-600 bg-rose-100/80 px-2 py-0.5 rounded-md border border-rose-200">
          Ưu tiên xử lý
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
        {overdueItems.map((item) => (
          <div
            key={item.id}
            onClick={() => onSelectWorkItem?.(item)}
            className="flex items-center justify-between gap-2 rounded-lg border border-rose-200 bg-white/80 p-2 text-xs shadow-2xs hover:bg-white hover:border-rose-300 cursor-pointer transition-all"
            title={`Xem nhiệm vụ: ${item.title}`}
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {item.code && (
                  <span className="font-mono text-xs font-bold text-rose-700 bg-rose-100/60 px-1.5 py-0.5 rounded">
                    {item.code}
                  </span>
                )}
                <span className="font-semibold text-slate-800 truncate block">
                  {item.title}
                </span>
              </div>
              <div className="text-xs text-slate-500 truncate mt-0.5">
                {item.departmentName} • {item.assigneeName}
              </div>
            </div>
            <div className="flex flex-col items-end shrink-0 gap-1">
              <span className="font-mono text-xs font-bold text-rose-600 bg-rose-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                Trễ {item.daysOverdue || 1} ngày
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-5 px-2 text-xs text-rose-700 hover:bg-rose-100 rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectWorkItem?.(item);
                }}
              >
                Xử lý
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
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

export function ExecutiveCalendarWorkspace({
  events: propEvents,
  tasks,
  initialDate,
  initialViewMode = "week_grid",
  onSelectEvent,
  onSelectWorkItem,
  onAddTask,
  onAddEvent,
  onOpenAddTask,
  className,
  isExecutive = true,
}: ExecutiveCalendarWorkspaceProps) {
  const [currentDate, setCurrentDate] = React.useState<Date>(() => {
    if (initialDate instanceof Date) return initialDate;
    if (typeof initialDate === "string") {
      if (/^\d{4}-\d{2}-\d{2}$/.test(initialDate)) {
        const [y, m, day] = initialDate.split("-").map(Number);
        return new Date(y, m - 1, day, 0, 0, 0, 0);
      }
      return new Date(initialDate);
    }
    const sysDate = getSystemReferenceDate();
    const [y, m, day] = sysDate.split("-").map(Number);
    return new Date(y, m - 1, day, 0, 0, 0, 0);
  });

  const [viewMode, setViewMode] = React.useState<"week_grid" | "agenda_list">(initialViewMode);
  const [selectedDepartment, setSelectedDepartment] = React.useState<string>("ALL");
  const [selectedItemType, setSelectedItemType] = React.useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = React.useState<string>("ALL");
  const [searchQuery, setSearchQuery] = React.useState<string>("");
  const [selectedPreviewItem, setSelectedPreviewItem] = React.useState<WorkCalendarItem | null>(null);

  // Calculate the 7 days of the active week
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

  // Combine with explicit propEvents if provided (without fake static defaults)
  const combinedWorkItems = React.useMemo<WorkCalendarItem[]>(() => {
    const list: WorkCalendarItem[] = [...liveWorkItems];

    if (propEvents && propEvents.length > 0) {
      for (const ev of propEvents) {
        list.push({
          id: ev.id,
          sourceTaskId: ev.taskId || ev.id,
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

    return list;
  }, [liveWorkItems, propEvents]);

  // Dynamic department options based on default list and loaded tasks
  const departmentOptions = React.useMemo(() => {
    const base: { id: string; label: string }[] = [...QCET_DEPARTMENT_FILTER_OPTIONS];
    const knownIds = new Set<string>(base.map((b) => b.id));
    for (const item of combinedWorkItems) {
      if (item.departmentId && !knownIds.has(item.departmentId)) {
        base.push({
          id: item.departmentId,
          label: item.departmentName || item.departmentId,
        });
        knownIds.add(item.departmentId);
      }
    }
    return base;
  }, [combinedWorkItems]);

  // Apply matrix operations filters
  const filteredWorkItems = React.useMemo(() => {
    return filterWorkCalendarItems(combinedWorkItems, {
      departmentId: selectedDepartment as any,
      itemType: selectedItemType as any,
      statusFilter: selectedStatus as any,
      searchQuery,
    });
  }, [combinedWorkItems, selectedDepartment, selectedItemType, selectedStatus, searchQuery]);

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
    const sysDate = getSystemReferenceDate();
    const [y, m, day] = sysDate.split("-").map(Number);
    setCurrentDate(new Date(y, m - 1, day, 0, 0, 0, 0));
  }, []);

  const handleAddSlotClick = React.useCallback(
    (dateStr?: string) => {
      if (onOpenAddTask) {
        onOpenAddTask(dateStr);
      } else if (onAddTask) {
        onAddTask(dateStr);
      } else if (onAddEvent) {
        onAddEvent(dateStr);
      }
    },
    [onOpenAddTask, onAddTask, onAddEvent]
  );

  const handleItemClick = React.useCallback(
    (item: WorkCalendarItem) => {
      if (onSelectWorkItem) {
        onSelectWorkItem(item);
      } else if (onSelectEvent) {
        onSelectEvent(convertItemToTimeEvent(item));
      } else {
        setSelectedPreviewItem(item);
      }
    },
    [onSelectWorkItem, onSelectEvent]
  );

  // Group items by day for the active week
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
      {/* 1. Prior Overdue Backlog Banner (Pinned on top when overdue items exist) */}
      <PriorOverdueBacklogBanner
        overdueItems={priorOverdueItems}
        onSelectWorkItem={handleItemClick}
      />

      {/* 2. Top Navigation & Toolbar Bar */}
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

          {/* Quick Add Action */}
          {isExecutive && (
            <Button
              size="sm"
              onClick={() => handleAddSlotClick()}
              className="gap-1.5 text-xs font-semibold rounded-xl h-8.5"
            >
              <Plus className="size-3.5" />
              <span className="hidden sm:inline">Thêm nhiệm vụ</span>
            </Button>
          )}
        </div>
      </div>

      {/* 3. Work-Oriented Filters Toolbar */}
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
          >
            {departmentOptions.map((dept) => (
              <option key={dept.id} value={dept.id}>
                {dept.label}
              </option>
            ))}
          </select>
        </div>

        {/* Work Item Type Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs overflow-x-auto">
          {[
            { id: "ALL", label: "Tất cả mốc" },
            { id: "school_milestone", label: "Mốc trường" },
            { id: "deliverable", label: "Sản phẩm DACUM" },
            { id: "subtask", label: "Việc đơn vị" },
          ].map((typeOpt) => (
            <button
              key={typeOpt.id}
              type="button"
              onClick={() => setSelectedItemType(typeOpt.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                selectedItemType === typeOpt.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {typeOpt.label}
            </button>
          ))}
        </div>

        {/* Status Selector */}
        <div className="flex items-center gap-1 rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs overflow-x-auto">
          {[
            { id: "ALL", label: "Tất cả" },
            { id: "ACTIVE", label: "Đang làm" },
            { id: "OVERDUE", label: "Quá hạn" },
            { id: "COMPLETED", label: "Hoàn thành" },
          ].map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => setSelectedStatus(st.id)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-colors",
                selectedStatus === st.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              {st.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4. Main Calendar Content Body */}
      {viewMode === "week_grid" ? (
        <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
          <div className="min-w-[800px]">
            {/* Header: Day Columns */}
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

                      {/* Current Time Line on Today */}
                      {d.isToday && currentTimeIndicator !== null && (
                        <div
                          className="absolute left-0 right-0 z-20 pointer-events-none flex items-center"
                          style={{ top: `${currentTimeIndicator}%` }}
                        >
                          <div className="size-2 -ml-1 rounded-full bg-rose-500 ring-2 ring-rose-500/20" />
                          <div className="h-[2px] w-full bg-rose-500" />
                        </div>
                      )}

                      {/* Work Item Cards Placed into Column */}
                      {dayWorkItems.map((item) => {
                        const timeEv = convertItemToTimeEvent(item);
                        const layout = calculateEventLayout(timeEv, 7, 18, timeEvents);

                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
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
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 5. Agenda List View */
        <div className="space-y-4">
          {filteredWorkItems.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/80 p-8 text-center bg-muted/10 space-y-2">
              <CalendarDays className="size-8 mx-auto text-muted-foreground/50" />
              <h3 className="text-sm font-semibold text-foreground">
                Không có công việc hoặc sự kiện
              </h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Không tìm thấy nhiệm vụ nào phù hợp với bộ lọc trong tuần này.
              </p>
              {isExecutive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleAddSlotClick()}
                  className="mt-2 text-xs rounded-xl"
                >
                  <Plus className="size-3.5 mr-1" />
                  Tạo nhiệm vụ mới
                </Button>
              )}
            </div>
          ) : (
            weekDays.map((d) => {
              const dayItems = dayItemsMap.get(d.dateString) || [];
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
                      <span className="text-xs font-mono text-muted-foreground tabular-nums">
                        {pad(d.dayOfMonth)}/{pad(d.month)}/{d.date.getFullYear()}
                      </span>
                      {d.isToday && (
                        <span className="inline-block px-1.5 py-0.5 rounded text-xs font-semibold bg-primary text-primary-foreground font-mono">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground font-mono">
                        {dayItems.length} việc
                      </span>
                      {isExecutive && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleAddSlotClick(d.dateString)}
                          className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Plus className="size-3 mr-0.5" />
                          Thêm việc
                        </Button>
                      )}
                    </div>
                  </div>

                  {dayItems.length === 0 ? (
                    <div className="py-4 text-center text-xs text-muted-foreground/60">
                      Không có công việc hoặc sự kiện trong ngày
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {dayItems.map((item) => (
                        <WorkCalendarCard
                          key={item.id}
                          item={item}
                          onClick={() => handleItemClick(item)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* 6. Preview Modal for Work Items */}
      {selectedPreviewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-lg space-y-4">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 pb-3">
              <div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Chi tiết công việc
                </span>
                <h3 className="text-sm font-bold text-foreground leading-snug mt-1">
                  {selectedPreviewItem.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPreviewItem(null)}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <WorkCalendarCard item={selectedPreviewItem} />

              <div className="space-y-2 rounded-xl bg-muted/30 p-3">
                <div className="flex items-center gap-2 text-foreground font-mono">
                  <Clock className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                  <span>
                    Hạn chót: {selectedPreviewItem.dueTime || "17:00"}, ngày {selectedPreviewItem.dueDate}
                  </span>
                </div>
                {selectedPreviewItem.isOverdue && (
                  <div className="flex items-center gap-2 text-rose-600 font-semibold font-mono">
                    <AlertTriangle className="size-3.5 shrink-0" strokeWidth={1.5} />
                    <span>Đã quá hạn {selectedPreviewItem.daysOverdue || 1} ngày</span>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedPreviewItem(null)}
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
