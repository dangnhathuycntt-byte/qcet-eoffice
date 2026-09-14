"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  Building2,
  Briefcase,
  Layers,
  Search,
  Clock,
  MapPin,
} from "lucide-react";
import type {
  SchoolTask,
  StaffTask,
  TaskCategory,
  TaskStatus,
} from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getCategoryBadgeConfig,
  getStatusBadgeConfig,
  CATEGORY_TABS,
} from "@/components/tasks/cascading-task-table";
import {
  type AcademicMonthPeriod,
  getAcademicMonthInfo,
  getAdjacentAcademicMonth,
  getAcademicMonthPeriod,
  getSystemReferenceDate,
  isTaskOverdue,
} from "@/lib/academic-calendar";

export interface CalendarDayCell {
  date: Date;
  dateString: string; // YYYY-MM-DD
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
  dayOfWeek: number; // 0 (Sun) to 6 (Sat)
}

export interface CalendarTaskItem {
  id: string;
  title: string;
  level: "Trường" | "Đơn vị";
  category?: TaskCategory;
  categoryLabel?: string;
  assigneeName: string;
  assigneeAvatar?: string;
  dueDate: string;
  status: TaskStatus | "PENDING_EXECUTIVE_APPROVAL";
  progressPercent?: number;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  originalTask: SchoolTask | StaffTask;
}

export function toDateString(year: number, month: number, day: number): string {
  const y = String(year);
  const m = String(month + 1).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatMonthYearVi(year: number, month: number): string {
  const m = String(month + 1).padStart(2, "0");
  return `Tháng ${m} / ${year}`;
}

/**
 * Formats full academic month header with date span and academic year:
 * e.g. "Tháng 9 / 2026 (25/08 - 24/09) • Năm học 2026 - 2027"
 */
export function formatAcademicMonthHeader(period: AcademicMonthPeriod): string {
  const academicYearFormatted = period.academicYear.includes(" - ")
    ? period.academicYear
    : period.academicYear.replace("-", " - ");
  return `${period.fullLabel} • Năm học ${academicYearFormatted}`;
}

export function getPrevMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 0) {
    return { year: year - 1, month: 11 };
  }
  return { year, month: month - 1 };
}

export function getNextMonth(
  year: number,
  month: number
): { year: number; month: number } {
  if (month === 11) {
    return { year: year + 1, month: 0 };
  }
  return { year, month: month + 1 };
}

/**
 * Returns 6px status dot color class according to precision design rules:
 * - Emerald: Completed / Đã hoàn thành
 * - Rose: Overdue / Quá hạn
 * - Blue: In Progress / Đang thực hiện
 * - Amber: Needs Review / New / Chờ xử lý
 */
export function getStatusDotClass(
  status: TaskStatus | "PENDING_EXECUTIVE_APPROVAL",
  dueDate?: string,
  referenceDate: string = getSystemReferenceDate()
): string {
  if (status === "COMPLETED") {
    return "bg-emerald-500";
  }

  if (isTaskOverdue(status, dueDate, referenceDate)) {
    return "bg-rose-500";
  }

  if (status === "IN_PROGRESS") {
    return "bg-blue-500";
  }

  if (status === "NEEDS_REVIEW" || status === "PENDING_EXECUTIVE_APPROVAL") {
    return "bg-amber-500";
  }

  return "bg-amber-500";
}

/**
 * Returns concise Vietnamese status label without emojis.
 */
export function getStatusLabel(
  status: TaskStatus | "PENDING_EXECUTIVE_APPROVAL",
  dueDate?: string,
  referenceDate: string = getSystemReferenceDate()
): string {
  if (status === "COMPLETED") return "Đã hoàn thành";
  if (isTaskOverdue(status, dueDate, referenceDate)) return "Quá hạn";
  if (status === "PENDING_EXECUTIVE_APPROVAL") return "Chờ BGH phê duyệt";
  if (status === "IN_PROGRESS") return "Đang thực hiện";
  if (status === "NEEDS_REVIEW") return "Chờ xét duyệt";
  return "Chờ thực hiện";
}

/**
 * Generates calendar day cells for an academic operational period (25th of prior month to 24th of current month).
 * Grid starts on Monday (T2) and ends on Sunday (CN).
 * Guarantees a grid length of 35 or 42 (5 or 6 complete 7-day weeks).
 */
