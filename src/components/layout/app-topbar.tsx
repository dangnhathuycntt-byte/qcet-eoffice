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
import {
  useSidebar,
  useSidebarLayout,
  resolveBreadcrumb,
} from "@/components/layout/sidebar-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { cn, getInitials as baseGetInitials } from "@/lib/utils";

import { formatDisplayName } from "@/components/layout/app-sidebar";

export function getInitials(name?: string | null): string {
  const cleanName = formatDisplayName(name);
  if (!cleanName || cleanName === "Người dùng") return "QC";
  return baseGetInitials(cleanName);
}

function MobileHeaderTitle({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);
  const { breadcrumbItems } = useSidebarLayout();
  const currentTitle = breadcrumbItems?.at(-1)?.label ?? pageTitle;

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
      <span className="text-xs font-bold text-foreground truncate max-w-[160px]">
        {currentTitle}
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
      <span className="text-xs font-bold text-foreground truncate max-w-[160px]">
        {pageTitle}
      </span>
    </div>
  );
}

function DesktopHeaderTitle({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);
  const { breadcrumbItems } = useSidebarLayout();

  if (breadcrumbItems?.length) {
    return (
      <nav aria-label="Đường dẫn trang" className="flex min-w-0 items-center gap-1.5 text-xs font-medium select-none">
        {breadcrumbItems.map((item, index) => (
          <React.Fragment key={`${item.label}-${index}`}>
            {index > 0 && <span className="text-muted-foreground/30">›</span>}
            {item.href ? (
              <Link href={item.href} className="text-muted-foreground/70 transition-colors hover:text-foreground">
                {item.label}
              </Link>
            ) : (
              <span
                className={cn(
                  "truncate",
                  index === breadcrumbItems.length - 1
                    ? "max-w-[min(52vw,680px)] font-semibold text-foreground"
                    : "text-muted-foreground/70",
                  item.mono && "font-mono text-[11px]"
                )}
                title={item.label}
              >
                {item.label}
              </span>
            )}
          </React.Fragment>
        ))}
      </nav>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs font-medium select-none">
      <span className="text-muted-foreground/60">{rootTitle}</span>
      <span className="text-muted-foreground/30">›</span>
      <span className="font-semibold text-foreground">{pageTitle}</span>
    </div>
  );
}

function DesktopHeaderTitleFallback({ pathname }: { pathname: string }) {
  const [rootTitle, pageTitle] = resolveBreadcrumb(pathname || "/");
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium select-none">
      <span className="text-muted-foreground/60">{rootTitle}</span>
      <span className="text-muted-foreground/30">›</span>
      <span className="font-semibold text-foreground">{pageTitle}</span>
    </div>
  );
}

/**
 * Desktop-only topbar (>= 768px). Linear-style header bar with matching background.
 */
export function DesktopTopbar() {
  const pathname = usePathname();

  return (
    <header
      data-slot="desktop-topbar"
      className="hidden md:flex h-11 shrink-0 items-center justify-between px-4 bg-[#f8f9fa] dark:bg-zinc-950 select-none"
    >
      <Suspense fallback={<DesktopHeaderTitleFallback pathname={pathname} />}>
        <DesktopHeaderTitle pathname={pathname} />
      </Suspense>
    </header>
  );
}

/**
 * Mobile-only topbar (< 768px).
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
      className="md:hidden sticky top-0 z-30 w-full h-[calc(48px+env(safe-area-inset-top,0px))] border-b border-border/70 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md pt-[env(safe-area-inset-top,0px)] px-3 flex items-center justify-between gap-2 shadow-2xs select-none"
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
