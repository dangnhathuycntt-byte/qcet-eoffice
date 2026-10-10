"use client";

import * as React from "react";
import { Toggle } from "@base-ui/react/toggle";
import { ToggleGroup } from "@base-ui/react/toggle-group";
import { cn } from "@/lib/utils";

export interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SegmentedControlProps {
  options: SegmentedOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  "aria-label": string;
  className?: string;
}

/**
 * Chuyển cách xem cùng một dữ liệu (bảng/kanban, ngày/tuần). Luôn có đúng một mục được chọn.
 * Nếu chuyển sang nội dung khác hẳn, dùng `Tabs`.
 */
export function SegmentedControl({
  options,
  value,
  defaultValue,
  onValueChange,
  "aria-label": ariaLabel,
  className,
}: SegmentedControlProps) {
  return (
    <ToggleGroup
      aria-label={ariaLabel}
      value={value === undefined ? undefined : [value]}
      defaultValue={defaultValue === undefined ? undefined : [defaultValue]}
      onValueChange={(next) => {
        // Giữ luôn một mục được chọn: bấm lại mục đang chọn không làm gì.
        if (next.length > 0) onValueChange?.(next[next.length - 1] as string);
      }}
      className={cn("inline-flex items-center gap-0.5 rounded-xl bg-secondary p-0.5", className)}
    >
      {options.map((o) => (
        <Toggle
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-[10px] px-3 text-sm font-medium text-muted-foreground outline-none transition-colors duration-100 hover:text-foreground focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 data-[pressed]:bg-card data-[pressed]:text-foreground data-[pressed]:font-semibold data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50 sm:h-7 [&_svg]:size-4 motion-reduce:transition-none"
        >
          {o.icon}
          {o.label}
        </Toggle>
      ))}
    </ToggleGroup>
  );
}
