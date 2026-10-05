"use client";

import * as React from "react";
import { Clock, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const QCET_TIME_PRESETS = [
  "07:30",
  "08:00",
  "09:30",
  "13:30",
  "14:00",
  "15:30",
  "Cả ngày",
];

export interface TimePickerProps {
  value?: string;
  defaultValue?: string;
  onChange?: (time: string) => void;
  presets?: string[];
  placeholder?: string;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  id?: string;
}

/**
 * Điều khiển chọn giờ làm việc / lịch công tác QCET với phím chọn nhanh các ca học/họp.
 * Chuẩn QCET: Artboard Components5 (Chọn giờ · Lịch công tác).
 */
export function TimePicker({
  value: controlledValue,
  defaultValue = "",
  onChange,
  presets = QCET_TIME_PRESETS,
  placeholder = "Chọn giờ...",
  label,
  disabled = false,
  invalid = false,
  className,
  id,
}: TimePickerProps) {
  const [internalValue, setInternalValue] = React.useState<string>(defaultValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedValue = controlledValue !== undefined ? controlledValue : internalValue;

  const updateValue = (newVal: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newVal);
    }
    onChange?.(newVal);
  };

  const handleSelectPreset = (preset: string) => {
    updateValue(preset);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    updateValue("");
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
          <Clock className="size-4 text-muted-foreground shrink-0" />
          <span className={cn("truncate font-medium tabular-nums", !selectedValue && "text-muted-foreground font-normal")}>
            {selectedValue || placeholder}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Xóa giờ đã chọn"
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
        <div className="absolute left-0 z-50 mt-1 w-56 rounded-2xl bg-popover p-2 text-popover-foreground shadow-menu outline-none border-0">
          <div className="flex flex-col gap-2">
            <div className="px-1 py-0.5 text-xs font-medium text-muted-foreground">
              Ca làm việc & Giờ chuẩn
            </div>
            <div className="grid grid-cols-2 gap-1">
              {presets.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => handleSelectPreset(preset)}
                  className={cn(
                    "flex items-center justify-center h-8 rounded-lg text-xs font-medium transition-colors tabular-nums cursor-pointer",
                    selectedValue === preset
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "bg-secondary hover:bg-accent text-foreground"
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>

            <div className="pt-2 border-0">
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Hoặc nhập giờ tùy chọn
              </label>
              <input
                type="time"
                value={selectedValue.includes(":") ? selectedValue : ""}
                onChange={(e) => updateValue(e.target.value)}
                className="h-8 w-full rounded-lg border-0 bg-secondary px-2 text-xs font-medium text-foreground outline-none focus:bg-selected focus:outline-2 focus:outline-primary"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
