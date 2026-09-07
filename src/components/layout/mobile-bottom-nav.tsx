"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  Home,
  CheckSquare,
  Zap,
  Bell,
  Menu,
  Plus,
} from "lucide-react";
import { useAuth } from "@/context/auth-context";
import { isExecutiveUser, isManagerUser } from "@/lib/auth/roles";
import { MobileMenuDrawer } from "@/components/layout/mobile-menu-drawer";
import { cn } from "@/lib/utils";

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = React.useState(false);

  const isExecutive = isExecutiveUser(user);
  const isManager = isManagerUser(user);
  const isApprover = isExecutive || isManager;

  const zoneParam = searchParams?.get("zone");
  const isHomeActive = pathname === "/" && !zoneParam;
  const isTasksActive = pathname === "/" && zoneParam === "tasks";
  const isNotificationsActive = pathname.startsWith("/notifications");

  const handleCenterAction = () => {
    if (isApprover) {
      // BGH / Trưởng đơn vị: mở Hàng đợi duyệt nhanh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("qcet:open-briefing-modal"));
      }
    } else {
      // Giảng viên: Tạo việc / báo cáo nhanh
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("qcet:open-submit-deliverable"));
      }
    }
  };

  return (
    <>
      <nav
        aria-label="Thanh điều hướng di động"
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
          "pb-[max(0.5rem,env(safe-area-inset-bottom))]",
          className
        )}
      >
        <div className="grid grid-cols-5 items-center h-14 px-2 max-w-lg mx-auto">
          {/* 1. Tổng quan */}
          <Link
            href="/"
            aria-label="Trang tổng quan"
            aria-current={isHomeActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] min-w-[44px] transition-colors active:scale-95 touch-manipulation",
              isHomeActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Home size={20} strokeWidth={isHomeActive ? 2.2 : 1.7} />
            <span className="text-xs tracking-tight">Tổng quan</span>
          </Link>

          {/* 2. Công việc */}
          <Link
            href="/?zone=tasks"
            aria-label="Danh sách công việc"
            aria-current={isTasksActive ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] min-w-[44px] transition-colors active:scale-95 touch-manipulation",
              isTasksActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <CheckSquare size={20} strokeWidth={isTasksActive ? 2.2 : 1.7} />
            <span className="text-xs tracking-tight">Công việc</span>
          </Link>

          {/* 3. Center Action Pill (Duyệt nhanh / Tạo việc) */}
          <div className="flex items-center justify-center -mt-4">
            <button
              type="button"
              onClick={handleCenterAction}
              aria-label={isApprover ? "Phê duyệt nhanh" : "Tạo việc mới"}
              className={cn(
                "size-12 min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shadow-lg transition-transform active:scale-90 cursor-pointer touch-manipulation",
                isApprover
                  ? "bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25"
                  : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-primary/25"
              )}
            >
              {isApprover ? <Zap size={22} className="fill-current" /> : <Plus size={24} />}
            </button>
          </div>

          {/* 4. Thông báo */}
          <Link
            href="/notifications"
            aria-label="Thông báo hệ thống"
            aria-current={isNotificationsActive ? "page" : undefined}
            className={cn(
              "relative flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] min-w-[44px] transition-colors active:scale-95 touch-manipulation",
              isNotificationsActive ? "text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Bell size={20} strokeWidth={isNotificationsActive ? 2.2 : 1.7} />
              <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500" />
            </div>
            <span className="text-xs tracking-tight">Thông báo</span>
          </Link>

          {/* 5. Menu mở rộng */}
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Menu mở rộng và tài khoản"
            className="flex flex-col items-center justify-center gap-0.5 h-full min-h-[44px] min-w-[44px] text-muted-foreground hover:text-foreground transition-colors active:scale-95 touch-manipulation cursor-pointer"
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
