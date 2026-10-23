"use client";

import * as React from "react";
import { prefersReducedMotion } from "@/lib/motion/list-motion";

/** Khớp `duration-150` của lớp `animate-out` ở nơi dùng (mờ đi 150ms, như tô sáng khi rê). */
export const EXIT_PRESENCE_MS = 150;

function shallowEqual(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || !a || !b) return false;
  const keysA = Object.keys(a);
  return keysA.length === Object.keys(b).length && keysA.every((key) => Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

/**
 * Giữ phần tử thêm một nhịp sau khi `active` tắt để chạy chuyển động thoát (thanh thao tác nổi, vùng chỉ hiện theo điều kiện),
 * thay cho `if (!active) return null` làm phần tử biến mất đột ngột. Không dùng `AnimatePresence`: không thêm gói, và đồng hồ
 * gỡ phần tử nằm ở đây nên chạy cả khi tab ẩn hoặc bật giảm chuyển động (gỡ ngay, không chờ).
 *
 * - `mounted`: còn dựng phần tử không (true từ lúc `active` bật đến hết nhịp thoát).
 * - `leaving`: đang trong nhịp thoát; nơi dùng đổi lớp `animate-in` thành `animate-out`, thêm `inert` và `aria-hidden`.
 * - `shown`: giá trị cuối khi còn `active` (số đã chọn…), để nội dung không nháy sang 0 trong lúc mờ đi. `value` so sánh nông
 *   (truyền đối tượng literal mỗi lần dựng cũng được).
 */
export function useExitPresence<T>(value: T, active: boolean, exitMs: number = EXIT_PRESENCE_MS) {
  const [held, setHeld] = React.useState(value);
  const [mounted, setMounted] = React.useState(active);
  if (active) {
    if (!shallowEqual(held, value)) setHeld(value);
    if (!mounted) setMounted(true);
  }
  const leaving = mounted && !active;

  React.useEffect(() => {
    if (!leaving) return;
    const instant = prefersReducedMotion() || document.hidden;
    const timer = window.setTimeout(() => setMounted(false), instant ? 0 : exitMs);
    return () => window.clearTimeout(timer);
  }, [leaving, exitMs]);

  return { mounted, leaving, shown: active ? value : held };
}
