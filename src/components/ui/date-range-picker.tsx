"use client";

import * as React from "react";
import { Calendar, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DateRange {
  from?: string; // YYYY-MM-DD or DD/MM/YYYY
  to?: string;   // YYYY-MM-DD or DD/MM/YYYY
}

export interface DateRangePreset {
  label: string;
  getValue: () => DateRange;
}

export const QCET_DATE_PRESETS: DateRangePreset[] = [
  {
    label: "Tuần này",
    getValue: () => {
      const now = new Date();
      const first = now.getDate() - now.getDay() + (now.getDay() === 0 ? -6 : 1);
      const monday = new Date(now.setDate(first));
      const sunday = new Date(now.setDate(monday.getDate() + 6));
      return {
        from: monday.toISOString().split("T")[0],
        to: sunday.toISOString().split("T")[0],
      };
    },
  },
  {
    label: "Tháng này",
    getValue: () => {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return {
        from: first.toISOString().split("T")[0],
        to: last.toISOString().split("T")[0],
      };
    },
  },
  {
    label: "Quý này",
    getValue: () => {
      const now = new Date();
      const quarter = Math.floor(now.getMonth() / 3);
      const first = new Date(now.getFullYear(), quarter * 3, 1);
      const last = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      return {
        from: first.toISOString().split("T")[0],
        to: last.toISOString().split("T")[0],
      };
    },
  },
  {
    label: "Học kỳ 1",
    getValue: () => ({
      from: "2026-09-01",
      to: "2027-01-15",
    }),
  },
  {
    label: "Học kỳ 2",
    getValue: () => ({
      from: "2027-01-16",
      to: "2027-06-30",
    }),
  },
  {
    label: "Năm học 2026–2027",
    getValue: () => ({
      from: "2026-09-01",
      to: "2027-08-31",
    }),
  },
];

export interface DateRangePickerProps {
  value?: DateRange;
  defaultValue?: DateRange;
  onChange?: (range: DateRange) => void;
  presets?: DateRangePreset[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
}

function formatDateDisplay(dateStr?: string) {
  if (!dateStr) return "";
  if (dateStr.includes("-")) {
    const [y, m, d] = dateStr.split("-");
    return `${d}/${m}/${y}`;
  }
  return dateStr;
}

/**
 * Bộ chọn khoảng thời gian kép kèm phím tắt mốc thời gian / năm học QCET.
 * Chuẩn QCET: Artboard Components4 (Khoảng thời gian · bộ lọc Mốc thời gian).
 */
export function DateRangePicker({
  value: controlledValue,
  defaultValue,
  onChange,
  presets = QCET_DATE_PRESETS,
  placeholder = "Chọn khoảng thời gian...",
  label,
  disabled = false,
  invalid = false,
  className,
  id,
}: DateRangePickerProps) {
  const [internalValue, setInternalValue] = React.useState<DateRange>(defaultValue ?? {});
  const [isOpen, setIsOpen] = React.useState(false);
  const [fromInput, setFromInput] = React.useState(controlledValue?.from ?? defaultValue?.from ?? "");
  const [toInput, setToInput] = React.useState(controlledValue?.to ?? defaultValue?.to ?? "");
  const containerRef = React.useRef<HTMLDivElement>(null);

  const range = controlledValue ?? internalValue;

  const updateRange = (newRange: DateRange) => {
    if (controlledValue === undefined) {
      setInternalValue(newRange);
    }
    setFromInput(newRange.from ?? "");
    setToInput(newRange.to ?? "");
    onChange?.(newRange);
  };

  const handleApplyCustom = () => {
    updateRange({ from: fromInput, to: toInput });
    setIsOpen(false);
  };

  const handlePresetSelect = (preset: DateRangePreset) => {
    const val = preset.getValue();
    updateRange(val);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateRange({});
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasValue = Boolean(range.from || range.to);
  const displayLabel = hasValue
    ? `${formatDateDisplay(range.from)} – ${formatDateDisplay(range.to)}`
    : placeholder;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}

      <div
        id={id}
        tabIndex={disabled ? -1 : 0}
        role="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => {
          if (!disabled) setIsOpen((prev) => !prev);
        }}
        className={cn(
          "relative flex h-9 sm:h-9 w-full items-center justify-between gap-2 rounded-xl bg-secondary px-3 text-sm select-none",
          "transition-colors duration-100 motion-reduce:transition-none",
          "hover:bg-accent focus:bg-selected focus:outline-2 focus:outline-primary focus:outline-offset-1 outline-none",
          disabled && "cursor-not-allowed opacity-50",
          invalid && "bg-danger-soft text-destructive",
          !disabled && "cursor-pointer"
        )}
      >
        <div className="flex items-center gap-2 truncate">
          <Calendar className="size-4 text-muted-foreground shrink-0" />
          <span className={cn("truncate font-medium", !hasValue && "text-muted-foreground font-normal")}>
            {displayLabel}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {hasValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Xóa khoảng thời gian"
            >
              <X className="size-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground transition-transform duration-200",
              isOpen && "rotate-180"
            )}
          />
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 z-50 mt-1 flex flex-col sm:flex-row rounded-2xl bg-popover text-popover-foreground shadow-menu outline-none border-0 overflow-hidden min-w-[320px]">
          {/* Presets Column */}
          <div className="flex flex-col border-0 p-2 bg-secondary min-w-[140px] gap-0.5">
            <span className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Chọn nhanh
            </span>
            {presets.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className="text-left px-2.5 py-1.5 text-xs rounded-lg hover:bg-accent hover:text-accent-foreground font-medium text-foreground transition-colors cursor-pointer"
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="p-3.5 flex flex-col gap-3 flex-1">
            <span className="text-xs font-semibold text-foreground block">
              Tùy chỉnh khoảng ngày
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={fromInput}
                  onChange={(e) => setFromInput(e.target.value)}
                  className="h-8 w-full rounded-lg border-0 bg-secondary px-2 text-xs font-medium text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={toInput}
                  onChange={(e) => setToInput(e.target.value)}
                  className="h-8 w-full rounded-lg border-0 bg-secondary px-2 text-xs font-medium text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1 border-0">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-7 px-3 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted"
              >
                Đóng
              </button>
              <button
                type="button"
                onClick={handleApplyCustom}
                className="h-7 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:bg-primary-hover transition-colors"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
