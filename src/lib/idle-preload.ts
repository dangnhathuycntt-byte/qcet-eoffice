/**
 * Nạp trước chunk của component `dynamic()` lúc trình duyệt rảnh, để lần mở đầu tiên không phải chờ mạng.
 * Cùng specifier `import()` với lời gọi `dynamic()` thì bundler dùng chung một chunk.
 * Nạp tuần tự từng chunk; bỏ qua khi offline hoặc người dùng bật tiết kiệm dữ liệu.
 */

export interface IdlePreloadEntry {
  /** Khóa chống nạp lại khi component mount lại. */
  key: string;
  load: () => Promise<unknown>;
}

interface IdlePreloadEnv {
  online: boolean;
  saveData: boolean;
  schedule: (task: () => void) => void;
}

const settledKeys = new Set<string>();
const pendingKeys = new Set<string>();

function browserEnv(): IdlePreloadEnv | null {
  if (typeof window === "undefined" || typeof navigator === "undefined") return null;
  const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    online: navigator.onLine !== false,
    saveData: connection?.saveData === true,
    // Safari trên iPhone chưa có requestIdleCallback
    schedule: (task) =>
      typeof window.requestIdleCallback === "function"
        ? window.requestIdleCallback(() => task(), { timeout: 10_000 })
        : window.setTimeout(task, 1_000),
  };
}

export function preloadWhenIdle(entries: IdlePreloadEntry[], env: IdlePreloadEnv | null = browserEnv()): void {
  if (!env || !env.online || env.saveData) return;
  const queue = entries.filter((entry) => !settledKeys.has(entry.key) && !pendingKeys.has(entry.key));
  for (const entry of queue) pendingKeys.add(entry.key);

  const runNext = (index: number) => {
    const entry = queue[index];
    if (!entry) return;
    env.schedule(() => {
      entry
        .load()
        // Nạp hỏng thì bỏ qua: lần mở thật sẽ tự nạp lại và hiện lỗi nếu có
        .then(() => settledKeys.add(entry.key), () => undefined)
        .finally(() => {
          pendingKeys.delete(entry.key);
          runNext(index + 1);
        });
    });
  };
  runNext(0);
}
