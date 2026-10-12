"use client";

import * as React from "react";
import { triggerHaptic } from "@/lib/haptics";

const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 10;

/**
 * Nhấn giữ trên hàng danh sách điện thoại (iOS qua bộ đếm chạm, Android qua `contextmenu`).
 * Gắn `handlers` vào phần tử; trong `onClick` gọi `consumeClick()` trước để bỏ cú chạm nhả ngay sau khi nhấn giữ.
 * Không truyền `onLongPress` thì không gắn gì.
 */
export function useLongPress<T extends HTMLElement>(onLongPress?: (anchor: T) => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const fired = React.useRef(false);

  const cancel = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  React.useEffect(() => cancel, [cancel]);

  const fire = React.useCallback(
    (anchor: T) => {
      if (!onLongPress) return;
      fired.current = true;
      triggerHaptic("medium");
      onLongPress(anchor);
    },
    [onLongPress]
  );

  const consumeClick = React.useCallback(() => {
    if (!fired.current) return false;
    fired.current = false;
    return true;
  }, []);

  const handlers = onLongPress
    ? {
        onTouchStart: (e: React.TouchEvent<T>) => {
          fired.current = false;
          const touch = e.touches[0];
          start.current = { x: touch.clientX, y: touch.clientY };
          const anchor = e.currentTarget;
          cancel();
          timer.current = setTimeout(() => fire(anchor), LONG_PRESS_MS);
        },
        onTouchMove: (e: React.TouchEvent<T>) => {
          const from = start.current;
          const touch = e.touches[0];
          if (from && Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > LONG_PRESS_MOVE_TOLERANCE) cancel();
        },
        onTouchEnd: cancel,
        onTouchCancel: cancel,
        onContextMenu: (e: React.MouseEvent<T>) => {
          e.preventDefault();
          if (!fired.current) fire(e.currentTarget);
        },
      }
    : {};

  return { handlers, consumeClick };
}
