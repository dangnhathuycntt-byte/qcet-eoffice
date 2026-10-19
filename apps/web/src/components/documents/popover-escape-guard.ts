import * as React from "react";

// Drawer (Vaul) không biết popover của base-ui nên Escape sẽ đóng cả hai.
// Đếm popover đang mở để drawer bỏ qua lệnh đóng đó và để popover đóng trước.
let openPopovers = 0;

export function hasOpenDetailsPopover(): boolean {
  return openPopovers > 0;
}

/** Đăng ký popover đang mở với drawer cha. */
export function useTrackOpenPopover(open: boolean) {
  React.useEffect(() => {
    if (!open) return;
    openPopovers += 1;
    // Giảm sau khi sự kiện phím hiện tại xử lý xong để drawer còn thấy popover đang mở
    return () => {
      setTimeout(() => {
        openPopovers = Math.max(0, openPopovers - 1);
      }, 0);
    };
  }, [open]);
}
