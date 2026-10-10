"use client";

import * as React from "react";
import { Slider as BaseSlider } from "@base-ui/react/slider";
import { cn } from "@/lib/utils";

export interface SliderProps {
  value?: number | number[];
  defaultValue?: number | number[];
  onValueChange?: (value: number | number[]) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  label?: string;
  showValue?: boolean;
  formatValue?: (value: number) => string;
  "aria-label"?: string;
  className?: string;
}

/**
 * Thanh trượt dải giá trị (tiến độ %, thang đo điểm số), dựng trên `@base-ui/react/slider`.
 * Hỗ trợ phím mũi tên ←/→, Home/End và nhãn giá trị động theo chuẩn QCET.
 */
export function Slider({
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  disabled = false,
  label,
  showValue = false,
  formatValue,
  "aria-label": ariaLabel,
  className,
}: SliderProps) {
  const isRange = Array.isArray(value) || Array.isArray(defaultValue);

  return (
    <BaseSlider.Root
      value={value}
      defaultValue={defaultValue ?? (isRange ? [min, max] : min)}
      onValueChange={onValueChange}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      aria-label={ariaLabel || label}
      className={cn("flex w-full flex-col gap-2 select-none", className)}
    >
      {(label || showValue) && (
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          {label ? <BaseSlider.Label className="text-foreground">{label}</BaseSlider.Label> : <span />}
          {showValue && (
            <BaseSlider.Value className="tabular-nums font-medium text-foreground">
              {(_formattedValues: readonly string[], values: readonly number[]) => {
                if (values.length > 1) {
                  return values.map((v) => (formatValue ? formatValue(v) : v)).join(" – ");
                }
                const singleVal = values[0] ?? 0;
                return formatValue ? formatValue(singleVal) : `${singleVal}%`;
              }}
            </BaseSlider.Value>
          )}
        </div>
      )}

      <BaseSlider.Control className="relative flex h-6 w-full touch-none items-center">
        <BaseSlider.Track className="relative h-2 w-full grow overflow-hidden rounded-full bg-control-edge">
          <BaseSlider.Indicator className="absolute h-full bg-primary" />
        </BaseSlider.Track>
        {isRange ? (
          <>
            <BaseSlider.Thumb
              index={0}
              className="block size-4 cursor-grab rounded-full border-2 border-primary bg-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
            />
            <BaseSlider.Thumb
              index={1}
              className="block size-4 cursor-grab rounded-full border-2 border-primary bg-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50"
            />
          </>
        ) : (
          <BaseSlider.Thumb className="block size-4 cursor-grab rounded-full border-2 border-primary bg-background focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-1 active:cursor-grabbing disabled:pointer-events-none disabled:opacity-50" />
        )}
      </BaseSlider.Control>
    </BaseSlider.Root>
  );
}
