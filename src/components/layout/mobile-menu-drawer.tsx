"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { Drawer as VaulDrawer } from "vaul";
import { Bell, BellOff, Download, HelpCircle, Loader2, LogOut, Smartphone, User, Volume2 } from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { SidebarNavList } from "@/components/layout/sidebar-nav-list";
import { formatDisplayName } from "@/components/layout/app-sidebar";
import { usePushNotification } from "@/hooks/use-push-notification";
import { usePWAInstall } from "@/hooks/use-pwa-install";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import { Pressable } from "@/components/ui/pressable";
import { UserAvatar } from "@/components/ui/user-avatar";

export interface MobileMenuDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Cùng kiểu hàng với mục điều hướng của sidebar desktop (h-7, chữ compact, nền sidebar-accent khi chạm). */
const ROW_CLASS =
  "flex h-7 w-full items-center gap-2 rounded-sm px-2 text-compact font-medium text-muted-foreground outline-none touch-manipulation transition-colors hover:bg-sidebar-accent/60 hover:text-foreground focus-visible:bg-sidebar-accent active:bg-sidebar-accent";
const ICON_CLASS = "size-3.5 shrink-0";

/**
 * Sidebar di động trượt từ trái: cùng logo, nhóm và danh sách điều hướng với sidebar desktop (`SidebarNavList`),
 * kèm các thao tác tài khoản và ứng dụng. Mở bằng sự kiện `qcet:open-mobile-menu`.
 */
