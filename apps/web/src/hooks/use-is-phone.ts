"use client";

import * as React from "react";

/** Cùng ngưỡng `md` của Tailwind: dưới 768px là điện thoại (sheet, header riêng…). */
const PHONE_QUERY = "(max-width: 767px)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(PHONE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/** Màn điện thoại (< md). SSR và lần hydrate đầu luôn là false (bố cục rộng). */
export function useIsPhone() {
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
