"use client";

import * as React from "react";
import { Plus, Check, X } from "lucide-react";
import { Kbd } from "./kbd";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface QuickEntryProps {
  placeholder?: string;
  onSave: (value: string) => void | Promise<void>;
  onCancel?: () => void;
  defaultValue?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  icon?: React.ReactNode;
}

/**
 * Ô tạo nhanh tại chỗ hoặc sửa tại chỗ (việc con, mục danh sách, tiêu chí...).
 * Chuẩn QCET: Artboard Patterns & Components3 (Enter để lưu, Esc để hủy, không bật hộp thoại).
 */
export function QuickEntry({
  placeholder = "Nhập nội dung và nhấn Enter...",
  onSave,
  onCancel,
  defaultValue = "",
  autoFocus = true,
  disabled = false,
  className,
  icon,
}: QuickEntryProps) {
  const [value, setValue] = React.useState(defaultValue);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleSubmit = async () => {
    if (!value.trim() || isSubmitting || disabled) return;
    setIsSubmitting(true);
    try {
      await onSave(value.trim());
      setValue("");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setValue(defaultValue);
      onCancel?.();
    }
  };

  return (
    <div
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-control bg-secondary px-3 text-xs sm:text-sm",
        "transition-colors duration-100 hover:bg-accent focus-within:bg-selected focus-within:outline-2 focus-within:outline-primary focus-within:outline-offset-1",
        disabled && "opacity-50 pointer-events-none",
        className
      )}
    >
      <span className="text-muted-foreground shrink-0">
        {icon || <Plus className="size-4" />}
      </span>

      <input
        ref={inputRef}
        type="text"
        aria-label={placeholder || "Nhập nhanh"}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        disabled={disabled || isSubmitting}
        className="flex-1 bg-transparent text-foreground outline-none placeholder:text-muted-foreground"
      />

      <div className="flex items-center gap-1.5 shrink-0 text-muted-foreground">
        {value.trim() ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              aria-label="Lưu (Enter)"
              title="Lưu (Enter)"
              className={`flex size-6 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary-hover transition-colors cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-2 before:content-[''] touch-manipulation`}
            >
              <Check className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setValue(defaultValue);
                onCancel?.();
              }}
              aria-label="Hủy (Esc)"
              title="Hủy (Esc)"
              className={`flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors cursor-pointer outline-none ${focusRingClass} relative before:absolute before:-inset-2 before:content-[''] touch-manipulation`}
            >
              <X className="size-3.5" />
            </button>
          </div>
        ) : (
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground font-medium">
            <span>Enter lưu</span>
            <span>·</span>
            <span>Esc hủy</span>
          </div>
        )}
      </div>
    </div>
  );
}
