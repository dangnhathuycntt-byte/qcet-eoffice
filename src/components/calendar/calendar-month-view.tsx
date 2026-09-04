"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  User,
  Plus,
  Building2,
  Briefcase,
  CheckCircle2,
  AlertCircle,
  Layers,
  Search,
  Filter,
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
    const now = new Date();
    // Default to Sept 2026 if current mock context or live today
    setCurrentYear(2026);
    setCurrentMonth(8);
    setSelectedDate("2026-09-04");
  };

  // Generate calendar cells
  const gridCells = React.useMemo(
    () => generateMonthGrid(currentYear, currentMonth),
    [currentYear, currentMonth]
  );

  // Group all filtered tasks by date for calendar display
  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, CalendarTaskItem[]>();

    // First collect all tasks
    for (const cell of gridCells) {
      let items = getTasksForDate(tasks, cell.dateString);

      // Apply category filter
      if (activeCategory !== "ALL") {
        items = items.filter((item) => item.category === activeCategory);
      }

      // Apply level filter
      if (levelFilter === "TRUONG") {
        items = items.filter((item) => item.level === "Trường");
      } else if (levelFilter === "DON_VI") {
        items = items.filter((item) => item.level === "Đơn vị");
      }

      // Apply search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        items = items.filter(
          (item) =>
            item.title.toLowerCase().includes(q) ||
            item.assigneeName.toLowerCase().includes(q)
        );
      }

      if (items.length > 0) {
        map.set(cell.dateString, items);
      }
    }

    return map;
  }, [tasks, gridCells, activeCategory, levelFilter, searchQuery]);

  // Selected date tasks for side panel
  const selectedDateTasks = React.useMemo(() => {
    let items = getTasksForDate(tasks, selectedDate);
    if (activeCategory !== "ALL") {
      items = items.filter((item) => item.category === activeCategory);
    }
    if (levelFilter === "TRUONG") {
      items = items.filter((item) => item.level === "Trường");
    } else if (levelFilter === "DON_VI") {
      items = items.filter((item) => item.level === "Đơn vị");
    }
    return items;
  }, [tasks, selectedDate, activeCategory, levelFilter]);

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
      className={cn("flex flex-col gap-5", className)}
      data-slot="twenty-calendar-view"
    >
      {/* ========================================================================= */}
      {/* 1. Header Toolbar: Month Navigation, Today, Filters, and New Task         */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-lg border border-border/80 bg-card p-3.5 shadow-2xs">
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
                className="inline-flex size-7.5 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Tháng sau"
                className="inline-flex size-7.5 items-center justify-center rounded-md border border-border/70 bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <ChevronRight className="size-4" />
              </button>

              <button
                type="button"
                onClick={handleToday}
                className="inline-flex h-7.5 items-center rounded-md border border-border/70 bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-secondary cursor-pointer"
              >
                Hôm nay
              </button>
            </div>

            <span className="hidden md:inline-flex items-center gap-1 rounded-full bg-secondary/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {currentMonthTaskCount} hạn chót trong tháng
            </span>
          </div>

          {/* Right: Quick Search & + Giao việc */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-[180px] max-w-xs">
              <Search className="size-3.5 text-muted-foreground pointer-events-none absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Lọc lịch công tác..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-7.5 pl-8 pr-2.5 rounded-md border border-border/80 bg-background text-xs text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <Button
              type="button"
              onClick={() => onAddTask?.(selectedDate)}
              className="h-7.5 gap-1 px-3 text-xs font-semibold bg-[#18181B] text-white hover:bg-[#27272A] dark:bg-[#FAFAFA] dark:text-[#18181B] dark:hover:bg-[#E4E4E7] shadow-2xs cursor-pointer"
            >
              <Plus className="size-3.5" />
              <span>Giao việc</span>
            </Button>
          </div>
        </div>

        {/* Category & Level Sub-filters */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
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
                    "whitespace-nowrap rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors cursor-pointer",
                    isActive
                      ? "bg-secondary text-foreground font-semibold border border-border/70"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
                "px-2 py-0.5 rounded text-[11px] font-medium transition-colors",
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
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "TRUONG"
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Building2 className="size-3" />
              <span>Cấp Trường</span>
            </button>
            <button
              type="button"
              onClick={() => setLevelFilter("DON_VI")}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors cursor-pointer",
                levelFilter === "DON_VI"
                  ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Briefcase className="size-3" />
              <span>Đơn vị</span>
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. Main 2-Column Grid: 8 Cols (Calendar Grid) & 4 Cols (Selected Day Panel) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Left Column (8 cols on desktop): 7-Column Calendar Grid */}
        <div className="lg:col-span-8 flex flex-col rounded-xl border border-border/75 bg-card shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] overflow-hidden">
          {/* Weekday Header (T2 - CN) */}
          <div className="grid grid-cols-7 border-b border-border/80 bg-muted/30 text-center">
            {WEEK_DAYS.map((w, idx) => (
              <div
                key={w.label}
                className={cn(
                  "py-2 text-xs font-semibold text-muted-foreground border-r border-border/40 last:border-r-0",
                  idx >= 5 && "text-muted-foreground/70 bg-muted/20"
                )}
                title={w.fullName}
              >
                {w.label}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 divide-x divide-y divide-border/60">
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
                    "group relative min-h-[96px] p-1.5 transition-all cursor-pointer flex flex-col focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring",
                    !cell.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                    cell.isCurrentMonth && "bg-card hover:bg-secondary/30",
                    cell.isWeekend && cell.isCurrentMonth && "bg-muted/10",
                    isSelected &&
                      "ring-2 ring-primary/80 ring-inset bg-secondary/50 font-medium z-10 shadow-2xs"
                  )}
                  data-date={cell.dateString}
                  aria-label={`${cell.dateString}: ${dayTasks.length} nhiệm vụ`}
                >
                  {/* Top Day Header: Day number + Today pill + Task count badge */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={cn(
                        "inline-flex size-5.5 items-center justify-center rounded-full text-xs font-medium",
                        cell.isToday
                          ? "bg-primary text-primary-foreground font-bold shadow-xs"
                          : cell.isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                        isSelected && !cell.isToday && "font-bold text-foreground"
                      )}
                    >
                      {cell.dayNumber}
                    </span>

                    {dayTasks.length > 0 && (
                      <span className="text-[10px] font-mono text-muted-foreground/70 font-semibold">
                        {dayTasks.length}
                      </span>
                    )}
                  </div>

                  {/* Event Chips List */}
                  <div className="flex-1 space-y-1 overflow-hidden">
                    {displayedTasks.map((item) => {
                      const dotClass = getCategoryDotClass(item.category);
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
                            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors border truncate cursor-pointer",
                            item.level === "Trường"
                              ? "bg-background/95 border-border/90 text-foreground hover:border-primary/50 shadow-2xs"
                              : "bg-muted/50 border-border/60 text-muted-foreground hover:text-foreground",
                            isDone && "opacity-60 line-through"
                          )}
                          title={`${item.level === "Trường" ? "[Cấp Trường]" : "[Đơn vị]"} ${item.title} (${item.assigneeName})`}
                        >
                          <span
                            className={cn(
                              "size-1.5 shrink-0 rounded-full",
                              dotClass
                            )}
                          />
                          <span className="truncate">
                            {item.title}
                          </span>
                        </div>
                      );
                    })}

                    {hasMore && (
                      <div className="pt-0.5 text-center text-[10px] font-medium text-muted-foreground hover:text-foreground">
                        +{dayTasks.length - maxDisplay} việc nữa
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column (4 cols on desktop): Selected Date Detail Panel */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-border/75 bg-card p-4.5 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.03)] space-y-4">
          {/* Date Header */}
          <div className="flex items-start justify-between border-b border-border/70 pb-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-medium mb-0.5">
                <CalendarIcon className="size-3.5 text-primary" />
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
              className="h-7 text-xs gap-1 border-dashed px-2"
            >
              <Plus className="size-3" />
              Thêm việc
            </Button>
          </div>

          {/* Task count summary */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              Tổng số nhiệm vụ hạn chót:{" "}
              <strong className="text-foreground font-semibold">
                {selectedDateTasks.length}
              </strong>
            </span>
          </div>

          {/* Task List on Selected Date */}
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[500px] pr-0.5">
            {selectedDateTasks.length === 0 ? (
              <div className="py-12 text-center text-xs text-muted-foreground space-y-1.5 border border-dashed border-border/70 rounded-lg p-4 bg-muted/10">
                <CalendarIcon className="mx-auto size-7 text-muted-foreground/40 mb-1" />
                <p className="font-semibold text-foreground">
                  Không có hạn chót công việc
                </p>
                <p className="text-[11px]">
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
                    className="group flex flex-col gap-2 rounded-lg border border-border/80 bg-background p-3 transition-all hover:border-border hover:shadow-2xs hover:bg-secondary/20 cursor-pointer focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring"
                    role="button"
                    aria-label={`Xem chi tiết ${item.title}`}
                  >
                    {/* Top row: Level Badge + Category + Status */}
                    <div className="flex items-center justify-between gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold border",
                            isSchool
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : "bg-muted text-muted-foreground border-border"
                          )}
                        >
                          {isSchool ? "Cấp Trường" : "Đơn vị"}
                        </span>

                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0 h-4.5 font-medium",
                            catConfig.className
                          )}
                        >
                          {catConfig.label}
                        </Badge>
                      </div>

                      <Badge
                        variant={statusConfig.variant}
                        className={cn(
                          "text-[10px] px-1.5 py-0 h-4.5 font-medium",
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
                      <div className="text-[11px] text-muted-foreground truncate">
                        Thuộc: {item.parentSchoolTaskTitle}
                      </div>
                    )}

                    {/* Footer: Assignee avatar & name */}
                    <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {item.assigneeAvatar ? (
                          <img
                            src={item.assigneeAvatar}
                            alt={item.assigneeName}
                            className="size-4 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-secondary text-[8px] font-bold text-secondary-foreground border border-border">
                            {getInitials(item.assigneeName)}
                          </span>
                        )}
                        <span className="font-medium text-foreground/80">
                          {item.assigneeName}
                        </span>
                      </div>

                      <span className="text-muted-foreground text-[10px] font-mono">
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
