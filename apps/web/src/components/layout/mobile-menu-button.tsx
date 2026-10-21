"use client";

import * as React from "react";
import { IconSidebarPanel } from "@/components/layout/sidebar-rounded-icons";
import { SidebarBadgeContext } from "@/components/layout/sidebar-context";
import { Button } from "@/components/ui/button";

/** Menu điện thoại (sidebar dạng ngăn kéo) đang mở; AppShell cung cấp. */
export const MobileMenuOpenContext = React.createContext(false);

export interface MobileMenuButtonProps extends Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "onClick"> {
  "aria-label"?: string;
}

/**
 * Nút mở menu điện thoại ở đầu header mỗi trang (như Linear), chuẩn theo trang Nhiệm vụ: 32px, icon 14px.
 * Menu đang mở thì icon tô nửa trái. Hộp thư có thông báo chưa đọc: chấm 6px ở góc icon (chỗ chật như thanh trên cùng chỉ dùng
 * chấm, theo M3), số nằm ở hàng Hộp thư trong ngăn kéo. Chấm nằm ở nút này nên mọi header riêng của trang đều có, không chỉ
 * thanh trên cùng chung.
 */
export function MobileMenuButton({ children, "aria-label": ariaLabel, ...props }: MobileMenuButtonProps) {
  const open = React.useContext(MobileMenuOpenContext);
  const unreadCount = Number(React.useContext(SidebarBadgeContext)?.badgeCounts.notifications) || 0;
  return (
    <Button
      variant="ghost"
      size="icon-md"
      aria-label={ariaLabel ?? (unreadCount > 0 ? `Mở menu, ${unreadCount} thông báo chưa đọc` : "Mở menu")}
      onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-mobile-menu"))}
      {...props}
    >
      {/* Chấm bám góc icon, không bám góc nút (header Trợ lý có nút 44px); không đè nét icon nên không cần viền cắt, viền màu thẻ thành quầng trắng trên header nền xám */}
      <span className="relative flex">
        <IconSidebarPanel size={14} active={open} />
        {unreadCount > 0 && (
          <span aria-hidden data-slot="mobile-menu-unread-dot" className="absolute -right-1 -top-1 size-1.5 rounded-full bg-primary" />
        )}
      </span>
      {children}
    </Button>
  );
}
