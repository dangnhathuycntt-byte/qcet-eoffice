"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import {
  AlertTriangle,
  Calendar as CalendarIcon,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CircleDot,
  Clock,
  Filter,
  Plus,
  Search,
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
import { sideSheetVariants } from "@/lib/motion/variants";

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
    const [year, month, day] = clean.split("-").map(Number);
    const dateObj = new Date(year, month - 1, day, 12, 0, 0);
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
    const d = String(day).padStart(2, "0");
    const m = String(month).padStart(2, "0");
    return `${dayName}, ${d}/${m}/${year}`;
  } catch {
    return dateStr;
  }
}

function StateIcon({ state, isEvent }: { state: CalendarAttentionState; isEvent?: boolean }) {
  if (isEvent) return <CalendarIcon className="size-3.5 text-sky-600 shrink-0" aria-hidden="true" />;
  if (state === "overdue") return <AlertTriangle className="size-3.5 text-rose-600 shrink-0" aria-hidden="true" />;
  if (state === "waiting") return <Clock className="size-3.5 text-amber-600 shrink-0" aria-hidden="true" />;
  if (state === "due_today") return <Clock className="size-3.5 text-orange-600 shrink-0" aria-hidden="true" />;
  if (state === "completed") return <CheckCircle2 className="size-3.5 text-emerald-600 shrink-0" aria-hidden="true" />;
  return (
    <CircleDot
      className={cn(
        "size-3.5 shrink-0",
        state === "in_progress" ? "text-blue-600" : "text-muted-foreground/60"
      )}
      aria-hidden="true"
    />
  );
}

