import * as React from "react";

/**
 * Phục hồi khi không tải được chunk JS (thường do vừa deploy bản mới, chunk cũ đã bị thay).
 * Next tự tải lại trang khi build ID lệch lúc điều hướng, nhưng chunk của `dynamic()` nạp ngay trong trang
 * thì rơi vào error boundary; `reset()` không cứu được, phải tải lại trang để nhận HTML và chunk mới.
 */

const CHUNK_ERROR_PATTERNS = [
  /Loading (CSS )?chunk .+ failed/i, // webpack (bản build production)
  /Failed to load chunk/i, // Turbopack (dev)
  /Failed to fetch dynamically imported module/i, // Chrome
  /error loading dynamically imported module/i, // Firefox
  /Importing a module script failed/i, // Safari
];

export const CHUNK_ERROR_MESSAGE =
  "Không tải được một phần của trang, có thể do hệ thống vừa cập nhật. Tải lại trang để tiếp tục.";

export const CHUNK_RELOAD_STORAGE_KEY = "qcet:chunk-reload-at";
/** Trong khoảng này đã tự tải lại một lần mà vẫn lỗi thì không tải lại nữa, tránh vòng lặp. */
export const CHUNK_RELOAD_COOLDOWN_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const { name, message } = error as { name?: unknown; message?: unknown };
  if (name === "ChunkLoadError") return true;
  return typeof message === "string" && CHUNK_ERROR_PATTERNS.some((pattern) => pattern.test(message));
}

interface ChunkReloadDeps {
  storage: Pick<Storage, "getItem" | "setItem"> | null;
  now: number;
  online: boolean;
  reload: () => void;
}

/** Tải lại trang một lần cho lỗi chunk; trả `true` khi đã gọi reload. */
export function reloadOnceForChunkError({ storage, now, online, reload }: ChunkReloadDeps): boolean {
  if (!online || !storage) return false;
  try {
    const last = Number(storage.getItem(CHUNK_RELOAD_STORAGE_KEY));
    if (last > 0 && now - last >= 0 && now - last < CHUNK_RELOAD_COOLDOWN_MS) return false;
    storage.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
  } catch {
    // Không ghi được mốc thì không tự tải lại, tránh lặp vô hạn
    return false;
  }
  reload();
  return true;
}

/**
 * Dùng trong error boundary: lỗi chunk thì tự tải lại trang một lần.
 * Trả `true` khi lỗi là lỗi chunk, để màn lỗi đổi "Thử lại" (reset) thành "Tải lại trang".
 */
export function useChunkLoadRecovery(error: unknown): boolean {
  const isChunkError = isChunkLoadError(error);
  React.useEffect(() => {
    if (!isChunkError) return;
    let storage: Storage | null = null;
    try {
      storage = window.sessionStorage;
    } catch {
      storage = null;
    }
    reloadOnceForChunkError({
      storage,
      now: Date.now(),
      online: navigator.onLine !== false,
      reload: () => window.location.reload(),
    });
  }, [isChunkError]);
  return isChunkError;
}
