/**
 * GET dữ liệu phụ của một trang (các khối trong chi tiết nhiệm vụ…): gặp 429 thì chờ theo `Retry-After`
 * rồi thử lại, để người dùng không thấy lỗi quá tải chỉ vì trang tải nhiều khối cùng lúc.
 * Chỉ dùng cho yêu cầu đọc; thao tác ghi không tự gửi lại.
 */
export const RATE_LIMIT_MESSAGE = "Hệ thống đang bận, thử lại sau ít giây";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function retryDelayMs(retryAfterHeader: string | null, attempt: number, maxWaitMs: number): number {
  const seconds = Number(retryAfterHeader);
  const base = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 2000 * (attempt + 1);
  return Math.min(maxWaitMs, base);
}

export async function fetchWithRetry(
  input: string,
  init?: RequestInit,
  { retries = 2, maxWaitMs = 8000 }: { retries?: number; maxWaitMs?: number } = {}
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(input, init);
    if (res.status !== 429 || attempt >= retries) return res;
    // Lệch ngẫu nhiên một chút để các khối không cùng gửi lại một lúc
    await sleep(retryDelayMs(res.headers.get("Retry-After"), attempt, maxWaitMs) + Math.random() * 400);
  }
}