const filterLabels: Record<CalendarDayFilter, string> = {
  all: "Tất cả",
  attention: "Cần xử lý",
  overdue: "Quá hạn",
  waiting: "Chờ duyệt",
};

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
  const [isFilterMenuOpen, setIsFilterMenuOpen] = React.useState(false);
  const [isCreateMenuOpen, setIsCreateMenuOpen] = React.useState(false);
  const filterMenuRef = React.useRef<HTMLDivElement>(null);
  const createMenuRef = React.useRef<HTMLDivElement>(null);
  const panelRef = React.useRef<HTMLElement>(null);
  const referenceDate = getSystemReferenceDate();

  React.useEffect(() => setMounted(true), []);

  // Focus panel on open for accessibility without trapping background pointer events
  React.useEffect(() => {
    if (isOpen && panelRef.current) {
      panelRef.current.focus();
    }
  }, [isOpen]);

  // Click outside listener for dropdown menus
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (createMenuRef.current && !createMenuRef.current.contains(target)) {
        setIsCreateMenuOpen(false);
      }
      if (filterMenuRef.current && !filterMenuRef.current.contains(target)) {
        setIsFilterMenuOpen(false);
      }
    };
    if (isCreateMenuOpen || isFilterMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isCreateMenuOpen, isFilterMenuOpen]);

  // Keyboard Escape listener (no body scroll lock so background calendar is interactive)
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Reset filters and query whenever active date changes
  React.useEffect(() => {
    setFilter("all");
    setQuery("");
    setIsFilterMenuOpen(false);
    setIsCreateMenuOpen(false);
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

  const isAttention = React.useCallback(
    (item: DayTaskItem) => {
      if (item.isEvent) return false;
      const state = getCalendarAttentionState(item, referenceDate);
      return state === "overdue" || state === "waiting" || state === "due_today";
    },
    [referenceDate]
  );

  const attentionItems = React.useMemo(
    () => visibleTasks.filter(isAttention),
    [visibleTasks, isAttention]
  );

  const otherItems = React.useMemo(
    () => visibleTasks.filter((item) => !isAttention(item)),
    [visibleTasks, isAttention]
  );

  if (!mounted) return null;

  const formattedDate = selectedDate ? formatDateVi(selectedDate) : "Chưa chọn ngày";

  const renderItemRow = (item: DayTaskItem) => {
    const isEvent = item.isEvent;
    const state = getCalendarAttentionState(item, referenceDate);
    const isCompleted = state === "completed";

    let metaLeader: string;
    let metaExtra: React.ReactNode = null;

    if (isEvent) {
      metaLeader = item.host || item.assigneeName || "Ban Giám hiệu";
      metaExtra = (
        <>
          {item.time && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono tabular-nums text-sky-700 font-medium">{item.time}</span>
            </>
          )}
          {item.location && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate max-w-[120px]">{item.location}</span>
            </>
          )}
        </>
      );
    } else {
      metaLeader = item.assigneeName || "Chưa phân công";

      let statusBadge: React.ReactNode = null;
      if (state === "overdue") {
        statusBadge = <span className="text-rose-600 font-medium">Quá hạn</span>;
      } else if (state === "waiting") {
        statusBadge = <span className="text-amber-600 font-medium">Chờ duyệt</span>;
      } else if (state === "due_today") {
        statusBadge = <span className="text-orange-600 font-medium">Hôm nay</span>;
      }

      metaExtra = (
        <>
          {statusBadge && (
            <>
              <span className="text-muted-foreground/40">·</span>
              {statusBadge}
            </>
          )}
          {item.time && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono tabular-nums">{item.time}</span>
            </>
          )}
          {item.categoryLabel && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate max-w-[110px]">{item.categoryLabel}</span>
            </>
          )}
          {item.parentSchoolTaskTitle && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="truncate max-w-[130px] text-muted-foreground/70">
                Thuộc: {item.parentSchoolTaskTitle}
              </span>
            </>
          )}
        </>
      );
    }

    const isClickable = Boolean(item.originalTask);

    return (
      <div
        key={item.id}
        role={isClickable ? "button" : undefined}
        tabIndex={isClickable ? 0 : undefined}
        onClick={() => isClickable && onSelectTask?.(item.originalTask!)}
        onKeyDown={(e) => {
          if (isClickable && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onSelectTask?.(item.originalTask!);
          }
        }}
        className={cn(
          "group px-4 py-2.5 min-h-[52px] max-h-[64px] flex items-start gap-2.5 transition-colors text-left select-none",
          isClickable
            ? "cursor-pointer hover:bg-muted/40 active:bg-muted/60"
            : "cursor-default",
          isCompleted && "opacity-60"
        )}
        aria-label={item.title}
      >
        {/* Status icon */}
        <div className="pt-0.5 shrink-0">
          <StateIcon state={state} isEvent={isEvent} />
        </div>

        {/* 2 lines: Title + Subtitle */}
        <div className="min-w-0 flex-1 space-y-0.5 overflow-hidden">
          {/* Line 1: Title */}
          <h4
            className={cn(
              "text-xs sm:text-sm font-medium text-foreground leading-snug truncate group-hover:text-primary transition-colors",
              isCompleted && "line-through text-muted-foreground"
            )}
            title={item.title}
          >
            {item.title}
          </h4>

          {/* Line 2: Phụ trách · hạn / metadata quan trọng */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate leading-none">
            <span className="truncate max-w-[150px]">{metaLeader}</span>
            {metaExtra}
          </div>
        </div>
      </div>
    );
  };

  const content = (
    <AnimatePresence>
      {isOpen && (
        <m.aside
          key="calendar-day-sheet-panel"
          ref={panelRef}
          tabIndex={-1}
          data-slot="calendar-day-sheet-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="calendar-day-sheet-title"
          variants={sideSheetVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className={cn(
            "fixed inset-y-0 right-0 z-40 flex h-full flex-col bg-card border-l border-border/70 shadow-2xl outline-none w-full sm:w-[440px]",
            className
          )}
        >
          {/* Sticky Side Peek Header */}
          <header className="sticky top-0 z-10 border-b border-border/60 bg-card/95 backdrop-blur-md px-4 py-2.5 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2
                id="calendar-day-sheet-title"
                className="text-sm font-semibold text-foreground truncate font-heading tracking-tight"
              >
                {formattedDate}
              </h2>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* [filter] compact control */}
              <div className="relative" ref={filterMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterMenuOpen((prev) => !prev)}
                  className={cn(
                    "inline-flex items-center gap-1 h-7.5 px-2 rounded-md text-xs font-medium border transition-colors cursor-pointer",
                    filter !== "all"
                      ? "border-primary/40 bg-primary/10 text-primary font-semibold"
                      : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                  aria-haspopup="true"
                  aria-expanded={isFilterMenuOpen}
                  aria-label="Lọc trạng thái"
                >
                  <Filter className="size-3" strokeWidth={1.5} />
                  <span>{filterLabels[filter]}</span>
                  <ChevronDown className="size-2.5 text-muted-foreground" strokeWidth={1.5} />
                </button>

                {isFilterMenuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-full mt-1 w-36 rounded-lg border border-border/70 bg-card p-1 shadow-lg z-20 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                  >
                    {(["all", "attention", "overdue", "waiting"] as const).map((key) => {
                      const counts = {
                        all: summary.total,
                        attention: summary.attention,
                        overdue: summary.overdue,
                        waiting: summary.waiting,
                      };
                      return (
                        <button
                          key={key}
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setFilter(key);
                            setIsFilterMenuOpen(false);
                          }}
                          className={cn(
                            "w-full flex items-center justify-between rounded px-2 py-1.5 text-left transition-colors cursor-pointer",
                            filter === key
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-foreground hover:bg-muted/60"
                          )}
                        >
                          <span>{filterLabels[key]}</span>
                          <span className="font-mono tabular-nums text-muted-foreground text-xs">
                            {counts[key]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* [+ Tạo] action */}
              {selectedDate && (
                <div className="relative" ref={createMenuRef}>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsCreateMenuOpen((prev) => !prev)}
                    className="h-7.5 px-2 text-xs font-medium gap-1 rounded-md border-border/70 hover:bg-muted/50 cursor-pointer"
                    aria-haspopup="true"
                    aria-expanded={isCreateMenuOpen}
                  >
                    <Plus className="size-3" strokeWidth={1.5} />
                    <span>Tạo</span>
                    <ChevronDown className="size-2.5 text-muted-foreground" strokeWidth={1.5} />
                  </Button>
                  {isCreateMenuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-full mt-1 w-44 rounded-lg border border-border/70 bg-card p-1 shadow-lg z-20 text-xs space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                    >
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsCreateMenuOpen(false);
                          onAddTaskOnDate?.(selectedDate);
                        }}
                        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                      >
                        <CheckSquare className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                        <span>Nhiệm vụ hạn ngày này</span>
                      </button>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setIsCreateMenuOpen(false);
                          onAddEventOnDate?.(selectedDate);
                        }}
                        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                      >
                        <CalendarIcon className="size-3.5 text-sky-600 shrink-0" strokeWidth={1.5} />
                        <span>Sự kiện ngày này</span>
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* [×] close */}
              <button
                type="button"
                onClick={onClose}
                className="inline-flex size-7.5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                aria-label="Đóng chi tiết ngày"
              >
                <X className="size-4" strokeWidth={1.5} />
              </button>
            </div>
          </header>

          {/* Compact search: only visible if total tasks > 10 */}
          {tasks.length > 10 && (
            <div className="px-4 py-1.5 border-b border-border/40 bg-muted/10">
              <div className="relative">
                <Search
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground/60"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Lọc nhanh danh sách..."
                  className="h-7 w-full rounded-md border border-border/50 bg-background pl-7 pr-2.5 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/60"
                />
              </div>
            </div>
          )}

          {/* Flat List Content */}
          <div className="flex-1 overflow-y-auto thin-scrollbar">
            {!selectedDate || tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center py-14 px-4 space-y-2 text-muted-foreground">
                <CalendarIcon className="size-8 text-muted-foreground/30 mb-1" strokeWidth={1.5} />
                <p className="text-xs font-semibold text-foreground">Không có lịch công tác</p>
                <p className="text-xs text-muted-foreground max-w-xs">
                  Không có nhiệm vụ hoặc sự kiện nào trong ngày này. Nhấn &ldquo;+ Tạo&rdquo; để thêm mới.
                </p>
              </div>
            ) : visibleTasks.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                <p>Không có mục nào khớp bộ lọc.</p>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                  }}
                  className="font-medium text-primary hover:underline cursor-pointer"
                >
                  Xem tất cả ({summary.total})
                </button>
              </div>
            ) : filter === "all" && attentionItems.length > 0 ? (
              <div className="space-y-0">
                {/* Section Cần xử lý */}
                <div>
                  <div className="sticky top-0 z-5 px-4 py-1.5 bg-muted/30 border-b border-border/40 text-xs font-semibold text-rose-600 flex items-center justify-between">
                    <span>Cần xử lý</span>
                    <span className="font-mono tabular-nums text-xs">{attentionItems.length}</span>
                  </div>
                  <div className="divide-y divide-border/30">
                    {attentionItems.map(renderItemRow)}
                  </div>
                </div>

                {/* Section Các nhiệm vụ khác */}
                {otherItems.length > 0 && (
                  <div>
                    <div className="sticky top-0 z-5 px-4 py-1.5 bg-muted/30 border-y border-border/40 text-xs font-semibold text-muted-foreground flex items-center justify-between">
                      <span>Các nhiệm vụ khác</span>
                      <span className="font-mono tabular-nums text-xs">{otherItems.length}</span>
                    </div>
                    <div className="divide-y divide-border/30">
                      {otherItems.map(renderItemRow)}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border/30">
                {visibleTasks.map(renderItemRow)}
              </div>
            )}
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );

  return createPortal(content, document.body);
}

export default CalendarDaySheet;
