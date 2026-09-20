"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressProps extends React.ComponentProps<"div"> {
  value?: number | null;
  max?: number;
}

function Progress({
  className,
  value = 0,
  max = 100,
  children,
  ...props
}: ProgressProps) {
  const isIndeterminate = value === null || value === undefined;
  const percentage = isIndeterminate
    ? undefined
    : Math.min(Math.max((Number(value) / max) * 100, 0), 100);

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={isIndeterminate ? undefined : (value as number)}
      aria-valuetext={
        isIndeterminate ? "Đang tải..." : `${Math.round(percentage!)}%`
      }
      data-indeterminate={isIndeterminate ? "" : undefined}
      className={cn("flex flex-wrap gap-3", className)}
      {...props}
    >
      {children}
      <ProgressTrack>
        <ProgressIndicator
          style={
            isIndeterminate
              ? undefined
              : { transform: `translateX(-${100 - percentage!}%)` }
          }
          data-indeterminate={isIndeterminate ? "" : undefined}
        />
      </ProgressTrack>
    </div>
  );
}

function ProgressTrack({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-track"
      className={cn(
        "relative flex h-1.5 w-full items-center overflow-x-hidden rounded-full bg-muted",
        className
      )}
      {...props}
    />
  );
}

function ProgressIndicator({
  className,
  style,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-indicator"
      className={cn(
        "h-full w-full flex-1 bg-primary transition-transform duration-500 ease-in-out will-change-transform",
        "data-[indeterminate]:animate-[progress-indeterminate_1.5s_ease-in-out_infinite]",
        className
      )}
      style={style}
      {...props}
    />
  );
}

function ProgressLabel({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-label"
      className={cn("text-sm font-medium", className)}
      {...props}
    />
  );
}

function ProgressValue({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="progress-value"
      className={cn(
        "ml-auto text-sm text-muted-foreground tabular-nums",
        className
      )}
      {...props}
    />
  );
}

export {
  Progress,
  ProgressTrack,
  ProgressIndicator,
  ProgressLabel,
  ProgressValue,
};
