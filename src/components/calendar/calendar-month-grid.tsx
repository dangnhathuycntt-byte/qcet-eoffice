"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  Clock,
  Building2,
  Briefcase,
  User,
  Layers,
  MapPin,
  CheckCircle2,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskCategory, TaskStatus } from "@/types/dashboard";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  type AcademicMonthPeriod,
  type CalendarDayCell,
  generateAcademicMonthGrid,
  getSystemReferenceDate,
} from "@/lib/academic-calendar";
import { type DayTaskItem } from "./calendar-day-sheet";

export type CalendarScope = "school" | "unit" | "my";

export interface CalendarMonthGridProps {
  period: AcademicMonthPeriod;
  tasks: SchoolTask[];
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

/**
 * Returns 6px status dot color class:
 * - Emerald: Completed
 * - Rose: Overdue
 * - Blue: In Progress
 * - Amber: Waiting / Review
 */
function getStatusDotClass(status: string, dueDate?: string): string {
  if (status === "COMPLETED") return "bg-emerald-500";
  const refDate = getSystemReferenceDate();
  if (dueDate && dueDate.split("T")[0] < refDate && status !== "COMPLETED") {
    return "bg-rose-500";
  }
  if (status === "IN_PROGRESS") return "bg-blue-500";
  return "bg-amber-500";
}

function getStatusLabel(status: string, dueDate?: string): string {
  if (status === "COMPLETED") return "Đã hoàn thành";
  const refDate = getSystemReferenceDate();
  if (dueDate && dueDate.split("T")[0] < refDate) return "Quá hạn";
  if (status === "IN_PROGRESS") return "Đang thực hiện";
  if (status === "NEEDS_REVIEW" || status === "WAITING_APPROVAL") return "Chờ xét duyệt";
  return "Chờ thực hiện";
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
  // Generate calendar grid cells for academic operational period
  const gridCells = React.useMemo(() => {
    return generateAcademicMonthGrid(period);
  }, [period]);

  const deferredQuery = React.useDeferredValue(searchQuery.trim().toLowerCase());

  // Index and filter tasks by date key in a single pass
  const tasksByDate = React.useMemo(() => {
    const map = new Map<string, DayTaskItem[]>();

    for (const st of tasks) {
      // 1. School-level task
      const matchesSchoolLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "TRUONG";
      const matchesSchoolStatus =
        !statusFilter ||
        statusFilter === "ALL" ||
        (statusFilter === "OVERDUE"
          ? getStatusLabel(st.status, st.dueDate) === "Quá hạn"
          : st.status === statusFilter);

      const isSchoolMatchScope =
        scope === "school" ||
        (scope === "my" &&
          ((currentUserId && st.leadAssigneeId === currentUserId) ||
            (currentUserName && st.leadAssigneeName === currentUserName)));

      if (isSchoolMatchScope && matchesSchoolLevel && matchesSchoolStatus && st.dueDate) {
        const matchesQuery =
          !deferredQuery ||
          st.title.toLowerCase().includes(deferredQuery) ||
          (st.leadAssigneeName && st.leadAssigneeName.toLowerCase().includes(deferredQuery));

        if (matchesQuery) {
          const dateKey = st.dueDate.split("T")[0];
          const item: DayTaskItem = {
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

      // 2. Unit-level subtasks
      const matchesSubLevel = !levelFilter || levelFilter === "ALL" || levelFilter === "DON_VI";

      if (matchesSubLevel && st.subTasks && Array.isArray(st.subTasks)) {
        for (const sub of st.subTasks) {
          const matchesSubStatus =
            !statusFilter ||
            statusFilter === "ALL" ||
            (statusFilter === "OVERDUE"
              ? getStatusLabel(sub.status, sub.dueDate) === "Quá hạn"
              : sub.status === statusFilter);

          const isUnitMatchScope =
            scope === "unit" ||
            (scope === "my" &&
              ((currentUserId && (sub.assigneeId === currentUserId || (sub as any).userId === currentUserId)) ||
                (currentUserName && sub.assigneeName === currentUserName)));

          if (isUnitMatchScope && matchesSubStatus && sub.dueDate) {
            const matchesQuery =
              !deferredQuery ||
              sub.title.toLowerCase().includes(deferredQuery) ||
              (sub.assigneeName && sub.assigneeName.toLowerCase().includes(deferredQuery));

            if (matchesQuery) {
              const dateKey = sub.dueDate.split("T")[0];
              const item: DayTaskItem = {
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
  }, [tasks, scope, currentUserId, currentUserName, deferredQuery, statusFilter, levelFilter]);

  // Grouped chronological agenda items for the active operational month
  const agendaGroups = React.useMemo(() => {
    const groups: Array<{
      dateString: string;
      dayHeaderVi: string;
      isToday: boolean;
      items: DayTaskItem[];
    }> = [];

    const monthCells = gridCells.filter((c) => c.isCurrentMonth);
    for (const cell of monthCells) {
      const items = tasksByDate.get(cell.dateString) || [];
      if (items.length > 0) {
        groups.push({
          dateString: cell.dateString,
          dayHeaderVi: formatDateVi(cell.dateString),
          isToday: cell.isToday,
          items,
        });
      }
    }
    return groups;
  }, [gridCells, tasksByDate]);

  // =========================================================================
  // AGENDA VIEW RENDERER (Used in Agenda Mode & Mobile Responsive Dual-Mode)
  // =========================================================================
  const renderAgendaList = (slotName: string) => (
    <div className="space-y-4" data-slot={slotName}>
      {agendaGroups.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4 rounded-2xl border border-dashed border-border/70 bg-card/60 space-y-3">
          <CalendarIcon className="size-10 text-muted-foreground/40" strokeWidth={1.5} />
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-foreground">
              Không có lịch công tác hoặc sự kiện
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Không có nhiệm vụ nào đến hạn trong chu kỳ vận hành {period.label} ({period.shortDateSpan}).
            </p>
          </div>
        </div>
      ) : (
        agendaGroups.map((group) => (
          <div
            key={group.dateString}
            className={cn(
              "rounded-2xl border border-border/70 bg-card overflow-hidden shadow-2xs transition-all",
              group.isToday && "border-primary/50 ring-1 ring-primary/20"
            )}
          >
            {/* Day Header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/30 border-b border-border/50">
              <div className="flex items-center gap-2">
                <h3 className="text-xs sm:text-sm font-bold text-foreground font-mono tabular-nums">
                  {group.dayHeaderVi}
                </h3>
                {group.isToday && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold bg-primary text-primary-foreground font-mono tabular-nums uppercase">
                    Hôm nay
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  onSelectDate(group.dateString);
                  onOpenDaySheet(group.dateString);
                }}
                className="text-xs font-semibold text-primary hover:underline cursor-pointer font-mono tabular-nums"
              >
                {group.items.length} nhiệm vụ &rarr;
              </button>
            </div>

            {/* Items List */}
            <div className="divide-y divide-border/40">
              {group.items.map((item) => {
                const dotClass = getStatusDotClass(item.status as string, item.dueDate);
                const isDone = item.status === "COMPLETED";

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      if (item.originalTask) {
                        onSelectTask?.(item.originalTask);
                      } else {
                        onSelectDate(group.dateString);
                        onOpenDaySheet(group.dateString);
                      }
                    }}
                    className={cn(
                      "w-full p-3.5 flex flex-col gap-2 hover:bg-muted/30 active:bg-muted/50 transition-colors cursor-pointer text-left focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary",
                      isDone && "opacity-60 bg-muted/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={cn(
                            "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold border",
                            item.level === "Trường"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-indigo-50 text-indigo-700 border-indigo-200"
                          )}
                        >
                          {item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                        </span>
                        {item.categoryLabel && (
                          <span className="text-xs text-muted-foreground bg-muted/60 border border-border/50 px-2 py-0.5 rounded-md">
                            {item.categoryLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <span className={cn("size-2 rounded-full", dotClass)} />
                        <span>{getStatusLabel(item.status as string, item.dueDate)}</span>
                      </div>
                    </div>

                    <h4
                      className={cn(
                        "text-xs sm:text-sm font-semibold text-foreground leading-snug",
                        isDone && "line-through text-muted-foreground"
                      )}
                    >
                      {item.title}
                    </h4>

                    {item.assigneeName && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="size-3 text-muted-foreground/70" strokeWidth={1.5} />
                        <span>Phụ trách: {item.assigneeName}</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // =========================================================================
  // VIEW MODE: AGENDA LIST
  // =========================================================================
  if (viewMode === "agenda") {
    return (
      <div className={cn("space-y-4", className)}>
        {renderAgendaList("calendar-agenda-view")}
      </div>
    );
  }

  // =========================================================================
  // VIEW MODE: 7-COLUMN MONTH GRID WITH RESPONSIVE DUAL-MODE FOR MOBILE (<640px)
  // (22-calendar.md Invariant 5: linear agenda on compact mobile, 7-col on desktop)
  // =========================================================================
  return (
    <div
      className={cn("flex flex-col space-y-4", className)}
      data-slot="calendar-month-grid"
    >
      {/* Mobile Responsive Agenda Feed (<640px) */}
      <div className="block sm:hidden" data-slot="mobile-responsive-agenda-feed">
        {renderAgendaList("mobile-responsive-agenda-feed")}
      </div>

      {/* Desktop Responsive Month Grid (>=640px) */}
      <div
        className="hidden sm:flex sm:flex-col rounded-2xl border border-border/60 bg-card shadow-card overflow-hidden transition-all"
        data-slot="desktop-responsive-month-grid"
      >
        {/* Weekday Header Row (T2 - CN) */}
        <div className="grid grid-cols-7 border-b border-border/50 bg-muted/30 text-center select-none">
          {WEEK_DAYS.map((w, idx) => (
            <div
              key={w.label}
              className={cn(
                "py-2.5 text-xs font-semibold text-muted-foreground border-r border-border/40 last:border-r-0",
                idx >= 5 && "text-muted-foreground/70 bg-muted/20"
              )}
              title={w.fullName}
            >
              <span className="hidden sm:inline">{w.fullName}</span>
              <span className="sm:hidden">{w.label}</span>
            </div>
          ))}
        </div>

        {/* Days Grid: 7-column layout with fixed density boundaries */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border/40 bg-border/20">
          {gridCells.map((cell) => {
            const dayTasks = tasksByDate.get(cell.dateString) || [];
            const isSelected = selectedDate === cell.dateString;

            // Requirement 2: Cell density capping - maximum 3 item previews per cell
            const MAX_PREVIEW = 3;
            const displayedTasks = dayTasks.slice(0, MAX_PREVIEW);
            const remainingCount = dayTasks.length - MAX_PREVIEW;

            return (
              <div
                key={cell.dateString}
                role="gridcell"
                onClick={() => {
                  onSelectDate(cell.dateString);
                  onOpenDaySheet(cell.dateString);
                }}
                className={cn(
                  // Enforce cell density bounds: min-h-[112px] max-h-[136px] overflow-hidden prevents cell explosion
                  "group relative min-h-[112px] max-h-[136px] p-1.5 sm:p-2 flex flex-col justify-between overflow-hidden transition-all cursor-pointer text-left",
                  !cell.isCurrentMonth && "bg-muted/15 text-muted-foreground/40",
                  cell.isCurrentMonth && "bg-card hover:bg-muted/25",
                  cell.isWeekend && cell.isCurrentMonth && "bg-muted/[0.04]",
                  cell.isToday && "bg-primary/[0.04] font-medium border-primary/30",
                  isSelected && "ring-1.5 ring-primary ring-inset bg-primary/[0.06] z-10 shadow-xs"
                )}
                data-date={cell.dateString}
                aria-label={`${cell.dateString}: ${dayTasks.length} nhiệm vụ`}
              >
                {/* Top Cell Header: Task count indicator (left) + Day Number Button (right) */}
                <div className="flex items-center justify-between gap-1 mb-1">
                  {dayTasks.length > 0 ? (
                    <span className="inline-flex items-center px-1.5 py-0.2 rounded-full text-xs font-mono font-medium tabular-nums bg-secondary/80 text-muted-foreground border border-border/40">
                      {dayTasks.length}
                    </span>
                  ) : (
                    <span />
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectDate(cell.dateString);
                      onOpenDaySheet(cell.dateString);
                    }}
                    aria-label={`Mở lịch ngày ${cell.dateString}, ${dayTasks.length} nhiệm vụ`}
                    className={cn(
                      "inline-flex size-5.5 sm:size-6 items-center justify-center rounded-full font-mono text-xs font-medium tabular-nums transition-colors hover:ring-2 hover:ring-primary/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-bold shadow-xs"
                        : cell.isCurrentMonth
                        ? "text-foreground hover:bg-muted/60"
                        : "text-muted-foreground/40 hover:bg-muted/40",
                      isSelected && !cell.isToday && "font-bold text-primary"
                    )}
                  >
                    {cell.dayNumber}
                  </button>
                </div>

                {/* Event Item Previews (Capped at maximum 3 items) */}
                <div className="flex-1 space-y-1 overflow-hidden min-h-0">
                  {displayedTasks.map((item) => {
                    const dotClass = getStatusDotClass(item.status as string, item.dueDate);
                    const isDone = item.status === "COMPLETED";

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (item.originalTask) {
                            onSelectTask?.(item.originalTask);
                          } else {
                            onSelectDate(cell.dateString);
                            onOpenDaySheet(cell.dateString);
                          }
                        }}
                        className={cn(
                          "w-full text-left flex items-center gap-1.5 rounded-[4px] px-1.5 py-0.5 text-xs font-medium transition-colors border truncate cursor-pointer shadow-2xs focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-primary",
                          item.level === "Trường"
                            ? "bg-background/90 border-border/70 text-foreground hover:border-primary/50 hover:bg-accent"
                            : "bg-muted/30 border-border/50 text-muted-foreground hover:text-foreground hover:bg-accent",
                          isDone && "opacity-60 line-through bg-emerald-500/5 border-emerald-500/20 text-muted-foreground"
                        )}
                        title={`${item.level === "Trường" ? "[Cấp Trường]" : "[Đơn vị]"} ${item.title}`}
                      >
                        <span className={cn("size-1.5 shrink-0 rounded-full ring-1 ring-background/80", dotClass)} />
                        <span className="truncate font-sans text-xs leading-tight">
                          {item.title}
                        </span>
                      </button>
                    );
                  })}

                  {/* Requirement 2: +N nhiệm vụ badge that opens the day detail side sheet */}
                  {remainingCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectDate(cell.dateString);
                        onOpenDaySheet(cell.dateString);
                      }}
                      className="w-full text-left px-1.5 py-0.5 rounded text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer block truncate"
                      title={`Xem thêm ${remainingCount} nhiệm vụ`}
                      aria-label={`Xem thêm ${remainingCount} nhiệm vụ ngày ${cell.dateString}`}
                    >
                      +{remainingCount} nhiệm vụ
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

      {/* Grid Footer Legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-border/50 bg-muted/20 text-xs text-muted-foreground">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <span>Trạng thái:</span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500 ring-1 ring-background" />
            <span>Hoàn thành</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-blue-500 ring-1 ring-background" />
            <span>Đang thực hiện</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500 ring-1 ring-background" />
            <span>Chờ thực hiện</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-rose-500 ring-1 ring-background" />
            <span>Quá hạn</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-muted-foreground font-mono text-xs tabular-nums">
          <span>Chu kỳ: 25/tháng trước - 24/tháng này</span>
        </div>
      </div>
      </div>
    </div>
  );
}
