"use client";

import * as React from "react";
import { observeListMotion, type ListMotionOptions } from "@/lib/motion/list-motion";

/**
 * Ref gắn vào phần tử cha của danh sách (`<tbody>`, khối lưới div…): mục thêm hoặc bỏ có chuyển động (xem `lib/motion/list-motion`).
 * Ref callback trả hàm dọn của React 19 nên ngắt quan sát khi cha gỡ. `options.item` nên là hằng số ngoài component.
 */
export function useListMotion<T extends HTMLElement = HTMLElement>(options?: ListMotionOptions): React.RefCallback<T> {
  const item = options?.item;
  const flip = options?.flip;
  return React.useCallback(
    (el: T | null) => {
      if (!el) return;
      return observeListMotion(el, { item, flip });
    },
    [item, flip],
  );
}

/**
 * Gộp nhiều ref (callback hoặc object) thành một ref callback. React 19 đã có hàm dọn thì không gọi `ref(null)` nữa, nên hàm dọn
 * ở đây tự trả ref object về `null` và gọi ref callback cũ (không trả hàm dọn) với `null`.
 */
export function useMergedRefs<T>(...refs: Array<React.Ref<T> | undefined>): React.RefCallback<T> {
  return React.useCallback((el: T | null) => {
    const cleanups: Array<() => void> = [];
    for (const ref of refs) {
      if (typeof ref === "function") {
        const cleanup = ref(el);
        cleanups.push(typeof cleanup === "function" ? cleanup : () => ref(null));
      } else if (ref) {
        (ref as React.MutableRefObject<T | null>).current = el;
        cleanups.push(() => {
          (ref as React.MutableRefObject<T | null>).current = null;
        });
      }
    }
    return () => {
      for (const cleanup of cleanups) cleanup();
    };
    // Số ref và thứ tự cố định theo chỗ gọi
  }, refs);
}
