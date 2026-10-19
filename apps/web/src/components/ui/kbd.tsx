import * as React from "react";
import { cn } from "@/lib/utils";

/** Một phím trên bàn phím (gợi ý phím tắt): ô nhỏ viền mảnh, chữ phụ, cao 20px. */
export function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-border bg-muted px-1 font-sans text-xs text-muted-foreground",
        className
      )}
      {...props}
    />
  );
}
