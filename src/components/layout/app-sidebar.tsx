"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useSidebar, NAVIGATION_ITEMS } from "@/components/layout/sidebar-context";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    isMobileOpen,
    setIsMobileOpen,
  } = useSidebar();
  const pathname = usePathname();

  // Helper to determine if a nav item is active
  const isItemActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname === href || (href !== "/" && pathname.startsWith(href + "/"));
  };

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
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col border-r border-border/60 bg-card/95 backdrop-blur-md transition-all duration-200 ease-in-out select-none",
          isCollapsed ? "w-16" : "w-60"
        )}
      >
        {/* Desktop Sidebar Header */}
        <div className="h-[52px] border-b border-border/50 flex items-center px-3 shrink-0">
          {isCollapsed ? (
            <div className="flex w-full items-center justify-center relative group">
              <Link
                href="/"
                className="relative flex items-center justify-center size-8 rounded-lg bg-card p-0.5 border border-border/60 hover:border-primary/40 transition-colors"
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
              {/* Edge Expand Button */}
              <button
                type="button"
                onClick={toggleCollapse}
                className="absolute -right-3 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-full border border-border/70 bg-background shadow-xs hover:bg-secondary text-muted-foreground hover:text-foreground transition-all cursor-pointer z-50 hover:scale-110 active:scale-95"
                title="Mở rộng sidebar (Ctrl+B)"
                aria-label="Mở rộng sidebar"
              >
                <ChevronRight size={12} strokeWidth={2} />
              </button>
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
                <ChevronLeft size={15} strokeWidth={1.75} />
              </button>
            </div>
          )}
        </div>

        {/* Desktop Navigation List */}
        <nav
          className="flex-1 py-3 px-2 space-y-1 overflow-y-auto overflow-x-hidden"
          aria-label="Danh mục điều hướng chính"
        >
          {NAVIGATION_ITEMS.map((item) => {
            const active = isItemActive(item.href);
            const Icon = item.icon;

            if (isCollapsed) {
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  aria-label={item.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex size-10 mx-auto items-center justify-center rounded-lg text-xs font-medium transition-colors active:scale-95",
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
                    strokeWidth={active ? 2 : 1.75}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                </Link>
              );
            }

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors active:scale-[0.98]",
                  active
                    ? "bg-primary/10 text-primary font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                )}
              >
                {active && (
                  <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary" />
                )}
                <Icon
                  size={17}
                  strokeWidth={active ? 2 : 1.75}
                  className={cn(
                    "shrink-0 transition-colors",
                    active
                      ? "text-primary"
                      : "text-muted-foreground group-hover:text-foreground"
                  )}
                />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">
                    {item.badge}
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
                <ChevronRight size={15} strokeWidth={1.75} />
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
                <ChevronLeft size={14} strokeWidth={1.75} />
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
              <X size={16} strokeWidth={1.75} />
            </button>
          </div>

          {/* Mobile Navigation List */}
          <nav
            className="flex-1 py-4 space-y-1 overflow-y-auto"
            aria-label="Danh mục điều hướng di động"
          >
            {NAVIGATION_ITEMS.map((item) => {
              const active = isItemActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileOpen(false)}
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
                    strokeWidth={active ? 2 : 1.75}
                    className={cn(
                      "shrink-0 transition-colors",
                      active
                        ? "text-primary"
                        : "text-muted-foreground group-hover:text-foreground"
                    )}
                  />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge && (
                    <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/15 text-primary">
                      {item.badge}
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
