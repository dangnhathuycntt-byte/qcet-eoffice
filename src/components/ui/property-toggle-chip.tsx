import * as React from "react";
import { cn } from "@/lib/utils";

export interface PropertyToggleChipProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
}

/** Chip bật/tắt thuộc tính hiển thị: bật = nền xám + viền, tắt = chữ nhạt không viền. */
export function PropertyToggleChip({ pressed, onPressedChange, className, children, ...props }: PropertyToggleChipProps) {
  return (
    <button
      type="button"
      onClick={() => onPressedChange(!pressed)}
      aria-pressed={pressed}
      className={cn(
        "px-2.5 h-6 inline-flex items-center rounded-full text-xs border transition-colors cursor-pointer select-none outline-none focus-visible:outline-2 focus-visible:outline-primary focus-visible:outline-offset-1",
        pressed
          ? "bg-muted border-border text-foreground font-medium"
          : "bg-card border-border/70 text-muted-foreground font-normal hover:bg-muted/50 hover:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
