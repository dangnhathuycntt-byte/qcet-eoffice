"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  Check,
  CheckSquare,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Layers,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  User,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type CalendarViewMode = "month" | "week" | "agenda";
export type CalendarScope = "school" | "unit" | "my";
export type CalendarDensity = "compact" | "comfortable";

export interface CalendarToolbarProps {
  currentPeriodLabel: string;
  viewMode: CalendarViewMode;
  onViewChange: (mode: CalendarViewMode) => void;
  scope: CalendarScope;
  onScopeChange: (scope: CalendarScope) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  academicYear?: string;
  availableAcademicYears?: string[];
  onAcademicYearChange?: (year: string) => void;
  showWeekends?: boolean;
  onToggleWeekends?: (show: boolean) => void;
  /** Show completed items (default: false — completed items muted/hidden by default) */
  showCompleted?: boolean;
  onToggleShowCompleted?: (show: boolean) => void;
  /** Display density: compact or comfortable (default: comfortable) */
  density?: CalendarDensity;
  onDensityChange?: (density: CalendarDensity) => void;
  /** Item type filter: ALL | event | task */
  itemTypeFilter?: string;
  onItemTypeFilterChange?: (type: string) => void;
  levelFilter: string;
  onLevelFilterChange: (level: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onCreateTask?: () => void;
  onCreateEvent?: () => void;
  className?: string;
  // Legacy compat: compactMode maps to density internally
  compactMode?: boolean;
  onToggleCompactMode?: (compact: boolean) => void;
}

const VIEW_OPTIONS: Array<{ id: CalendarViewMode; label: string }> = [
  { id: "month", label: "Tháng" },
  { id: "week", label: "Tuần" },
  { id: "agenda", label: "Danh sách" },
];

const SCOPE_OPTIONS: Array<{ id: CalendarScope; label: string; icon: typeof Layers }> = [
  { id: "school", label: "Toàn trường", icon: Layers },
  { id: "unit", label: "Đơn vị", icon: SlidersHorizontal },
  { id: "my", label: "Của tôi", icon: User },
];

const ITEM_TYPE_OPTIONS = [
  { id: "ALL", label: "Tất cả loại" },
  { id: "event", label: "Sự kiện" },
  { id: "task", label: "Nhiệm vụ" },
];

const LEVEL_OPTIONS = [
  { id: "ALL", label: "Tất cả cấp" },
  { id: "TRUONG", label: "Cấp trường" },
  { id: "DON_VI", label: "Cấp đơn vị" },
];

const STATUS_OPTIONS = [
  { id: "ALL", label: "Tất cả trạng thái" },
  { id: "OVERDUE", label: "Quá hạn" },
  { id: "WAITING", label: "Chờ duyệt" },
  { id: "IN_PROGRESS", label: "Đang thực hiện" },
  { id: "COMPLETED", label: "Hoàn thành" },
];

const DENSITY_OPTIONS: Array<{ id: CalendarDensity; label: string }> = [
  { id: "comfortable", label: "Thoải mái" },
  { id: "compact", label: "Thu gọn" },
];

/** Derive contextual navigation aria-labels from view mode */
function prevLabel(viewMode: CalendarViewMode): string {
  if (viewMode === "week") return "Tuần trước";
  if (viewMode === "agenda") return "Kỳ trước";
  return "Tháng trước";
}
function nextLabel(viewMode: CalendarViewMode): string {
  if (viewMode === "week") return "Tuần tiếp theo";
  if (viewMode === "agenda") return "Kỳ tiếp theo";
  return "Tháng tiếp theo";
}
function todayLabel(viewMode: CalendarViewMode): string {
  if (viewMode === "week") return "Tuần này";
  if (viewMode === "agenda") return "Hôm nay";
  return "Hôm nay";
}

export function CalendarToolbar({
  currentPeriodLabel,
  viewMode,
  onViewChange,
  scope,
  onScopeChange,
  onPrev,
  onNext,
  onToday,
  academicYear = "2026-2027",
  availableAcademicYears = ["2026-2027", "2025-2026", "2024-2025"],
  onAcademicYearChange,
  showWeekends = true,
  onToggleWeekends,
  showCompleted = false,
  onToggleShowCompleted,
  density = "comfortable",
  onDensityChange,
  itemTypeFilter = "ALL",
  onItemTypeFilterChange,
  levelFilter,
  onLevelFilterChange,
  statusFilter,
  onStatusFilterChange,
  onResetFilters,
  hasActiveFilters,
  searchQuery,
  onSearchChange,
  onCreateTask,
  onCreateEvent,
  className,
  compactMode,
  onToggleCompactMode,
}: CalendarToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);
  const [isDisplayOpen, setIsDisplayOpen] = React.useState(false);
  const [isCreateOpen, setIsCreateOpen] = React.useState(false);

