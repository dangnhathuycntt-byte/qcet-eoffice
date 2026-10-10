"use client";

import * as React from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface MultiSelectOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface MultiSelectProps {
  options: MultiSelectOption[];
  value?: string[];
  defaultValue?: string[];
  onValueChange?: (values: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  label?: string;
  disabled?: boolean;
  invalid?: boolean;
  maxChips?: number;
  className?: string;
  "aria-label"?: string;
  id?: string;
}

/**
 * Điều khiển chọn nhiều mục dạng chips/thẻ (MultiSelect), hỗ trợ xóa nhanh, phím Backspace, lọc tìm kiếm.
 * Chuẩn QCET: Artboard Components4 (Chọn nhiều mục · Phối hợp).
 */
export function MultiSelect({
  options,
  value: controlledValue,
  defaultValue = [],
  onValueChange,
  placeholder = "Chọn các mục...",
  searchPlaceholder = "Tìm kiếm...",
  emptyText = "Không có kết quả phù hợp",
  label,
  disabled = false,
  invalid = false,
  maxChips,
  className,
  "aria-label": ariaLabel,
  id,
}: MultiSelectProps) {
  const [internalValue, setInternalValue] = React.useState<string[]>(defaultValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedValues = controlledValue ?? internalValue;

  const updateValues = (newValues: string[]) => {
    if (controlledValue === undefined) {
      setInternalValue(newValues);
    }
    onValueChange?.(newValues);
  };

  const handleToggleOption = (val: string) => {
    if (disabled) return;
    if (selectedValues.includes(val)) {
      updateValues(selectedValues.filter((v) => v !== val));
    } else {
      updateValues([...selectedValues, val]);
    }
  };

  const handleRemoveValue = (val: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (disabled) return;
    updateValues(selectedValues.filter((v) => v !== val));
    inputRef.current?.focus();
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    updateValues([]);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && searchTerm === "" && selectedValues.length > 0) {
      const lastValue = selectedValues[selectedValues.length - 1];
      handleRemoveValue(lastValue);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setActiveIndex(-1);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        setActiveIndex(0);
      } else {
        setActiveIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0));
      }
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (isOpen) {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1));
      }
    } else if (e.key === "Enter") {
      if (isOpen && activeIndex >= 0 && activeIndex < filteredOptions.length) {
        e.preventDefault();
        const targetOption = filteredOptions[activeIndex];
        if (!targetOption.disabled) {
          handleToggleOption(targetOption.value);
        }
      }
    }
  };

  // Close dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    setActiveIndex(-1);
  }, [searchTerm, isOpen]);

  const filteredOptions = React.useMemo(() => {
    if (!searchTerm.trim()) return options;
    const term = searchTerm.toLowerCase();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.description && opt.description.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  const visibleValues = maxChips ? selectedValues.slice(0, maxChips) : selectedValues;
  const remainingCount = maxChips ? Math.max(0, selectedValues.length - maxChips) : 0;

  return (
    <div ref={containerRef} className={cn("relative w-full", className)}>
      {label && (
        <label htmlFor={id} className="block text-xs font-medium text-foreground mb-1.5">
          {label}
        </label>
      )}

      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen((prev) => !prev);
            inputRef.current?.focus();
          }
        }}
        className={cn(
          "relative flex min-h-9 w-full flex-wrap items-center gap-1.5 rounded-control bg-secondary px-2.5 py-1 text-sm",
          "transition-colors duration-100 motion-reduce:transition-none hover:bg-accent",
          "focus-within:bg-selected focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-1",
          disabled && "cursor-not-allowed opacity-50",
          invalid && "bg-danger-soft text-destructive",
          !disabled && "cursor-text"
        )}
      >
        {visibleValues.map((val) => {
          const opt = options.find((o) => o.value === val);
          const labelText = opt?.label ?? val;
          return (
            <span
              key={val}
              className="inline-flex h-6 items-center gap-1 rounded-md bg-background px-2 py-0.5 text-xs font-medium text-foreground select-none"
            >
              <span className="max-w-[140px] truncate">{labelText}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => handleRemoveValue(val, e)}
                  className={`rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-1.5 before:content-[''] touch-manipulation`}
                  aria-label={`Xóa ${labelText}`}
                >
                  <X className="size-3" />
                </button>
              )}
            </span>
          );
        })}

        {remainingCount > 0 && (
          <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-xs font-medium text-muted-foreground">
            +{remainingCount}
          </span>
        )}

        <input
          ref={inputRef}
          id={id}
          type="text"
          disabled={disabled}
          role="combobox"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          aria-label={ariaLabel || label || placeholder}
          aria-invalid={invalid || undefined}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          placeholder={selectedValues.length === 0 ? placeholder : ""}
          className="min-w-[80px] flex-1 bg-transparent py-0.5 text-sm outline-none placeholder:text-muted-foreground"
        />

        <div className="flex shrink-0 items-center gap-1 ml-auto">
          {selectedValues.length > 0 && !disabled && (
            <button
              type="button"
              onClick={handleClearAll}
              className={`flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-1.5 before:content-[''] touch-manipulation`}
              aria-label="Xóa tất cả"
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
        <div className="absolute left-0 right-0 z-30 mt-1 max-h-60 overflow-y-auto rounded-[var(--radius-menu)] bg-popover p-1 text-popover-foreground shadow-menu outline-none border-0">
          {filteredOptions.length === 0 ? (
            <div className="px-3 py-2.5 text-xs text-muted-foreground">{emptyText}</div>
          ) : (
            <div role="listbox" className="flex flex-col gap-0.5">
              {filteredOptions.map((option, idx) => {
                const isSelected = selectedValues.includes(option.value);
                const isActive = activeIndex === idx;
                return (
                  <div
                    key={option.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleToggleOption(option.value)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-1.5 text-xs sm:text-sm select-none transition-colors",
                      isSelected
                        ? "bg-selected text-primary font-medium"
                        : isActive
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-accent text-foreground",
                      option.disabled && "pointer-events-none opacity-50"
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="truncate">{option.label}</span>
                      {option.description && (
                        <span className="truncate text-xs text-muted-foreground">
                          {option.description}
                        </span>
                      )}
                    </div>
                    {isSelected && <Check className="size-4 shrink-0 text-primary" />}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
