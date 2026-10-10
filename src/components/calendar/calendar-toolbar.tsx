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
import { StandardMenu } from "@/components/ui/menu";
import {
  PopoverRoot,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/pressable";

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
  { id: "OVERDUE", label: "Trễ hạn" },
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

  // Derive density from legacy compactMode if new prop not provided
  const resolvedDensity: CalendarDensity =
    density !== "comfortable" ? density : compactMode ? "compact" : density;

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
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              aria-label={prevLabel(viewMode)}
            >
              <ChevronLeft className="size-4" strokeWidth={1.5} />
            </button>
            <button
              type="button"
              onClick={onNext}
              className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
              aria-label={nextLabel(viewMode)}
            >
              <ChevronRight className="size-4" strokeWidth={1.5} />
            </button>
          </div>

          <h2 className="text-sm sm:text-base font-bold text-foreground font-heading font-mono tabular-nums px-1">
            {currentPeriodLabel}
          </h2>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToday}
            className="min-h-[44px] sm:min-h-8 h-8 px-2.5 text-xs font-semibold rounded-lg border-border/70 hover:bg-secondary cursor-pointer"
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
            className="inline-flex h-7 items-center rounded-md border border-border/80 bg-muted/30 p-0.5 text-xs shrink-0 select-none"
          >
            {VIEW_OPTIONS.map((option) => {
              const isActive = viewMode === option.id;
              return (
                <Pressable
                  key={option.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onViewChange(option.id)}
                  className={cn(
                    "inline-flex items-center justify-center h-6 px-2.5 rounded-[4px] text-xs font-medium transition-colors cursor-pointer select-none",
                    isActive
                      ? "bg-background text-foreground shadow-2xs font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  {option.label}
                </Pressable>
              );
            })}
          </div>

          {/* Single primary CTA: +Tạo dropdown — StandardMenu */}
          {(onCreateTask || onCreateEvent) && (
            <StandardMenu
              align="end"
              side="bottom"
              sideOffset={6}
              trigger={
                <Button
                  type="button"
                  size="sm"
                  className="min-h-[44px] sm:min-h-8 h-8 px-3 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 gap-1 cursor-pointer"
                  aria-label="Tạo mới"
                >
                  <Plus className="size-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Tạo mới</span>
                  <ChevronDown className="size-3 opacity-80" strokeWidth={1.5} />
                </Button>
              }
              items={[
                ...(onCreateTask
                  ? [
                      {
                        id: "create-task",
                        label: "Tạo công việc mới",
                        icon: CheckSquare,
                        onClick: onCreateTask,
                      },
                    ]
                  : []),
                ...(onCreateEvent
                  ? [
                      {
                        id: "create-event",
                        label: "Tạo sự kiện lịch biểu",
                        icon: CalendarIcon,
                        onClick: onCreateEvent,
                      },
                    ]
                  : []),
              ]}
            />
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
                    "min-h-[44px] sm:min-h-8 px-2.5 py-1 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
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
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded cursor-pointer"
                aria-label="Xóa bộ lọc"
              >
                <X className="size-3" strokeWidth={1.5} />
              </button>
            )}
          </div>

          {/* Filter Popover: Loại + Cấp + Trạng thái */}
          <PopoverRoot open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger
              render={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-7 px-2.5 text-xs font-medium rounded-md border border-border/80 bg-background hover:bg-accent gap-1.5 cursor-pointer text-foreground",
                    hasActiveFilters && "border-foreground/40 bg-muted/60 text-foreground font-semibold"
                  )}
                  aria-label="Bộ lọc nhiệm vụ và sự kiện"
                >
                  <Filter className="size-3.5" strokeWidth={1.5} />
                  <span className="hidden sm:inline">Lọc</span>
                  {hasActiveFilters && (
                    <span className="size-1.5 rounded-full bg-foreground/80 inline-block" />
                  )}
                </Button>
              }
            />

            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-64 sm:w-72 rounded-2xl border border-border/70 bg-card p-4 shadow-xl z-50 space-y-3.5 text-xs"
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
                    className="text-xs text-foreground/85 hover:underline inline-flex items-center gap-1 font-semibold focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary rounded cursor-pointer"
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
                      <Pressable
                        key={opt.id}
                        type="button"
                        onClick={() => onItemTypeFilterChange(opt.id)}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors cursor-pointer",
                          itemTypeFilter === opt.id
                            ? "bg-secondary text-foreground font-bold"
                            : "hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <span>{opt.label}</span>
                        {itemTypeFilter === opt.id && <Check className="size-3 text-foreground/85" strokeWidth={1.5} />}
                      </Pressable>
                    ))}
                  </div>
                </div>
              )}

              {/* Cấp nhiệm vụ */}
              <div className={cn("space-y-1.5", onItemTypeFilterChange && "pt-1 border-t border-border/40")}>
                <span className="text-muted-foreground font-medium block">Cấp nhiệm vụ</span>
                <div className="grid grid-cols-1 gap-1">
                  {LEVEL_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      type="button"
                      onClick={() => onLevelFilterChange(opt.id)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors cursor-pointer",
                        levelFilter === opt.id
                          ? "bg-secondary text-foreground font-bold"
                          : "hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <span>{opt.label}</span>
                      {levelFilter === opt.id && <Check className="size-3 text-foreground/85" strokeWidth={1.5} />}
                    </Pressable>
                  ))}
                </div>
              </div>

              {/* Trạng thái tiến độ */}
              <div className="space-y-1.5 pt-1 border-t border-border/40">
                <span className="text-muted-foreground font-medium block">Trạng thái tiến độ</span>
                <div className="grid grid-cols-1 gap-1">
                  {STATUS_OPTIONS.map((opt) => (
                    <Pressable
                      key={opt.id}
                      type="button"
                      onClick={() => onStatusFilterChange(opt.id)}
                      className={cn(
                        "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors cursor-pointer",
                        statusFilter === opt.id
                          ? "bg-secondary text-foreground font-bold"
                          : "hover:bg-muted/40 text-muted-foreground"
                      )}
                    >
                      <span>{opt.label}</span>
                      {statusFilter === opt.id && <Check className="size-3 text-foreground/85" strokeWidth={1.5} />}
                    </Pressable>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </PopoverRoot>

          {/* Display Popover: Hiện cuối tuần + Hiện hoàn thành + Mật độ */}
          <PopoverRoot open={isDisplayOpen} onOpenChange={setIsDisplayOpen}>
            <PopoverTrigger
              render={
                <button
                  type="button"
                  className="inline-flex min-h-[44px] min-w-[44px] sm:min-h-8 sm:min-w-8 items-center justify-center rounded-xl border border-border/70 bg-background text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                  aria-label="Tùy chọn hiển thị lịch"
                >
                  <MoreHorizontal className="size-4" strokeWidth={1.5} />
                </button>
              }
            />

            <PopoverContent
              align="end"
              side="bottom"
              sideOffset={6}
              className="w-60 rounded-2xl border border-border/70 bg-card p-3.5 shadow-xl z-50 space-y-3 text-xs"
            >
              {/* Năm học selector */}
              {onAcademicYearChange && (
                <div className="space-y-1.5">
                  <span className="font-bold text-foreground block">Năm học</span>
                  <div className="space-y-1">
                    {availableAcademicYears.map((yr) => (
                      <Pressable
                        key={yr}
                        type="button"
                        onClick={() => {
                          onAcademicYearChange(yr);
                          setIsDisplayOpen(false);
                        }}
                        className={cn(
                          "w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between font-medium min-h-[36px] transition-colors cursor-pointer",
                          academicYear === yr
                            ? "bg-secondary text-foreground font-bold"
                            : "hover:bg-muted/40 text-muted-foreground"
                        )}
                      >
                        <span className="font-mono tabular-nums">{yr}</span>
                        {academicYear === yr && <Check className="size-3 text-foreground/85" strokeWidth={1.5} />}
                      </Pressable>
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
                      className="rounded border-border/80 text-foreground/85 focus:ring-foreground/20 size-3.5 accent-foreground/85 cursor-pointer"
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
                      className="rounded border-border/80 text-foreground/85 focus:ring-foreground/20 size-3.5 accent-foreground/85 cursor-pointer"
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
                            "flex-1 text-center px-2 py-1.5 text-xs font-semibold rounded-lg transition-all min-h-[36px] focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary cursor-pointer",
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
            </PopoverContent>
          </PopoverRoot>
        </div>
      </div>

      {/* Active Filter Breadcrumbs: Flat informational pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/60">
          {itemTypeFilter && itemTypeFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 select-none">
              <span className="text-muted-foreground text-xs">Loại:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {ITEM_TYPE_OPTIONS.find((o) => o.id === itemTypeFilter)?.label}
              </span>
              <Pressable
                type="button"
                onClick={() => onItemTypeFilterChange?.("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc loại"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </Pressable>
            </span>
          )}
          {levelFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 select-none">
              <span className="text-muted-foreground text-xs">Cấp:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {LEVEL_OPTIONS.find((o) => o.id === levelFilter)?.label}
              </span>
              <Pressable
                type="button"
                onClick={() => onLevelFilterChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc cấp"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </Pressable>
            </span>
          )}
          {statusFilter !== "ALL" && (
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-muted/50 text-xs text-foreground/90 select-none">
              <span className="text-muted-foreground text-xs">Trạng thái:</span>
              <span className="font-medium text-xs truncate max-w-[200px]">
                {STATUS_OPTIONS.find((o) => o.id === statusFilter)?.label}
              </span>
              <Pressable
                type="button"
                onClick={() => onStatusFilterChange("ALL")}
                className="size-3.5 -mr-0.5 flex items-center justify-center rounded-sm text-muted-foreground/50 hover:text-foreground hover:bg-black/6 transition-colors cursor-pointer"
                aria-label="Xóa lọc trạng thái"
              >
                <X className="size-2.5" strokeWidth={1.5} />
              </Pressable>
            </span>
          )}
          <Pressable
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer ml-1"
          >
            <RotateCcw className="size-3" strokeWidth={1.5} />
            <span>Xóa lọc</span>
          </Pressable>
        </div>
      )}
    </div>
  );
}