  const filterRef = React.useRef<HTMLDivElement>(null);
  const displayRef = React.useRef<HTMLDivElement>(null);
  const createRef = React.useRef<HTMLDivElement>(null);

  // Derive density from legacy compactMode if new prop not provided
  const resolvedDensity: CalendarDensity =
    density !== "comfortable" ? density : compactMode ? "compact" : density;

  // Close menus on outside click or Escape key
  React.useEffect(() => {
    const anyOpen = isFilterOpen || isDisplayOpen || isCreateOpen;
    if (!anyOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (filterRef.current && !filterRef.current.contains(target)) {
        setIsFilterOpen(false);
      }
      if (displayRef.current && !displayRef.current.contains(target)) {
        setIsDisplayOpen(false);
      }
      if (createRef.current && !createRef.current.contains(target)) {
        setIsCreateOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsFilterOpen(false);
        setIsDisplayOpen(false);
        setIsCreateOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isFilterOpen, isDisplayOpen, isCreateOpen]);

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-3 sm:p-4 shadow-xs space-y-3",
        className
      )}
      data-slot="calendar-toolbar"
    >
      {/* Hàng 1: Điều hướng thời gian + Tablist chế độ xem + Nút Tạo */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Điều hướng mốc thời gian */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="inline-flex items-center rounded-xl border border-border/70 bg-background p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={onPrev}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={prevLabel(viewMode)}
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              aria-label={nextLabel(viewMode)}
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-foreground font-heading tabular-nums px-1">
            {currentPeriodLabel}
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToday}
            className="min-h-[44px] sm:min-h-8 h-8 px-2.5 text-xs font-semibold rounded-lg border-border/70 hover:bg-secondary"
            aria-label={todayLabel(viewMode)}
          >
            {todayLabel(viewMode)}
          </Button>
        </div>

