import * as React from "react";

// Bản seed đã được một khối dùng: khối gắn lại sau đó (đổi tab, đóng mở) tải mới vì dữ liệu kèm trang có thể đã cũ.
const consumedSeeds = new WeakSet<object>();

/**
 * Dữ liệu khối phụ gửi kèm page-data (chi tiết nhiệm vụ): `seed` dùng làm giá trị đầu thay cho GET riêng của khối.
 * `skipLoad(key)` gọi trong effect tải của khối, trả true ở các lượt effect còn đúng `key` lúc nhận seed
 * (kể cả lượt chạy lặp của StrictMode); `key` đổi một lần thì từ đó luôn tải lại.
 */
export function useBlockSeed<T>(seed: T | null | undefined) {
  const [initial] = React.useState(() =>
    seed && typeof seed === "object" && !consumedSeeds.has(seed) ? seed : null
  );
  const seededKey = React.useRef<string | null | undefined>(initial ? undefined : null);

  const skipLoad = React.useCallback(
    (key: string) => {
      if (!initial || seededKey.current === null) return false;
      consumedSeeds.add(initial as object);
      if (seededKey.current === undefined) seededKey.current = key;
      if (seededKey.current === key) return true;
      seededKey.current = null;
      return false;
    },
    [initial]
  );

  return { seed: initial, skipLoad };
}
