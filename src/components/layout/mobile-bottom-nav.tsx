"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Bell,
  Menu,
  Plus,
} from "lucide-react";
import { MobileMenuDrawer } from "@/components/layout/mobile-menu-drawer";
import { useSidebarContext } from "@/components/layout/sidebar-context";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  getMobileBottomBarItems,
  type CanonicalRouteConfig,
} from "@/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "@/lib/navigation/active-matcher";

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const [menuOpen, setMenuOpen] = React.useState(false);
  const { badgeCounts } = useSidebarContext();
  const unreadNotifications = Number(badgeCounts?.notifications) || 0;

  const [deskItem, tasksItem, notifItem] = getMobileBottomBarItems();

  const isHomeActive = deskItem
    ? isRouteActive(deskItem.href, pathname, searchParams, deskItem.aliases)
    : isRouteActive("/", pathname, searchParams);
  const isTasksActive = tasksItem
    ? isRouteActive(tasksItem.href, pathname, searchParams, tasksItem.aliases)
    : isRouteActive("/tasks", pathname, searchParams);
  const isNotificationsActive = notifItem
    ? isRouteActive(notifItem.href, pathname, searchParams, notifItem.aliases)
    : isRouteActive("/notifications", pathname, searchParams);

  const handleCenterAction = () => {
    triggerHaptic("medium");
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
    }
  };

  return (
    <>
      <nav
        aria-label="Thanh điều hướng di động"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
          "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
          className
        )}
      >
        <div className="grid grid-cols-5 items-center h-14 px-2 max-w-lg mx-auto">
          {/* 1. Bàn làm việc / Tổng quan */}
          <Link
            href={deskItem?.href || "/"}
            onClick={() => triggerHaptic("light")}
            aria-label="Trang tổng quan"
            aria-current={isHomeActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] min-w-[48px] transition-colors active:scale-95 touch-manipulation",
              isHomeActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutDashboard size={20} strokeWidth={isHomeActive ? 2.2 : 1.7} />
            <span className="text-xs tracking-tight">{deskItem?.shortLabel || "Tổng quan"}</span>
          </Link>

          {/* 2. Nhiệm vụ (Công việc) */}
          <Link
            href={tasksItem?.href || "/tasks"}
            onClick={() => triggerHaptic("light")}
            aria-label="Nhiệm vụ - Công việc"
            aria-current={isTasksActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] min-w-[48px] transition-colors active:scale-95 touch-manipulation",
              isTasksActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare size={20} strokeWidth={isTasksActive ? 2.2 : 1.7} />
            <span className="text-xs tracking-tight">{tasksItem?.shortLabel || "Nhiệm vụ"}</span>
          </Link>

          {/* 3. Center Action Pill (Tạo việc mới) */}
          <div className="flex items-center justify-center">
            <button
              type="button"
              onClick={handleCenterAction}
              aria-label="Tạo việc mới"
              className={cn(
                "size-11 min-h-[48px] min-w-[48px] rounded-xl flex items-center justify-center shadow-xs transition-transform active:scale-95 cursor-pointer touch-manipulation",
                "bg-primary hover:bg-primary/90 text-primary-foreground"
              )}
            >
              <Plus size={20} strokeWidth={2.2} />
            </button>
          </div>

          {/* 4. Thông báo */}
          <Link
            href={notifItem?.href || "/notifications"}
            onClick={() => triggerHaptic("light")}
            aria-label="Thông báo hệ thống"
            aria-current={isNotificationsActive ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] min-w-[48px] transition-colors active:scale-95 touch-manipulation",
              isNotificationsActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Bell size={20} strokeWidth={isNotificationsActive ? 2.2 : 1.7} />
              {unreadNotifications > 0 && (
                <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-card" />
              )}
            </div>
            <span className="text-xs tracking-tight">{notifItem?.shortLabel || "Thông báo"}</span>
          </Link>

          {/* 5. Menu mở rộng */}
          <button
            type="button"
            onClick={() => {
              triggerHaptic("light");
              setMenuOpen(true);
            }}
            aria-label="Menu mở rộng và tài khoản"
            className="flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] min-w-[48px] text-muted-foreground hover:text-foreground transition-colors active:scale-95 touch-manipulation cursor-pointer"
          >
            <Menu size={20} strokeWidth={1.7} />
            <span className="text-xs tracking-tight">Thêm</span>
          </button>
        </div>
      </nav>

      {/* Mobile Menu Drawer Sheet */}
      <MobileMenuDrawer open={menuOpen} onOpenChange={setMenuOpen} />
    </>
  );
}
