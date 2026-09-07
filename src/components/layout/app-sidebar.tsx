"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronDown, X, User } from "lucide-react";
import {
  useSidebar,
  MODULES,
  MODULE_NAV_ITEMS,
  SIDEBAR_ZONE_ITEMS,
  QCET_CDS_MENU_ITEMS,
  type SidebarItem,
  type NavigationSection,
  type QCETMenuItem,
} from "@/components/layout/sidebar-context";
import { MaintenanceDialog } from "@/components/common/maintenance-dialog";
import { AppPrimaryRail } from "@/components/layout/app-primary-rail";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    isMobileOpen,
    setIsMobileOpen,
    badgeCounts,
    currentModule,
    setCurrentModule,
  } = useSidebar();
  const router = useRouter();
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

  const [mobileMenuMode, setMobileMenuMode] = React.useState<"cds" | "modules">("cds");

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

  // Current items for the active module
  const currentItems = React.useMemo(() => {
    return MODULE_NAV_ITEMS[currentModule] || MODULE_NAV_ITEMS.work;
  }, [currentModule]);

  const currentModuleMeta = React.useMemo(() => {
    return MODULES.find((m) => m.id === currentModule) || MODULES[0];
  }, [currentModule]);

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
        const scope = searchParams.get("scope");
        if (zone && (zone === "tasks" || zone === "calendar" || zone === "org")) {
          return false;
        }
        if (view === "calendar" || view === "month") {
          return false;
        }
        if (scope === "school" || scope === "unit") {
          return false;
        }
        return pathname === "/";
      }

      if (pathname === item.href) {
        const hasSpecificQueryMatch = currentItems.some(
          (other) =>
            other.id !== item.id &&
            other.href.startsWith(item.href + "?") &&
            isItemActive(other)
        );
        if (hasSpecificQueryMatch) return false;
        return true;
      }

      if (item.href !== "/" && pathname.startsWith(item.href + "/")) {
        return true;
      }

      // Backward compatibility for legacy ?zone= or ?view= / ?scope= query parameters on root
      if (pathname === "/") {
        const zone = searchParams.get("zone");
        const view = searchParams.get("view");
        const scope = searchParams.get("scope");

        if (
          item.href === "/calendar" &&
          (zone === "calendar" || view === "calendar" || view === "month")
        ) {
          return true;
        }
        if (
          item.href === "/tasks" &&
          (zone === "tasks" || scope === "school" || scope === "unit")
        ) {
          return true;
        }
        if (item.href === "/org" && zone === "org") {
          return true;
        }
      }

      return false;
    },
    [pathname, searchParams, currentItems]
  );

  // Helper to get badge counter and variant
  const getBadgeInfo = React.useCallback(
    (item: SidebarItem): { text: string; variant: "primary" | "sky" | "muted" | "danger" } | null => {
      let text: string | number | undefined;
      let variant: "primary" | "sky" | "muted" | "danger" = "primary";

      if (item.badgeKey && badgeCounts?.[item.badgeKey] !== undefined) {
        text = badgeCounts[item.badgeKey];
        if (
          item.badgeKey === "allTasks" ||
          item.badgeKey === "tasks" ||
          item.badgeKey === "notifications"
        ) {
          variant = "danger";
        } else if (item.badgeKey === "calendar") {
          variant = "sky";
        } else if (item.badgeKey === "myFocus") {
          variant = "primary";
        } else {
          variant = "muted";
        }
      } else if (item.href === "/notifications") {
        text = badgeCounts?.notifications ?? 5;
        variant = "danger";
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

  // Group items by section
  const sections = React.useMemo(() => {
    const personalItems = currentItems.filter((i) => i.section === "personal");
    const workspaceItems = currentItems.filter((i) => i.section === "workspace");

    const list: { key: NavigationSection; label: string; items: SidebarItem[] }[] = [];
    if (personalItems.length > 0) {
      list.push({ key: "personal", label: "CÁ NHÂN", items: personalItems });
    }
    if (workspaceItems.length > 0) {
      list.push({ key: "workspace", label: "TOÀN TRƯỜNG & ĐƠN VỊ", items: workspaceItems });
    }
    return list;
  }, [currentItems]);

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
      {/* Desktop Navigation (>= md): houses Rail 1 and Rail 2 inline */}
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng chính"
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-row transition-all duration-200 ease-in-out bg-card/90 backdrop-blur-md border-r border-border/70 select-none",
          isCollapsed ? "w-28" : "w-[280px]"
        )}
      >
        {/* Rail 1: Primary Module Rail (fixed 56px) */}
        <AppPrimaryRail />

        {/* Rail 2: Sub-Navigation Pane (56px collapsed / 224px expanded) */}
        <div
          className={cn(
            "flex flex-col h-full transition-all duration-200 ease-in-out border-r border-border/50 bg-background/50 overflow-hidden",
            isCollapsed ? "w-14 items-center" : "w-56"
          )}
        >
          {isCollapsed ? (
            /* Collapsed Rail 2 Mode (56px icon-only, matches Image 2) */
            <>
              {/* Header with expand toggle trigger */}
              <div className="h-[52px] border-b border-border/50 flex items-center justify-center shrink-0 w-full">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={toggleCollapse}
                        aria-label="Mở rộng bảng điều hướng [Ctrl+B]"
                        className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                      >
                        <ChevronRight size={16} strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <span>Mở rộng bảng điều hướng [Ctrl+B]</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              {/* Collapsed Icon List */}
              <div className="overflow-y-auto flex-1 py-2 flex flex-col items-center gap-1 w-full thin-scrollbar">
                <TooltipProvider>
                  {sections.map((sec, idx) => (
                    <React.Fragment key={sec.key}>
                      {idx > 0 && <div className="w-6 h-px bg-border/50 my-1 shrink-0" />}
                      {sec.items.map((item) => {
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
                                aria-label={`${item.label}${badge ? ` (${badge.text})` : ""}${item.isMaintenance ? " (Đang bảo trì)" : ""}`}
                                aria-current={active ? "page" : undefined}
                                className={cn(
                                  "size-9 rounded-lg relative flex items-center justify-center transition-all duration-150 active:scale-95",
                                  active
                                    ? "bg-primary/15 text-primary font-semibold shadow-xs ring-1 ring-primary/25"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                                )}
                              >
                                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                                {badge && (
                                  <span
                                    aria-label={`${badge.text} mục`}
                                    className={cn(
                                      "absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-xs font-mono font-bold leading-none tracking-tight shadow-xs select-none pointer-events-none",
                                      badge.variant === "primary" &&
                                        "bg-primary text-primary-foreground",
                                      badge.variant === "sky" && "bg-sky-500 text-white",
                                      badge.variant === "danger" &&
                                        "bg-rose-500 text-white animate-pulse",
                                      badge.variant === "muted" &&
                                        "bg-secondary text-muted-foreground"
                                    )}
                                  >
                                    {badge.text}
                                  </span>
                                )}
                                {item.isMaintenance && !badge && (
                                  <span
                                    className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                                    title="Đang bảo trì"
                                  />
                                )}
                              </Link>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                              <div className="flex items-center gap-1.5">
                                <span>{item.label}</span>
                                {badge && (
                                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-semibold bg-muted">
                                    {badge.text}
                                  </span>
                                )}
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
                  ))}
                </TooltipProvider>
              </div>

              {/* Collapsed Footer (Expand Button) */}
              <div className="p-2 border-t border-border/50 shrink-0 w-full flex justify-center">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={toggleCollapse}
                        className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                        aria-label="Mở rộng [Ctrl+B]"
                        title="Mở rộng [Ctrl+B]"
                      >
                        <ChevronRight size={16} strokeWidth={1.5} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <span>Mở rộng [Ctrl+B]</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </>
          ) : (
            /* Expanded Rail 2 Mode (224px width, full labels & sections) */
            <>
              {/* Header with Module Title */}
              <div className="h-[52px] border-b border-border/50 px-3.5 flex flex-col justify-center shrink-0 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-xs font-bold tracking-tight text-foreground truncate">
                    {currentModuleMeta.label}
                  </span>
                  {currentModuleMeta.isComingSoon && (
                    <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded leading-none shrink-0">
                      Sắp ra mắt
                    </span>
                  )}
                </div>
                <span className="text-xs font-mono text-muted-foreground truncate">
                  {currentModuleMeta.isComingSoon ? "Đang phát triển" : "Năm học 2025-2026"}
                </span>
              </div>

              {/* Expanded Menu Navigation */}
              <div className="overflow-y-auto flex-1 p-2 space-y-4 thin-scrollbar">
                {sections.map((sec) => (
                  <div key={sec.key} className="space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 py-1 select-none">
                      {sec.label}
                    </div>
                    <div className="space-y-0.5">
                      {sec.items.map((item) => {
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
                              "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-10 text-[13.5px] font-medium transition-colors select-none",
                              active
                                ? "bg-primary/10 text-primary font-semibold shadow-xs"
                                : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                            )}
                          >
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
                            {badge && (
                              <span
                                className={cn(
                                  "ml-auto inline-flex items-center justify-center px-2 py-0.5 min-w-[20px] rounded-full text-xs font-mono font-semibold leading-none select-none tracking-tight",
                                  badge.variant === "primary" &&
                                    "bg-primary/15 text-primary border border-primary/20",
                                  badge.variant === "sky" &&
                                    "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                                  badge.variant === "danger" &&
                                    "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                  badge.variant === "muted" &&
                                    "bg-secondary text-muted-foreground border border-border/50"
                                )}
                              >
                                {badge.text}
                              </span>
                            )}
                            {item.isMaintenance && !badge && (
                              <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded leading-none select-none">
                                Bảo trì
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Expanded Footer (Collapse Button & Version) */}
              <div className="p-2 border-t border-border/50 shrink-0 space-y-1.5">
                <button
                  type="button"
                  onClick={toggleCollapse}
                  className="flex w-full items-center gap-2 px-2.5 py-2 min-h-10 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                  title="Thu gọn [Ctrl+B]"
                  aria-label="Thu gọn [Ctrl+B]"
                >
                  <ChevronLeft size={16} strokeWidth={1.5} className="shrink-0" />
                  <span className="truncate text-xs font-medium">Thu gọn [Ctrl+B]</span>
                  <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-border/60 bg-muted px-1.5 font-mono text-xs font-medium text-muted-foreground">
                    Ctrl+B
                  </kbd>
                </button>
                <div className="text-center pt-0.5">
                  <span className="text-xs font-mono font-medium text-rose-500/90 tracking-wider">
                    Version: 2.4.3
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
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
          {/* Mobile Drawer Header: Blue Gradient Banner matching QCET CĐS System */}
          <div className="bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-700 text-white p-4 shrink-0 shadow-xs">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <div className="size-10 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white shrink-0 shadow-xs">
                  <User size={20} strokeWidth={2} />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-sm font-bold tracking-tight text-white leading-tight">
                    Chuyển đổi số
                  </span>
                  <div className="flex items-center gap-1 text-xs text-blue-100 font-medium">
                    <span className="truncate">CĐ Kỹ Thuật Công Nghệ Quy Nhơn</span>
                    <ChevronDown size={13} className="shrink-0 opacity-80" />
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="size-8 rounded-lg flex items-center justify-center bg-white/15 hover:bg-white/25 text-white transition-colors cursor-pointer active:scale-95 shrink-0"
                aria-label="Đóng menu"
                title="Đóng menu"
              >
                <X size={18} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Mode Switcher Tabs (Satisfies test contract: role="tablist", role="tab", role="tabpanel") */}
          <div className="p-2 border-b border-border/50 bg-muted/20 shrink-0">
            <div
              role="tablist"
              aria-label="Chế độ danh mục"
              className="grid grid-cols-2 gap-1 p-1 bg-muted/60 rounded-lg border border-border/40 text-xs font-medium"
            >
              <button
                type="button"
                role="tab"
                id="mobile-tab-cds"
                aria-selected={mobileMenuMode === "cds"}
                aria-controls="mobile-tabpanel-cds"
                onClick={() => setMobileMenuMode("cds")}
                className={cn(
                  "py-2 px-2.5 min-h-9 rounded-md transition-all text-center cursor-pointer text-xs",
                  mobileMenuMode === "cds"
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Danh mục CĐS (12 mục)
              </button>
              <button
                type="button"
                role="tab"
                id="mobile-tab-modules"
                aria-selected={mobileMenuMode === "modules"}
                aria-controls="mobile-tabpanel-modules"
                onClick={() => setMobileMenuMode("modules")}
                className={cn(
                  "py-2 px-2.5 min-h-9 rounded-md transition-all text-center cursor-pointer text-xs",
                  mobileMenuMode === "modules"
                    ? "bg-card text-foreground font-semibold shadow-xs border border-border/40"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Theo Phân hệ (3 nhóm)
              </button>
            </div>
          </div>

          {/* When in "modules" mode, show the 3 module tabs */}
          {mobileMenuMode === "modules" && (
            <div className="px-3 py-2 border-b border-border/50 shrink-0">
              <div
                role="tablist"
                aria-label="Phân hệ hệ thống"
                className="grid grid-cols-3 gap-1 p-1 bg-muted/60 rounded-lg border border-border/40 text-xs font-medium"
              >
                {MODULES.map((mod) => {
                  const isActive = currentModule === mod.id;
                  const Icon = mod.icon;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      role="tab"
                      id={`mobile-tab-${mod.id}`}
                      aria-selected={isActive}
                      aria-controls={`mobile-tabpanel-${mod.id}`}
                      onClick={() => {
                        setCurrentModule(mod.id);
                        if (pathname !== mod.defaultHref) {
                          router.push(mod.defaultHref);
                          setIsMobileOpen(false);
                        }
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center gap-1 py-1.5 px-1 min-h-10 rounded-md transition-all text-center cursor-pointer",
                        isActive
                          ? "bg-card text-foreground font-semibold shadow-xs border border-border/40"
                          : "text-muted-foreground hover:text-foreground hover:bg-card/40"
                      )}
                    >
                      <Icon size={15} strokeWidth={isActive ? 2 : 1.5} />
                      <span className="truncate max-w-full text-xs leading-tight">
                        {mod.shortLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Navigation Body */}
          <nav
            id={
              mobileMenuMode === "cds"
                ? "mobile-tabpanel-cds"
                : `mobile-tabpanel-${currentModule}`
            }
            role="tabpanel"
            aria-labelledby={
              mobileMenuMode === "cds"
                ? "mobile-tab-cds"
                : `mobile-tab-${currentModule}`
            }
            className="flex-1 py-2 px-3 space-y-1 overflow-y-auto thin-scrollbar"
            aria-label={
              mobileMenuMode === "cds"
                ? "Danh mục Chuyển đổi số QCET"
                : `Danh mục điều hướng ${currentModuleMeta.label}`
            }
          >
            {mobileMenuMode === "cds" ? (
              /* Full 12 Items from QCET CĐS System */
              <div className="space-y-0.5">
                {QCET_CDS_MENU_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href.split("?")[0]);

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
                        "group flex items-center gap-3 rounded-lg px-3 py-2.5 min-h-10 text-[13.5px] font-medium transition-all active:scale-[0.98]",
                        active
                          ? "bg-primary/10 text-primary font-semibold shadow-xs"
                          : "text-foreground/80 hover:bg-muted/70 hover:text-foreground"
                      )}
                    >
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

                      {/* Item Badges or Submenu Indicators */}
                      {item.badge && (
                        <span
                          className={cn(
                            "inline-flex items-center justify-center px-2 py-0.5 min-w-[20px] rounded-full text-xs font-mono font-semibold leading-none select-none tracking-tight",
                            item.badgeVariant === "danger"
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                              : "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20"
                          )}
                        >
                          {item.badge}
                        </span>
                      )}

                      {item.isMaintenance && !item.badge && (
                        <span className="text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded leading-none select-none">
                          Bảo trì
                        </span>
                      )}

                      {item.hasSubmenu && !item.isMaintenance && !item.badge && (
                        <ChevronRight size={14} className="text-muted-foreground/50 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </div>
            ) : (
              /* Grouped Module Sections */
              sections.map((sec) => (
                <div key={sec.key} className="space-y-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70 px-2.5 py-1 select-none">
                    {sec.label}
                  </div>
                  <div className="space-y-0.5">
                    {sec.items.map((item) => {
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
                              ? "bg-primary/10 text-primary font-semibold shadow-xs"
                              : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                          )}
                        >
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
                          {badge && (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center px-2 py-0.5 min-w-[20px] rounded-full text-xs font-mono font-semibold leading-none select-none tracking-tight",
                                badge.variant === "primary" &&
                                  "bg-primary/15 text-primary border border-primary/20",
                                badge.variant === "sky" &&
                                  "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/20",
                                badge.variant === "danger" &&
                                  "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                badge.variant === "muted" &&
                                  "bg-secondary text-muted-foreground border border-border/50"
                              )}
                            >
                              {badge.text}
                            </span>
                          )}
                          {item.isMaintenance && (
                            <span className="ml-auto text-xs font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded leading-none select-none">
                              Bảo trì
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </nav>

          {/* Mobile Drawer Footer: Exact Version from School System & Notion Sync */}
          <div className="p-3 border-t border-border/50 shrink-0 bg-muted/20 space-y-2">
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
