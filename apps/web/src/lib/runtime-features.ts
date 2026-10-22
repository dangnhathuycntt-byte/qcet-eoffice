"use client";

import * as React from "react";

export type RuntimeFeatureKey = "taskAgent" | "assistant" | "taskCollab";

// Cờ layout gốc đã đọc ở server (cùng request vẽ trang); `null` khi server không đọc được, hook tự tải như trước
const RuntimeFeaturesContext = React.createContext<Record<string, boolean> | null>(null);

/**
 * Đưa cờ đọc ở server xuống cả cây: `useRuntimeFeature` dùng luôn từ lần vẽ đầu (server và trình duyệt cùng giá trị,
 * không lệch hydrate), không gọi `/api/runtime-config` và không vẽ lại khi cờ về (ô mô tả có `taskCollab` từng dựng 3 lần).
 */
export function RuntimeFeaturesProvider({
  features,
  children,
}: {
  features: Record<string, boolean> | null;
  children: React.ReactNode;
}) {
  return React.createElement(RuntimeFeaturesContext.Provider, { value: features }, children);
}

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
 * Cờ của một tính năng. Có cờ từ server (`RuntimeFeaturesProvider`) thì dùng luôn. Không có thì tải: lần render đầu
 * `false` (tránh lệch hydrate), tải xong mới đổi; `enabled = false` thì chưa tải, giá trị đã có được giữ nguyên.
 */
export function useRuntimeFeature(key: RuntimeFeatureKey, enabled = true): boolean {
  const seeded = React.useContext(RuntimeFeaturesContext);
  const [on, setOn] = React.useState(false);
  React.useEffect(() => {
    if (!enabled || seeded) return;
    let alive = true;
    void loadRuntimeFeatures().then((features) => alive && setOn(features[key] === true));
    return () => {
      alive = false;
    };
  }, [key, enabled, seeded]);
  return seeded ? seeded[key] === true : on;
}
