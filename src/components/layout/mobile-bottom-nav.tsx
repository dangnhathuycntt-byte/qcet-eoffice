"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Calendar,
} from "lucide-react";
import { useSidebarContext } from "@/components/layout/sidebar-context";
import { useVirtualKeyboard } from "@/hooks/use-virtual-keyboard";
import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  getMobileBottomBarItems,
  type CanonicalRouteConfig,
} from "@/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "@/lib/navigation/active-matcher";

const ROUTE_ICONS: Record<
  string,
  React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>
> = {
  LayoutDashboard,
  CheckSquare,
  FileText,
  Calendar,
};

export function MobileBottomNav({ className }: { className?: string }) {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const { badgeCounts } = useSidebarContext();
  const { isKeyboardOpen } = useVirtualKeyboard();

  const bottomItems = getMobileBottomBarItems();

  // Hide bottom nav when virtual keyboard is active (WCAG 2.4.11 & Apple HIG)
  if (isKeyboardOpen) {
    return null;
  }

  return (
    <nav
      aria-label="Thanh điều hướng di động"
      data-slot="mobile-bottom-nav"
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-lg border-t border-border/70 shadow-lg",
        "pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]",
        className
      )}
    >
      <div className="grid grid-cols-4 items-center h-14 px-2 max-w-lg mx-auto">
        {bottomItems.map((item: CanonicalRouteConfig) => {
          const Icon = ROUTE_ICONS[item.iconName] || LayoutDashboard;
          const isActive = isRouteActive(item.href, pathname, searchParams, item.aliases);
          const badgeValue = item.badgeKey ? badgeCounts?.[item.badgeKey] : undefined;
          const hasBadge = Number(badgeValue) > 0;

          return (
            <Link
              key={item.id}
              href={item.href}
              onClick={() => triggerHaptic("light")}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 h-full min-h-[48px] min-w-[48px] transition-colors active:scale-95 touch-manipulation",
                isActive
                  ? "text-primary font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="relative">
                <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} />
                {hasBadge && (
                  <span className="absolute -top-1 -right-1 size-2 rounded-full bg-rose-500 ring-2 ring-card" />
                )}
              </div>
              <span className="text-xs tracking-tight">{item.shortLabel}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const MobileBottomBar = MobileBottomNav;
