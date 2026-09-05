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
} from "@/components/dashboard/cascading-task-table";

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
  status: TaskStatus | "IN_PROGRESS" | "COMPLETED";
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
  status: TaskStatus | "IN_PROGRESS" | "COMPLETED",
  dueDate?: string
): string {
  if (status === "COMPLETED") {
    return "bg-emerald-500";
  }

  // Anchor date for system demo is 2026-09-04
  if (dueDate) {
    const cleanDue = dueDate.split("T")[0];
    if (cleanDue < "2026-09-04") {
      return "bg-rose-500";
    }
  }

  if (status === "IN_PROGRESS") {
    return "bg-blue-500";
  }

  if (status === "NEEDS_REVIEW") {
    return "bg-amber-500";
  }

  return "bg-amber-500";
}

/**
 * Returns concise Vietnamese status label without emojis.
 */
export function getStatusLabel(
  status: TaskStatus | "IN_PROGRESS" | "COMPLETED",
  dueDate?: string
): string {
  if (status === "COMPLETED") return "Đã hoàn thành";
  if (dueDate && dueDate.split("T")[0] < "2026-09-04") return "Quá hạn";
  if (status === "IN_PROGRESS") return "Đang thực hiện";
  if (status === "NEEDS_REVIEW") return "Chờ xét duyệt";
  return "Chờ thực hiện";
}

/**
 * Generates calendar day cells for a month starting on Monday (T2) and ending on Sunday (CN).
 * Guarantees a grid length of 35 or 42 (5 or 6 complete 7-day weeks).
 */
