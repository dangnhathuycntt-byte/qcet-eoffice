"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  CircleDot,
  Clock,
  Layers,
  MapPin,
  Plus,
  Search,
  User,
  X,
} from "lucide-react";
import type { SchoolTask, StaffTask, TaskCategory, TaskStatus } from "@/types/dashboard";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getSystemReferenceDate } from "@/lib/academic-calendar";
import {
  filterCalendarItems,
  getCalendarAttentionState,
  getCalendarDaySummary,
  type CalendarAttentionState,
  type CalendarDayFilter,
} from "@/lib/calendar/calendar-presentation";

export interface DayTaskItem {
  id: string;
  title: string;
  level: "Trường" | "Đơn vị";
  category?: TaskCategory;
  categoryLabel?: string;
  assigneeName?: string;
  assigneeAvatar?: string;
  dueDate: string;
  status: TaskStatus | string;
  progressPercent?: number;
  parentSchoolTaskId?: string;
  parentSchoolTaskTitle?: string;
  originalTask?: SchoolTask | StaffTask;
  isEvent?: boolean;
  time?: string;
  location?: string;
  host?: string;
  participants?: string;
}

export interface CalendarDaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  selectedDate: string | null;
  tasks: DayTaskItem[];
  onSelectTask?: (task: SchoolTask | StaffTask) => void;
  onAddTaskOnDate?: (dateStr: string) => void;
  className?: string;
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
    const dayName = dayNames[dateObj.getDay()] || "Ngày";
    return `${dayName}, ngày ${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

function stateLabel(state: CalendarAttentionState, isEvent?: boolean): string {
  if (isEvent) return "Sự kiện";
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

function StateIcon({ state, isEvent }: { state: CalendarAttentionState; isEvent?: boolean }) {
  if (isEvent) return <CalendarIcon className="size-3.5 text-primary" aria-hidden="true" />;
  if (state === "overdue") return <AlertTriangle className="size-3.5 text-rose-600" aria-hidden="true" />;
  if (state === "waiting" || state === "due_today") return <Clock className="size-3.5 text-amber-600" aria-hidden="true" />;
  if (state === "completed") return <CheckCircle2 className="size-3.5 text-emerald-600" aria-hidden="true" />;
  return <CircleDot className={cn("size-3.5", state === "in_progress" ? "text-blue-600" : "text-muted-foreground")} aria-hidden="true" />;
}

export function CalendarDaySheet({
  isOpen,
  onClose,
  selectedDate,
  tasks = [],
  onSelectTask,
  onAddTaskOnDate,
  className,
}: CalendarDaySheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const [filter, setFilter] = React.useState<CalendarDayFilter>("all");
  const [query, setQuery] = React.useState("");
  const referenceDate = getSystemReferenceDate();

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  React.useEffect(() => {
    setFilter("all");
    setQuery("");
  }, [selectedDate]);

  const summary = React.useMemo(
    () => getCalendarDaySummary(tasks, referenceDate),
    [tasks, referenceDate]
  );

  const visibleTasks = React.useMemo(() => {
    const filtered = filterCalendarItems(tasks, filter, referenceDate);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return filtered;
    return filtered.filter((item) =>
      [item.title, item.assigneeName, item.categoryLabel, item.location, item.host]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [filter, query, referenceDate, tasks]);

  if (!mounted || !isOpen) return null;

  const formattedDate = selectedDate ? formatDateVi(selectedDate) : "Chưa chọn ngày";
  const isDateSelected = Boolean(selectedDate);
  const showSearch = tasks.length > 20;

  const filters: Array<{ value: CalendarDayFilter; label: string; count: number }> = [
    { value: "attention", label: "Cần xử lý", count: summary.attention },
    { value: "overdue", label: "Quá hạn", count: summary.overdue },
    { value: "waiting", label: "Chờ duyệt", count: summary.waiting },
    { value: "all", label: "Tất cả", count: summary.total },
  ];

  const content = (
    <div role="dialog" aria-modal="true" aria-labelledby="calendar-day-sheet-title" className="fixed inset-0 z-50 overflow-hidden">
      <div
        data-slot="calendar-day-sheet-backdrop"
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        data-slot="calendar-day-sheet-panel"
        className={cn(
          "fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 flex h-full flex-col bg-card border-l border-border/70 shadow-2xl transition-all duration-300 animate-in slide-in-from-right",
          "w-full sm:w-[500px] md:w-[540px]",
          className
        )}
      >
        <header className="sticky top-0 z-10 border-b border-border/60 bg-card/95 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3.5">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="sm:hidden inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                aria-label="Đóng chi tiết ngày"
              >
                <ArrowLeft className="size-5" strokeWidth={1.5} />
              </button>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5 text-xs text-primary font-semibold">
                  <CalendarIcon className="size-3.5" strokeWidth={1.5} aria-hidden="true" />
                  <span>Chi tiết lịch công tác</span>
                </div>
                <h2 id="calendar-day-sheet-title" className="text-sm sm:text-base font-bold text-foreground truncate font-heading tracking-tight">
                  {formattedDate}
                </h2>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden sm:inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Đóng chi tiết ngày"
            >
              <X className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          {isDateSelected && (
            <div className="px-4 sm:px-5 pb-3 space-y-2.5">
              <div className="flex flex-wrap items-center gap-1.5" aria-label="Bộ lọc nhanh theo trạng thái">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    aria-pressed={filter === item.value}
                    className={cn(
                      "min-h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      filter === item.value
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                    )}
                  >
                    {item.label} <span className="font-mono tabular-nums">{item.count}</span>
                  </button>
                ))}
              </div>

              {showSearch && (
                <label className="relative block">
                  <span className="sr-only">Tìm trong ngày</span>
                  <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={`Tìm trong ${summary.total} nhiệm vụ / sự kiện...`}
                    className="h-9 w-full rounded-lg border border-border/70 bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              )}
            </div>
          )}
        </header>

        <div className="flex items-center justify-between px-4 sm:px-5 py-2.5 bg-muted/20 border-b border-border/50 gap-3">
          <div className="min-w-0 text-xs text-muted-foreground">
            {summary.total === 0 ? (
              "Không có lịch công tác"
            ) : (
              <span>
                <strong className="font-mono tabular-nums text-foreground">{visibleTasks.length}</strong> đang hiển thị
                {summary.attention > 0 && (
                  <span> · <strong className="text-rose-700">{summary.attention} cần xử lý</strong></span>
                )}
              </span>
            )}
          </div>
          {selectedDate && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAddTaskOnDate?.(selectedDate)}
              className="h-8 min-h-[32px] sm:min-h-0 shrink-0 text-xs font-medium gap-1.5 border-dashed border-border hover:border-primary/50 rounded-lg px-2.5"
            >
              <Plus className="size-3.5" strokeWidth={1.5} />
              <span>+ Thêm việc ngày này</span>
            </Button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          {!isDateSelected || summary.total === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-8 sm:py-10 px-4 rounded-2xl border border-dashed border-border/70 bg-muted/10 space-y-3 my-2">
              <div className="size-11 rounded-xl bg-secondary/80 flex items-center justify-center border border-border/60 text-muted-foreground/60">
                <CalendarIcon className="size-5" strokeWidth={1.5} />
              </div>
              <div className="space-y-1 max-w-xs">
                <h3 className="text-sm font-bold text-foreground">
                  {isDateSelected ? "Không có nhiệm vụ trong ngày" : "Chưa chọn ngày công tác"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {isDateSelected
                    ? "Không có sự kiện, hạn chót hoặc nhiệm vụ nào trong ngày này."
                    : "Chọn một ngày trên lịch hoặc danh sách để xem chi tiết."}
                </p>
              </div>
              {selectedDate && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onAddTaskOnDate?.(selectedDate)}
                  className="min-h-[44px] sm:min-h-0 h-9 px-4 text-xs font-semibold gap-1.5 rounded-xl border-dashed border-border/80 hover:border-primary/50 text-foreground hover:bg-secondary cursor-pointer"
                >
                  <Plus className="size-4" strokeWidth={1.5} />
                  <span>+ Thêm việc ngày này</span>
                </Button>
              )}
            </div>
          ) : visibleTasks.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
              Không có mục nào khớp bộ lọc hiện tại.
              <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="ml-1 font-semibold text-primary hover:underline">
                Xem tất cả
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {visibleTasks.map((item) => {
                const state = getCalendarAttentionState(item, referenceDate);
                const isCompleted = state === "completed";
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => item.originalTask && onSelectTask?.(item.originalTask)}
                    className={cn(
                      "group w-full flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      item.originalTask ? "hover:border-primary/40 hover:shadow-card" : "cursor-default",
                      isCompleted && "opacity-70 bg-muted/20"
                    )}
                    aria-label={item.originalTask ? `Xem chi tiết ${item.title}` : item.title}
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs font-semibold text-foreground">
                          {item.isEvent ? "Lịch" : item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                        </span>
                        {item.categoryLabel && (
                          <span className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                            {item.categoryLabel}
                          </span>
                        )}
                      </div>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <StateIcon state={state} isEvent={item.isEvent} />
                        {stateLabel(state, item.isEvent)}
                      </span>
                    </div>

                    <h4 className={cn("text-xs sm:text-sm font-semibold text-foreground leading-snug", isCompleted && "line-through text-muted-foreground")}>{item.title}</h4>

                    {!item.isEvent && item.level === "Đơn vị" && item.parentSchoolTaskTitle && (
                      <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                        <Layers className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span className="truncate">Thuộc: {item.parentSchoolTaskTitle}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <User className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                        <span className="truncate">{item.assigneeName || item.host || "Chưa gán phụ trách"}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                        {item.time && (
                          <span className="inline-flex items-center gap-1 text-primary">
                            <Clock className="size-3" strokeWidth={1.5} aria-hidden="true" />
                            {item.time}
                          </span>
                        )}
                        {item.location && (
                          <span className="inline-flex items-center gap-1 max-w-[150px]">
                            <MapPin className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                            <span className="truncate">{item.location}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 px-4 sm:px-5 py-3 bg-card/90 flex items-center justify-between gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs min-h-9 rounded-lg px-4">
            Đóng
          </Button>
          {selectedDate && (
            <Button type="button" variant="outline" size="sm" onClick={() => onAddTaskOnDate?.(selectedDate)} className="text-xs min-h-9 rounded-lg px-3.5 border-dashed">
              <Plus className="size-3.5 mr-1" strokeWidth={1.5} />
              Thêm việc
            </Button>
          )}
        </footer>
      </aside>
    </div>
  );

  return createPortal(content, document.body);
}
