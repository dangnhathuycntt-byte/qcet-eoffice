"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Settings,
  X,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  type LucideIcon,
} from "lucide-react";
import {
  getSidebarNavItems,
  type CanonicalRouteConfig,
} from "@/lib/navigation/canonical-navigation-registry";
import {
  useSidebar,
  type NavigationSection,
} from "@/components/layout/sidebar-context";
import { isRouteActive } from "@/lib/navigation/active-matcher";
import { MaintenanceDialog } from "@/components/common/maintenance-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth, isUserUnassignedDepartment, shouldPromptUnassignedDepartment } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const ICON_MAP: Record<CanonicalRouteConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  Settings,
};

export interface DesktopSidebarItem extends CanonicalRouteConfig {
  icon: LucideIcon;
  isComingSoon?: boolean;
  isMaintenance?: boolean;
}

// Canonical desktop sidebar items derived from getSidebarNavItems() (Single Source of Truth)
// Exclude settings route from body sections since it is rendered in the sidebar footer
export const SINGLE_TIER_NAV_ITEMS: DesktopSidebarItem[] = getSidebarNavItems()
  .filter((item) => item.id !== "settings")
  .map((item) => ({
    ...item,
    icon: ICON_MAP[item.iconName] || LayoutDashboard,
    isComingSoon: item.id === "documents",
  }));

export function isEditableTarget(target: any): boolean {
  if (!target) return false;
  const tagName = typeof target.tagName === "string" ? target.tagName.toUpperCase() : "";
  if (tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT") {
    return true;
  }
  if (target.isContentEditable === true || target.isContentEditable === "true") {
    return true;
  }
  if (typeof target.getAttribute === "function" && target.getAttribute("contenteditable") === "true") {
    return true;
  }
  return false;
}

export interface ShortcutHandlerOptions {
  toggleCollapse?: () => void;
  onNavigate?: (href: string) => void;
}

export function handleSidebarShortcut(
  e: {
    key: string;
    ctrlKey?: boolean;
    metaKey?: boolean;
    altKey?: boolean;
    target?: any;
    preventDefault?: () => void;
  },
  options: ShortcutHandlerOptions
): boolean {
  // Never hijack keys when user is typing in forms or contenteditable elements
  if (isEditableTarget(e.target)) {
    return false;
  }

  // Ctrl+B or Cmd+B toggles sidebar collapse
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
    e.preventDefault?.();
    options.toggleCollapse?.();
    return true;
  }

  // Quick navigation shortcut numbers '1'-'6'
  const navIndex = parseInt(e.key, 10);
  if (!e.ctrlKey && !e.metaKey && !e.altKey && navIndex >= 1 && navIndex <= 6) {
    const items = getSidebarNavItems().filter((i) => i.id !== "settings");
    const targetItem = items[navIndex - 1];
    if (targetItem && options.onNavigate) {
      if (targetItem.id === "documents") {
        // Feature is under development - disable shortcut navigation
        e.preventDefault?.();
        return true;
      }
      e.preventDefault?.();
      options.onNavigate(targetItem.href);
      return true;
    }
  }

  return false;
}

