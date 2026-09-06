"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSidebar, SIDEBAR_ZONE_ITEMS, type NavigationItem } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    isMobileOpen,
    setIsMobileOpen,
    badgeCounts,
  } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper to determine if a nav item is active
  const isItemActive = (item: NavigationItem) => {
    if (item.href === "/portal") {
      return pathname === "/portal";
    }
    if (pathname === "/") {
      const activeZone = searchParams.get("zone") || "tasks";
      if (item.zone) {
        return activeZone === item.zone;
      }
      return false;
    }
    return pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/"));
  };

  // Helper to get badge counter and variant
  const getBadgeInfo = React.useCallback(
    (item: NavigationItem): { text: string; variant: "primary" | "sky" | "muted" | "danger" } | null => {
      let text: string | number | undefined;
      let variant: "primary" | "sky" | "muted" | "danger" = "primary";

      if (item.zone === "tasks") {
        text = badgeCounts?.tasks;
        variant = "danger";
      } else if (item.zone === "calendar") {
        text = badgeCounts?.calendar;
        variant = "sky";
      } else if (item.zone === "org") {
        text = badgeCounts?.org;
        variant = "muted";
      } else if (item.href === "/notifications") {
        text = badgeCounts?.notifications ?? 5;
        variant = "danger";
      } else if (item.badge) {
        text = item.badge;
        variant = (item.badgeVariant as any) || "primary";
      }

      if (
        text === undefined ||
        text === null ||
        text === "" ||
        text === 0 ||
        text === "0"
      ) {
        return null;
      }
      return { text: String(text), variant };
    },
    [badgeCounts]
  );

  // Close mobile drawer on Escape key
  React.useEffect(() => {
    if (!isMobileOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobileOpen, setIsMobileOpen]);

  // Lock body scroll when mobile drawer is open
  React.useEffect(() => {
    if (isMobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileOpen]);

  return (
    <>
      {/* Desktop Sidebar (>= md) */}
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng bên"
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col border-r border-border/60 bg-card/95 backdrop-blur-md transition-all duration-200 ease-in-out select-none overflow-x-hidden",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Desktop Sidebar Header */}
        <div className="h-[52px] border-b border-border/50 flex items-center px-3 shrink-0">
          {isCollapsed ? (
            <div className="flex w-full items-center justify-center">
              <Link
                href="/"
                className="relative flex items-center justify-center size-8 rounded-lg bg-card p-0.5 border border-border/60 hover:border-primary/40 hover:shadow-2xs transition-all"
                title="QCET E-Office - v1.2 Enterprise"
                aria-label="Về trang chủ QCET E-Office"
              >
                <Image
                  src="/logo-qcet.png"
                  alt="QCET Logo"
                  width={32}
                  height={32}
                  priority
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </Link>
            </div>
          ) : (
            <div className="flex w-full items-center justify-between min-w-0">
              <Link
                href="/"
                className="flex items-center gap-2.5 min-w-0 group"
                aria-label="Về trang chủ QCET E-Office"
              >
                <div className="relative flex items-center justify-center size-8 rounded-lg bg-card p-0.5 border border-border/60 shrink-0 transition-colors group-hover:border-primary/40">
                  <Image
                    src="/logo-qcet.png"
                    alt="QCET Logo"
                    width={32}
                    height={32}
                    priority
                    unoptimized
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-xs font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                    QCET E-Office
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground truncate">
                    v1.2 Enterprise
                  </span>
                </div>
              </Link>
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 active:scale-95"
                title="Thu gọn sidebar (Ctrl+B)"
                aria-label="Thu gọn sidebar"
              >
                <ChevronLeft size={15} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Navigation List */}
        <nav
          className="flex-1 py-3 px-2 space-y-1.5 overflow-y-auto overflow-x-hidden thin-scrollbar"
          aria-label="Danh mục điều hướng chính"
        >
          {SIDEBAR_ZONE_ITEMS.map((item) => {
            const active = isItemActive(item);
            const Icon = item.icon;
            const badge = getBadgeInfo(item);

            if (isCollapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href === "/notifications") {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent("qcet:toggle-notifications"));
                    }
                  }}
                  title={`${item.label}${badge ? ` (${badge.text})` : ""}`}
                  aria-label={`${item.label}${badge ? ` (${badge.text})` : ""}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex size-10 mx-auto items-center justify-center rounded-xl text-xs font-medium transition-all duration-150 active:scale-95",
                    active
                      ? "bg-primary/12 text-primary font-semibold shadow-2xs border border-primary/25"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground hover:border-border/40 border border-transparent"
                  )}
                >
                  <Icon
                    size={18}
                    strokeWidth={1.5}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  {badge && (
                    <span
                      aria-label={`${badge.text} mục`}
                      className={cn(
                        "absolute -top-1 -right-1 flex items-center justify-center min-w-[17px] h-[17px] px-1 rounded-full text-[9px] font-mono font-bold leading-none tracking-tight shadow-xs ring-2 ring-card select-none pointer-events-none",
                        badge.variant === "primary" && "bg-primary text-primary-foreground",
                        badge.variant === "sky" && "bg-sky-500 text-white",
                        badge.variant === "danger" && "bg-rose-500 text-white animate-pulse",
                        badge.variant === "muted" && "bg-muted-foreground/80 text-background"
                      )}
                    >
                      {badge.text}
                    </span>
                  )}
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={(e) => {
                  if (item.href === "/notifications") {
                    e.preventDefault();
                    window.dispatchEvent(new CustomEvent("qcet:toggle-notifications"));
                  }
                }}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-[0.98]",
                  active
                    ? "bg-primary/10 text-primary font-semibold shadow-2xs border border-primary/20"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground border border-transparent"
                )}
              >
                <Icon
                  size={17}
                  strokeWidth={1.5}
                  className={cn(
                    "shrink-0 transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="truncate flex-1">{item.label}</span>
                {badge && (
                  <span
                    className={cn(
                      "ml-auto inline-flex items-center justify-center px-1.5 py-0.5 min-w-[20px] rounded-full text-[10.5px] font-mono font-bold leading-none select-none tracking-tight",
                      badge.variant === "primary" && "bg-primary/15 text-primary border border-primary/20",
                      badge.variant === "sky" && "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                      badge.variant === "danger" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                      badge.variant === "muted" && "bg-secondary text-muted-foreground border border-border/50"
                    )}
                  >
                    {badge.text}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Desktop Sidebar Footer */}
        <div className="p-2.5 border-t border-border/50 shrink-0">
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-2">
              <div
                className="flex size-9 items-center justify-center rounded-lg bg-secondary/40 border border-border/40"
                title="Notion: Đang kết nối"
                aria-label="Notion: Đang kết nối"
              >
                <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex size-9 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-95"
                title="Mở rộng sidebar (Ctrl+B)"
                aria-label="Mở rộng sidebar"
              >
                <ChevronRight size={15} strokeWidth={1.5} />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-border/40 bg-secondary/30 text-xs text-muted-foreground min-w-0">
                <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <span className="truncate font-medium text-[11.5px]">Notion: Đang kết nối</span>
              </div>
              <button
                type="button"
                onClick={toggleCollapse}
                className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0 active:scale-95"
                title="Thu gọn sidebar (Ctrl+B)"
                aria-label="Thu gọn sidebar"
              >
                <ChevronLeft size={14} strokeWidth={1.5} />
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Overlay & Sliding Panel (< md) */}
      <div className="md:hidden">
        {/* Full-screen Backdrop */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            isMobileOpen
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          )}
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />

        {/* Sliding Drawer */}
        <aside
          data-slot="mobile-sidebar-drawer"
          className={cn(
            "fixed left-0 top-0 bottom-0 z-50 w-64 bg-background border-r border-border p-4 flex flex-col transition-transform duration-200 ease-in-out shadow-2xl select-none",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label="Điều hướng di động"
          aria-hidden={!isMobileOpen}
        >
          {/* Mobile Drawer Header */}
          <div className="flex items-center justify-between pb-3.5 border-b border-border/50">
            <Link
              href="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0"
              aria-label="Về trang chủ QCET E-Office"
            >
              <div className="relative flex items-center justify-center size-8 rounded-lg bg-card p-0.5 border border-border/60 shrink-0">
                <Image
                  src="/logo-qcet.png"
                  alt="QCET Logo"
                  width={32}
                  height={32}
                  priority
                  unoptimized
                  className="h-full w-full object-contain"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-foreground truncate">
                  QCET E-Office
                </span>
                <span className="text-[10px] font-mono text-muted-foreground truncate">
                  v1.2 Enterprise
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors cursor-pointer active:scale-95"
              aria-label="Đóng menu"
              title="Đóng menu"
            >
              <X size={16} strokeWidth={1.5} />
            </button>
          </div>

          {/* Mobile Navigation List */}
          <nav
            className="flex-1 py-4 space-y-1 overflow-y-auto thin-scrollbar"
            aria-label="Danh mục điều hướng di động"
          >
            {SIDEBAR_ZONE_ITEMS.map((item) => {
              const active = isItemActive(item);
              const Icon = item.icon;
              const badge = getBadgeInfo(item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => {
                    setIsMobileOpen(false);
                    if (item.href === "/notifications") {
                      e.preventDefault();
                      window.dispatchEvent(new CustomEvent("qcet:toggle-notifications"));
                    }
                  }}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-xs font-medium transition-colors active:scale-[0.98]",
                    active
                      ? "bg-primary/10 text-primary font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  )}
                >
                  {active && (
                    <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
                  )}
                  <Icon
                    size={18}
                    strokeWidth={1.5}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {badge && (
                    <span
                      className={cn(
                        "ml-auto inline-flex items-center justify-center px-2 py-0.5 min-w-[20px] rounded-full text-[10.5px] font-mono font-bold leading-none select-none tracking-tight",
                        badge.variant === "primary" && "bg-primary/15 text-primary border border-primary/20",
                        badge.variant === "sky" && "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                        badge.variant === "danger" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                        badge.variant === "muted" && "bg-secondary text-muted-foreground border border-border/50"
                      )}
                    >
                      {badge.text}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Mobile Drawer Footer */}
          <div className="pt-3 border-t border-border/50 shrink-0">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border/40 bg-secondary/30 text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="truncate font-medium">Notion: Đang kết nối</span>
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}
