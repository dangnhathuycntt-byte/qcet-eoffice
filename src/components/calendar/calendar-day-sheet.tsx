"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
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
import { fadeVariants, sideSheetVariants } from "@/lib/motion/variants";

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
  onAddEventOnDate?: (dateStr: string) => void;
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
  onAddEventOnDate,
  className,
}: CalendarDaySheetProps) {
  const [mounted, setMounted] = React.useState(false);
  const [filter, setFilter] = React.useState<CalendarDayFilter>("all");
  const [query, setQuery] = React.useState("");
  const [isCreateMenuOpen, setIsCreateMenuOpen] = React.useState(false);
  const createMenuRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const referenceDate = getSystemReferenceDate();

  React.useEffect(() => setMounted(true), []);

  // Focus panel on open for keyboard and screen-reader users
  React.useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (createMenuRef.current && !createMenuRef.current.contains(event.target as Node)) {
        setIsCreateMenuOpen(false);
      }
    };
    if (isCreateMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCreateMenuOpen]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
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

  // Events always render unfiltered by attention state — they have real times, not deadlines.
  // The attention quick-filters apply only to the "Nhiệm vụ đến hạn" section.
  const visibleEvents = React.useMemo(() => {
    const allEvents = tasks.filter((item) => item.isEvent);
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return allEvents;
    return allEvents.filter((item) =>
      [item.title, item.host, item.location, item.participants]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedQuery))
    );
  }, [query, tasks]);

  const visibleDeadlines = React.useMemo(
    () => visibleTasks.filter((item) => !item.isEvent),
    [visibleTasks]
  );

  if (!mounted) return null;

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
    <AnimatePresence>
      {isOpen && (
        <m.div
          key="calendar-day-sheet-backdrop"
          data-slot="calendar-day-sheet-backdrop"
          variants={fadeVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <m.aside
          key="calendar-day-sheet-panel"
          ref={panelRef}
          tabIndex={-1}
          data-slot="calendar-day-sheet-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="calendar-day-sheet-title"
          variants={sideSheetVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn(
            "fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto z-50 flex h-full flex-col bg-card border-l border-border/70 shadow-2xl outline-none",
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
                      "min-h-[44px] sm:min-h-8 rounded-lg border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
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
                <strong className="font-mono tabular-nums text-foreground">{visibleEvents.length + visibleDeadlines.length}</strong> đang hiển thị
                {summary.attention > 0 && (
                  <span> · <strong className="text-rose-700">{summary.attention} cần xử lý</strong></span>
                )}
              </span>
            )}
          </div>
          {selectedDate && (
            <div className="relative shrink-0" ref={createMenuRef}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsCreateMenuOpen((prev) => !prev)}
                className="h-8 min-h-[44px] sm:min-h-8 shrink-0 text-xs font-medium gap-1.5 border-dashed border-border hover:border-primary/50 rounded-lg px-2.5"
                aria-expanded={isCreateMenuOpen}
                aria-haspopup="true"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                <span>+ Tạo</span>
                <ChevronDown className="size-3 text-muted-foreground" />
              </Button>
              {isCreateMenuOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/70 bg-card p-1 shadow-lg z-20 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      onAddTaskOnDate?.(selectedDate);
                    }}
                    className="w-full min-h-[44px] sm:min-h-9 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left font-medium"
                  >
                    <CheckSquare className="size-3.5 text-primary shrink-0" />
                    <span>Nhiệm vụ hạn ngày này</span>
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setIsCreateMenuOpen(false);
                      onAddEventOnDate?.(selectedDate);
                    }}
                    className="w-full min-h-[44px] sm:min-h-9 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left font-medium"
                  >
                    <CalendarIcon className="size-3.5 text-sky-600 shrink-0" />
                    <span>Sự kiện ngày này</span>
                  </button>
                </div>
              )}
            </div>
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
                    ? "Không có sự kiện, hạn chót hoặc nhiệm vụ nào trong ngày này. Bạn có thể thêm việc mới hoặc sự kiện."
                    : "Chọn một ngày trên lịch hoặc danh sách để xem chi tiết."}
                </p>
              </div>
              {selectedDate && (
                <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddTaskOnDate?.(selectedDate)}
                    className="min-h-[44px] sm:min-h-9 h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl border-dashed border-border/80 hover:border-primary/50 text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <CheckSquare className="size-3.5 text-primary" strokeWidth={1.5} />
                    <span>+ Thêm việc ngày này</span>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onAddEventOnDate?.(selectedDate)}
                    className="min-h-[44px] sm:min-h-9 h-9 px-3 text-xs font-semibold gap-1.5 rounded-xl border-dashed border-border/80 hover:border-primary/50 text-foreground hover:bg-secondary cursor-pointer"
                  >
                    <CalendarIcon className="size-3.5 text-sky-600" strokeWidth={1.5} />
                    <span>Tạo sự kiện</span>
                  </Button>
                </div>
              )}
            </div>
          ) : visibleEvents.length === 0 && visibleDeadlines.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/10 p-6 text-center text-xs text-muted-foreground">
              Không có mục nào khớp bộ lọc hiện tại.
              <button type="button" onClick={() => { setFilter("all"); setQuery(""); }} className="ml-1 font-semibold text-primary hover:underline">
                Xem tất cả
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Mục Sự kiện lịch biểu */}
              {visibleEvents.length > 0 && (
                <section aria-label="Sự kiện lịch biểu" className="space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CalendarIcon className="size-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                      <span>Sự kiện lịch biểu</span>
                    </h3>
                    <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">
                      {visibleEvents.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {visibleEvents.map((item) => {
                      const state = getCalendarAttentionState(item, referenceDate);
                      const isCompleted = state === "completed";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.originalTask && onSelectTask?.(item.originalTask)}
                          className={cn(
                            "group w-full flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]",
                            item.originalTask ? "hover:border-primary/40 hover:shadow-card cursor-pointer" : "cursor-default",
                            isCompleted && "opacity-70 bg-muted/20"
                          )}
                          aria-label={item.originalTask ? `Xem chi tiết sự kiện ${item.title}` : item.title}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="inline-flex items-center rounded-md border border-primary/20 bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                              Sự kiện
                            </span>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <StateIcon state={state} isEvent={true} />
                              {stateLabel(state, true)}
                            </span>
                          </div>
                          <h4 className={cn("text-xs sm:text-sm font-semibold text-foreground leading-snug", isCompleted && "line-through text-muted-foreground")}>
                            {item.title}
                          </h4>
                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                              <span className="truncate">Chủ trì: {item.host || item.assigneeName || "Ban Giám hiệu"}</span>
                            </div>
                            <div className="flex items-center gap-2 font-mono tabular-nums shrink-0">
                              {item.time && (
                                <span className="inline-flex items-center gap-1 text-primary font-semibold">
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
                </section>
              )}

              {/* Mục Nhiệm vụ đến hạn */}
              {visibleDeadlines.length > 0 && (
                <section aria-label="Nhiệm vụ đến hạn" className="space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-border/40">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <CheckSquare className="size-3.5 text-primary" strokeWidth={1.5} aria-hidden="true" />
                      <span>Nhiệm vụ đến hạn</span>
                    </h3>
                    <span className="text-xs font-mono font-bold text-muted-foreground tabular-nums">
                      {visibleDeadlines.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {visibleDeadlines.map((item) => {
                      const state = getCalendarAttentionState(item, referenceDate);
                      const isCompleted = state === "completed";
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => item.originalTask && onSelectTask?.(item.originalTask)}
                          className={cn(
                            "group w-full flex flex-col gap-2 rounded-xl border border-border/60 bg-card p-3.5 text-left transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary min-h-[44px]",
                            item.originalTask ? "hover:border-primary/40 hover:shadow-card cursor-pointer" : "cursor-default",
                            isCompleted && "opacity-70 bg-muted/20"
                          )}
                          aria-label={item.originalTask ? `Xem chi tiết ${item.title}` : item.title}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center rounded-md border border-border/60 bg-muted/30 px-2 py-0.5 text-xs font-semibold text-foreground">
                                {item.level === "Trường" ? "Cấp Trường" : "Đơn vị"}
                              </span>
                              {item.categoryLabel && (
                                <span className="rounded-md border border-border/50 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground">
                                  {item.categoryLabel}
                                </span>
                              )}
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                              <StateIcon state={state} isEvent={false} />
                              {stateLabel(state, false)}
                            </span>
                          </div>

                          <h4 className={cn("text-xs sm:text-sm font-semibold text-foreground leading-snug", isCompleted && "line-through text-muted-foreground")}>
                            {item.title}
                          </h4>

                          {item.level === "Đơn vị" && item.parentSchoolTaskTitle && (
                            <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                              <Layers className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                              <span className="truncate">Thuộc: {item.parentSchoolTaskTitle}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground pt-1 border-t border-border/40 flex-wrap">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User className="size-3 shrink-0" strokeWidth={1.5} aria-hidden="true" />
                              <span className="truncate">{item.assigneeName || "Chưa gán phụ trách"}</span>
                            </div>
                            {typeof item.progressPercent === "number" && (
                              <span className="font-mono tabular-nums text-xs font-semibold text-foreground">
                                Tiến độ: {item.progressPercent}%
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>

        <footer className="border-t border-border/60 px-4 sm:px-5 py-3 bg-card/90 flex items-center justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs min-h-[44px] sm:min-h-9 rounded-lg px-4">
            Đóng
          </Button>
        </footer>
      </m.aside>
    )}
  </AnimatePresence>
);

  return createPortal(content, document.body);
}
