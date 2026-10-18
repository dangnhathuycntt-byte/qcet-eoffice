"use client";

import * as React from "react";
import { triggerHaptic } from "@/lib/haptics";

export const LONG_PRESS_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE = 10;
/** Thời gian giữ lại phần vẽ sau khi thả sớm (mờ đi) và sau khi đủ giờ (nở ra rồi tan). */
const PRESS_FADE_MS = 200;
const PRESS_DONE_MS = 280;

export interface LongPressVisual {
  at: number;
  releasing: boolean;
  /** Đã giữ đủ giờ (menu đang mở), khác với thả sớm. */
  completed: boolean;
}

/**
 * Nhấn giữ trên hàng danh sách điện thoại (iOS qua bộ đếm chạm, Android qua `contextmenu`).
 * Gắn `handlers` vào phần tử; trong `onClick` gọi `consumeClick()` trước để bỏ cú chạm nhả ngay sau khi nhấn giữ.
 * Không truyền `onLongPress` thì không gắn gì.
 * `press` có giá trị trong lúc đang giữ (và thêm ~0,2s mờ đi sau khi thả/khi menu hiện) để vẽ hiệu ứng lan dần:
 * `at` là vị trí chạm theo tỉ lệ 0..1 bề ngang phần tử, `releasing` báo đã thả hoặc đã kích hoạt, `completed` báo đã giữ đủ giờ.
 */
export function useLongPress<T extends HTMLElement>(onLongPress?: (anchor: T) => void) {
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const start = React.useRef<{ x: number; y: number } | null>(null);
  const fired = React.useRef(false);
  const [press, setPress] = React.useState<LongPressVisual | null>(null);
  const releasedRef = React.useRef(true);
  const fadeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = React.useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  React.useEffect(
    () => () => {
      cancel();
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [cancel]
  );

  /** Kết thúc phần vẽ: giữ nguyên tiến độ và mờ dần rồi mới gỡ. */
  const release = React.useCallback(
    (completed = false) => {
      cancel();
      // Đã kết thúc rồi (vd. thả tay sau khi menu đã hiện) thì để hiệu ứng đang chạy nốt
      if (releasedRef.current) return;
      releasedRef.current = true;
      setPress((prev) => (prev && !prev.releasing ? { ...prev, releasing: true, completed } : prev));
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fadeTimer.current = setTimeout(() => setPress(null), completed ? PRESS_DONE_MS : PRESS_FADE_MS);
    },
    [cancel]
  );

  const fire = React.useCallback(
    (anchor: T) => {
      if (!onLongPress) return;
      fired.current = true;
      release(true);
      triggerHaptic("medium");
      onLongPress(anchor);
    },
    [onLongPress, release]
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
          releasedRef.current = false;
          if (fadeTimer.current) clearTimeout(fadeTimer.current);
          const rect = anchor.getBoundingClientRect();
          setPress({ at: Math.min(1, Math.max(0, (touch.clientX - rect.left) / rect.width)), releasing: false, completed: false });
          timer.current = setTimeout(() => fire(anchor), LONG_PRESS_MS);
        },
        onTouchMove: (e: React.TouchEvent<T>) => {
          const from = start.current;
          const touch = e.touches[0];
          if (from && Math.hypot(touch.clientX - from.x, touch.clientY - from.y) > LONG_PRESS_MOVE_TOLERANCE) release();
        },
        onTouchEnd: () => release(),
        onTouchCancel: () => release(),
        onContextMenu: (e: React.MouseEvent<T>) => {
          e.preventDefault();
          if (!fired.current) fire(e.currentTarget);
        },
      }
    : {};

  return { handlers, consumeClick, press };
}
