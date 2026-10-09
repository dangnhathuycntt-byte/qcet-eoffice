"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PaneResizeHandleProps {
  /** Độ rộng pane hiện tại, và khoảng cho phép. */
  value: number;
  min: number;
  max: number;
  onResize: (width: number) => void;
  /** Phím ←/→/Home trả về độ rộng mới hoặc null để bỏ qua (xem `nextWidthForKey`). */
  onKey?: (key: string, current: number) => number | null;
  onReset?: () => void;
  /** Pane nằm bên phải (kéo sang trái làm rộng) hay bên trái. */
  side?: "right" | "left";
  label?: string;
  className?: string;
}

/**
 * Thanh kéo đổi độ rộng pane: chuột (pointer capture), bàn phím (role=separator có aria-value*),
 * nhấp đúp để đặt lại. Chỉ trình bày và phát `onResize`; chỗ lưu độ rộng thuộc về nơi dùng.
 */
export function PaneResizeHandle({ value, min, max, onResize, onKey, onReset, side = "right", label = "Đổi độ rộng khung chi tiết", className }: PaneResizeHandleProps) {
  const [dragging, setDragging] = React.useState(false);
  const start = React.useRef({ x: 0, width: 0 });

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    start.current = { x: event.clientX, width: value };
    setDragging(true);
  };
  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const delta = event.clientX - start.current.x;
    onResize(Math.round(start.current.width + (side === "right" ? -delta : delta)));
  };
  const stop = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.max(min, Math.round(max))}
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stop}
      onPointerCancel={stop}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const next = onKey?.(event.key, value);
        if (next === null || next === undefined) return;
        event.preventDefault();
        onResize(next);
      }}
      className={cn(
        "group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none outline-none",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border/60 after:transition-colors",
        "hover:after:bg-foreground/30 focus-visible:after:w-0.5 focus-visible:after:bg-ring data-[dragging]:after:w-0.5 data-[dragging]:after:bg-ring",
        className,
      )}
    />
  );
}
