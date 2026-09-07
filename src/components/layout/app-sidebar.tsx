"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
} from "lucide-react";
import {
  useSidebar,
  SINGLE_TIER_NAV_ITEMS,
  type SidebarItem,
  type NavigationSection,
} from "@/components/layout/sidebar-context";
import { MaintenanceDialog } from "@/components/common/maintenance-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const SECTIONS: { key: NavigationSection; label: string }[] = [
  { key: "personal", label: "CÁ NHÂN" },
  { key: "workspace", label: "CÔNG VIỆC" },
  { key: "operations", label: "VĂN BẢN & ĐIỀU HÀNH" },
];

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

  // Close mobile drawer on route change
  React.useEffect(() => {
    setIsMobileOpen(false);
  }, [pathname, searchParams, setIsMobileOpen]);

  // Maintenance dialog state for items undergoing maintenance
  const [maintenanceDialog, setMaintenanceDialog] = React.useState<{
    isOpen: boolean;
    title: string;
    feature?: string;
    description?: string;
  }>({ isOpen: false, title: "" });

  // Global listener for opening maintenance dialog
  React.useEffect(() => {
    const handleOpenMaintenance = (e: Event) => {
      const customEvent = e as CustomEvent<{
        title?: string;
        feature?: string;
        description?: string;
      }>;
      setMaintenanceDialog({
        isOpen: true,
        title: customEvent.detail?.title || "Tính năng hệ thống",
        feature: customEvent.detail?.feature || "general",
        description: customEvent.detail?.description,
      });
    };
    window.addEventListener("qcet:open-maintenance", handleOpenMaintenance);
    return () => window.removeEventListener("qcet:open-maintenance", handleOpenMaintenance);
  }, []);

  // Listen to Ctrl+B / Cmd+B globally to toggleCollapse
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse]);

  // Close mobile drawer on Escape
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [setIsMobileOpen]);

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

  // Helper to determine if a nav item is active
  const isItemActive = React.useCallback(
    (item: SidebarItem) => {
      if (item.href.includes("?")) {
        const [itemPath, itemQuery] = item.href.split("?");
        if (pathname !== itemPath) return false;
        const itemParams = new URLSearchParams(itemQuery);
        let match = true;
        itemParams.forEach((val, key) => {
          if (searchParams.get(key) !== val) {
            match = false;
          }
        });
        return match;
      }

      if (item.href === "/") {
        const zone = searchParams.get("zone");
        const view = searchParams.get("view");
        if (zone === "calendar" || view === "calendar" || view === "month") {
          return false;
        }
        return pathname === "/";
      }

      if (pathname === item.href) {
        return true;
      }

      if (item.href !== "/" && pathname.startsWith(item.href + "/")) {
        return true;
      }

      // Backward compatibility for /unit-tasks -> /tasks
      if (item.href === "/tasks" && pathname === "/unit-tasks") {
        return true;
      }

      return false;
    },
    [pathname, searchParams]
  );

  // Helper to get badge counter and variant
  const getBadgeInfo = React.useCallback(
    (item: SidebarItem): {
      text: string;
      variant: "primary" | "sky" | "rose" | "amber" | "muted";
    } | null => {
      let text: string | number | undefined;
      let variant: "primary" | "sky" | "rose" | "amber" | "muted" = "primary";

      if (item.badgeKey && badgeCounts?.[item.badgeKey] !== undefined) {
        text = badgeCounts[item.badgeKey];
      } else if (item.href === "/calendar") {
        text = badgeCounts?.calendar ?? 1;
      } else if (item.href === "/notifications") {
        text = badgeCounts?.notifications ?? 5;
      } else if (item.href === "/documents") {
        text = badgeCounts?.docsInbox ?? 6;
      }

      if (item.badgeKey === "calendar" || item.href === "/calendar") {
        variant = "sky";
      } else if (item.badgeKey === "notifications" || item.href === "/notifications") {
        variant = "rose";
      } else if (item.badgeKey === "docsInbox" || item.href === "/documents") {
        variant = "amber";
      } else if (item.badgeKey === "allTasks" || item.href === "/tasks") {
        variant = "primary";
      } else {
        variant = "muted";
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

  return (
    <>
      {/* Desktop Navigation (>= md): Single-Tier 248px Sidebar */}
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng chính"
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col transition-all duration-200 ease-in-out bg-card/90 backdrop-blur-md border-r border-border/70 select-none",
          isCollapsed ? "w-16" : "w-[248px]"
        )}
      >
        {/* Brand Header: 48px height (h-12) */}
        {isCollapsed ? (
          <div className="h-12 border-b border-border/50 flex items-center justify-center shrink-0 w-full">
            <Link href="/" className="flex items-center justify-center" aria-label="QCET Trang chủ">
              <Image
                src="/logo-qcet.png"
                alt="QCET Logo"
                width={32}
                height={32}
                className="shrink-0 rounded object-contain"
                priority
              />
            </Link>
          </div>
        ) : (
          <div className="h-12 border-b border-border/50 px-3 flex items-center shrink-0 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 min-w-0 group" aria-label="QCET Trang chủ">
              <Image
                src="/logo-qcet.png"
                alt="QCET Logo"
                width={28}
                height={28}
                className="shrink-0 rounded object-contain"
                priority
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                  QUẢN LÝ CÔNG VIỆC
                </span>
                <span className="font-mono text-xs text-muted-foreground truncate">
                  Năm học 2026–2027
                </span>
              </div>
            </Link>
          </div>
        )}

        {/* Navigation Body */}
        {isCollapsed ? (
          /* Collapsed Mode (64px / w-16 icon-only) */
          <div className="overflow-y-auto flex-1 py-2 flex flex-col items-center gap-1 w-full thin-scrollbar">
            <TooltipProvider>
              {SECTIONS.map((sec, idx) => {
                const items = SINGLE_TIER_NAV_ITEMS.filter(
                  (item) => item.section === sec.key
                );
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={sec.key}>
                    {idx > 0 && (
                      <div className="w-8 h-px bg-border/50 my-1 shrink-0" />
                    )}
                    {items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      const badge = getBadgeInfo(item);
                      return (
                        <Tooltip key={item.id}>
                          <TooltipTrigger asChild>
                            <Link
                              href={item.href}
                              onClick={(e) => {
                                if (item.isMaintenance) {
                                  e.preventDefault();
                                  setMaintenanceDialog({
                                    isOpen: true,
                                    title: item.label,
                                    feature: item.id,
                                  });
                                  return;
                                }
                                if (item.href === "/notifications") {
                                  e.preventDefault();
                                  window.dispatchEvent(
                                    new CustomEvent("qcet:toggle-notifications")
                                  );
                                }
                              }}
                              aria-label={`${item.label}${item.isComingSoon ? " (Đang phát triển)" : badge ? ` (${badge.text})` : ""}${item.isMaintenance ? " (Đang bảo trì)" : ""}`}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "size-9 rounded-lg relative flex items-center justify-center transition-all duration-150 active:scale-95",
                                active
                                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                              )}
                            >
                              {active && (
                                <span
                                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                                  aria-hidden="true"
                                />
                              )}
                              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                              {item.isComingSoon ? (
                                <span
                                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                                  title="Đang phát triển"
                                />
                              ) : badge ? (
                                <span
                                  aria-label={`${badge.text} mục`}
                                  className={cn(
                                    "absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-xs font-mono font-bold leading-none select-none pointer-events-none",
                                    badge.variant === "primary" &&
                                      "bg-primary text-primary-foreground",
                                    badge.variant === "sky" &&
                                      "bg-sky-500 text-white",
                                    badge.variant === "rose" &&
                                      "bg-rose-500 text-white",
                                    badge.variant === "amber" &&
                                      "bg-amber-500 text-white",
                                    badge.variant === "muted" &&
                                      "bg-secondary text-muted-foreground"
                                  )}
                                >
                                  {badge.text}
                                </span>
                              ) : item.isMaintenance ? (
                                <span
                                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                                  title="Đang bảo trì"
                                />
                              ) : null}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.isComingSoon ? (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                  Đang phát triển
                                </span>
                              ) : badge ? (
                                <span className="px-1.5 py-0.5 rounded text-xs font-mono font-semibold bg-muted">
                                  {badge.text}
                                </span>
                              ) : null}
                              {item.isMaintenance && (
                                <span className="text-xs text-amber-500 font-medium">
                                  (Đang bảo trì)
                                </span>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </TooltipProvider>
          </div>
        ) : (
          /* Expanded Mode (248px width, full labels & sections) */
          <div className="overflow-y-auto flex-1 p-2 space-y-4 thin-scrollbar">
            {SECTIONS.map((sec) => {
              const items = SINGLE_TIER_NAV_ITEMS.filter(
                (item) => item.section === sec.key
              );
              if (items.length === 0) return null;
              return (
                <div key={sec.key} className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 py-1 select-none">
                    {sec.label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      const badge = getBadgeInfo(item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={(e) => {
                            if (item.isMaintenance) {
                              e.preventDefault();
                              setMaintenanceDialog({
                                isOpen: true,
                                title: item.label,
                                feature: item.id,
                              });
                              return;
                            }
                            if (item.href === "/notifications") {
                              e.preventDefault();
                              window.dispatchEvent(
                                new CustomEvent("qcet:toggle-notifications")
                              );
                            }
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-9 text-[13px] font-medium transition-colors select-none",
                            active
                              ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                              : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                          )}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                              aria-hidden="true"
                            />
                          )}
                          <Icon
                            size={18}
                            strokeWidth={active ? 2 : 1.5}
                            className={cn(
                              "shrink-0 transition-colors",
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          />
                          <span className="truncate flex-1">{item.label}</span>
                          {item.isComingSoon ? (
                            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none">
                              Đang phát triển
                            </span>
                          ) : badge ? (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold leading-none select-none tracking-tight",
                                badge.variant === "primary" &&
                                  "bg-primary/15 text-primary border border-primary/20",
                                badge.variant === "sky" &&
                                  "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                                badge.variant === "rose" &&
                                  "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                badge.variant === "amber" &&
                                  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                                badge.variant === "muted" &&
                                  "bg-secondary text-muted-foreground border border-border/50"
                              )}
                            >
                              {badge.text}
                            </span>
                          ) : item.isMaintenance && !badge ? (
                            <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded leading-none select-none">
                              Bảo trì
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        {isCollapsed ? (
          <div className="p-2 border-t border-border/50 shrink-0 w-full flex flex-col items-center gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Link
                    href="/settings"
                    className={cn(
                      "size-9 rounded-lg flex items-center justify-center transition-colors select-none",
                      pathname.startsWith("/settings")
                        ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                    )}
                    aria-label="Cài đặt"
                  >
                    <Settings
                      size={18}
                      strokeWidth={pathname.startsWith("/settings") ? 2 : 1.5}
                    />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Cài đặt</span>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer select-none"
                    aria-label="Mở rộng thanh bên [Ctrl+B / ⌘B]"
                    title="Mở rộng thanh bên [Ctrl+B / ⌘B]"
                  >
                    <ChevronRight size={18} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Mở rộng thanh bên [⌘B / Ctrl+B]</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="p-2 border-t border-border/50 shrink-0 space-y-1">
            <Link
              href="/settings"
              className={cn(
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-9 text-[13px] font-medium transition-colors select-none",
                pathname.startsWith("/settings")
                  ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                  : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
              )}
            >
              {pathname.startsWith("/settings") && (
                <span
                  className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                  aria-hidden="true"
                />
              )}
              <Settings
                size={18}
                strokeWidth={pathname.startsWith("/settings") ? 2 : 1.5}
                className="shrink-0 transition-colors text-muted-foreground group-hover:text-foreground"
              />
              <span className="truncate flex-1">Cài đặt</span>
            </Link>
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex w-full items-center gap-2 px-2.5 py-2 min-h-9 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-muted/70 transition-colors cursor-pointer select-none"
              title="Thu gọn thanh bên [Ctrl+B / ⌘B]"
              aria-label="Thu gọn thanh bên [Ctrl+B / ⌘B]"
            >
              <ChevronLeft size={16} strokeWidth={1.5} className="shrink-0" />
              <span className="truncate flex-1 text-left font-medium">
                Thu gọn thanh bên
              </span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                ⌘B
              </kbd>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Navigation Drawer (<= md) */}
      <div className="md:hidden">
        {/* Backdrop Overlay */}
        <div
          className={cn(
            "fixed inset-0 z-50 bg-black/50 backdrop-blur-sm transition-opacity duration-200",
            isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setIsMobileOpen(false)}
          aria-hidden={!isMobileOpen}
        />

        {/* Sliding Drawer */}
        <aside
          data-slot="mobile-sidebar-drawer"
          className={cn(
            "fixed left-0 top-0 bottom-0 z-50 w-72 sm:w-80 bg-background border-r border-border flex flex-col transition-transform duration-200 ease-in-out shadow-2xl select-none overflow-hidden",
            isMobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
          aria-label="Điều hướng di động"
          aria-hidden={!isMobileOpen}
        >
          {/* Mobile Drawer Header: 48px height */}
          <div className="h-12 px-4 border-b border-border/50 flex items-center justify-between shrink-0 bg-muted/20">
            <Link
              href="/"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 min-w-0"
              aria-label="QCET Trang chủ"
            >
              <Image
                src="/logo-qcet.png"
                alt="QCET Logo"
                width={28}
                height={28}
                className="shrink-0 rounded object-contain"
              />
              <div className="flex flex-col min-w-0">
                <span className="text-[13px] font-semibold tracking-tight text-foreground truncate">
                  QUẢN LÝ CÔNG VIỆC
                </span>
                <span className="font-mono text-xs text-muted-foreground truncate">
                  Năm học 2026–2027
                </span>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setIsMobileOpen(false)}
              className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer active:scale-95 shrink-0"
              aria-label="Đóng menu"
              title="Đóng menu"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          {/* Mobile Navigation List */}
          <nav
            aria-label="Danh mục điều hướng di động"
            className="flex-1 overflow-y-auto p-3 space-y-4 thin-scrollbar"
          >
            {SECTIONS.map((sec) => {
              const items = SINGLE_TIER_NAV_ITEMS.filter(
                (item) => item.section === sec.key
              );
              if (items.length === 0) return null;
              return (
                <div key={sec.key} className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 py-1 select-none">
                    {sec.label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      const badge = getBadgeInfo(item);
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={(e) => {
                            if (item.isMaintenance) {
                              e.preventDefault();
                              setIsMobileOpen(false);
                              setMaintenanceDialog({
                                isOpen: true,
                                title: item.label,
                                feature: item.id,
                              });
                              return;
                            }
                            setIsMobileOpen(false);
                            if (item.href === "/notifications") {
                              e.preventDefault();
                              window.dispatchEvent(
                                new CustomEvent("qcet:toggle-notifications")
                              );
                            }
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-10 text-[13.5px] font-medium transition-colors active:scale-[0.98]",
                            active
                              ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                          )}
                        >
                          {active && (
                            <span
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] bg-primary rounded-r-full"
                              aria-hidden="true"
                            />
                          )}
                          <Icon
                            size={18}
                            strokeWidth={active ? 2 : 1.5}
                            className={cn(
                              "shrink-0 transition-colors",
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          />
                          <span className="truncate flex-1">{item.label}</span>
                          {item.isComingSoon ? (
                            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shrink-0 select-none">
                              Đang phát triển
                            </span>
                          ) : badge ? (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold leading-none select-none tracking-tight",
                                badge.variant === "primary" &&
                                  "bg-primary/15 text-primary border border-primary/20",
                                badge.variant === "sky" &&
                                  "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                                badge.variant === "rose" &&
                                  "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                badge.variant === "amber" &&
                                  "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20",
                                badge.variant === "muted" &&
                                  "bg-secondary text-muted-foreground border border-border/50"
                              )}
                            >
                              {badge.text}
                            </span>
                          ) : item.isMaintenance && !badge ? (
                            <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-1.5 py-0.5 rounded leading-none select-none">
                              Bảo trì
                            </span>
                          ) : null}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </nav>

          {/* Mobile Drawer Footer: Settings + Notion Status */}
          <div className="p-3 border-t border-border/50 shrink-0 bg-muted/20 space-y-2">
            <Link
              href="/settings"
              onClick={() => setIsMobileOpen(false)}
              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              <Settings size={18} strokeWidth={1.5} />
              <span>Cài đặt hệ thống</span>
            </Link>
            <div className="flex items-center justify-center gap-2 px-2.5 py-1 rounded-md border border-border/40 bg-card text-xs text-muted-foreground">
              <span className="size-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
              <span className="truncate font-medium text-xs">Notion: Đang kết nối</span>
            </div>
            <div className="text-center">
              <span className="text-xs font-semibold text-rose-500 font-mono tracking-wider">
                Version: 2.4.3
              </span>
            </div>
          </div>
        </aside>
      </div>

      {/* Maintenance Dialog Modal */}
      <MaintenanceDialog
        isOpen={maintenanceDialog.isOpen}
        onClose={() => setMaintenanceDialog({ isOpen: false, title: "" })}
        title={maintenanceDialog.title}
        feature={maintenanceDialog.feature}
        description={maintenanceDialog.description}
      />
    </>
  );
}
