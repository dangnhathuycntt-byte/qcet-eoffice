"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  MoreHorizontal,
  Calendar,
  Users,
  Bell,
  Settings,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";
import { useSidebarContext } from "@/components/layout/sidebar-context";

export interface MobileBottomNavItem {
  id: string;
  label: string;
  shortLabel: string;
  href: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badgeKey?: "docsInbox" | "notifications" | "calendar";
  isAction?: boolean;
}

export interface MobileBottomNavProps {
  className?: string;
  variant?: "with-more" | "canonical";
  onOpenMore?: () => void;
  activeRoute?: string;
}

/**
 * 4 Primary Mobile Destinations
 * 1. Bàn làm việc (/)
 * 2. Nhiệm vụ (/tasks)
 * 3. Văn bản (/documents)
 * 4. Thêm (Mở ngăn kéo drawer/sheet cho Lịch, Tổ chức, Cài đặt, Thông báo)
 */
export const MOBILE_PRIMARY_TABS: readonly MobileBottomNavItem[] = [
  {
    id: "desk",
    label: "Bàn làm việc",
    shortLabel: "Làm việc",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "tasks",
    label: "Quản lý nhiệm vụ",
    shortLabel: "Nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    id: "documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    href: "/documents",
    icon: FileText,
    badgeKey: "docsInbox",
  },
  {
    id: "more",
    label: "Thêm tiện ích",
    shortLabel: "Thêm",
    href: "/more",
    icon: MoreHorizontal,
    isAction: true,
  },
] as const;

/**
 * Alternative canonical 4 destinations (desk, tasks, documents, calendar)
 */
export const MOBILE_CANONICAL_TABS: readonly MobileBottomNavItem[] = [
  {
    id: "desk",
    label: "Bàn làm việc",
    shortLabel: "Làm việc",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    id: "tasks",
    label: "Quản lý nhiệm vụ",
    shortLabel: "Nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
  },
  {
    id: "documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    href: "/documents",
    icon: FileText,
    badgeKey: "docsInbox",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    shortLabel: "Lịch",
    href: "/calendar",
    icon: Calendar,
    badgeKey: "calendar",
  },
] as const;

/**
 * Determines whether a route/tab is currently active.
 */
export function isMobileTabActive(tab: MobileBottomNavItem, currentPath: string): boolean {
  const cleanPath = currentPath.split("?")[0].split("#")[0].trim();

  if (tab.id === "desk") {
    return cleanPath === "/" || cleanPath === "/dashboard";
  }

  if (tab.id === "tasks") {
    return cleanPath === "/tasks" || cleanPath.startsWith("/tasks/") || cleanPath === "/unit-tasks";
  }

  if (tab.id === "documents") {
    return cleanPath === "/documents" || cleanPath.startsWith("/documents/");
  }

  if (tab.id === "more") {
    // Active if on secondary routes accessible via "More" drawer
    return (
      cleanPath === "/more" ||
      cleanPath === "/calendar" ||
      cleanPath.startsWith("/calendar/") ||
      cleanPath === "/org" ||
      cleanPath.startsWith("/org/") ||
      cleanPath === "/settings" ||
      cleanPath.startsWith("/settings/") ||
      cleanPath === "/notifications" ||
      cleanPath.startsWith("/notifications/")
    );
  }

  if (tab.id === "calendar") {
    return cleanPath === "/calendar" || cleanPath.startsWith("/calendar/");
  }

  return cleanPath === tab.href || cleanPath.startsWith(`${tab.href}/`);
}

/**
 * MobileBottomNav (4-Tab Bottom Navigation)
 *
 * Implements mobile-first ergonomics (< 768px):
 * - Fixed at viewport bottom with safe-area padding
 * - Exactly 4 primary destinations (Bàn làm việc, Nhiệm vụ, Văn bản, Thêm)
 * - Strict >= 44px touch targets (min-h-[48px], min-w-[48px])
 * - Haptic feedback integration
 * - Automatically hidden when virtual keyboard opens
 * - Light-only design, zero emojis, font sizes >= 12px
 */
