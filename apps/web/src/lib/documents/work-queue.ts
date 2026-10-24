import * as React from "react";
import { usePathname } from "next/navigation";

/**
 * Số văn bản đi đang chờ chính người dùng, cho chấm báo việc ở sidebar (spec Văn bản §8.2, S3). Giữ ở store ngoài và đọc
 * bằng `useSyncExternalStore` tại nơi dùng, không đưa vào context của provider bọc cả app: provider đổi giá trị sau
 * hydrate làm React vẽ lại cả trang (AGENTS.md). Khung trang gốc không dựng lại khi chuyển trang nên số này tự làm mới
 * khi vào trang, khi quay lại tab và sau mỗi thao tác bước (`refreshWorkQueue({ force: true })`).
 */

const MIN_INTERVAL_MS = 15_000;

let outgoingAwaiting = 0;
let lastFetchedAt = 0;
let inflight: Promise<void> | null = null;
let latestRequest = 0;
const listeners = new Set<() => void>();

function publish(next: number) {
  if (next === outgoingAwaiting) return;
  outgoingAwaiting = next;
  listeners.forEach((listener) => listener());
}

/** Tải lại số việc chờ. Lỗi tạm thời (mất mạng, 401, 5xx) giữ số cũ thay vì ghi thành 0; lần tải mới nhất thắng. */
export function refreshWorkQueue(options: { force?: boolean } = {}): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (!options.force) {
    if (inflight) return inflight;
    if (Date.now() - lastFetchedAt < MIN_INTERVAL_MS) return Promise.resolve();
  }
  const request = ++latestRequest;
  const run = fetch("/api/documents/queue-summary", { cache: "no-store" })
    .then(async (res) => {
      if (!res.ok) return;
      const body = (await res.json()) as { data?: { outgoingAwaiting?: unknown } };
      const count = body.data?.outgoingAwaiting;
      if (request === latestRequest && typeof count === "number") publish(count);
    })
    .catch(() => undefined)
    .finally(() => {
      if (request === latestRequest) {
        lastFetchedAt = Date.now();
        inflight = null;
      }
    });
  inflight = run;
  return run;
}

/** Số hiện có (không tải); dùng làm `getSnapshot` của `useSyncExternalStore`. */
export function getWorkQueueSnapshot(): number {
  return outgoingAwaiting;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Số văn bản đi đang chờ người dùng; làm mới khi vào trang mới và khi quay lại tab. */
export function useOutgoingAwaitingCount(): number {
  const pathname = usePathname();
  React.useEffect(() => {
    void refreshWorkQueue();
  }, [pathname]);
  React.useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshWorkQueue();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, []);
  return React.useSyncExternalStore(subscribe, getWorkQueueSnapshot, () => 0);
}
