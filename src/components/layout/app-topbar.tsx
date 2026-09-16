"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Search,
  Inbox,
  Menu,
  ChevronRight,
} from "lucide-react";
import { useSidebar, resolveBreadcrumb } from "@/components/layout/sidebar-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

function MobileHeaderTitle({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);

  return (
    <div className="flex items-center min-w-0 gap-1.5">
      <Link href="/tasks" className="flex items-center gap-1.5 shrink-0" aria-label="Trang chủ">
        <Image
          src="/logo-qcet.png"
          alt="QCET Logo"
          width={22}
          height={22}
          className="rounded object-contain shrink-0"
        />
      </Link>
      <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
      <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
        {pageTitle}
      </span>
    </div>
  );
}

function MobileHeaderTitleFallback({ pathname }: { pathname: string }) {
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/");
  return (
    <div className="flex items-center min-w-0 gap-1.5">
      <Link href="/tasks" className="flex items-center gap-1.5 shrink-0" aria-label="Trang chủ">
        <Image
          src="/logo-qcet.png"
          alt="QCET Logo"
          width={22}
          height={22}
          className="rounded object-contain shrink-0"
        />
      </Link>
      <ChevronRight size={12} className="text-muted-foreground/50 shrink-0" />
      <span className="text-xs font-bold text-foreground truncate max-w-[150px]">
        {pageTitle}
      </span>
    </div>
  );
}

/**
 * Mobile-only topbar (< 768px). On desktop (>= 768px), topbar is omitted per Linear layout standard.
 */
export function AppTopbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { badgeCounts } = useSidebar();
  const { user } = useAuth();

  const unreadCount = Number(badgeCounts?.notifications) || 0;

  const handleOpenSearch = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("qcet:open-command-search", { detail: { open: true } }));
  }, []);

  const handleOpenMobileMenu = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("qcet:open-mobile-menu"));
  }, []);

  return (
    <header
      data-slot="app-topbar"
      className="md:hidden sticky top-0 z-30 w-full h-[calc(48px+env(safe-area-inset-top,0px))] border-b border-border/70 bg-background/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)] px-3 flex items-center justify-between gap-2 shadow-2xs select-none"
    >
      {/* Left: Brand / Title */}
      <Suspense fallback={<MobileHeaderTitleFallback pathname={pathname} />}>
        <MobileHeaderTitle pathname={pathname} />
      </Suspense>

      {/* Right: Quick actions for mobile */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Search button */}
        <button
          type="button"
          onClick={handleOpenSearch}
          className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          title="Tìm kiếm (⌘K)"
          aria-label="Tìm kiếm"
        >
          <Search size={16} strokeWidth={1.5} />
        </button>

        {/* Inbox Link */}
        <Link
          href="/inbox"
          className="size-8 relative flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
          title="Hộp thư"
          aria-label="Hộp thư"
        >
          <Inbox size={16} strokeWidth={1.5} />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[15px] h-3.5 px-0.5 rounded-full bg-primary text-[9px] font-mono font-bold text-primary-foreground flex items-center justify-center ring-1 ring-background tabular-nums">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Link>

        {/* Mobile Menu Drawer button */}
        <button
          type="button"
          onClick={handleOpenMobileMenu}
          className="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
          title="Menu tùy chọn"
          aria-label="Menu tùy chọn"
        >
          <Menu size={16} strokeWidth={1.5} />
        </button>
      </div>
    </header>
  );
}
