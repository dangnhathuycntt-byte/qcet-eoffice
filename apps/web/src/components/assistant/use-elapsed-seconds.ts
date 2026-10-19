"use client";

import * as React from "react";

/** Số giây từ `startedAt` (ms) tới giờ, cập nhật mỗi giây khi `active`; không chạy hoặc không có mốc thì null. */
export function useElapsedSeconds(startedAt: number | undefined, active: boolean): number | null {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!active || startedAt === undefined) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active, startedAt]);
  return active && startedAt !== undefined ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
}
