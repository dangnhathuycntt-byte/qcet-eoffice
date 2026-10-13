"use client";

import * as React from "react";
import { Suspense } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import {
  useSidebar,
  useSidebarLayout,
  resolveBreadcrumb,
} from "@/components/layout/sidebar-context";
import { cn, getInitials as baseGetInitials } from "@/lib/utils";

import { formatDisplayName } from "@/components/layout/app-sidebar";
import { Pressable } from "@/components/ui/pressable";
import { Button } from "@/components/ui/button";
import { IconSidebarPanel } from "@/components/layout/sidebar-rounded-icons";

export function getInitials(name?: string | null): string {
  const cleanName = formatDisplayName(name);
  if (!cleanName || cleanName === "Người dùng") return "QC";
  return baseGetInitials(cleanName);
}

function MobileHeaderTitle({ pathname }: { pathname: string }) {
  const searchParams = useSearchParams();
  const [, pageTitle] = resolveBreadcrumb(pathname || "/", searchParams);
  const { breadcrumbItems } = useSidebarLayout();
  const currentTitle = breadcrumbItems?.at(-1)?.label ?? pageTitle;

  return <p className="min-w-0 truncate text-compact font-medium text-foreground">{currentTitle}</p>;
}

function MobileHeaderTitleFallback({ pathname }: { pathname: string }) {
  const [, pageTitle] = resolveBreadcrumb(pathname || "/");
  return <p className="min-w-0 truncate text-compact font-medium text-foreground">{pageTitle}</p>;
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
                  item.mono && "font-mono text-xs"
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
 * Desktop-only topbar (>= 768px). Compact header bar with matching background.
 */
export function DesktopTopbar() {
  const pathname = usePathname();

  return (
    <header
      data-slot="desktop-topbar"
      className="hidden md:flex h-11 shrink-0 items-center justify-between px-4 bg-sidebar dark:bg-zinc-950 select-none"
    >
      <Suspense fallback={<DesktopHeaderTitleFallback pathname={pathname} />}>
        <DesktopHeaderTitle pathname={pathname} />
      </Suspense>
    </header>
  );
}

const TOPBAR_ACTIONS_ID = "app-topbar-actions";

/**
 * Đưa nút thao tác chính của trang (vd. "+") lên thanh trên cùng điện thoại, cạnh nút tìm, như Linear.
 * Trang tự ẩn nút gốc dưới md; trên desktop thanh này ẩn nên nút gắn vào cũng không hiện.
 */
export function MobileTopbarActions({ children }: { children: React.ReactNode }) {
  const [target, setTarget] = React.useState<HTMLElement | null>(null);
  React.useEffect(() => {
    setTarget(document.getElementById(TOPBAR_ACTIONS_ID));
  }, []);
  return target ? createPortal(children, target) : null;
}

/**
 * Mobile-only topbar (< 768px): nút mở sidebar, tên trang, nút tìm, cùng mẫu header riêng của Nhiệm vụ/Hộp thư (như Linear).
 */
export function AppTopbar() {
  const pathname = usePathname();
  const { badgeCounts } = useSidebar();

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
      className="md:hidden sticky top-0 z-30 flex h-[calc(44px+env(safe-area-inset-top,0px))] w-full shrink-0 items-center gap-1 border-b border-border/60 bg-card/95 px-4 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md select-none"
    >
      {/* Hộp thư có thông báo chưa đọc: chấm trên nút mở sidebar, số nằm ở mục Hộp thư trong sidebar */}
      <Pressable
        onClick={handleOpenMobileMenu}
        aria-label={unreadCount > 0 ? `Mở menu, ${unreadCount} thông báo chưa đọc` : "Mở menu"}
        className="relative -ml-1.5 mr-1 flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <IconSidebarPanel size={14} />
        {unreadCount > 0 && (
          <span aria-hidden className="absolute right-1 top-1 size-2 rounded-full bg-primary ring-2 ring-card" />
        )}
      </Pressable>

      <Suspense fallback={<MobileHeaderTitleFallback pathname={pathname} />}>
        <MobileHeaderTitle pathname={pathname} />
      </Suspense>

      {/* Nút tìm và nút của trang cùng cỡ 32px với nút mở sidebar */}
      <Button variant="ghost" size="icon-xs" className="ml-auto size-8 rounded-md text-foreground/80" onClick={handleOpenSearch} aria-label="Tìm kiếm" title="Tìm kiếm (⌘K)">
        <Search className="size-4" />
      </Button>
      {/* Nút của trang (vd. "+") gắn vào qua MobileTopbarActions */}
      <div
        id={TOPBAR_ACTIONS_ID}
        className="-mr-1.5 flex items-center empty:hidden [&>button]:size-8 [&>button]:rounded-md [&>button]:text-foreground/80 [&_svg]:size-4!"
      />
    </header>
  );
}
