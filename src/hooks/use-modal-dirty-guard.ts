"use client";

import * as React from "react";

export interface UseModalDirtyGuardOptions {
  isDirty: boolean;
  onConfirmClose?: () => void;
  onClose?: () => void;
  message?: string;
}

/**
 * Điểm đóng modal dùng chung. Không dùng hộp thoại xác nhận của trình duyệt (`window.confirm`):
 * nút Hủy, nút × và phím Esc đóng ngay; riêng khi form đã có dữ liệu thì bấm ra ngoài lớp nền
 * không đóng modal, tránh mất dữ liệu vì một cú bấm nhầm.
 */
export function useModalDirtyGuard(
  optionsOrDirty: boolean | UseModalDirtyGuardOptions,
  onConfirmCloseCallback?: () => void
) {
  const isOptionsObject = typeof optionsOrDirty === "object" && optionsOrDirty !== null;
  const isDirty = isOptionsObject ? optionsOrDirty.isDirty : Boolean(optionsOrDirty);
  const onConfirmClose = isOptionsObject
    ? (optionsOrDirty.onConfirmClose ?? optionsOrDirty.onClose ?? (() => {}))
    : (onConfirmCloseCallback ?? (() => {}));

  const handleOpenChange = React.useCallback(
    (open: boolean, eventDetails?: { reason?: string }) => {
      if (!open) {
        if (isDirty && eventDetails?.reason === "outside-press") return;
        onConfirmClose();
      }
    },
    [isDirty, onConfirmClose]
  );

  return { handleOpenChange };
}
