"use client";

import * as React from "react";
import {
  Calendar,
  ChevronDown,
  Check,
  Layers,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ACADEMIC_MONTH_ORDER,
  getAcademicYear,
  getAcademicMonthPeriod,
} from "@/lib/academic-calendar";

export type PeriodFilterValue = number | "ALL";

export interface SemesterOption {
  id: string;
  label: string;
  shortLabel: string;
  months: number[];
}

export const ACADEMIC_SEMESTERS: SemesterOption[] = [
  {
    id: "hk1",
    label: "Học kỳ I",
    shortLabel: "HK I",
    months: [9, 10, 11, 12],
  },
  {
    id: "hk2",
    label: "Học kỳ II",
    shortLabel: "HK II",
    months: [1, 2, 3, 4, 5],
  },
  {
    id: "summer",
    label: "Học kỳ Hè",
    shortLabel: "HK Hè",
    months: [6, 7, 8],
  },
];

export interface PeriodSelectorProps {
  selectedMonth: PeriodFilterValue;
  onMonthChange: (month: PeriodFilterValue) => void;
  academicYear?: string;
  monthlyCounts?: Record<number, number>;
  className?: string;
  size?: "default" | "sm" | "lg";
  disabled?: boolean;
  showSemesterPresets?: boolean;
}

/**
 * PeriodSelector - Canonical academic period and month selector.
 * Complies with QCET academic calendar invariants (Tháng 9 to Tháng 8).
 * WCAG 2.2 AA compliant, 44px+ touch targets on mobile, senior ergonomics.
 * Strictly Light-Only with zero dark: classes and zero emojis.
 */
export function PeriodSelector({
  selectedMonth,
  onMonthChange,
  academicYear: customAcademicYear,
  monthlyCounts,
  className,
  size = "default",
  disabled = false,
  showSemesterPresets = true,
}: PeriodSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  const academicYear = React.useMemo(() => {
    return customAcademicYear || getAcademicYear(new Date());
  }, [customAcademicYear]);

  // Handle click outside to close popover
  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const selectedLabel = React.useMemo(() => {
    if (selectedMonth === "ALL") {
      return `Cả năm học (${academicYear})`;
    }
    try {
      const info = getAcademicMonthPeriod(selectedMonth, academicYear);
      return info?.label || `Tháng ${selectedMonth}`;
    } catch {
      return `Tháng ${selectedMonth}`;
    }
  }, [selectedMonth, academicYear]);

  const handleSelect = (month: PeriodFilterValue) => {
    onMonthChange(month);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  const sizeClasses = {
    sm: "min-h-[40px] px-3 py-1.5 text-xs gap-1.5",
    default: "min-h-[44px] px-3.5 py-2 text-sm gap-2",
    lg: "min-h-[48px] px-4 py-2.5 text-base gap-2.5",
  };

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={`Chọn kỳ học: Hiện đang chọn ${selectedLabel}`}
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={cn(
          "inline-flex items-center justify-between rounded-xl bg-white border border-slate-200 text-slate-900 font-medium shadow-xs transition-all select-none",
          "hover:bg-slate-50 hover:border-slate-300 active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
          sizeClasses[size],
          disabled && "opacity-50 cursor-not-allowed",
          isOpen && "ring-2 ring-blue-600/20 border-blue-600"
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <Calendar
            className="size-4 text-blue-600 shrink-0"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <span className="font-semibold truncate">{selectedLabel}</span>
        </span>
        <ChevronDown
          className={cn(
            "size-4 text-slate-500 shrink-0 transition-transform duration-200",
            isOpen && "rotate-180 text-blue-600"
          )}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Bảng chọn kỳ học và tháng công việc"
          className={cn(
            "absolute z-50 mt-2 left-0 sm:left-auto sm:right-0 w-[calc(100vw-32px)] sm:w-[360px] rounded-2xl bg-white p-4 shadow-xl border border-slate-200",
            "animate-in fade-in-0 zoom-in-95 duration-150"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Năm học {academicYear}
            </span>
            <button
              type="button"
              onClick={() => handleSelect("ALL")}
              className={cn(
                "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors min-h-[44px]",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                selectedMonth === "ALL"
                  ? "bg-blue-50 text-blue-800 border border-blue-200"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              )}
            >
              <Layers className="size-3.5 text-blue-600" aria-hidden="true" />
              <span>Tất cả các tháng</span>
              {selectedMonth === "ALL" && (
                <Check className="size-3.5 text-blue-600" aria-hidden="true" />
              )}
            </button>
          </div>

          {/* Semesters / Quick shortcuts */}
          {showSemesterPresets && (
            <div className="mb-3">
              <span className="text-[11px] font-semibold text-slate-600 block mb-1.5">
                Phân kỳ học kỳ
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {ACADEMIC_SEMESTERS.map((sem) => {
                  const isSelected =
                    selectedMonth !== "ALL" &&
                    sem.months.includes(selectedMonth);

                  return (
                    <div
                      key={sem.id}
                      className={cn(
                        "flex flex-col rounded-lg p-1.5 text-center border text-xs",
                        isSelected
                          ? "bg-blue-50/50 border-blue-300"
                          : "bg-slate-50 border-slate-200"
                      )}
                    >
                      <span className="font-bold text-slate-800">{sem.shortLabel}</span>
                      <span className="text-[10px] text-slate-600 mt-0.5">
                        T{sem.months[0]} - T{sem.months[sem.months.length - 1]}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* 12 Academic Months Grid in Canonical Academic Order [9 -> 8] */}
          <div>
            <span className="text-[11px] font-semibold text-slate-600 block mb-2">
              Các tháng trong năm học (Tháng 9 đến Tháng 8)
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {ACADEMIC_MONTH_ORDER.map((m) => {
                const isSelected = selectedMonth === m;
                const count = monthlyCounts?.[m];

                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => handleSelect(m)}
                    className={cn(
                      "relative flex flex-col items-center justify-center rounded-xl p-2 min-h-[48px] min-w-[44px] transition-all font-medium border text-xs",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600",
                      isSelected
                        ? "bg-blue-600 text-white border-blue-700 font-bold shadow-xs"
                        : "bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100 hover:border-slate-300"
                    )}
                  >
                    <span>Tháng {m}</span>
                    {typeof count === "number" && (
                      <span
                        className={cn(
                          "mt-0.5 text-[10px] font-mono",
                          isSelected ? "text-blue-100" : "text-slate-500"
                        )}
                      >
                        {count} việc
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