export function generateAcademicMonthGrid(
  period: AcademicMonthPeriod
): CalendarDayCell[] {
  const todayString = getSystemReferenceDate();

  const [startYear, startMonth, startDay] = period.startDate
    .split("-")
    .map((s) => parseInt(s, 10));
  const [endYear, endMonth, endDay] = period.endDate
    .split("-")
    .map((s) => parseInt(s, 10));

  const startDateObj = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  const startDayOfWeek = startDateObj.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const mondayOffset = (startDayOfWeek + 6) % 7; // Monday-start offset

  const grid: CalendarDayCell[] = [];

  // 1. Preceding days before startDate (starting from Monday of that week)
  for (let i = mondayOffset; i >= 1; i--) {
    const prevDate = new Date(startYear, startMonth - 1, startDay - i, 12, 0, 0);
    const dateString = toDateString(
      prevDate.getFullYear(),
      prevDate.getMonth(),
      prevDate.getDate()
    );
    const dayOfWeek = prevDate.getDay();

    grid.push({
      date: prevDate,
      dateString,
      dayNumber: prevDate.getDate(),
      isCurrentMonth: false,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  // 2. Active operational period days (from 25th of prev month to 24th of current month)
  const endDateObj = new Date(endYear, endMonth - 1, endDay, 12, 0, 0);
  let curr = new Date(startYear, startMonth - 1, startDay, 12, 0, 0);
  while (curr <= endDateObj) {
    const dateString = toDateString(
      curr.getFullYear(),
      curr.getMonth(),
      curr.getDate()
    );
    const dayOfWeek = curr.getDay();

    grid.push({
      date: curr,
      dateString,
      dayNumber: curr.getDate(),
      isCurrentMonth: true,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });

    curr = new Date(curr.getFullYear(), curr.getMonth(), curr.getDate() + 1, 12, 0, 0);
  }

  // 3. Trailing days to complete 7-day rows (at least 35 cells, up to 42 cells)
  const totalCells = Math.max(35, Math.ceil(grid.length / 7) * 7);
  const trailingDaysNeeded = totalCells - grid.length;

  for (let d = 1; d <= trailingDaysNeeded; d++) {
    const nextDate = new Date(endYear, endMonth - 1, endDay + d, 12, 0, 0);
    const dateString = toDateString(
      nextDate.getFullYear(),
      nextDate.getMonth(),
      nextDate.getDate()
    );
    const dayOfWeek = nextDate.getDay();

    grid.push({
      date: nextDate,
      dateString,
      dayNumber: nextDate.getDate(),
      isCurrentMonth: false,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  return grid;
}

/**
 * Generates calendar day cells starting on Monday (T2) and ending on Sunday (CN).
 * Supports AcademicMonthPeriod for operational cycle or (year, month) for calendar months.
 * Guarantees a grid length of 35 or 42 (5 or 6 complete 7-day weeks).
 */
export function generateMonthGrid(
  period: AcademicMonthPeriod
): CalendarDayCell[];
export function generateMonthGrid(
  year: number,
  month: number
): CalendarDayCell[];
export function generateMonthGrid(
  periodOrYear: AcademicMonthPeriod | number,
  month?: number
): CalendarDayCell[] {
  if (typeof periodOrYear === "object" && periodOrYear !== null) {
    return generateAcademicMonthGrid(periodOrYear);
  }

  const year = periodOrYear;
  const targetMonth = month ?? 0;

  const todayString = getSystemReferenceDate();

  // 1st day of target month
  const firstDay = new Date(year, targetMonth, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Monday-start offset: 0 for Mon, 1 for Tue, ..., 6 for Sun
  const mondayOffset = (firstDayOfWeek + 6) % 7;

  // Number of days in current month
  const daysInMonth = new Date(year, targetMonth + 1, 0).getDate();

  // Number of days in previous month
  const daysInPrevMonth = new Date(year, targetMonth, 0).getDate();

  const grid: CalendarDayCell[] = [];

  // 1. Preceding days from previous month
  for (let i = mondayOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthData = getPrevMonth(year, targetMonth);
    const dateObj = new Date(prevMonthData.year, prevMonthData.month, day);
    const dateString = toDateString(prevMonthData.year, prevMonthData.month, day);
    const dayOfWeek = dateObj.getDay();

    grid.push({
      date: dateObj,
      dateString,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, targetMonth, day);
    const dateString = toDateString(year, targetMonth, day);
    const dayOfWeek = dateObj.getDay();

    grid.push({
      date: dateObj,
      dateString,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  // 3. Trailing days from next month to complete the grid (multiple of 7, at least 35)
  const totalCells = Math.max(35, Math.ceil(grid.length / 7) * 7);
  const trailingDaysNeeded = totalCells - grid.length;
  const nextMonthData = getNextMonth(year, targetMonth);

  for (let day = 1; day <= trailingDaysNeeded; day++) {
    const dateObj = new Date(nextMonthData.year, nextMonthData.month, day);
    const dateString = toDateString(nextMonthData.year, nextMonthData.month, day);
    const dayOfWeek = dateObj.getDay();

    grid.push({
      date: dateObj,
      dateString,
      dayNumber: day,
      isCurrentMonth: false,
      isToday: dateString === todayString,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      dayOfWeek,
    });
  }

  return grid;
}

/**
 * Maps tasks (both SchoolTasks and their StaffTasks) to matching due dates.
 */
export function getTasksForDate(
  tasks: SchoolTask[],
  dateStr: string
): CalendarTaskItem[] {
  const items: CalendarTaskItem[] = [];
  const cleanTargetDate = dateStr.split("T")[0];

  for (const st of tasks) {
    const cleanDueDate = st.dueDate?.split("T")[0];
    if (cleanDueDate === cleanTargetDate) {
      items.push({
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

    if (st.subTasks && Array.isArray(st.subTasks)) {
      for (const sub of st.subTasks) {
        const cleanSubDue = sub.dueDate?.split("T")[0];
        if (cleanSubDue === cleanTargetDate) {
          items.push({
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
    }
  }

  return items;
}

export function getCategoryDotClass(category?: TaskCategory): string {
  switch (category) {
    case "CHUYEN_DOI_SO":
      return "bg-purple-500";
    case "TRUYEN_THONG":
      return "bg-sky-500";
    case "CNTT":
      return "bg-blue-500";
    case "ATTT":
      return "bg-red-500";
    case "THU_VIEN":
      return "bg-emerald-500";
    case "BAO_CAO":
      return "bg-amber-500";
    default:
      return "bg-zinc-400";
  }
}

export function getCategoryChipClass(category?: TaskCategory): string {
  switch (category) {
    case "CHUYEN_DOI_SO":
      return "border-purple-500/30 bg-purple-500/10 text-purple-700";
    case "TRUYEN_THONG":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700";
    case "CNTT":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700";
    case "ATTT":
      return "border-red-500/30 bg-red-500/10 text-red-700";
    case "THU_VIEN":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "BAO_CAO":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    default:
      return "border-border/60 bg-muted/60 text-muted-foreground";
  }
}

function getInitials(name: string): string {
  if (!name) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
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

export function getEventTimeBadge(item: CalendarTaskItem): string {
  const orig = item.originalTask as any;
  if (orig?.startTime && orig?.endTime) {
    return `${orig.startTime} - ${orig.endTime}`;
  }
  if (orig?.startTime) return orig.startTime;
  if (orig?.dueTime) return orig.dueTime;
  if ((item as any).dueTime) return (item as any).dueTime;
  if (item.dueDate?.includes("T")) {
    const timePart = item.dueDate.split("T")[1]?.slice(0, 5);
    if (timePart && timePart !== "00:00") {
      return timePart;
    }
  }
  return item.level === "Trường" ? "09:00 - 10:30" : "14:00 - 16:30";
}

export function getEventLocation(item: CalendarTaskItem): string {
  const orig = item.originalTask as any;
  if (orig?.location) return orig.location;
  if (orig?.room) return orig.room;
  if (orig?.venue) return orig.venue;
  if (item.level === "Trường") return "Phòng họp A";
  if (orig?.leadDepartment) return `Văn phòng ${orig.leadDepartment}`;
  return "Phòng họp A";
}

export function getEventParticipants(item: CalendarTaskItem): { host: string; participants: string } {
  const orig = item.originalTask as any;
  const host =
    orig?.host ||
    orig?.leadAssigneeName ||
    item.assigneeName ||
    "TS. Lê Doãn Cường";
  const participants =
    (orig?.attendees && orig.attendees.length > 0 ? orig.attendees.join(", ") : "") ||
    (orig?.coAssignees && orig.coAssignees.length > 0 ? orig.coAssignees.join(", ") : "") ||
    orig?.leadDepartment ||
    item.assigneeName ||
    "Ban Giám hiệu";
  return { host, participants };
}

export interface CalendarMonthViewProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: (initialDate?: string) => void;
  initialYear?: number;
  initialMonth?: number; // 0-indexed or 1-12
  selectedAcademicMonth?: number | "ALL";
  onAcademicMonthChange?: (month: number | "ALL") => void;
  initialPeriod?: AcademicMonthPeriod;
  currentPeriod?: AcademicMonthPeriod;
  onPeriodChange?: (period: AcademicMonthPeriod) => void;
  className?: string;
}

export function CalendarMonthView({
  tasks,
  onSelectTask,
  onAddTask,
  initialYear = 2026,
  initialMonth = 9, // Tháng 9 / 2026 (25/08 - 24/09)
  selectedAcademicMonth,
  onAcademicMonthChange,
  initialPeriod,
  currentPeriod: controlledPeriod,
  onPeriodChange,
  className,
}: CalendarMonthViewProps) {
  const [internalPeriod, setInternalPeriod] = React.useState<AcademicMonthPeriod>(() => {
    if (initialPeriod) return initialPeriod;
    const targetMonth =
      typeof selectedAcademicMonth === "number"
        ? selectedAcademicMonth
        : initialMonth >= 1 && initialMonth <= 12
        ? initialMonth
        : 9;
    return getAcademicMonthPeriod(targetMonth, "2026-2027");
  });

  // Sync internal period if selectedAcademicMonth, initialMonth, initialYear or initialPeriod props update
  React.useEffect(() => {
    if (initialPeriod) {
      setInternalPeriod(initialPeriod);
    } else if (typeof selectedAcademicMonth === "number") {
      setInternalPeriod(getAcademicMonthPeriod(selectedAcademicMonth, "2026-2027"));
    } else if (initialMonth) {
      const m = initialMonth >= 1 && initialMonth <= 12 ? initialMonth : 9;
      setInternalPeriod(getAcademicMonthPeriod(m, "2026-2027"));
    }
  }, [selectedAcademicMonth, initialMonth, initialPeriod]);

  const period = controlledPeriod ?? internalPeriod;

  const handlePeriodChange = React.useCallback(
    (newPeriod: AcademicMonthPeriod) => {
      if (!controlledPeriod) {
        setInternalPeriod(newPeriod);
      }
      onPeriodChange?.(newPeriod);
      onAcademicMonthChange?.(newPeriod.monthNumber);
    },
    [controlledPeriod, onPeriodChange, onAcademicMonthChange]
  );

  const [selectedDate, setSelectedDate] = React.useState<string>(getSystemReferenceDate());

  // Keep selected date focused within cycle bounds
  React.useEffect(() => {
    if (selectedDate < period.startDate || selectedDate > period.endDate) {
      const anchorToday = getSystemReferenceDate();
      if (anchorToday >= period.startDate && anchorToday <= period.endDate) {
        setSelectedDate(anchorToday);
      } else {
        setSelectedDate(period.startDate);
      }
    }
  }, [period.startDate, period.endDate, selectedDate]);
  const [activeCategory, setActiveCategory] = React.useState<TaskCategory | "ALL">("ALL");
  const [levelFilter, setLevelFilter] = React.useState<"ALL" | "TRUONG" | "DON_VI">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Month navigation handlers using getAdjacentAcademicMonth
  const handlePrevMonth = () => {
    handlePeriodChange(getAdjacentAcademicMonth(period, -1));
  };

  const handleNextMonth = () => {
    handlePeriodChange(getAdjacentAcademicMonth(period, 1));
  };

  const handleCurrentMonth = () => {
    const curPeriod = getAcademicMonthInfo(new Date());
    handlePeriodChange(curPeriod);
    setSelectedDate(getSystemReferenceDate());
  };

  // Generate calendar cells for the 25th-to-24th academic cycle
  const gridCells = React.useMemo(
    () => generateAcademicMonthGrid(period),
    [period]
  );

  const deferredSearchQuery = React.useDeferredValue(searchQuery);

  // Group all filtered tasks by date for calendar display in a single O(N) pass
  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, CalendarTaskItem[]>();
    const q = deferredSearchQuery.trim().toLowerCase();

    for (const st of tasks) {
      // 1. Process School Task
      if (levelFilter !== "DON_VI") {
        if (activeCategory === "ALL" || st.category === activeCategory) {
          const matchQuery =
            !q ||
            st.title.toLowerCase().includes(q) ||
            st.leadAssigneeName.toLowerCase().includes(q);
          if (matchQuery && st.dueDate) {
            const dateKey = st.dueDate.length > 10 ? st.dueDate.slice(0, 10) : st.dueDate;
            const item: CalendarTaskItem = {
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
            };
            const existing = map.get(dateKey);
            if (existing) existing.push(item);
            else map.set(dateKey, [item]);
          }
        }
      }

      // 2. Process Staff Tasks
      if (levelFilter !== "TRUONG" && st.subTasks) {
        for (const sub of st.subTasks) {
          if (activeCategory === "ALL" || st.category === activeCategory) {
            const matchQuery =
              !q ||
              sub.title.toLowerCase().includes(q) ||
              sub.assigneeName.toLowerCase().includes(q);
            if (matchQuery && sub.dueDate) {
              const dateKey = sub.dueDate.length > 10 ? sub.dueDate.slice(0, 10) : sub.dueDate;
              const item: CalendarTaskItem = {
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
              };
              const existing = map.get(dateKey);
              if (existing) existing.push(item);
              else map.set(dateKey, [item]);
            }
          }
        }
      }
    }

    return map;
  }, [tasks, activeCategory, levelFilter, deferredSearchQuery]);

  // Selected date tasks for side panel: instant O(1) map lookup
  const selectedDateTasks = React.useMemo(() => {
    return tasksByDate.get(selectedDate) || [];
  }, [tasksByDate, selectedDate]);

  // Count total tasks in current view
  const currentMonthTaskCount = React.useMemo(() => {
    let count = 0;
    for (const cell of gridCells) {
      if (cell.isCurrentMonth) {
        const items = tasksByDate.get(cell.dateString);
        if (items) count += items.length;
      }
    }
    return count;
  }, [gridCells, tasksByDate]);

  const calendarYear = React.useMemo(() => {
    if (period.calendarYear) return period.calendarYear;
    const parts = period.academicYear?.split("-") || ["2026", "2027"];
    return period.monthNumber >= 9 ? parseInt(parts[0], 10) : parseInt(parts[1], 10);
  }, [period]);

  const [desktopViewMode, setDesktopViewMode] = React.useState<"grid" | "agenda">("grid");

  // Grouped chronological Agenda items for the active operational month
  const monthlyAgendaGroups = React.useMemo(() => {
    const groups: Array<{
      dateString: string;
      dayHeaderVi: string;
      isToday: boolean;
      items: CalendarTaskItem[];
    }> = [];

    // Filter active current month cells in chronological order
    const monthCells = gridCells.filter((c) => c.isCurrentMonth);
    for (const cell of monthCells) {
      const dayTasks = tasksByDate.get(cell.dateString) || [];
      if (dayTasks.length > 0) {
        groups.push({
          dateString: cell.dateString,
          dayHeaderVi: formatDateVi(cell.dateString),
          isToday: cell.isToday,
          items: dayTasks,
        });
      }
    }
    return groups;
  }, [gridCells, tasksByDate]);

  const WEEK_DAYS = [
    { label: "T2", fullName: "Thứ Hai" },
    { label: "T3", fullName: "Thứ Ba" },
    { label: "T4", fullName: "Thứ Tư" },
    { label: "T5", fullName: "Thứ Năm" },
    { label: "T6", fullName: "Thứ Sáu" },
    { label: "T7", fullName: "Thứ Bảy" },
    { label: "CN", fullName: "Chủ Nhật" },
  ];

  return (
    <div
      className={cn("flex flex-col gap-6", className)}
      data-slot="twenty-calendar-view"
    >
      {/* ========================================================================= */}
      {/* 1. Header Toolbar: Month Navigation, Today, Filters, and New Task         */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-xs p-4 shadow-card">
        {/* Mobile Compact Month Selector Header: < Tháng M/YYYY > with min-44px touch targets */}
        <div className="flex sm:hidden items-center justify-between w-full rounded-xl border border-border/70 bg-card p-1 shadow-2xs">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Tháng trước"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 transition-colors cursor-pointer"
          >
            <ChevronLeft strokeWidth={1.5} className="size-5" />
          </button>
          <div className="flex flex-col items-center text-center">
            <span className="font-heading text-sm font-bold text-foreground font-mono tabular-nums tracking-tight">
              Tháng {period.monthNumber}/{calendarYear}
            </span>
            <span className="text-xs text-muted-foreground font-mono tabular-nums">
              {period.shortDateSpan}
            </span>
          </div>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Tháng sau"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary active:bg-secondary/80 transition-colors cursor-pointer"
          >
            <ChevronRight strokeWidth={1.5} className="size-5" />
          </button>
        </div>

        {/* Desktop Header: Academic Month Selector & Navigation Controls */}
        <div className="hidden sm:flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-foreground sm:text-base lg:text-lg tracking-tight">
              {formatAcademicMonthHeader(period)}
            </h2>

            <div className="flex items-center gap-1 border-l border-border/60 pl-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Tháng học trước"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer shadow-xs"
              >
                <ChevronLeft strokeWidth={1.5} className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Tháng học sau"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer shadow-xs"
              >
                <ChevronRight strokeWidth={1.5} className="size-4" />
              </button>

              <button
                type="button"
                onClick={handleCurrentMonth}
                className="inline-flex h-8 items-center rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary cursor-pointer shadow-xs"
                title="Về tháng hiện tại"
              >
                Tháng hiện tại
              </button>
            </div>

            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-xs font-semibold font-mono tabular-nums">
              {currentMonthTaskCount} hạn chót trong tháng
            </span>
          </div>

          {/* Desktop Right: View Mode Switcher, Quick Search & + Giao việc */}
          <div className="flex items-center gap-2">
            {/* Desktop View Mode Toggle */}
            <div className="hidden sm:inline-flex items-center rounded-xl border border-border/70 bg-card p-0.5 shadow-2xs">
              <button
                type="button"
                onClick={() => setDesktopViewMode("grid")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  desktopViewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Lưới tháng
              </button>
              <button
                type="button"
                onClick={() => setDesktopViewMode("agenda")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer",
                  desktopViewMode === "agenda"
                    ? "bg-primary text-primary-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                Nghị sự
              </button>
            </div>

            <div className="relative min-w-[200px] max-w-xs">
              <Search
                strokeWidth={1.5}
                className="size-3.5 text-muted-foreground pointer-events-none absolute left-3 top-2.5"
              />
              <input
                type="text"
                placeholder="Lọc lịch công tác..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-8.5 pl-9 pr-3 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
            </div>

            <Button
              type="button"
              onClick={() => onAddTask?.(selectedDate)}
              className="h-8.5 gap-1.5 px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-card hover:shadow-card-hover transition-all cursor-pointer rounded-lg"
            >
              <Plus strokeWidth={1.5} className="size-3.5" />
              <span>Giao việc</span>
            </Button>
          </div>
        </div>

        {/* Mobile Search & Add Task */}
        <div className="flex sm:hidden items-center gap-2">
          <div className="relative flex-1">
            <Search
              strokeWidth={1.5}
              className="size-4 text-muted-foreground pointer-events-none absolute left-3 top-1/2 -translate-y-1/2"
            />
            <input
              type="text"
              placeholder="Lọc lịch công tác..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full min-h-[44px] pl-9 pr-3 rounded-xl border border-border/70 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <Button
            type="button"
            onClick={() => onAddTask?.(selectedDate)}
            className="min-h-[44px] px-3.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-card hover:shadow-card-hover transition-all cursor-pointer rounded-xl shrink-0"
          >
            <Plus strokeWidth={1.5} className="size-4 mr-1" />
            <span>Giao việc</span>
          </Button>
        </div>

        {/* Category & Level Sub-filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2.5 border-t border-border/50">
          {/* Category Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
            {CATEGORY_TABS.map((tab) => {
              const isActive = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={cn(
                    "whitespace-nowrap rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer",
                    isActive
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Level Switcher */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setLevelFilter("ALL")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                levelFilter === "ALL"
                  ? "bg-secondary text-foreground font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Tất cả
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("TRUONG")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                levelFilter === "TRUONG"
                  ? "bg-blue-50 text-blue-700 font-semibold border border-blue-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 strokeWidth={1.5} className="size-3" />
              <span>Cấp Trường</span>
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("DON_VI")}
              className={cn(
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer",
                levelFilter === "DON_VI"
                  ? "bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Briefcase strokeWidth={1.5} className="size-3" />
              <span>Đơn vị</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Mobile Agenda Feed: Replaces 7-column month grid on < 640px            */}
      {/* ========================================================================= */}
      <div className="block sm:hidden space-y-4" data-slot="mobile-agenda-feed">
        {monthlyAgendaGroups.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/70 p-6 text-center bg-card/60 space-y-3">
            <CalendarIcon strokeWidth={1.5} className="size-8 mx-auto text-muted-foreground/40" />
            <div className="space-y-1">
              <p className="text-sm font-bold text-foreground">Không có sự kiện hoặc nhiệm vụ</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Không có nhiệm vụ nào đến hạn trong chu kỳ Tháng {period.monthNumber}/{calendarYear}.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => onAddTask?.(selectedDate)}
              className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-1.5"
            >
              <Plus strokeWidth={1.5} className="size-4" />
              <span>Giao việc mới</span>
            </Button>
          </div>
        ) : (
          monthlyAgendaGroups.map((group) => (
            <div
              key={group.dateString}
              className={cn(
                "rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all",
                group.isToday && "border-primary/50 ring-1 ring-primary/20"
              )}
            >
              {/* Day Header: e.g. "Thứ Tư, 09/09/2026" */}
              <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold text-foreground font-mono tabular-nums">
                    {group.dayHeaderVi}
                  </h3>
                  {group.isToday && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground font-mono tabular-nums uppercase">
                      Hôm nay
                    </span>
                  )}
                </div>
                <span className="text-xs font-medium text-muted-foreground font-mono tabular-nums">
                  {group.items.length} sự kiện
                </span>
              </div>

              {/* Group Event Items */}
              <div className="divide-y divide-border/40">
                {group.items.map((item) => {
                  const timeBadge = getEventTimeBadge(item);
                  const location = getEventLocation(item);
                  const { host, participants } = getEventParticipants(item);
                  const dotClass = getStatusDotClass(item.status, item.dueDate);
                  const isDone = item.status === "COMPLETED";

                  return (
                    <div
                      key={item.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => onSelectTask?.(item.originalTask)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          onSelectTask?.(item.originalTask);
                        }
                      }}
                      className={cn(
                        "min-h-[48px] p-3.5 flex flex-col gap-2 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer text-left",
                        isDone && "opacity-60 bg-muted/10"
                      )}
                      data-slot="mobile-agenda-event"
                      aria-label={`Xem chi tiết sự kiện ${item.title}`}
                    >
                      {/* Row 1: Time badge + Level/Status badges */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold tabular-nums bg-primary/10 text-primary border border-primary/20">
                            <Clock strokeWidth={1.5} className="size-3" />
                            <span>{timeBadge}</span>
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold border",
                              item.level === "Trường"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-indigo-50 text-indigo-700 border-indigo-200"
                            )}
                          >
                            {item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                          <span className={cn("size-2 rounded-full", dotClass)} />
                          <span>{getStatusLabel(item.status, item.dueDate)}</span>
                        </div>
                      </div>

                      {/* Row 2: Event Title */}
                      <h4 className={cn("text-xs font-bold text-foreground leading-snug", isDone && "line-through text-muted-foreground")}>
                        {item.title}
                      </h4>

                      {/* Row 3: Location/Room & Host/Participants */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground pt-0.5">
                        <div className="flex items-center gap-1 truncate text-foreground/80">
                          <Building2 strokeWidth={1.5} className="size-3 shrink-0 text-muted-foreground" />
                          <span className="truncate">{location}</span>
                        </div>

                        <div className="flex items-center gap-1 truncate">
                          <span className="text-muted-foreground">Chủ trì:</span>
                          <span className="font-medium text-foreground truncate">{host}</span>
                          {participants && participants !== host && (
                            <span className="text-muted-foreground/70 truncate hidden xs:inline">
                              • {participants}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      {/* ========================================================================= */}
      {/* 3. Desktop Main Body: 7-Column Calendar Grid + Selected Date Side Panel    */}
      {/* ========================================================================= */}
      {desktopViewMode === "grid" ? (
        <div className="hidden sm:grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Left Column: Rounded-2xl Container with Month Grid & Subtle Borders */}
        <div className="lg:col-span-8 flex flex-col rounded-2xl border border-border/40 bg-card shadow-card overflow-hidden transition-all">
          {/* Weekday Header (T2 - CN) */}
          <div className="grid grid-cols-7 border-b border-border/40 bg-muted/40 text-center">
            {WEEK_DAYS.map((w, idx) => (
              <div
                key={w.label}
                className={cn(
                  "py-2.5 text-xs font-semibold text-muted-foreground border-r border-border/40 last:border-r-0",
                  idx >= 5 && "text-muted-foreground/70 bg-muted/20"
                )}
                title={w.fullName}
              >
                {w.label}
              </div>
            ))}
          </div>

          {/* Days Grid with subtle border-border/40 */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/40">
            {gridCells.map((cell) => {
              const dayTasks = tasksByDate.get(cell.dateString) || [];
              const isSelected = selectedDate === cell.dateString;
              const maxDisplay = 3;
              const hasMore = dayTasks.length > maxDisplay;
              const displayedTasks = dayTasks.slice(0, maxDisplay);

              return (
                <div
                  key={cell.dateString}
                  tabIndex={0}
                  onClick={() => setSelectedDate(cell.dateString)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelectedDate(cell.dateString);
                    }
                  }}
                  className={cn(
                    "group relative min-h-[108px] p-2 transition-all cursor-pointer flex flex-col focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring",
                    !cell.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                    cell.isCurrentMonth && "bg-card hover:bg-muted/30",
                    cell.isWeekend && cell.isCurrentMonth && "bg-muted/[0.04]",
                    cell.isToday && "bg-primary/[0.04] font-medium border-primary/30",
                    isSelected &&
                      "ring-1.5 ring-primary ring-inset bg-primary/[0.06] z-10 shadow-xs"
                  )}
                  data-date={cell.dateString}
                  aria-label={`${cell.dateString}: ${dayTasks.length} nhiệm vụ`}
                >
                  {/* Top Day Header: Task count badge (left) + Day number (top right) */}
                  <div className="flex items-center justify-between mb-1.5">
                    {dayTasks.length > 0 ? (
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-xs font-mono font-medium tabular-nums bg-secondary/80 text-muted-foreground border border-border/40">
                        {dayTasks.length}
                      </span>
                    ) : (
                      <span />
                    )}

                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums transition-colors",
                        cell.isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : cell.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40",
                        isSelected && !cell.isToday && "font-bold text-primary"
                      )}
                    >
                      {cell.dayNumber}
                    </span>
                  </div>

                  {/* Event Pills List with 6px Status Dots & Subtle Styling */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {displayedTasks.map((item) => {
                      const dotClass = getStatusDotClass(item.status, item.dueDate);
                      const statusLabel = getStatusLabel(item.status, item.dueDate);
                      const isDone = item.status === "COMPLETED";

                      return (
                        <div
                          key={item.id}
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask?.(item.originalTask);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              onSelectTask?.(item.originalTask);
                            }
                          }}
                          className={cn(
                            "flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-xs font-medium transition-colors border truncate cursor-pointer shadow-2xs",
                            item.level === "Trường"
                              ? "bg-background/90 border-border/70 text-foreground hover:border-primary/50 hover:bg-accent"
                              : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent",
                            isDone && "opacity-60 line-through bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                          )}
                          title={`${item.level === "Trường" ? "[Cấp Trường]" : "[Đơn vị]"} ${item.title} • Phụ trách: ${item.assigneeName} • Hạn: ${item.dueDate.split("T")[0]} • Trạng thái: ${statusLabel}`}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full ring-1 ring-background/80",
                              dotClass
                            )}
                          />
                          <span className="truncate font-sans text-xs leading-tight">
                            {item.title}
                          </span>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedDate(cell.dateString);
                        }}
                        className="w-full text-center py-0.5 rounded text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                        title="Nhấn để xem toàn bộ danh sách nhiệm vụ của ngày này"
                      >
                        +{dayTasks.length - maxDisplay} nhiệm vụ
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bottom Legend with status dots and concise Vietnamese labels */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border/40 bg-muted/20 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 font-medium text-foreground">
              <span>Trạng thái:</span>
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-emerald-500 ring-1 ring-background" />
                <span>Hoàn thành</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-blue-500 ring-1 ring-background" />
                <span>Đang thực hiện</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-amber-500 ring-1 ring-background" />
                <span>Chờ thực hiện</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-rose-500 ring-1 ring-background" />
                <span>Quá hạn / Chậm tiến độ</span>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-muted-foreground/80 font-mono text-xs tabular-nums">
              <span>Hôm nay: 04/09/2026</span>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Date Detail Panel */}
        <div className="lg:col-span-4 flex flex-col rounded-2xl border border-border/60 bg-card p-5 shadow-card space-y-4">
          {/* Date Header */}
          <div className="flex items-start justify-between border-b border-border/70 pb-3.5">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-primary font-semibold mb-0.5">
                <CalendarIcon strokeWidth={1.5} className="size-3.5" />
                <span>Chi tiết lịch công tác</span>
              </div>
              <h3 className="text-sm font-bold text-foreground">
                {formatDateVi(selectedDate)}
              </h3>
            </div>

            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => onAddTask?.(selectedDate)}
              className="h-7.5 text-xs gap-1 border-dashed px-2.5 rounded-lg font-semibold cursor-pointer"
            >
              <Plus strokeWidth={1.5} className="size-3" />
              Thêm việc
            </Button>
          </div>

          {/* Task count summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Tổng số nhiệm vụ hạn chót:{" "}
              <strong className="text-foreground font-semibold font-mono tabular-nums">
                {selectedDateTasks.length}
              </strong>
            </span>
          </div>

          {/* Task List on Selected Date */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[520px] thin-scrollbar pr-0.5">
            {selectedDateTasks.length === 0 ? (
              <div className="py-14 text-center text-xs text-muted-foreground space-y-2 border border-dashed border-border/70 rounded-xl p-5 bg-muted/10">
                <CalendarIcon strokeWidth={1.5} className="mx-auto size-8 text-muted-foreground/30 mb-1" />
                <p className="font-semibold text-foreground">
                  Không có hạn chót công việc
                </p>
                <p className="text-xs leading-relaxed">
                  Không có nhiệm vụ nào đến hạn vào ngày này. Nhấn &ldquo;Thêm việc&rdquo; để phân công nhiệm vụ mới.
                </p>
              </div>
            ) : (
              selectedDateTasks.map((item) => {
                const isSchool = item.level === "Trường";
                const catConfig = getCategoryBadgeConfig(item.category || "KHAC");
                const statusConfig = getStatusBadgeConfig(item.status);

                return (
                  <div
                    key={item.id}
                    tabIndex={0}
                    onClick={() => onSelectTask?.(item.originalTask)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectTask?.(item.originalTask);
                      }
                    }}
                    className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-card cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
                    role="button"
                    aria-label={`Xem chi tiết ${item.title}`}
                  >
                    {/* Top row: Level Badge + Category + Status */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
                            isSchool
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}
                        >
                          {isSchool ? "Cấp Trường" : "Đơn vị"}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs px-1.5 py-0 h-4.5 font-medium rounded-md",
                            catConfig.className
                          )}
                        >
                          {catConfig.label}
                        </Badge>
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          "text-xs px-1.5 py-0 h-4.5 font-semibold rounded-md",
                          statusConfig.className
                        )}
                      >
                        {statusConfig.label}
                      </Badge>
                    </div>

                    {/* Task Title */}
                    <h4 className="text-xs font-semibold text-foreground leading-snug group-hover:text-primary transition-colors">
                      {item.title}
                    </h4>

                    {/* Parent task if Subtask */}
                    {!isSchool && item.parentSchoolTaskTitle && (
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Layers strokeWidth={1.5} className="size-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">Thuộc: {item.parentSchoolTaskTitle}</span>
                      </div>
                    )}

                    {/* Footer: Assignee avatar & name */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-xs">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {item.assigneeAvatar ? (
                          <img
                            src={item.assigneeAvatar}
                            alt={item.assigneeName}
                            className="size-4.5 rounded-full object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-secondary-foreground border border-border">
                            {getInitials(item.assigneeName)}
                          </span>
                        )}
                        <span className="font-medium text-foreground">
                          {item.assigneeName}
                        </span>
                      </div>

                      <span className="text-muted-foreground text-xs font-mono tabular-nums">
                        Hạn: {item.dueDate.split("T")[0]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
      ) : (
        /* Desktop Agenda View */
        <div className="hidden sm:block space-y-4">
          {monthlyAgendaGroups.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center bg-card/60 space-y-3">
              <CalendarIcon strokeWidth={1.5} className="size-10 mx-auto text-muted-foreground/40" />
              <div className="space-y-1">
                <p className="text-base font-bold text-foreground">Không có sự kiện hoặc nhiệm vụ</p>
                <p className="text-xs text-muted-foreground leading-relaxed max-w-md mx-auto">
                  Không có nhiệm vụ nào đến hạn trong chu kỳ Tháng {period.monthNumber}/{calendarYear}.
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => onAddTask?.(selectedDate)}
                className="min-h-[44px] px-4 rounded-xl text-xs font-semibold gap-1.5"
              >
                <Plus strokeWidth={1.5} className="size-4" />
                <span>Giao việc mới</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {monthlyAgendaGroups.map((group) => (
                <div
                  key={group.dateString}
                  className={cn(
                    "rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all flex flex-col",
                    group.isToday && "border-primary/50 ring-1 ring-primary/20"
                  )}
                >
                  <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs font-bold text-foreground font-mono tabular-nums">
                        {group.dayHeaderVi}
                      </h3>
                      {group.isToday && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground font-mono tabular-nums uppercase">
                          Hôm nay
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-medium text-muted-foreground font-mono tabular-nums">
                      {group.items.length} sự kiện
                    </span>
                  </div>

                  <div className="divide-y divide-border/40 flex-1">
                    {group.items.map((item) => {
                      const timeBadge = getEventTimeBadge(item);
                      const location = getEventLocation(item);
                      const { host, participants } = getEventParticipants(item);
                      const dotClass = getStatusDotClass(item.status, item.dueDate);
                      const isDone = item.status === "COMPLETED";

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectTask?.(item.originalTask)}
                          className={cn(
                            "min-h-[48px] p-3.5 flex flex-col gap-2 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer text-left",
                            isDone && "opacity-60 bg-muted/10"
                          )}
                          aria-label={`Xem chi tiết sự kiện ${item.title}`}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-mono font-semibold tabular-nums bg-primary/10 text-primary border border-primary/20">
                                <Clock strokeWidth={1.5} className="size-3" />
                                <span>{timeBadge}</span>
                              </span>
                              <span
                                className={cn(
                                  "inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-semibold border",
                                  item.level === "Trường"
                                    ? "bg-blue-50 text-blue-700 border-blue-200"
                                    : "bg-indigo-50 text-indigo-700 border-indigo-200"
                                )}
                              >
                                {item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                              <span className={cn("size-2 rounded-full", dotClass)} />
                              <span>{getStatusLabel(item.status, item.dueDate)}</span>
                            </div>
                          </div>

                          <h4 className={cn("text-xs font-bold text-foreground leading-snug", isDone && "line-through text-muted-foreground")}>
                            {item.title}
                          </h4>

                          <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground pt-0.5">
                            <div className="flex items-center gap-1 truncate text-foreground/80">
                              <Building2 strokeWidth={1.5} className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{location}</span>
                            </div>

                            <div className="flex items-center gap-1 truncate">
                              <span className="text-muted-foreground">Chủ trì:</span>
                              <span className="font-medium text-foreground truncate">{host}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default CalendarMonthView;
