"use client";

import * as React from "react";

export interface UseModalDirtyGuardOptions {
  isDirty: boolean;
  onConfirmClose?: () => void;
  onClose?: () => void;
  message?: string;
}

/**
 * Hook to guard against accidentally closing a modal when form has unsaved changes.
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
  const message = isOptionsObject
    ? (optionsOrDirty.message ?? "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?")
    : "Bạn có thay đổi chưa lưu. Bạn có chắc chắn muốn đóng?";

  const handleOpenChange = React.useCallback(
    (open: boolean) => {
      if (!open) {
        if (isDirty) {
          if (typeof window !== "undefined") {
            const confirmed = window.confirm(message);
            if (!confirmed) {
              return;
            }
          }
        }
        onConfirmClose();
      }
    },
    [isDirty, message, onConfirmClose]
  );

  return { handleOpenChange };
}
