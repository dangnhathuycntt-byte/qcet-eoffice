"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  formatDisplayDate,
  formatIsoDate,
  toIctDateTimeParts,
} from "@/lib/format/date";
import { FloatingPortal } from "./floating-portal";

export type DateGranularity = "day" | "month" | "quarter" | "half-year" | "year";

export interface VietnameseDatePickerProps {
  /** Giá trị ngày dạng ISO string `YYYY-MM-DD` hoặc rỗng */
  value?: string | null;
  /** Callback khi người dùng thay đổi ngày (trả về `YYYY-MM-DD` hoặc `""`) */
  onChange?: (isoDate: string) => void;
  /** Label hiển thị trên chip hoặc form input (ví dụ: "Bắt đầu:", "Hạn chót:") */
  label?: string;
  /** Placeholder khi chưa chọn ngày (mặc định: "Target date") */
  placeholder?: string;
  /** Icon hiển thị phía trước */
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
  /** Hiển thị dải nút chọn nhanh */
  showPresets?: boolean;
  /** Vị trí căn lề của Popover ("left" | "right" | "auto") */
  align?: "left" | "right" | "auto";
  /** ClassName bổ sung cho container */
  className?: string;
  /** ID cho input field nếu cần */
  id?: string;
}

const LINEAR_WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
];

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** Chuyển thứ trong tuần của JS (0 = Su, 1 = Mo, ..., 6 = Sa) sang index bắt đầu từ Su */
function getFirstDayOfWeekIndexSunday(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function VietnameseDatePicker({
  value,
  onChange,
  label,
  placeholder = "Target date",
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
  const [mode, setMode] = React.useState<DateGranularity>("day");
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Parse ngày hiện tại
  const selectedParts = React.useMemo(() => {
    return value ? toIctDateTimeParts(value) : null;
  }, [value]);

  const todayParts = React.useMemo(() => {
    return toIctDateTimeParts(new Date()) || {
      year: 2026,
      month: 9,
      day: 17,
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

  React.useEffect(() => {
    if (selectedParts) {
      setViewYear(selectedParts.year);
      setViewMonth(selectedParts.month);
    }
  }, [selectedParts]);

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

  const handleSelectDate = (year: number, month: number, day: number) => {
    const iso = `${year}-${pad2(month)}-${pad2(day)}`;
    onChange?.(iso);
    setIsOpen(false);
  };

  const handleClearDate = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
    setIsOpen(false);
  };

  // Calendar cells generation (Full 35 hoặc 42 ô chuẩn Linear/Apple)
  const calendarCells = React.useMemo(() => {
    const totalDaysInMonth = getDaysInMonth(viewYear, viewMonth);
    const firstDayOffset = getFirstDayOfWeekIndexSunday(viewYear, viewMonth);

    const prevMonthYear = viewMonth === 1 ? viewYear - 1 : viewYear;
    const prevMonth = viewMonth === 1 ? 12 : viewMonth - 1;
    const daysInPrevMonth = getDaysInMonth(prevMonthYear, prevMonth);

    const nextMonthYear = viewMonth === 12 ? viewYear + 1 : viewYear;
    const nextMonth = viewMonth === 12 ? 1 : viewMonth + 1;

    const cells: Array<{
      year: number;
      month: number;
      day: number;
      iso: string;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      isToday: boolean;
      isSelected: boolean;
    }> = [];

    // Tháng trước
    for (let i = firstDayOffset - 1; i >= 0; i--) {
      const dayNum = daysInPrevMonth - i;
      const iso = `${prevMonthYear}-${pad2(prevMonth)}-${pad2(dayNum)}`;
      const colIndex = cells.length % 7;
      cells.push({
        year: prevMonthYear,
        month: prevMonth,
        day: dayNum,
        iso,
        isCurrentMonth: false,
        isWeekend: colIndex === 0 || colIndex === 6,
        isToday:
          todayParts.year === prevMonthYear &&
          todayParts.month === prevMonth &&
          todayParts.day === dayNum,
        isSelected:
          selectedParts?.year === prevMonthYear &&
          selectedParts?.month === prevMonth &&
          selectedParts?.day === dayNum,
      });
    }

    // Tháng hiện tại
    for (let dayNum = 1; dayNum <= totalDaysInMonth; dayNum++) {
      const iso = `${viewYear}-${pad2(viewMonth)}-${pad2(dayNum)}`;
      const colIndex = (firstDayOffset + dayNum - 1) % 7;
      cells.push({
        year: viewYear,
        month: viewMonth,
        day: dayNum,
        iso,
        isCurrentMonth: true,
        isWeekend: colIndex === 0 || colIndex === 6,
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

    // Tháng sau
    const targetTotal = cells.length <= 35 ? 35 : 42;
    const nextMonthDaysToAdd = targetTotal - cells.length;

    for (let dayNum = 1; dayNum <= nextMonthDaysToAdd; dayNum++) {
      const iso = `${nextMonthYear}-${pad2(nextMonth)}-${pad2(dayNum)}`;
      const colIndex: number = cells.length % 7;
      cells.push({
        year: nextMonthYear,
        month: nextMonth,
        day: dayNum,
        iso,
        isCurrentMonth: false,
        isWeekend: colIndex === 0 || colIndex === 6,
        isToday:
          todayParts.year === nextMonthYear &&
          todayParts.month === nextMonth &&
          todayParts.day === dayNum,
        isSelected:
          selectedParts?.year === nextMonthYear &&
          selectedParts?.month === nextMonth &&
          selectedParts?.day === dayNum,
      });
    }

    return cells;
  }, [viewYear, viewMonth, todayParts, selectedParts]);

  // Options cho Mode Month / Quarter / Half-Year / Year
  const yearOptions = [viewYear, viewYear + 1];
  const fullYearOptions = [viewYear, viewYear + 1, viewYear + 2];

  const hasValue = Boolean(value);
  const displayDate = hasValue ? formatDisplayDate(value!) : "";
  const headerInputValue = hasValue ? `${displayDate}` : "";

  return (
    <div
      ref={containerRef}
      className={cn("relative inline-block text-left select-none", className)}
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
            "group inline-flex items-center gap-1.5 h-6.5 px-2 rounded-md border text-[11px] font-medium transition-all duration-150 cursor-pointer select-none",
            error
              ? "border-rose-300 bg-rose-50 text-rose-700"
              : isOpen
              ? "border-border bg-accent text-foreground shadow-2xs"
              : "border-border/60 bg-muted/30 hover:bg-accent hover:border-border text-foreground",
            hasValue ? "text-foreground" : "text-muted-foreground",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {icon || <CalendarIcon className="size-3 text-muted-foreground shrink-0" strokeWidth={1.5} />}
          {label && <span className={cn(error ? "text-rose-600" : "text-muted-foreground font-normal")}>{label}</span>}
          <span className={cn("tabular-nums", hasValue ? "text-foreground font-medium" : "text-muted-foreground")}>
            {hasValue ? displayDate : placeholder}
          </span>
        </button>
      ) : (
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setIsOpen((prev) => !prev)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={cn(
            "w-full flex items-center justify-between h-9 px-3 rounded-lg border border-border bg-background text-xs text-foreground font-mono tabular-nums transition-colors cursor-pointer",
            isOpen && "border-foreground/40",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          <div className="flex items-center gap-2">
            {icon || <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" strokeWidth={1.5} />}
            <span>{hasValue ? displayDate : placeholder}</span>
          </div>
          {hasValue && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClearDate}
              className="size-4 flex items-center justify-center rounded text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" strokeWidth={1.5} />
            </span>
          )}
        </button>
      )}

      {/* 2. Linear-Style Date Picker Popover Portal */}
      <FloatingPortal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        triggerRef={containerRef}
        align={align}
        offset={4}
        collisionPadding={12}
        ariaLabel="Chọn ngày trên lịch"
        className="w-[290px] p-3 text-foreground"
      >
        {/* Header Label */}
        <div className="text-[12px] font-normal text-muted-foreground mb-1.5 px-0.5">
          Target date
        </div>

        {/* Top Form Input with Clear Icon */}
        <div className="relative mb-2.5">
          <input
            type="text"
            readOnly
            value={headerInputValue}
            placeholder="Select date..."
            className="w-full h-8 px-2.5 text-[13px] font-sans text-foreground bg-background rounded-lg border border-border outline-none focus:border-foreground/40"
          />
          {hasValue && (
            <button
              type="button"
              onClick={handleClearDate}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5 transition-colors cursor-pointer"
              title="Xóa ngày"
            >
              <div className="size-3.5 rounded-full bg-muted-foreground/20 flex items-center justify-center">
                <X className="size-2 text-foreground" strokeWidth={1.5} />
              </div>
            </button>
          )}
        </div>

        {/* Granularity Segmented Control (Linear / Apple Style Capsule) */}
        <div className="flex items-center p-0.5 bg-muted/40 rounded-full mb-3 border border-border/40 select-none text-[11px]">
          {(
            [
              { key: "day", label: "Day" },
              { key: "month", label: "Month" },
              { key: "quarter", label: "Quarter" },
              { key: "half-year", label: "Half-year" },
              { key: "year", label: "Year" },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={cn(
                "py-1 rounded-full font-medium transition-all text-center cursor-pointer select-none whitespace-nowrap flex items-center justify-center leading-none",
                item.key === "half-year" ? "px-2.5" : "flex-1 px-1.5",
                mode === item.key
                  ? "bg-background text-foreground font-semibold shadow-2xs border border-border/40"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-accent/50"
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* MODE 1: DAY CALENDAR (Linear Style) */}
        {mode === "day" && (
          <div className="space-y-2">
            {/* Month Navigator Header */}
            <div className="flex items-center justify-between px-1 text-xs">
              <span className="font-semibold text-foreground">
                {MONTH_NAMES[viewMonth - 1]} {viewYear}
              </span>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setViewYear(todayParts.year);
                    setViewMonth(todayParts.month);
                  }}
                  title="Về tháng này"
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer mr-0.5"
                >
                  <ArrowRight className="size-3.5 -rotate-45" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronLeft className="size-3.5" strokeWidth={1.5} />
                </button>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
                >
                  <ChevronRight className="size-3.5" strokeWidth={1.5} />
                </button>
              </div>
            </div>

            {/* Weekday Grid (Su Mo Tu We Th Fr Sa) */}
            <div className="grid grid-cols-7 text-center">
              {LINEAR_WEEKDAYS.map((w) => (
                <div
                  key={w}
                  className="text-[11px] font-medium text-muted-foreground py-1 select-none"
                >
                  {w}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-y-1 text-center">
              {calendarCells.map((cell) => (
                <button
                  key={cell.iso}
                  type="button"
                  onClick={() => handleSelectDate(cell.year, cell.month, cell.day)}
                  className={cn(
                    "size-8 mx-auto flex items-center justify-center rounded-full text-xs transition-colors cursor-pointer",
                    cell.isCurrentMonth
                      ? "text-foreground font-normal"
                      : "text-muted-foreground/40",
                    cell.isSelected &&
                      "border-2 border-primary bg-primary/10 font-bold text-primary",
                    cell.isToday && !cell.isSelected && "font-bold text-primary underline"
                  )}
                >
                  {cell.day}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SCROLLABLE CONTAINER FOR NON-DAY MODES */}
        {mode !== "day" && (
          <div className="max-h-[220px] overflow-y-auto pr-1 space-y-3 pt-0.5">
            {/* MODE 2: MONTH PICKER */}
            {mode === "month" && (
              <div className="space-y-3">
                {yearOptions.map((yr) => (
                  <div key={yr} className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground px-1">
                      {yr}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {MONTH_SHORT.map((mName, mIdx) => {
                        const mNum = mIdx + 1;
                        const isSel = selectedParts?.year === yr && selectedParts?.month === mNum;
                        return (
                          <button
                            key={mName}
                            type="button"
                            onClick={() => {
                              const lastDay = getDaysInMonth(yr, mNum);
                              handleSelectDate(yr, mNum, lastDay);
                            }}
                            className={cn(
                              "h-7 rounded-full border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center",
                              isSel
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            )}
                          >
                            {mName}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MODE 3: QUARTER PICKER */}
            {mode === "quarter" && (
              <div className="space-y-3">
                {yearOptions.map((yr) => (
                  <div key={yr} className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground px-1">
                      {yr}
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { label: "Q1", endMonth: 3, endDay: 31 },
                        { label: "Q2", endMonth: 6, endDay: 30 },
                        { label: "Q3", endMonth: 9, endDay: 30 },
                        { label: "Q4", endMonth: 12, endDay: 31 },
                      ].map((q) => {
                        const isSel =
                          selectedParts?.year === yr &&
                          selectedParts?.month === q.endMonth;
                        return (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => handleSelectDate(yr, q.endMonth, q.endDay)}
                            className={cn(
                              "h-7 rounded-full border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center",
                              isSel
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            )}
                          >
                            {q.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MODE 4: HALF-YEAR PICKER */}
            {mode === "half-year" && (
              <div className="space-y-3">
                {yearOptions.map((yr) => (
                  <div key={yr} className="space-y-1.5">
                    <div className="text-[11px] font-semibold text-muted-foreground px-1">
                      {yr}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "H1", endMonth: 6, endDay: 30 },
                        { label: "H2", endMonth: 12, endDay: 31 },
                      ].map((h) => {
                        const isSel =
                          selectedParts?.year === yr &&
                          selectedParts?.month === h.endMonth;
                        return (
                          <button
                            key={h.label}
                            type="button"
                            onClick={() => handleSelectDate(yr, h.endMonth, h.endDay)}
                            className={cn(
                              "h-7 rounded-full border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center",
                              isSel
                                ? "border-primary bg-primary/10 text-primary font-semibold"
                                : "border-border bg-background text-foreground hover:bg-muted"
                            )}
                          >
                            {h.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* MODE 5: YEAR PICKER */}
            {mode === "year" && (
              <div className="space-y-1.5">
                {fullYearOptions.map((yr) => {
                  const isSel = selectedParts?.year === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleSelectDate(yr, 12, 31)}
                      className={cn(
                        "w-full h-8 rounded-full border text-xs font-medium transition-colors cursor-pointer flex items-center justify-center",
                        isSel
                          ? "border-primary bg-primary/10 text-primary font-semibold"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </FloatingPortal>
    </div>
  );
}

export default VietnameseDatePicker;
