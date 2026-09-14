"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { triggerHaptic } from "@/lib/haptics";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";
import { useSidebarContext } from "@/components/layout/sidebar-context";
import {
  getMobileBottomBarItems,
  type CanonicalRouteConfig,
} from "@/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "@/lib/navigation/active-matcher";

const ROUTE_ICONS: Record<CanonicalRouteConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  Settings,
};

export interface MobileBottomNavProps {
  className?: string;
}

/**
 * MobileBottomNav (mobile-first bottom navigation, < 768px)
 *
 * T86: this component is registry-driven. `getMobileBottomBarItems()` is the
 * single source for the primary mobile destinations and `isRouteActive()`
 * provides active/alias parity. Secondary destinations (org, settings) are
 * reached through the canonical `MobileMenuDrawer` hosted at AppShell (opened
 * from the topbar), so no second hard-coded route owner exists here.
 */
export function MobileBottomNav({ className }: MobileBottomNavProps) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { isKeyboardOpen } = useVirtualKeyboard();
  const { badgeCounts } = useSidebarContext();

  const bottomItems = getMobileBottomBarItems();

  // Hide the bar while the virtual keyboard is open (WCAG 2.4.11 & rule ui.md #12).
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <nav
      role="navigation"
      aria-label="Thanh điều hướng di động"
      data-slot="mobile-bottom-nav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden",
        "bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
        "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        className
      )}
    >
      <div className="grid grid-cols-4 items-center justify-around h-14 min-h-[56px] px-1 max-w-lg mx-auto">
        {bottomItems.map((item) => {
          const Icon = ROUTE_ICONS[item.iconName] || LayoutDashboard;
          const isActive = isRouteActive(item.href, pathname, searchParams, item.aliases);
          const rawBadge = item.badgeKey ? badgeCounts?.[item.badgeKey] : 0;
          const numBadge =
            typeof rawBadge === "number"
              ? rawBadge
              : parseInt(String(rawBadge || "0"), 10) || 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => triggerHaptic("light")}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "group flex flex-col items-center justify-center",
                "min-h-[48px] min-w-[48px] h-full w-full",
                "touch-manipulation cursor-pointer select-none rounded-lg",
                "active:scale-95 transition-all duration-100 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-primary/40",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className="relative flex flex-col items-center justify-center gap-1 w-full h-full">
                <span className="relative inline-flex items-center justify-center">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2 : 1.5}
                    className={cn(
                      "transition-transform duration-150",
                      isActive
                        ? "text-primary scale-105"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {numBadge > 0 && (
                    <span
                      aria-label={`${numBadge} mục chưa đọc`}
                      className="absolute -top-1 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-xs font-bold text-white font-mono tabular-nums leading-none border border-card shadow-2xs"
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
                  {item.shortLabel}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export default MobileBottomNav;
