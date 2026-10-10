"use client";

import * as React from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup as BaseRadioGroup } from "@base-ui/react/radio-group";
import { cn } from "@/lib/utils";

export interface RadioOption {
  value: string;
  label: string;
  description?: string;
  disabled?: boolean;
}

export interface RadioGroupProps {
  options: RadioOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Tên nhóm hiển thị cho trình đọc màn hình; bắt buộc nếu không có nhãn khác. */
  "aria-label"?: string;
  name?: string;
  disabled?: boolean;
  orientation?: "vertical" | "horizontal";
  className?: string;
}

/** Nhóm lựa chọn một trong vài mục, dựng trên `@base-ui/react/radio-group`. */
export function RadioGroup({
  options,
  value,
  defaultValue,
  onValueChange,
  "aria-label": ariaLabel,
  name,
  disabled,
  orientation = "vertical",
  className,
}: RadioGroupProps) {
  return (
    <BaseRadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as string)}
      aria-label={ariaLabel}
      name={name}
      disabled={disabled}
      className={cn(
        "flex gap-3",
        orientation === "vertical" ? "flex-col" : "flex-row flex-wrap gap-x-5",
        className,
      )}
    >
      {options.map((o) => (
        <label
          key={o.value}
          className="flex cursor-pointer items-start gap-2.5 text-sm has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50"
        >
          <Radio.Root
            value={o.value}
            disabled={o.disabled}
            className="mt-0.5 flex size-4.5 shrink-0 cursor-pointer items-center justify-center rounded-full bg-card inset-ring-2 inset-ring-control-edge outline-none transition-colors duration-100 hover:bg-accent focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 data-[checked]:bg-primary data-[checked]:inset-ring-primary data-[disabled]:cursor-not-allowed motion-reduce:transition-none"
          >
            <Radio.Indicator className="size-1.5 rounded-full bg-primary-foreground" />
          </Radio.Root>
          <span className="min-w-0">
            <span className="block text-foreground">{o.label}</span>
            {o.description ? (
              <span className="block text-xs text-muted-foreground">{o.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </BaseRadioGroup>
  );
}
