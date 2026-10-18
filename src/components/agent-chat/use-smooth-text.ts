"use client";

import * as React from "react";

/** Tốc độ nền khi chữ tới nhỏ giọt (ký tự/giây). */
const BASE_CHARS_PER_SECOND = 90;
/** Mỗi lần chữ mới tới: chọn tốc độ để phần còn tồn hiện hết đều trong khoảng này (giây), không bung rồi nhỏ giọt. */
const CATCH_UP_SECONDS = 1.5;
/** Tab ẩn rồi quay lại: không bù cả quãng nghỉ trong một khung hình. */
const MAX_FRAME_MS = 100;

/** Tốc độ hiện chữ (ký tự/giây) cho phần còn tồn lúc chữ mới tới; giữ nguyên tới lần chữ tới sau. */
export function revealSpeed(backlog: number): number {
  return Math.max(BASE_CHARS_PER_SECOND, backlog / CATCH_UP_SECONDS);
}

/** Số ký tự hiện thêm sau `frameMs` (số thực, cộng dồn phần lẻ qua các khung để đúng tốc độ). */
export function nextRevealCount(backlog: number, frameMs: number, charsPerSecond: number): number {
  if (backlog <= 0) return 0;
  return Math.min(backlog, (charsPerSecond * Math.min(Math.max(0, frameMs), MAX_FRAME_MS)) / 1000);
}

/** Điểm cắt an toàn: không tách cặp surrogate (emoji) hay bỏ rơi dấu kết hợp của chữ tiếng Việt. */
export function safeRevealEnd(text: string, end: number): number {
  let i = Math.min(Math.max(0, end), text.length);
  while (i > 0 && i < text.length) {
    const code = text.charCodeAt(i);
    const lowSurrogate = code >= 0xdc00 && code <= 0xdfff;
    const combiningMark = code >= 0x0300 && code <= 0x036f;
    if (!lowSurrogate && !combiningMark) break;
    i++;
  }
  return i;
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/**
 * Chữ trả lời hiện dần đều như đang gõ, kể cả khi gateway gửi cả cục. Chỉ chạy với tin đang tới khi gắn vào
 * (`animate`); tin tải từ lịch sử và người dùng bật giảm chuyển động thì hiện ngay. Đã chạy thì chạy tới hết
 * dù luồng đã xong, để đoạn cuối không nhảy ra một lần.
 */
export function useSmoothText(target: string, animate: boolean): { text: string; revealing: boolean } {
  const [shown, setShown] = React.useState(() => (animate && !prefersReducedMotion() ? 0 : Number.POSITIVE_INFINITY));
  const shownRef = React.useRef(shown);
  const caughtUp = shown >= target.length;

  React.useEffect(() => {
    shownRef.current = shown;
  });

  React.useEffect(() => {
    if (caughtUp) return;
    // Chữ mới tới (target đổi): tính lại tốc độ theo phần còn tồn
    const speed = revealSpeed(target.length - shownRef.current);
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const elapsed = now - last;
      last = now;
      setShown((current) => current + nextRevealCount(target.length - current, elapsed, speed));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, caughtUp]);

  return { text: caughtUp ? target : target.slice(0, safeRevealEnd(target, Math.floor(shown))), revealing: !caughtUp };
}
