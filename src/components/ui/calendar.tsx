"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CalendarProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "onSelect"> {
  selected?: Date | null;
  onSelect?: (date: Date) => void;
  defaultMonth?: Date;
  minDate?: Date;
  maxDate?: Date;
  disabledDates?: Date[];
}

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

/**
 * Thành phần lịch tháng độc lập tiếng Việt chuẩn QCET.
 * Không viền hộp, không bóng đổ, hỗ trợ điều hướng tháng/năm và chọn ngày trực quan.
 */
export function Calendar({
  selected,
  onSelect,
  defaultMonth,
  minDate,
  maxDate,
  disabledDates = [],
  className,
  ...props
}: CalendarProps) {
  const [currentMonth, setCurrentMonth] = React.useState<Date>(
    () => defaultMonth || selected || new Date()
  );

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth(); // 0 - 11

  // Handle month navigation
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Days calculations
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDays = lastDayOfMonth.getDate();

  // Day of week for 1st of month: Sunday is 0 -> convert to Monday as 0 (0: Mon, ..., 6: Sun)
  const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;

  // Previous month trailing days
  const prevMonthLastDay = new Date(year, month, 0).getDate();
  const prevDays = Array.from(
    { length: firstDayWeekday },
    (_, i) => prevMonthLastDay - firstDayWeekday + i + 1
  );

  // Current month days
  const currentDays = Array.from({ length: totalDays }, (_, i) => i + 1);

  // Next month leading days to fill grid (total cells multiple of 7)
  const totalCells = prevDays.length + currentDays.length;
  const nextDaysCount = (7 - (totalCells % 7)) % 7;
  const nextDays = Array.from({ length: nextDaysCount }, (_, i) => i + 1);

  const today = new Date();
  const isToday = (d: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === d;

  const isSelected = (d: number) => {
    if (!selected) return false;
    return (
      selected.getFullYear() === year &&
      selected.getMonth() === month &&
      selected.getDate() === d
    );
  };

  const isDateDisabled = (d: number) => {
    const target = new Date(year, month, d);
    if (minDate && target < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) {
      return true;
    }
    if (maxDate && target > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) {
      return true;
    }
    return disabledDates.some(
      (dd) =>
        dd.getFullYear() === target.getFullYear() &&
        dd.getMonth() === target.getMonth() &&
        dd.getDate() === target.getDate()
    );
  };

  return (
    <div className={cn("w-[280px] p-3 select-none", className)} {...props}>
      {/* Header: Month / Year & Navigation */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-sm font-semibold text-foreground">
          Tháng {month + 1}, {year}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handlePrevMonth}
            aria-label="Tháng trước"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none hover:bg-accent hover:text-foreground outline-none focus-visible:outline-2 focus-visible:outline-primary cursor-pointer relative before:absolute before:-inset-2 before:content-[''] touch-manipulation"
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            onClick={handleNextMonth}
            aria-label="Tháng sau"
            className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none hover:bg-accent hover:text-foreground outline-none focus-visible:outline-2 focus-visible:outline-primary cursor-pointer relative before:absolute before:-inset-2 before:content-[''] touch-manipulation"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS.map((day) => (
          <span key={day} className="text-xs font-medium text-muted-foreground h-7 flex items-center justify-center">
            {day}
          </span>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1 text-center">
        {/* Previous month days */}
        {prevDays.map((d) => (
          <span
            key={`prev-${d}`}
            className="flex size-8 items-center justify-center text-xs text-muted-foreground/40 tabular-nums pointer-events-none"
          >
            {d}
          </span>
        ))}

        {/* Current month days */}
        {currentDays.map((d) => {
          const disabled = isDateDisabled(d);
          const active = isSelected(d);
          const current = isToday(d);

          return (
            <button
              key={`curr-${d}`}
              type="button"
              disabled={disabled}
              onClick={() => onSelect?.(new Date(year, month, d))}
              className={cn(
                "flex size-8 items-center justify-center rounded-full text-xs tabular-nums transition-colors duration-[var(--motion-duration-micro)] motion-reduce:transition-none outline-none cursor-pointer focus-visible:outline-2 focus-visible:outline-primary relative before:absolute before:-inset-1 before:content-[''] touch-manipulation",
                active
                  ? "bg-primary text-primary-foreground font-semibold"
                  : current
                    ? "text-primary font-semibold hover:bg-accent"
                    : "text-foreground hover:bg-accent",
                disabled && "opacity-30 cursor-not-allowed pointer-events-none"
              )}
            >
              {d}
            </button>
          );
        })}

        {/* Next month days */}
        {nextDays.map((d) => (
          <span
            key={`next-${d}`}
            className="flex size-8 items-center justify-center text-xs text-muted-foreground/40 tabular-nums pointer-events-none"
          >
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}
