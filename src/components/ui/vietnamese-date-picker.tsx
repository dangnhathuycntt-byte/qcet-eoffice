"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  X,
  RotateCcw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDisplayDate,
  formatIsoDate,
  toIctDateTimeParts,
} from "@/lib/format/date";

export interface VietnameseDatePickerProps {
  /** Giá trị ngày dạng ISO string `YYYY-MM-DD` hoặc rỗng */
  value?: string | null;
  /** Callback khi người dùng thay đổi ngày (trả về `YYYY-MM-DD` hoặc `""`) */
  onChange?: (isoDate: string) => void;
  /** Label hiển thị trên chip hoặc form input (ví dụ: "Bắt đầu:", "Hạn chót:") */
  label?: string;
  /** Placeholder khi chưa chọn ngày (mặc định: "dd/mm/yyyy") */
  placeholder?: string;
  /** Icon hiển thị phía trước (mặc định: Calendar hoặc CalendarClock nếu isDueDate=true) */
  icon?: React.ReactNode;
  /** Chế độ hiển thị: "chip" (Linear style) hoặc "input" (Standard form style) */
  variant?: "chip" | "input";
  /** Bắt buộc chọn hay không */
  required?: boolean;
  /** Vô hiệu hóa component */
  disabled?: boolean;
  /** Báo lỗi validation */
  error?: boolean | string;
  /** Giới hạn ngày tối thiểu (YYYY-MM-DD) */
  minDate?: string;
  /** Giới hạn ngày tối đa (YYYY-MM-DD) */
  maxDate?: string;
  /** Hiển thị dải nút chọn nhanh (Hôm nay, Ngày mai, +3 ngày, +7 ngày, Cuối tháng) */
  showPresets?: boolean;
  /** Vị trí căn lề của Popover ("left" | "right" | "auto") */
  align?: "left" | "right" | "auto";
  /** ClassName bổ sung cho container */
  className?: string;
  /** ID cho input field nếu cần */
  id?: string;
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Chuyển thứ trong tuần của JS (0 = CN, 1 = T2, ..., 6 = T7) sang index bắt đầu từ T2 (0 = T2, ..., 6 = CN) */
function getFirstDayOfWeekIndex(year: number, month: number): number {
  const day = new Date(year, month - 1, 1).getDay();
  return day === 0 ? 6 : day - 1;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function VietnameseDatePicker({
  value,
  onChange,
  label,
  placeholder = "dd/mm/yyyy",
  icon,
  variant = "chip",
  required = false,
  disabled = false,
  error,
  minDate,
  maxDate,
  showPresets = true,
  align = "auto",
  className,
  id,
}: VietnameseDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Parse ngày hiện tại được truyền vào
  const selectedParts = React.useMemo(() => {
    return value ? toIctDateTimeParts(value) : null;
  }, [value]);

  // Khởi tạo tháng/năm đang xem trên lịch
  const todayParts = React.useMemo(() => {
    return toIctDateTimeParts(new Date()) || {
      year: 2026,
      month: 9,
      day: 16,
      hour: 0,
      minute: 0,
      hasTime: false,
    };
  }, []);

  const [viewYear, setViewYear] = React.useState<number>(
    selectedParts?.year ?? todayParts.year
  );
  const [viewMonth, setViewMonth] = React.useState<number>(
    selectedParts?.month ?? todayParts.month
  );

  // Cập nhật view khi value thay đổi và mở picker
  React.useEffect(() => {
    if (selectedParts) {
      setViewYear(selectedParts.year);
      setViewMonth(selectedParts.month);
    }
  }, [selectedParts]);

  // Click outside listener
  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside, true);
    document.addEventListener("touchstart", handleClickOutside, true);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside, true);
      document.removeEventListener("touchstart", handleClickOutside, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Navigation handlers
  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setViewYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setViewYear((y) => y + 1);
  };

  const handleSelectDate = (year: number, month: number, day: number) => {
    const isoString = `${year}-${pad2(month)}-${pad2(day)}`;
    onChange?.(isoString);
    setIsOpen(false);
  };