export function MobileBottomNav({
  className,
  variant = "with-more",
  onOpenMore,
  activeRoute,
}: MobileBottomNavProps) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { isKeyboardOpen } = useVirtualKeyboard();
  const { badgeCounts } = useSidebarContext();

  // Build current URL path including search query for zone matching
  const currentPathWithQuery = React.useMemo(() => {
    if (activeRoute) return activeRoute;
    const queryString = searchParams?.toString();
    return queryString ? `${pathname}?${queryString}` : pathname;
  }, [activeRoute, pathname, searchParams]);

  // Tab items based on variant
  const items = variant === "canonical" ? MOBILE_CANONICAL_TABS : MOBILE_PRIMARY_TABS;

  const [isDrawerOpen, setIsDrawerOpen] = React.useState(false);

  const handleMoreClick = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      triggerHaptic("light");
      if (onOpenMore) {
        onOpenMore();
      } else {
        setIsDrawerOpen((prev) => !prev);
      }
    },
    [onOpenMore]
  );

  const handleNavClick = React.useCallback(() => {
    triggerHaptic("light");
  }, []);

  // Do not render bottom nav when virtual keyboard is active to prevent viewport obstruction
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Thanh điều hướng di động"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
        "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        className
      )}
    >
      <div className="grid grid-cols-4 items-center justify-around h-14 min-h-[56px] px-1">
        {items.map((tab) => {
          const isActive = isMobileTabActive(tab, currentPathWithQuery);
          const Icon = tab.icon;
          const rawBadge = tab.badgeKey && badgeCounts ? badgeCounts[tab.badgeKey] : 0;
          const numBadge = typeof rawBadge === "number" ? rawBadge : parseInt(String(rawBadge || "0"), 10) || 0;

          const content = (
            <span className="relative flex flex-col items-center justify-center gap-1 w-full h-full">
              <span className="relative inline-flex items-center justify-center">
                <Icon
                  size={20}
                  strokeWidth={isActive ? 2 : 1.5}
                  className={cn(
                    "transition-transform duration-150",
                    isActive ? "text-primary scale-105" : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                {numBadge > 0 && (
                  <span
                    aria-label={`${numBadge} mục chưa đọc`}
                    className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[11px] font-bold text-white font-mono tabular-nums leading-none border border-card shadow-2xs"
                  >
                    {numBadge > 99 ? "99+" : numBadge}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  "text-xs leading-none tracking-tight transition-colors duration-150 select-none",
                  isActive
                    ? "font-semibold text-primary"
                    : "font-medium text-muted-foreground group-hover:text-foreground"
                )}
              >
                {tab.shortLabel}
              </span>
            </span>
          );

          if (tab.isAction) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={handleMoreClick}
                aria-label={`${tab.label} (Mở menu danh mục)`}
                aria-haspopup="dialog"
                className={cn(
                  "group flex flex-col items-center justify-center",
                  "min-h-[48px] min-w-[48px] h-full w-full",
                  "touch-manipulation cursor-pointer select-none",
                  "active:scale-95 transition-all duration-100 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {content}
              </button>
            );
          }

          return (
            <Link
              key={tab.id}
              href={tab.href}
              onClick={handleNavClick}
              aria-label={tab.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex flex-col items-center justify-center",
                "min-h-[48px] min-w-[48px] h-full w-full",
                "touch-manipulation cursor-pointer select-none",
                "active:scale-95 transition-all duration-100 rounded-lg focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              {content}
            </Link>
          );
        })}
      </div>

      {/* Mobile "More" Drawer / Bottom Sheet */}
      {isDrawerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-xs animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Tiện ích mở rộng"
        >
          <div
            className="absolute inset-0"
            onClick={() => setIsDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative z-10 w-full max-w-lg rounded-t-2xl border-t border-border/80 bg-card p-4 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] shadow-2xl space-y-3 animate-in slide-in-from-bottom duration-200">
            <div className="mx-auto w-12 h-1.5 rounded-full bg-border/80 mb-2 shrink-0" aria-hidden="true" />
            <div className="flex items-center justify-between border-b border-border/60 pb-3">
              <span className="text-sm font-semibold text-foreground">Tiện ích &amp; Chức năng khác</span>
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                className="flex size-9 items-center justify-center rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer"
                aria-label="Đóng bảng tiện ích"
              >
                <X className="size-4.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <Link
                href="/calendar"
                onClick={() => {
                  triggerHaptic("light");
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 p-3 min-h-[48px] rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/50 transition-colors text-foreground group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 shrink-0">
                  <Calendar className="size-4.5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Lịch công tác</p>
                  <p className="text-[11px] text-muted-foreground truncate">Lịch tuần &amp; phòng họp</p>
                </div>
              </Link>

              <Link
                href="/org"
                onClick={() => {
                  triggerHaptic("light");
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 p-3 min-h-[48px] rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/50 transition-colors text-foreground group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 shrink-0">
                  <Users className="size-4.5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Sơ đồ tổ chức</p>
                  <p className="text-[11px] text-muted-foreground truncate">Phòng ban &amp; nhân sự</p>
                </div>
              </Link>

              <Link
                href="/notifications"
                onClick={() => {
                  triggerHaptic("light");
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 p-3 min-h-[48px] rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/50 transition-colors text-foreground group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 shrink-0">
                  <Bell className="size-4.5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Thông báo</p>
                  <p className="text-[11px] text-muted-foreground truncate">Nhắc việc &amp; tin tức</p>
                </div>
              </Link>

              <Link
                href="/settings"
                onClick={() => {
                  triggerHaptic("light");
                  setIsDrawerOpen(false);
                }}
                className="flex items-center gap-3 p-3 min-h-[48px] rounded-xl border border-border/70 bg-muted/20 hover:bg-muted/50 transition-colors text-foreground group"
              >
                <div className="flex size-9 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 shrink-0">
                  <Settings className="size-4.5" strokeWidth={1.5} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold group-hover:text-primary transition-colors truncate">Cài đặt</p>
                  <p className="text-[11px] text-muted-foreground truncate">Tùy chọn &amp; tài khoản</p>
                </div>
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default MobileBottomNav;
