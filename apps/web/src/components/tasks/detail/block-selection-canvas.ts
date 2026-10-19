import type * as React from "react";

/** Phần tử tương tác: không bắt đầu vùng chọn khối khi nhấn vào đây */
const INTERACTIVE =
  'button, a, input, textarea, select, [contenteditable="true"], [role="button"], [role="combobox"], [role="tab"], [role="menu"], [role="listbox"], [data-slot="task-detail-inspector"], [data-slot="subtask-outline-rail"], [data-slot="task-block-editor"] [data-slate-node]';

/** Khi bắt đầu kéo từ ngoài vùng cuộn (sidebar, thanh trên): loại thêm hộp thoại, popup, vùng nhập liệu của trang */
const GLOBAL_EXCLUDE =
  '[role="dialog"], [role="alertdialog"], [role="tooltip"], [data-selection-canvas="peek"], [data-radix-popper-content-wrapper], [data-base-ui-inert]';

function markTarget(target: HTMLElement | null, extraExclude?: string): void {
  if (!target || typeof target.closest !== "function") return;
  if (target.closest(INTERACTIVE)) return;
  if (extraExclude && target.closest(extraExclude)) return;
  target.dataset.plateSelectable = "true";
}

/**
 * Cho phép kéo chọn nhiều khối bắt đầu từ bất kỳ khoảng trống nào của trang (kiểu Notion),
 * không chỉ trong khung soạn thảo. Thư viện chọn vùng chỉ bắt đầu khi đích nhấn chuột có
 * data-plate-selectable, nên đánh dấu đích là vùng trống (không phải ô tương tác).
 * Gắn vào onMouseDownCapture của vùng cuộn để chạy trước bộ lắng nghe của thư viện.
 */
export function markSelectionStartTarget(e: React.MouseEvent<HTMLElement>): void {
  if (e.button !== 0) return;
  markTarget(e.target as HTMLElement | null);
}

/**
 * Cho phép bắt đầu kéo chọn khối từ cả sidebar và thanh trên (toàn cửa sổ ứng dụng).
 * Trả về hàm gỡ bộ lắng nghe.
 */
export function installGlobalSelectionStart(): () => void {
  if (typeof document === "undefined") return () => {};
  const handler = (e: MouseEvent) => {
    if (e.button !== 0) return;
    markTarget(e.target as HTMLElement | null, GLOBAL_EXCLUDE);
  };
  document.addEventListener("mousedown", handler, true);
  return () => document.removeEventListener("mousedown", handler, true);
}

/** Độ lệch chuột (px) từ lúc nhấn xuống để phân biệt kéo chọn với nhấp đơn */
export const SELECTION_DRAG_THRESHOLD = 4;

export function didDrag(
  down: { x: number; y: number } | null,
  up: { x: number; y: number }
): boolean {
  if (!down) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) > SELECTION_DRAG_THRESHOLD;
}
