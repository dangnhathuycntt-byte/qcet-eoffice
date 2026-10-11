"use client";

import * as React from "react";

export type DismissReason = "outside" | "escape";

/**
 * Đóng popup tự dựng khi bấm chuột ra ngoài mọi vùng trong `refs` hoặc nhấn Esc.
 * Popup mới nên dùng `Popover`/`Menu` trong `ui/` (đã tự xử lý việc này).
 */
export function useDismissOnOutside(
  open: boolean,
  refs: ReadonlyArray<React.RefObject<HTMLElement | null>>,
  onDismiss: (reason: DismissReason) => void,
) {
  const latest = React.useRef({ refs, onDismiss });
  React.useEffect(() => {
    latest.current = { refs, onDismiss };
  });

  React.useEffect(() => {
    if (!open) return;
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node;
      if (latest.current.refs.some((ref) => ref.current?.contains(target))) return;
      latest.current.onDismiss("outside");
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") latest.current.onDismiss("escape");
    }
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);
}