export function generateMonthGrid(
  year: number,
  month: number
): CalendarDayCell[] {
  const today = new Date();
  const todayString = toDateString(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  // 1st day of target month
  const firstDay = new Date(year, month, 1);
  const firstDayOfWeek = firstDay.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat

  // Monday-start offset: 0 for Mon, 1 for Tue, ..., 6 for Sun
  const mondayOffset = (firstDayOfWeek + 6) % 7;

  // Number of days in current month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Number of days in previous month
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const grid: CalendarDayCell[] = [];

  // 1. Preceding days from previous month
  for (let i = mondayOffset - 1; i >= 0; i--) {
    const day = daysInPrevMonth - i;
    const prevMonthData = getPrevMonth(year, month);
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
    const dateObj = new Date(year, month, day);
    const dateString = toDateString(year, month, day);
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
  const nextMonthData = getNextMonth(year, month);

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
      return "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300";
    case "TRUYEN_THONG":
      return "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300";
    case "CNTT":
      return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
    case "ATTT":
      return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
    case "THU_VIEN":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
    case "BAO_CAO":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
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

export interface CalendarMonthViewProps {
  tasks: SchoolTask[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTask?: (initialDate?: string) => void;
  initialYear?: number;
  initialMonth?: number; // 0-indexed
  className?: string;
}

export function CalendarMonthView({
  tasks,
  onSelectTask,
  onAddTask,
  initialYear = 2026,
  initialMonth = 8, // September 2026
  className,
}: CalendarMonthViewProps) {
  const [currentYear, setCurrentYear] = React.useState(initialYear);
  const [currentMonth, setCurrentMonth] = React.useState(initialMonth);
  const [selectedDate, setSelectedDate] = React.useState<string>("2026-09-04");
  const [activeCategory, setActiveCategory] = React.useState<TaskCategory | "ALL">("ALL");
  const [levelFilter, setLevelFilter] = React.useState<"ALL" | "TRUONG" | "DON_VI">("ALL");
  const [searchQuery, setSearchQuery] = React.useState("");

  // Month navigation handlers
  const handlePrevMonth = () => {
    const prev = getPrevMonth(currentYear, currentMonth);
    setCurrentYear(prev.year);
    setCurrentMonth(prev.month);
  };

  const handleNextMonth = () => {
    const next = getNextMonth(currentYear, currentMonth);
    setCurrentYear(next.year);
    setCurrentMonth(next.month);
  };

  const handleToday = () => {
    setCurrentYear(2026);
    setCurrentMonth(8);
    setSelectedDate("2026-09-04");
  };

  // Generate calendar cells
  const gridCells = React.useMemo(
    () => generateMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
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
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Left: Month Selector & Navigation Controls */}
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-foreground sm:text-lg tracking-tight">
              {formatMonthYearVi(currentYear, currentMonth)}
            </h2>

            <div className="flex items-center gap-1 border-l border-border/60 pl-2">
              <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Tháng trước"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer shadow-xs"
              >
                <ChevronLeft strokeWidth={1.5} className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Tháng sau"
                className="inline-flex size-8 items-center justify-center rounded-lg border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer shadow-xs"
              >
                <ChevronRight strokeWidth={1.5} className="size-4" />
              </button>

              <button
                type="button"
                onClick={handleToday}
                className="inline-flex h-8 items-center rounded-lg border border-border/70 bg-background px-3 text-xs font-semibold text-foreground transition-colors hover:bg-secondary cursor-pointer shadow-xs"
              >
                Hôm nay
              </button>
            </div>

            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary border border-primary/20 px-2.5 py-0.5 text-[11px] font-semibold font-mono tabular-nums">
              {currentMonthTaskCount} hạn chót trong tháng
            </span>
          </div>

          {/* Right: Quick Search & + Giao việc */}
          <div className="flex items-center gap-2">
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
                    "whitespace-nowrap rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer",
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
                "px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
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
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "TRUONG"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800"
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
                "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "DON_VI"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold border border-indigo-200 dark:border-indigo-800"
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
      {/* 2. Main Body: 7-Column Calendar Grid + Selected Date Side Panel           */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
                    "group relative min-h-[108px] p-2 transition-all cursor-pointer flex flex-col focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
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
                      <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[10px] font-mono font-medium tabular-nums bg-secondary/80 text-muted-foreground border border-border/40">
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
                            "flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-[10px] font-medium transition-colors border truncate cursor-pointer shadow-2xs",
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
                          <span className="truncate font-sans text-[10px] leading-tight">
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
                        className="w-full text-center py-0.5 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
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
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border/40 bg-muted/20 text-[11px] text-muted-foreground">
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
            <div className="hidden sm:flex items-center gap-3 text-muted-foreground/80 font-mono text-[10px] tabular-nums">
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
                <p className="text-[11px] leading-relaxed">
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
                    className="group flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 transition-all hover:border-primary/40 hover:shadow-card cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring active:scale-[0.99]"
                    role="button"
                    aria-label={`Xem chi tiết ${item.title}`}
                  >
                    {/* Top row: Level Badge + Category + Status */}
                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border",
                            isSchool
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800"
                          )}
                        >
                          {isSchool ? "Cấp Trường" : "Đơn vị"}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4.5 font-medium rounded-md",
                            catConfig.className
                          )}
                        >
                          {catConfig.label}
                        </Badge>
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4.5 font-semibold rounded-md",
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
                      <div className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <Layers strokeWidth={1.5} className="size-3 text-muted-foreground/70 shrink-0" />
                        <span className="truncate">Thuộc: {item.parentSchoolTaskTitle}</span>
                      </div>
                    )}

                    {/* Footer: Assignee avatar & name */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/50 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {item.assigneeAvatar ? (
                          <img
                            src={item.assigneeAvatar}
                            alt={item.assigneeName}
                            className="size-4.5 rounded-full object-cover shrink-0 border border-border"
                          />
                        ) : (
                          <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-secondary-foreground border border-border">
                            {getInitials(item.assigneeName)}
                          </span>
                        )}
                        <span className="font-medium text-foreground">
                          {item.assigneeName}
                        </span>
                      </div>

                      <span className="text-muted-foreground text-[10px] font-mono tabular-nums">
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
    </div>
  );
}

export default CalendarMonthView;