const SECTIONS: { key: NavigationSection; label: string }[] = [
  { key: "personal", label: "ĐIỀU HÀNH & CÁ NHÂN" },
  { key: "workspace", label: "NGHIỆP VỤ CỐT LÕI" },
  { key: "operations", label: "HỆ THỐNG & TỔ CHỨC" },
];

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    badgeCounts,
  } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, setIsProfileModalOpen } = useAuth();

  // Automatic profile prompt on first visit if user has unassigned department
  React.useEffect(() => {
    if (typeof window === "undefined" || !user) return;
    try {
      if (shouldPromptUnassignedDepartment(user, window.sessionStorage)) {
        setIsProfileModalOpen(true);
        try {
          window.sessionStorage.setItem("qcet_profile_unassigned_prompted", "true");
          window.sessionStorage.setItem("qcet_dept_prompt_dismissed", "true");
        } catch {
          // ignore storage access restrictions
        }
      }
    } catch {
      // ignore storage access restrictions
    }
  }, [user, setIsProfileModalOpen]);

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

  // Listen to Ctrl+B / Cmd+B (and number shortcuts 1-6) globally, guarded against editable targets
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      handleSidebarShortcut(e, {
        toggleCollapse,
        onNavigate: (href) => {
          router.push(href);
        },
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleCollapse, router]);

  // Helper to determine if a nav item is active using canonical matcher
  const isItemActive = React.useCallback(
    (item: DesktopSidebarItem) => {
      return isRouteActive(
        item.href,
        pathname,
        searchParams,
        (item.aliases as string[]) || (item.id === "tasks" ? ["/unit-tasks"] : undefined)
      );
    },
    [pathname, searchParams]
  );

  // Helper to get badge counter and variant
  const getBadgeInfo = React.useCallback(
    (item: DesktopSidebarItem): {
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
      } else if (item.href === "/tasks") {
        text = badgeCounts?.allTasks ?? badgeCounts?.tasks;
      }

      if (item.badgeKey === "calendar" || item.href === "/calendar") {
        variant = "sky";
      } else if (item.badgeKey === "notifications" || item.href === "/notifications") {
        variant = "rose";
      } else if (item.badgeKey === "docsInbox" || item.href === "/documents") {
        variant = "amber";
      } else if (item.href === "/tasks") {
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
                <span className="text-[13px] font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors">
                  CỔNG ĐIỀU HÀNH QCET
                </span>
                <span className="text-xs text-muted-foreground/70 truncate font-sans">
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
                              id={item.id === "documents" ? "tour-nav-documents" : undefined}
                              href={item.isComingSoon ? "#" : item.href}
                              onClick={(e) => {
                                if (item.isComingSoon) {
                                  e.preventDefault();
                                  return;
                                }
                                if (item.isMaintenance) {
                                  e.preventDefault();
                                  setMaintenanceDialog({
                                    isOpen: true,
                                    title: item.label,
                                    feature: item.id,
                                  });
                                  return;
                                }
                              }}
                              aria-disabled={item.isComingSoon ? true : undefined}
                              tabIndex={item.isComingSoon ? -1 : undefined}
                              aria-label={`${item.label}${item.isComingSoon ? " (Đang phát triển - Chưa thể truy cập)" : badge ? ` (${badge.text})` : ""}${item.isMaintenance ? " (Đang bảo trì)" : ""}`}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "size-9 rounded-lg relative flex items-center justify-center transition-colors",
                                item.isComingSoon && "cursor-not-allowed opacity-60 hover:bg-transparent",
                                active
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : !item.isComingSoon && "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                              )}
                            >
                              <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                              {item.isComingSoon ? (
                                <span
                                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                                  title="Sắp có"
                                />
                              ) : badge ? (
                                <span
                                  aria-label={`${badge.text} mục`}
                                  className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-4.5 px-1 rounded-full text-xs font-semibold tabular-nums leading-none select-none pointer-events-none bg-muted text-foreground border border-border/80 shadow-2xs"
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
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
                                  Sắp có
                                </span>
                              ) : badge ? (
                                <span className="px-1.5 py-0.5 rounded-full text-xs font-semibold tabular-nums bg-muted border border-border/60">
                                  {badge.text}
                                </span>
                              ) : null}
                              {item.isMaintenance && (
                                <span className="text-xs text-amber-700 font-medium">
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
          <div className="overflow-y-auto flex-1 px-2 py-2 space-y-2.5 thin-scrollbar">
            {SECTIONS.map((sec) => {
              const items = SINGLE_TIER_NAV_ITEMS.filter(
                (item) => item.section === sec.key
              );
              if (items.length === 0) return null;
              return (
                <div key={sec.key} className="space-y-0.5">
                  <div className="text-xs font-semibold tracking-wider text-muted-foreground/70 px-2.5 pt-3.5 pb-1 uppercase select-none">
                    {sec.label}
                  </div>
                  <div className="space-y-0.5">
                    {items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      const badge = getBadgeInfo(item);
                      return (
                        <Link
                          id={item.id === "documents" ? "tour-nav-documents" : undefined}
                          key={item.id}
                          href={item.isComingSoon ? "#" : item.href}
                          onClick={(e) => {
                            if (item.isComingSoon) {
                              e.preventDefault();
                              return;
                            }
                            if (item.isMaintenance) {
                              e.preventDefault();
                              setMaintenanceDialog({
                                isOpen: true,
                                title: item.label,
                                feature: item.id,
                              });
                              return;
                            }
                          }}
                          aria-disabled={item.isComingSoon ? true : undefined}
                          tabIndex={item.isComingSoon ? -1 : undefined}
                          aria-label={`${item.label}${item.isComingSoon ? " (Đang phát triển - Chưa thể truy cập)" : ""}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 min-h-[36px] text-[13px] tracking-tight transition-colors select-none",
                            item.isComingSoon && "cursor-not-allowed opacity-60 hover:bg-transparent",
                            active
                              ? "bg-primary/10 text-primary font-semibold shadow-2xs"
                              : !item.isComingSoon && "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          )}
                        >
                          {active && (
                            <span className="absolute left-0.5 top-2 bottom-2 w-[3px] bg-primary rounded-r-full" />
                          )}
                          <Icon
                            size={16}
                            strokeWidth={active ? 2 : 1.5}
                            className={cn(
                              "shrink-0 transition-colors",
                              active
                                ? "text-primary"
                                : "text-muted-foreground group-hover:text-foreground"
                            )}
                          />
                          <span className="truncate flex-1 font-medium">{item.label}</span>
                          {item.isComingSoon ? (
                            <span
                              title="Đang phát triển"
                              className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium tracking-tight bg-amber-500/10 text-amber-800 border border-amber-500/20 shrink-0 select-none leading-none whitespace-nowrap"
                            >
                              Đang phát triển
                            </span>
                          ) : badge ? (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full text-xs font-semibold tabular-nums leading-none border select-none",
                                badge.variant === "primary" && "bg-primary/10 text-primary border-primary/20",
                                badge.variant === "sky" && "bg-sky-500/10 text-sky-700 border-sky-500/20",
                                badge.variant === "rose" && "bg-rose-500/10 text-rose-700 border-rose-500/20",
                                badge.variant === "amber" && "bg-amber-500/10 text-amber-800 border-amber-500/20",
                                (!badge.variant || badge.variant === "muted") && "bg-muted/80 text-muted-foreground border-border/50"
                              )}
                            >
                              {badge.text}
                            </span>
                          ) : item.isMaintenance && !badge ? (
                            <span className="ml-auto text-xs font-medium text-amber-800 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded leading-none select-none">
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
                        ? "bg-accent/80 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
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
                    className="size-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer select-none"
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
                "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 min-h-9 text-[13px] transition-colors select-none",
                pathname.startsWith("/settings")
                  ? "bg-accent/80 text-foreground font-medium"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/40"
              )}
            >
              <Settings
                size={18}
                strokeWidth={pathname.startsWith("/settings") ? 2 : 1.5}
                className={cn(
                  "shrink-0 transition-colors",
                  pathname.startsWith("/settings")
                    ? "text-foreground"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              <span className="truncate flex-1">Cài đặt</span>
            </Link>
            {/* Notion: Đang kết nối (bg-emerald-500) mock widget removed */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="flex w-full items-center gap-2 px-2.5 py-2 min-h-9 rounded-lg text-[13px] text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer select-none"
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
