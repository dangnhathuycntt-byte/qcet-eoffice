import * as React from "react";

/** Số đếm nhỏ (bộ lọc đang áp dụng, số mục): không hiện khi count <= 0. */
export function CountBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-muted px-1 text-foreground/80 border border-border/80 font-mono text-xs leading-none font-semibold tabular-nums">
      {count}
    </span>
  );
}
