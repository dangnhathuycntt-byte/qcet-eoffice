"use client";

import * as React from "react";
import { IconSidebarPanel } from "@/components/layout/sidebar-rounded-icons";
import { Button } from "@/components/ui/button";

/** Menu điện thoại (sidebar dạng ngăn kéo) đang mở; AppShell cung cấp. */
export const MobileMenuOpenContext = React.createContext(false);

export interface MobileMenuButtonProps extends Omit<React.ComponentProps<typeof Button>, "variant" | "size" | "onClick"> {
  "aria-label"?: string;
}

/**
 * Nút mở menu điện thoại ở đầu header mỗi trang (như Linear), chuẩn theo trang Nhiệm vụ: 32px, icon 14px.
 * Menu đang mở thì icon tô nửa trái.
 */
export function MobileMenuButton({ children, "aria-label": ariaLabel = "Mở menu", ...props }: MobileMenuButtonProps) {
  const open = React.useContext(MobileMenuOpenContext);
  return (
    <Button
      variant="ghost"
      size="icon-md"
      aria-label={ariaLabel}
      onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-mobile-menu"))}
      {...props}
    >
      <IconSidebarPanel size={14} active={open} />
      {children}
    </Button>
  );
}