        {/* Tablist chế độ xem (Tháng | Tuần | Danh sách) + Nút +Tạo */}
        <div className="flex items-center gap-2">
          {/* Primary View Switcher: always-visible tablist — no secondary disclosure */}
          <div
            role="tablist"
            aria-label="Chế độ hiển thị lịch"
            className="inline-flex items-center rounded-xl border border-border/70 bg-muted/40 p-1 shadow-2xs"
          >
            {VIEW_OPTIONS.map((option) => {
              const isActive = viewMode === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onViewChange(option.id)}
                  className={cn(
                    "min-h-[44px] sm:min-h-8 px-3 py-1 text-xs font-semibold rounded-lg transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Single primary CTA: +Tạo dropdown — toolbar exposes onCreateTask / onCreateEvent */}
          {(onCreateTask || onCreateEvent) && (
            <div className="relative" ref={createRef}>
              <Button
                type="button"
                size="sm"
                onClick={() => setIsCreateOpen((prev) => !prev)}
                className="min-h-[44px] sm:min-h-8 h-8 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1"
                aria-expanded={isCreateOpen}
                aria-haspopup="menu"
                aria-label="Tạo mới"
              >
                <Plus className="size-3.5" strokeWidth={1.5} />
                <span className="hidden sm:inline">Tạo mới</span>
                <ChevronDown className="size-3 opacity-80" />
              </Button>

              {isCreateOpen && (
                <div
                  role="menu"
                  className="absolute right-0 top-full mt-1.5 w-48 rounded-xl border border-border/70 bg-card p-1 shadow-lg z-30 space-y-0.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  {onCreateTask && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsCreateOpen(false);
                        onCreateTask();
                      }}
                      className="w-full min-h-[44px] sm:min-h-9 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left font-medium"
                    >
                      <CheckSquare className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                      <span>Tạo công việc mới</span>
                    </button>
                  )}
                  {onCreateEvent && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setIsCreateOpen(false);
                        onCreateEvent();
                      }}
                      className="w-full min-h-[44px] sm:min-h-9 flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs text-foreground hover:bg-secondary transition-colors text-left font-medium"
                    >
                      <CalendarIcon className="size-3.5 text-primary shrink-0" strokeWidth={1.5} />
                      <span>Tạo sự kiện lịch biểu</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Hàng 2: Scope Radiogroup + Lọc lịch + Bộ lọc + Hiển thị */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 border-t border-border/50">
        {/* Scope: Role is not scope — scope is a dataset filter, never a permission model */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium hidden md:inline">
            Phạm vi:
          </span>
          <div
            role="radiogroup"
            aria-label="Phạm vi công việc"
            className="inline-flex items-center rounded-xl border border-border/70 bg-background p-0.5 shadow-2xs"
          >
            {SCOPE_OPTIONS.map((opt) => {
              const isSelected = scope === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  onClick={() => onScopeChange(opt.id)}
                  className={cn(
                    "min-h-[44px] sm:min-h-8 px-2.5 py-1 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                    isSelected
                      ? "bg-secondary text-foreground shadow-2xs font-bold border border-border/50"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="size-3 shrink-0" strokeWidth={1.5} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Secondary tools: Lọc lịch hiện tại (search) + Bộ lọc popover + Hiển thị popover */}
        <div className="flex items-center gap-1.5 ml-auto">
          {/* Search: "Lọc lịch hiện tại" — scoped to current calendar view, not global search */}
          <div className="relative">
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Lọc lịch hiện tại..."
              aria-label="Lọc lịch hiện tại"
              className="min-h-[44px] sm:min-h-8 h-8 w-32 sm:w-44 lg:w-52 pl-8 pr-7 text-xs rounded-xl border border-border/70 bg-background text-foreground focus:outline-hidden focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none"
              strokeWidth={1.5}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded"
                aria-label="Xóa bộ lọc"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Filter Popover: Loại + Cấp + Trạng thái */}
          <div className="relative" ref={filterRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsFilterOpen((prev) => !prev)}
              className={cn(
                "min-h-[44px] sm:min-h-8 h-8 px-2.5 text-xs font-semibold rounded-xl border-border/70 gap-1.5",
                hasActiveFilters && "border-primary/50 bg-primary/5 text-primary"
              )}
              aria-expanded={isFilterOpen}
              aria-haspopup="true"
              aria-label="Bộ lọc nhiệm vụ và sự kiện"
            >
              <Filter className="size-3.5" strokeWidth={1.5} />
              <span className="hidden sm:inline">Lọc</span>
              {hasActiveFilters && (
                <span className="size-1.5 rounded-full bg-primary inline-block" />
              )}
            </Button>

            {isFilterOpen && (
              <div
                role="dialog"
                aria-label="Bộ lọc lịch"
                className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 rounded-2xl border border-border/70 bg-card p-4 shadow-xl z-30 space-y-3.5 animate-in fade-in zoom-in-95 duration-100 text-xs"
              >
                <div className="flex items-center justify-between pb-2 border-b border-border/50">
                  <span className="font-bold text-foreground">Bộ lọc</span>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={() => {
                        onResetFilters();
                        setIsFilterOpen(false);
                      }}
                      className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded"
                    >
                      <RotateCcw className="size-3" strokeWidth={1.5} />
                      Đặt lại
                    </button>
                  )}
                </div>

                {/* Loại: sự kiện / nhiệm vụ */}
                {onItemTypeFilterChange && (
                  <div className="space-y-1.5">
                    <span className="text-muted-foreground font-medium block">Loại</span>
                    <div className="grid grid-cols-1 gap-1">
                      {ITEM_TYPE_OPTIONS.map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onItemTypeFilterChange(opt.id)}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors",
                            itemTypeFilter === opt.id
                              ? "bg-secondary text-foreground font-bold"
                              : "hover:bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <span>{opt.label}</span>
                          {itemTypeFilter === opt.id && <Check className="size-3 text-primary" strokeWidth={1.5} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cấp nhiệm vụ */}
                <div className={cn("space-y-1.5", onItemTypeFilterChange && "pt-1 border-t border-border/40")}>
                  <span className="text-muted-foreground font-medium block">Cấp nhiệm vụ</span>
                  <div className="grid grid-cols-1 gap-1">
                    {LEVEL_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onLevelFilterChange(opt.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors",
                          levelFilter === opt.id
                            ? "bg-secondary text-foreground font-bold"
                            : "hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <span>{opt.label}</span>
                        {levelFilter === opt.id && <Check className="size-3 text-primary" strokeWidth={1.5} />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Trạng thái tiến độ */}
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <span className="text-muted-foreground font-medium block">Trạng thái tiến độ</span>
                  <div className="grid grid-cols-1 gap-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => onStatusFilterChange(opt.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors",
                          statusFilter === opt.id
                            ? "bg-secondary text-foreground font-bold"
                            : "hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <span>{opt.label}</span>
                        {statusFilter === opt.id && <Check className="size-3 text-primary" strokeWidth={1.5} />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Display Popover: Hiện cuối tuần + Hiện hoàn thành + Mật độ */}
          <div className="relative" ref={displayRef}>
            <button
              type="button"
              onClick={() => setIsDisplayOpen((prev) => !prev)}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              aria-label="Tùy chọn hiển thị lịch"
              aria-expanded={isDisplayOpen}
              aria-haspopup="true"
            >
              <MoreHorizontal className="size-4" strokeWidth={1.5} />
            </button>

            {isDisplayOpen && (
              <div
                role="dialog"
                aria-label="Tùy chọn hiển thị"
                className="absolute right-0 top-full mt-1.5 w-60 rounded-2xl border border-border/70 bg-card p-3.5 shadow-xl z-30 space-y-3 animate-in fade-in zoom-in-95 duration-100 text-xs"
              >
                {/* Năm học selector */}
                {onAcademicYearChange && (
                  <div className="space-y-1.5">
                    <span className="font-bold text-foreground block">Năm học</span>
                    <div className="space-y-1">
                      {availableAcademicYears.map((yr) => (
                        <button
                          key={yr}
                          type="button"
                          onClick={() => {
                            onAcademicYearChange(yr);
                            setIsDisplayOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors",
                            academicYear === yr
                              ? "bg-secondary text-foreground font-bold"
                              : "hover:bg-muted/40 text-muted-foreground"
                          )}
                        >
                          <span className="font-mono tabular-nums">{yr}</span>
                          {academicYear === yr && <Check className="size-3 text-primary" strokeWidth={1.5} />}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Hiển thị */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <span className="font-bold text-foreground block">Hiển thị</span>

                  {onToggleWeekends && (
                    <label className="flex items-center justify-between gap-2 cursor-pointer py-1 text-muted-foreground hover:text-foreground min-h-[36px]">
                      <span>Hiện cuối tuần (T7, CN)</span>
                      <input
                        type="checkbox"
                        checked={showWeekends}
                        onChange={(e) => onToggleWeekends(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary size-4"
                      />
                    </label>
                  )}

                  {/* Hiện hoàn thành: default OFF (muted) per spec */}
                  {onToggleShowCompleted && (
                    <label className="flex items-center justify-between gap-2 cursor-pointer py-1 text-muted-foreground hover:text-foreground min-h-[36px]">
                      <span>Hiện hoàn thành</span>
                      <input
                        type="checkbox"
                        checked={showCompleted}
                        onChange={(e) => onToggleShowCompleted(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary size-4"
                      />
                    </label>
                  )}
                </div>

                {/* Mật độ: Compact | Comfortable — radio segment */}
                {(onDensityChange || onToggleCompactMode) && (
                  <div className="space-y-1.5 pt-2 border-t border-border/40">
                    <span className="font-bold text-foreground block">Mật độ</span>
                    <div
                      role="radiogroup"
                      aria-label="Mật độ hiển thị"
                      className="inline-flex items-center w-full rounded-xl border border-border/70 bg-background p-0.5 shadow-2xs"
                    >
                      {DENSITY_OPTIONS.map((opt) => {
                        const isActive = resolvedDensity === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            role="radio"
                            aria-checked={isActive}
                            onClick={() => {
                              if (onDensityChange) {
                                onDensityChange(opt.id);
                              } else if (onToggleCompactMode) {
                                onToggleCompactMode(opt.id === "compact");
                              }
                            }}
                            className={cn(
                              "flex-1 text-center px-2 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[36px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                              isActive
                                ? "bg-secondary text-foreground shadow-2xs"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