export function MobileMenuDrawer({ open, onOpenChange }: MobileMenuDrawerProps) {
  const { user, logout, setIsProfileModalOpen } = useAuth();
  const [isTestingPush, setIsTestingPush] = React.useState(false);

  // Đóng bàn phím ảo nếu đang mở khi drawer hiện ra
  React.useEffect(() => {
    if (open && typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }, [open]);

  const { isSupported, isSubscribed, isLoading, subscribeToPush, unsubscribeFromPush, sendTestNotification } =
    usePushNotification();
  const { isInstallable, isIOS, isStandalone, installApp } = usePWAInstall();

  const close = () => onOpenChange(false);
  const userRoleLabel =
    user?.role === "ADMIN" ? "Ban Giám hiệu" : user?.role === "MANAGER" ? "Trưởng đơn vị" : "Chuyên viên";

  return (
    <VaulDrawer.Root open={open} onOpenChange={onOpenChange} direction="left">
      <VaulDrawer.Portal>
        <VaulDrawer.Overlay className="fixed inset-0 z-40 bg-overlay" />
        <VaulDrawer.Content
          aria-describedby={undefined}
          className="fixed inset-y-0 left-0 z-50 flex w-[min(280px,calc(100vw-56px))] flex-col overflow-hidden rounded-r-sm bg-sidebar text-foreground shadow-dialog outline-none"
        >
          <VaulDrawer.Title className="sr-only">Menu điều hướng</VaulDrawer.Title>

          <div className="shrink-0 px-3 pt-[calc(env(safe-area-inset-top,0px)+14px)] pb-2.5">
            <Link
              href="/"
              onClick={close}
              title="QCET E-Office"
              className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              <Image src="/logo-qcet.png" alt="QCET" width={24} height={24} className="size-6 shrink-0 rounded-full object-contain" priority />
              <span className="truncate text-compact font-semibold tracking-tight text-foreground">QCET E-Office</span>
            </Link>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto thin-scrollbar">
            <SidebarNavList onNavigate={close} className="flex-none overflow-visible" />

            <div className="space-y-0.5 px-2.5 pt-3 pb-3">
              <div className="flex items-center gap-2 px-2 pt-1 pb-1.5">
                <UserAvatar name={formatDisplayName(user?.name)} avatarUrl={user?.avatar} size="sm" className="shrink-0" />
                <div className="min-w-0">
                  <div className="truncate text-compact text-foreground">{formatDisplayName(user?.name)}</div>
                  <div className="truncate text-xs text-muted-foreground">{user?.department || userRoleLabel}</div>
                </div>
              </div>

              <Pressable
                onClick={() => {
                  triggerHaptic("light");
                  close();
                  if (setIsProfileModalOpen) setIsProfileModalOpen(true);
                  else if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("qcet:open-profile-modal"));
                }}
                className={ROW_CLASS}
              >
                <User className={ICON_CLASS} />
                <span className="flex-1 truncate text-left">Hồ sơ cá nhân</span>
              </Pressable>

              {isSupported ? (
                <Pressable
                  disabled={isLoading}
                  onClick={async () => {
                    triggerHaptic("selection");
                    if (isSubscribed) await unsubscribeFromPush();
                    else await subscribeToPush();
                  }}
                  className={ROW_CLASS}
                >
                  {isLoading ? <Loader2 className={cn(ICON_CLASS, "animate-spin")} /> : isSubscribed ? <BellOff className={ICON_CLASS} /> : <Bell className={ICON_CLASS} />}
                  <span className="flex-1 truncate text-left">{isSubscribed ? "Tắt thông báo chuông" : "Bật thông báo chuông"}</span>
                </Pressable>
              ) : null}

              {isSupported && isSubscribed ? (
                <Pressable
                  disabled={isTestingPush || isLoading}
                  onClick={async () => {
                    triggerHaptic("selection");
                    setIsTestingPush(true);
                    try {
                      await sendTestNotification({
                        title: "BGH giao việc mới",
                        body: "Thử nghiệm kết nối chuông đẩy QCET E-Office thành công.",
                        linkHref: "/tasks",
                      });
                    } finally {
                      setIsTestingPush(false);
                    }
                  }}
                  className={ROW_CLASS}
                >
                  {isTestingPush ? <Loader2 className={cn(ICON_CLASS, "animate-spin")} /> : <Volume2 className={ICON_CLASS} />}
                  <span className="flex-1 truncate text-left">Thử chuông ngay</span>
                </Pressable>
              ) : null}

              {isInstallable ? (
                <Pressable
                  onClick={async () => {
                    triggerHaptic("medium");
                    await installApp();
                    close();
                  }}
                  className={ROW_CLASS}
                >
                  <Download className={ICON_CLASS} />
                  <span className="flex-1 truncate text-left">Cài đặt lên màn hình chính</span>
                </Pressable>
              ) : null}

              {isIOS && !isStandalone ? (
                <Pressable
                  onClick={() => {
                    triggerHaptic("light");
                    close();
                    if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("qcet:open-push-onboarding"));
                  }}
                  className={ROW_CLASS}
                >
                  <Smartphone className={ICON_CLASS} />
                  <span className="flex-1 truncate text-left">Hướng dẫn cài đặt iOS</span>
                </Pressable>
              ) : null}

              <Pressable
                onClick={() => {
                  triggerHaptic("light");
                  close();
                  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("qcet:open-help-guide"));
                }}
                className={ROW_CLASS}
              >
                <HelpCircle className={ICON_CLASS} />
                <span className="flex-1 truncate text-left">Trợ giúp và hướng dẫn</span>
              </Pressable>
            </div>
          </div>

          <div className="shrink-0 border-t border-border/60 px-2.5 pt-1.5 pb-[calc(env(safe-area-inset-bottom,0px)+8px)]">
            <Pressable
              onClick={() => {
                triggerHaptic("warning");
                logout();
                close();
              }}
              className={cn(ROW_CLASS, "text-destructive hover:bg-destructive/10 hover:text-destructive active:bg-destructive/10")}
            >
              <LogOut className={ICON_CLASS} />
              <span className="flex-1 truncate text-left">Đăng xuất</span>
            </Pressable>
          </div>
        </VaulDrawer.Content>
      </VaulDrawer.Portal>
    </VaulDrawer.Root>
  );
}
