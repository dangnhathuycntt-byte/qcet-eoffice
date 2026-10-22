import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Một phím trên bàn phím (gợi ý phím tắt), như keycap của Linear (đo 22/10/2026): nền trong suốt, viền mảnh, chữ 11px phụ,
 * cao 20px, bo 4px.
 */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border-hairline border-border px-1 font-sans text-micro text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}

/** Gợi ý phím tắt ở chân khung (Hộp thư, xem nhanh nhiệm vụ): các phím `Kbd` rồi nhãn, chữ theo khối chứa (`text-xs` mờ). */
export function KeyHint({ keys, label }: { keys: string[]; label: React.ReactNode }) {
  return (
    <span className="flex items-center gap-1">
      {keys.map((key) => (
        <Kbd key={key}>{key}</Kbd>
      ))}
      {label}
    </span>
  );
}
