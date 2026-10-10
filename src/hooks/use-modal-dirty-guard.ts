"use client";

import * as React from "react";

export interface UseModalDirtyGuardOptions {
  isDirty: boolean;
  onConfirmClose?: () => void;
  onClose?: () => void;
  message?: string;
}

/**
 * Điểm đóng modal dùng chung. Không còn hộp thoại xác nhận của trình duyệt (`window.confirm`):
 * đóng modal là đóng ngay. Giữ nguyên chữ ký hook để các modal gọi như cũ.
 */
export function useModalDirtyGuard(
  optionsOrDirty: boolean | UseModalDirtyGuardOptions,
  onConfirmCloseCallback?: () => void
) {
  const isOptionsObject = typeof optionsOrDirty === "object" && optionsOrDirty !== null;
  const onConfirmClose = isOptionsObject
    ? (optionsOrDirty.onConfirmClose ?? optionsOrDirty.onClose ?? (() => {}))
    : (onConfirmCloseCallback ?? (() => {}));

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) onConfirmClose();
    },
    [onConfirmClose]
  );

  return { handleOpenChange };
}
