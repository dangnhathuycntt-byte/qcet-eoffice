import * as React from "react";
import { cn } from "@/lib/utils";
import { focusRingClass } from "@/components/ui/focus-ring";

export interface PropertyToggleChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  /** quiet: không viền, nền trung tính khi bật (kiểu Linear). */
  variant?: "default" | "quiet";
}

/** Chip bật/tắt thuộc tính hiển thị: bật = nền xám + viền, tắt = chữ nhạt không viền. */
export function PropertyToggleChip({ pressed, onPressedChange, variant = "default", className, children, ...props }: PropertyToggleChipProps) {
  const quiet = variant === "quiet";
  return (
    <button
      type="button"
      onClick={() => onPressedChange(!pressed)}
      aria-pressed={pressed}
      className={cn(
        `px-2.5 h-6 inline-flex items-center rounded-full text-xs transition-colors cursor-pointer select-none outline-none ${focusRingClass}`,
        quiet
          ? pressed
            ? "bg-selected text-foreground font-medium"
            : "text-muted-foreground font-normal hover:bg-accent/60 hover:text-foreground"
          : cn(
              "border",
              pressed
                ? "bg-selected border-transparent text-foreground font-medium"
                : "bg-card border-border/70 text-muted-foreground font-normal hover:bg-muted/50 hover:text-foreground"
            ),
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
