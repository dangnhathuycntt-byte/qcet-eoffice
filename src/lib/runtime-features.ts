import * as React from "react";

export type RuntimeFeatureKey = "taskAgent" | "assistant";

// Cờ công khai từ server, đọc một lần cho cả phiên; mọi người gọi cùng chia sẻ một lần tải
let featuresPromise: Promise<Record<string, boolean>> | null = null;

/**
 * Cờ bật/tắt công khai của server (`/api/runtime-config`). Lỗi (mạng, HTTP không ok) trả `{}` cho lần gọi đó
 * và không được nhớ: lần gọi sau sẽ tải lại, để một lỗi tạm thời không tắt tính năng cho cả phiên.
 */
export function loadRuntimeFeatures(): Promise<Record<string, boolean>> {
  featuresPromise ??= fetch("/api/runtime-config", { credentials: "same-origin" })
    .then((res) => {
      if (!res.ok) throw new Error(`runtime-config ${res.status}`);
      return res.json();
    })
    .then((config: { features?: Record<string, boolean> } | null) => config?.features ?? {})
    .catch(() => {
      featuresPromise = null;
      return {};
    });
  return featuresPromise;
}

/**
 * Cờ của một tính năng. Lần render đầu luôn `false` (tránh lệch hydrate), sau khi tải xong mới đổi.
 * `enabled = false` thì chưa tải; giá trị đã có được giữ nguyên.
 */
export function useRuntimeFeature(key: RuntimeFeatureKey, enabled = true): boolean {
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadRuntimeFeatures().then((features) => alive && setOn(features[key] === true));
    return () => {
      alive = false;
    };
  }, [key, enabled]);
  return on;
}