  const handleClearDate = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange?.("");
    setIsOpen(false);
  };

  const handleSelectToday = () => {
    handleSelectDate(todayParts.year, todayParts.month, todayParts.day);
  };

  const handlePresetSelect = (daysOffset: number | "end_of_month") => {
    if (daysOffset === "end_of_month") {
      const daysInThisMonth = getDaysInMonth(todayParts.year, todayParts.month);
      handleSelectDate(todayParts.year, todayParts.month, daysInThisMonth);
      return;
    }

    const target = new Date();
    target.setDate(target.getDate() + daysOffset);
    const targetParts = toIctDateTimeParts(target);
    if (targetParts) {
      handleSelectDate(targetParts.year, targetParts.month, targetParts.day);
    }
  };

  // Tính toán grid 42 ô ngày
  const calendarCells = React.useMemo(() => {
    const totalDaysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDayOffset = getFirstDayOfWeekIndex(viewYear, viewMonth);

    // Tháng trước
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const prevYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const daysInPrevMonth = getDaysInMonth(prevYear, prevMonth);

    // Tháng sau
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;
    const nextYear = viewMonth === 12 ? viewYear + 1 : viewYear;

    const cells = [];

    // Ô của tháng trước
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const iso = `${prevYear}-${pad2(prevMonth)}-${pad2(dayNum)}`;
      cells.push({
        year: prevYear,
        month: prevMonth,
        day: dayNum,
        iso,
        isCurrentMonth: false,
        isToday:
          todayParts.year === prevYear &&
          todayParts.month === prevMonth &&
          todayParts.day === dayNum,
        isSelected:
          selectedParts?.year === prevYear &&
          selectedParts?.month === prevMonth &&
          selectedParts?.day === dayNum,
      });
    }

    // Ô của tháng hiện tại
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const iso = `${viewYear}-${pad2(viewMonth)}-${pad2(dayNum)}`;
      cells.push({
        year: viewYear,
        month: viewMonth,
        day: dayNum,
        iso,
        isCurrentMonth: true,
        isToday:
          todayParts.year === viewYear &&
          todayParts.month === viewMonth &&
          todayParts.day === dayNum,
        isSelected:
          selectedParts?.year === viewYear &&
          selectedParts?.month === viewMonth &&
          selectedParts?.day === dayNum,
      });
    }

    // Ô của tháng sau để đủ 35 hoặc 42 ô
    const totalRendered = cells.length;
    const targetTotal = totalRendered <= 35 ? 35 : 42;
    const nextMonthDaysToAdd = targetTotal - totalRendered;

    for (let dayNum = 1; dayNum <= nextMonthDaysToAdd; dayNum++) {
      const iso = `${nextYear}-${pad2(nextMonth)}-${pad2(dayNum)}`;
      cells.push({
        year: nextYear,
        month: nextMonth,
        day: dayNum,
        iso,
        isCurrentMonth: false,
        isToday:
          todayParts.year === nextYear &&
          todayParts.month === nextMonth &&
          todayParts.day === dayNum,
        isSelected:
          selectedParts?.year === nextYear &&
          selectedParts?.month === nextMonth &&
          selectedParts?.day === dayNum,
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayParts, selectedParts]);

  // Formatted date string để hiển thị trên UI
  const displayDate = React.useMemo(() => {
    if (!value) return "";
    return formatDisplayDate(value);
  }, [value]);

  const hasValue = Boolean(value && value.trim().length > 0);

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left", className)}
    >
      {/* 1. Trigger Area */}
      {variant === "chip" ? (
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn(
            "group inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs transition-all cursor-pointer select-none",
            error
              ? "bg-rose-50 text-rose-700 ring-1 ring-rose-200 hover:bg-rose-100/70"
              : hasValue
              ? "bg-primary/5 text-foreground font-medium hover:bg-primary/10 border border-primary/20"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent",
            disabled && "opacity-50 cursor-not-allowed",
            isOpen && "ring-2 ring-primary/20 border-primary/40 bg-accent/40"
          )}
        >
          {icon || (
            <CalendarIcon
              className={cn(
                "size-3.5 shrink-0",
                error
                  ? "text-rose-500"
                  : hasValue
                  ? "text-primary"
                  : "text-muted-foreground group-hover:text-foreground"
              )}
              strokeWidth={1.5}
            />
          )}

          {label && (
            <span
              className={cn(
                "font-medium",
                error ? "text-rose-700" : hasValue ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          )}

          <span
            className={cn(
              "font-mono tabular-nums",
              hasValue
                ? "text-foreground font-semibold"
                : "text-muted-foreground/70"
            )}
          >
            {hasValue ? displayDate : placeholder}
          </span>

          {hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              title="Xóa ngày"
              onClick={handleClearDate}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  handleClearDate(e as any);
                }
              }}
              className="ml-0.5 inline-flex size-3.5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X className="size-2.5" strokeWidth={1.5} />
            </span>
          )}
        </button>
      ) : (
        /* Standard Form Input Variant */
        <div className="relative flex items-center">
          <button
            type="button"
            id={id}
            disabled={disabled}
            onClick={() => !disabled && setIsOpen((prev) => !prev)}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            className={cn(
              "w-full flex items-center justify-between min-h-[40px] h-10 px-3 rounded-xl border bg-card text-xs text-foreground font-mono tabular-nums shadow-2xs transition-all cursor-pointer text-left",
              error
                ? "border-destructive ring-1 ring-destructive/30"
                : isOpen
                ? "border-primary ring-1 ring-primary/30"
                : "border-border/70 hover:border-border",
              disabled && "opacity-50 cursor-not-allowed bg-muted/30"
            )}
          >
            <div className="flex items-center gap-2 overflow-hidden">
              {icon || (
                <CalendarIcon
                  className={cn(
                    "size-4 shrink-0",
                    hasValue ? "text-primary" : "text-muted-foreground"
                  )}
                  strokeWidth={1.5}
                />
              )}
              {label && <span className="font-sans font-medium text-foreground">{label}</span>}
              <span className={cn(hasValue ? "text-foreground font-medium" : "text-muted-foreground")}>
                {hasValue ? displayDate : placeholder}
              </span>
            </div>

            <div className="flex items-center gap-1 shrink-0 ml-2">
              {hasValue && !disabled && (
                <span
                  role="button"
                  tabIndex={0}
                  title="Xóa ngày"
                  onClick={handleClearDate}
                  className="size-5 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X className="size-3" strokeWidth={1.5} />
                </span>
              )}
            </div>
          </button>
        </div>
      )}

      {/* 2. Popover Calendar Window */}
      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Chọn ngày trên lịch"
          className={cn(
            "absolute z-60 mt-1.5 w-[288px] sm:w-[304px] rounded-2xl border border-border/80 bg-popover/98 p-3.5 shadow-xl shadow-black/10 backdrop-blur-md animate-in fade-in-0 zoom-in-95 duration-150 text-popover-foreground",
            align === "right"
              ? "right-0"
              : align === "left"
              ? "left-0"
              : "left-0 sm:left-auto"
          )}
        >
          {/* Calendar Header: Month & Year Navigator */}
          <div className="flex items-center justify-between pb-2.5 border-b border-border/50">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handlePrevYear}
                title="Năm trước"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronsLeft className="size-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={handlePrevMonth}
                title="Tháng trước"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronLeft className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="flex items-center gap-1 font-semibold text-xs text-foreground select-none">
              <span>Tháng {viewMonth}</span>
              <span className="text-muted-foreground">,</span>
              <span className="font-mono">{viewYear}</span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleNextMonth}
                title="Tháng sau"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronRight className="size-3.5" strokeWidth={1.5} />
              </button>
              <button
                type="button"
                onClick={handleNextYear}
                title="Năm sau"
                className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              >
                <ChevronsRight className="size-3.5" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          {showPresets && (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none py-2 border-b border-border/40">
              <button
                type="button"
                onClick={() => handlePresetSelect(0)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/15 hover:text-primary text-[11px] font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(1)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/15 hover:text-primary text-[11px] font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                Ngày mai
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(3)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/15 hover:text-primary text-[11px] font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer shrink-0 font-mono"
              >
                +3 ngày
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect(7)}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/15 hover:text-primary text-[11px] font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer shrink-0 font-mono"
              >
                +1 tuần
              </button>
              <button
                type="button"
                onClick={() => handlePresetSelect("end_of_month")}
                className="px-2 py-0.5 rounded-md bg-muted/60 hover:bg-primary/15 hover:text-primary text-[11px] font-medium text-foreground transition-colors whitespace-nowrap cursor-pointer shrink-0"
              >
                Cuối tháng
              </button>
            </div>
          )}

          {/* Weekday Labels (T2 - CN) */}
          <div className="grid grid-cols-7 gap-1 pt-2 pb-1 text-center">
            {WEEKDAYS.map((w, idx) => (
              <div
                key={w}
                className={cn(
                  "text-[11px] font-semibold py-0.5 select-none",
                  idx >= 5 ? "text-amber-600/80" : "text-muted-foreground"
                )}
              >
                {w}
              </div>
            ))}
          </div>

          {/* Calendar Day Grid (7 cols) */}
          <div className="grid grid-cols-7 gap-1">
            {calendarCells.map((cell) => {
              const isCellDisabled = Boolean(
                (minDate && cell.iso < minDate) ||
                (maxDate && cell.iso > maxDate)
              );

              return (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={isCellDisabled}
                  onClick={() =>
                    !isCellDisabled &&
                    handleSelectDate(cell.year, cell.month, cell.day)
                  }
                  className={cn(
                    "relative size-8 sm:size-8.5 rounded-lg flex items-center justify-center text-xs font-mono tabular-nums transition-all cursor-pointer select-none",
                    // State: Selected
                    cell.isSelected
                      ? "bg-primary text-primary-foreground font-bold shadow-xs scale-100"
                      : // State: Today (not selected)
                      cell.isToday
                      ? "ring-1.5 ring-primary/70 font-semibold text-primary bg-primary/5 hover:bg-primary/15"
                      : // State: Normal current month vs out-of-month
                      cell.isCurrentMonth
                      ? "text-foreground hover:bg-muted/70 hover:text-foreground font-medium"
                      : "text-muted-foreground/35 hover:bg-muted/40 hover:text-muted-foreground/80 font-normal",
                    isCellDisabled &&
                      "opacity-25 cursor-not-allowed hover:bg-transparent"
                  )}
                  aria-label={`${cell.day}/${cell.month}/${cell.year}`}
                  aria-selected={cell.isSelected}
                >
                  <span>{cell.day}</span>
                  {cell.isToday && !cell.isSelected && (
                    <span className="absolute bottom-1 size-1 rounded-full bg-primary" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-2.5 mt-2 border-t border-border/50 text-xs">
            <button
              type="button"
              onClick={handleClearDate}
              disabled={!hasValue}
              className="text-xs font-medium text-muted-foreground hover:text-rose-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors cursor-pointer"
            >
              Xóa ngày
            </button>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleSelectToday}
                className="px-2 py-0.5 rounded-md text-xs font-medium text-primary hover:bg-primary/10 transition-colors cursor-pointer"
              >
                Hôm nay
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-2 py-0.5 rounded-md text-xs font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
