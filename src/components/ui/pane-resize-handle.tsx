"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PaneResizeHandleProps {
  /** Độ rộng pane hiện tại và khoảng cho phép. */
  value: number;
  min: number;
  max: number;
  /** `persist=false` khi đang kéo (chỉ hiển thị), `true` khi thả chuột hoặc đổi bằng phím. */
  onResize: (width: number, persist: boolean) => void;
  /** Phím ←/→/Home trả về độ rộng mới hoặc null để bỏ qua (xem `nextWidthForKey`). */
  onKey?: (key: string, current: number) => number | null;
  onReset?: () => void;
  label?: string;
}

/**
 * Grip luôn hiện ở giữa khe 6px giữa hai thẻ để người dùng thấy đường chia kéo được (như grip của
 * react-resizable-panels/shadcn `withHandle`); đậm hơn khi hover, xanh khi đang kéo hoặc focus.
 * Chỉ là dấu hiệu: cả vùng 24px của thanh kéo mới là vùng bấm. Thanh kéo cần lớp cha `group/resize`.
 */
export function ResizeGrip({ active }: { active?: boolean }) {
  return (
    <span
      aria-hidden
      data-slot="resize-grip"
      className={cn(
        "pointer-events-none absolute left-[7px] top-1/2 h-8 w-1 -translate-y-1/2 rounded-full transition-colors duration-150",
        active ? "bg-primary" : "bg-border group-hover/resize:bg-muted-foreground/50 group-focus-visible/resize:bg-primary",
      )}
    />
  );
}

/**
 * Vùng kéo đổi độ rộng pane bên phải, theo đúng hành vi của Subtask Peek (task-detail):
 * vùng chạm rộng 24px nằm trên mép trái thẻ (bắc qua khe gap), kèm grip luôn hiện.
 * Thẻ chứa phải để `overflow: visible`, nếu không nửa vùng chạm nằm ngoài thẻ bị cắt.
 * Độ rộng = khoảng cách từ mép phải pane tới con trỏ; kéo hiển thị tạm, thả chuột mới ghi nhớ.
 */
export function PaneResizeHandle({ value, min, max, onResize, onKey, onReset, label = "Kéo để điều chỉnh độ rộng hoặc nhấp đúp để đặt lại", }: PaneResizeHandleProps) {
  const [dragging, setDragging] = React.useState(false);
  const stopRef = React.useRef<(() => void) | null>(null);

  const clamp = React.useCallback((width: number) => Math.round(Math.min(max, Math.max(min, width))), [min, max]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    stopRef.current?.();
    const paneRight = event.currentTarget.parentElement?.getBoundingClientRect().right ?? window.innerWidth;
    const prevCursor = document.body.style.cursor;
    const prevSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    setDragging(true);

    let latest: number | null = null;
    const move = (e: PointerEvent) => {
      latest = clamp(paneRight - e.clientX);
      onResize(latest, false);
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("blur", up);
      document.body.style.cursor = prevCursor;
      document.body.style.userSelect = prevSelect;
      stopRef.current = null;
      setDragging(false);
      if (latest !== null) onResize(latest, true);
    };
    stopRef.current = up;
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("blur", up);
  };

  React.useEffect(() => () => stopRef.current?.(), []);

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Đổi độ rộng khung chi tiết"
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      aria-valuemax={Math.max(min, Math.round(max))}
      title={label}
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={handlePointerDown}
      onDoubleClick={onReset}
      onKeyDown={(event) => {
        const next = onKey?.(event.key, value);
        if (next === null || next === undefined) return;
        event.preventDefault();
        onResize(next, true);
      }}
      className={cn(
        "group/resize absolute -left-3 top-0 bottom-0 z-50 w-6 cursor-col-resize touch-none select-none bg-transparent outline-none",
        "focus-visible:ring-2 focus-visible:ring-ring",
      )}
    >
      <ResizeGrip active={dragging} />
    </div>
  );
}
