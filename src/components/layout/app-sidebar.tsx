"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Settings,
  X,
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  Inbox,
  Search,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  LogOut,
  Smartphone,
  Compass,
  CheckCircle2,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
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
import { useAuth, shouldPromptUnassignedDepartment } from "@/lib/auth-context";
import { RoleSwitcherPill } from "@/components/auth/role-switcher-pill";
import { cn } from "@/lib/utils";

const UserProfileModal = dynamic(
  () => import("@/components/auth/user-profile-modal").then((m) => m.UserProfileModal),
  { ssr: false }
);

const ICON_MAP: Record<CanonicalRouteConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CheckSquare,
  FileText,
  Building2,
  Bell,
  Settings,
  Inbox,
};

export function getInitials(name: string): string {
  if (!name || !name.trim()) return "QC";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0].charAt(0);
  const last = parts[parts.length - 1].charAt(0);
  return (first + last).toUpperCase();
}

export interface DesktopSidebarItem extends CanonicalRouteConfig {
  icon: LucideIcon;
  isComingSoon?: boolean;
  isMaintenance?: boolean;
}

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
  { key: "work", label: "CÔNG VIỆC" },
  { key: "org", label: "TỔ CHỨC" },
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
  const { user, logout, isProfileModalOpen, setIsProfileModalOpen, isOfflineReadOnly } = useAuth();

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const profileDropdownRef = React.useRef<HTMLDivElement>(null);

  // Close profile dropdown on outside click
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target as Node)
      ) {
        setIsProfileDropdownOpen(false);
      }
    };
    if (isProfileDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isProfileDropdownOpen]);

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

  // Maintenance dialog state
  const [maintenanceDialog, setMaintenanceDialog] = React.useState<{
    isOpen: boolean;
    title: string;
    feature?: string;
    description?: string;
  }>({ isOpen: false, title: "" });

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

  // Quick search launcher helper
  const handleOpenSearch = React.useCallback(() => {
    window.dispatchEvent(new CustomEvent("qcet:open-command-search", { detail: { open: true } }));
  }, []);

  // Global shortcuts: ⌘K / Ctrl+K and ⌘B / Ctrl+B
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target)) return;

      const isKeyK = e.key === "k" || e.key === "K" || e.code === "KeyK";
      if (isKeyK && (e.metaKey || e.ctrlKey) && !e.altKey) {
        e.preventDefault();
        handleOpenSearch();
        return;
      }

      handleSidebarShortcut(e, {
        toggleCollapse,
        onNavigate: (href) => {
          router.push(href);
        },
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenSearch, toggleCollapse, router]);

  // Helper to determine if a nav item is active
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
        text = badgeCounts?.calendar;
      } else if (item.href === "/inbox" || item.href === "/notifications") {
        text = badgeCounts?.notifications;
      } else if (item.href === "/documents") {
        text = badgeCounts?.docsInbox;
      } else if (item.href === "/tasks") {
        text = badgeCounts?.taskAttention ?? badgeCounts?.tasks;
      }

      if (item.badgeKey === "calendar" || item.href === "/calendar") {
        variant = "sky";
      } else if (item.badgeKey === "notifications" || item.href === "/inbox" || item.href === "/notifications") {
        variant = "rose";
      } else if (item.badgeKey === "docsInbox" || item.href === "/documents") {
        variant = "amber";
      } else if (
        item.badgeKey === "tasks" ||
        item.badgeKey === "taskAttention" ||
        item.href === "/tasks"
      ) {
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
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng chính"
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col transition-all duration-200 ease-in-out bg-card/95 backdrop-blur-md border-r border-border/70 select-none shadow-xs",
          isCollapsed ? "w-16" : "w-[248px]"
        )}
      >
        {/* ========================================================= */}
        {/* 1. BRAND HEADER & COLLAPSE TOGGLE (TOP)                   */}
        {/* ========================================================= */}
        {isCollapsed ? (
          <div className="h-12 border-b border-border/50 flex items-center justify-center shrink-0 w-full px-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="flex items-center justify-center p-1 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer"
                    aria-label="Mở rộng thanh bên [⌘B]"
                  >
                    <Image
                      src="/logo-qcet.png"
                      alt="QCET Logo"
                      width={28}
                      height={28}
                      className="shrink-0 rounded object-contain"
                      priority
                    />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Mở rộng thanh bên [⌘B]</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ) : (
          <div className="h-12 border-b border-border/50 px-3 flex items-center justify-between shrink-0 min-w-0">
            <Link href="/tasks" className="flex items-center gap-2 min-w-0 group" aria-label="QCET Trang chủ">
              <Image
                src="/logo-qcet.png"
                alt="QCET Logo"
                width={24}
                height={24}
                className="shrink-0 rounded object-contain"
                priority
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs font-bold tracking-tight text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                  QCET E-OFFICE
                </span>
                <span className="text-[10px] text-muted-foreground/70 truncate font-sans">
                  2026–2027
                </span>
              </div>
            </Link>

            {/* Sidebar Collapse Button at Header */}
            <button
              type="button"
              onClick={toggleCollapse}
              className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
              title="Thu gọn thanh bên [⌘B / Ctrl+B]"
              aria-label="Thu gọn thanh bên"
            >
              <PanelLeftClose size={15} strokeWidth={1.5} />
            </button>
          </div>
        )}

        {/* ========================================================= */}
        {/* 2. GLOBAL SEARCH BAR AT TOP OF SIDEBAR (LINEAR STYLE)     */}
        {/* ========================================================= */}
        <div className={cn("shrink-0", isCollapsed ? "p-2 pb-1" : "p-2.5 pb-1")}>
          {isCollapsed ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className="size-9 w-full rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent/40 transition-colors cursor-pointer"
                    aria-label="Tìm nhanh toàn hệ thống (⌘K)"
                  >
                    <Search size={16} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Tìm nhanh... [⌘K]</span>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : (
            <button
              type="button"
              onClick={handleOpenSearch}
              className="w-full flex items-center justify-between h-8 px-2.5 rounded-lg border border-border/70 bg-muted/30 hover:bg-muted/60 text-muted-foreground transition-colors cursor-pointer group text-xs select-none"
              title="Tìm kiếm nhanh toàn hệ thống (⌘K hoặc Ctrl+K)"
              aria-label="Tìm kiếm toàn hệ thống"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search
                  size={13}
                  strokeWidth={1.5}
                  className="text-muted-foreground group-hover:text-foreground shrink-0 transition-colors"
                />
                <span className="text-[12px] truncate">Tìm nhanh...</span>
              </div>
              <kbd className="text-[10px] font-mono px-1 py-0.2 rounded border border-border/60 bg-background text-muted-foreground group-hover:text-foreground shrink-0">
                ⌘K
              </kbd>
            </button>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. NAVIGATION ITEMS BODY                                  */}
        {/* ========================================================= */}
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
                              aria-label={`${item.label}${item.isComingSoon ? " (Sắp có)" : badge ? ` (${badge.text})` : ""}`}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "size-9 rounded-lg relative flex items-center justify-center transition-colors",
                                item.isComingSoon && "cursor-not-allowed opacity-60 hover:bg-transparent",
                                active
                                  ? "bg-primary/10 text-primary font-medium"
                                  : !item.isComingSoon && "text-muted-foreground hover:text-foreground hover:bg-accent/40"
                              )}
                            >
                              <Icon size={18} strokeWidth={1.5} />
                              {item.isComingSoon ? (
                                <span
                                  className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-amber-500 ring-2 ring-background"
                                  title="Sắp có"
                                />
                              ) : badge ? (
                                <span
                                  aria-label={`${badge.text} mục`}
                                  className={cn(
                                    "absolute -top-1 -right-1 flex items-center justify-center min-w-[17px] h-4 px-1 rounded-full text-[10px] font-mono font-bold tabular-nums leading-none select-none pointer-events-none shadow-2xs",
                                    badge.variant === "rose"
                                      ? "bg-rose-500 text-white"
                                      : "bg-primary text-primary-foreground"
                                  )}
                                >
                                  {badge.text}
                                </span>
                              ) : null}
                            </Link>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <div className="flex items-center gap-1.5">
                              <span>{item.label}</span>
                              {item.isComingSoon ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20">
                                  Sắp có
                                </span>
                              ) : badge ? (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold tabular-nums bg-muted border border-border/60">
                                  {badge.text}
                                </span>
                              ) : null}
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
          <div className="overflow-y-auto flex-1 px-2.5 py-1.5 space-y-2 thin-scrollbar">
            {SECTIONS.map((sec) => {
              const items = SINGLE_TIER_NAV_ITEMS.filter(
                (item) => item.section === sec.key
              );
              if (items.length === 0) return null;
              return (
                <div key={sec.key} className="space-y-0.5">
                  <div className="text-[11px] font-semibold text-muted-foreground/60 px-2 pt-2 pb-1 select-none tracking-wider">
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
                          aria-label={`${item.label}${item.isComingSoon ? " (Sắp có)" : ""}`}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 min-h-[34px] text-[13px] tracking-tight transition-colors select-none",
                            item.isComingSoon && "cursor-not-allowed opacity-60 hover:bg-transparent",
                            active
                              ? "bg-primary/10 text-primary font-medium"
                              : !item.isComingSoon && "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                          )}
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.5}
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
                              title="Sắp có"
                              aria-label="Sắp có"
                              className="ml-auto inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-medium bg-amber-500/10 text-amber-800 border border-amber-500/20 shrink-0 select-none leading-none whitespace-nowrap"
                            >
                              Sắp có
                            </span>
                          ) : badge ? (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center min-w-[18px] h-4.5 px-1.5 rounded-full text-[10px] font-mono font-semibold tabular-nums leading-none border select-none",
                                badge.variant === "rose" && "bg-rose-500 text-white border-rose-600",
                                badge.variant === "primary" && "bg-primary/10 text-primary border-primary/20",
                                badge.variant === "sky" && "bg-sky-500/10 text-sky-700 border-sky-500/20",
                                badge.variant === "amber" && "bg-amber-500/10 text-amber-800 border-amber-500/20",
                                (!badge.variant || badge.variant === "muted") && "bg-muted/80 text-muted-foreground border-border/50"
                              )}
                            >
                              {badge.text}
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

        {/* ========================================================= */}
        {/* 4. USER ACCOUNT & PROFILE MENU AT BOTTOM OF SIDEBAR       */}
        {/* ========================================================= */}
        <div className="p-2 border-t border-border/50 shrink-0 w-full relative" ref={profileDropdownRef}>
          {user && (
            <>
              {isCollapsed ? (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                        className="size-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary border border-primary/20 hover:opacity-90 transition-opacity cursor-pointer mx-auto text-xs font-semibold shadow-2xs"
                        aria-label={`Tài khoản: ${user.name}`}
                        aria-expanded={isProfileDropdownOpen}
                      >
                        {getInitials(user.name)}
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="right">
                      <span>{user.name}</span>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                  className="w-full flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer text-left group"
                  aria-label={`Tài khoản: ${user.name}`}
                  aria-expanded={isProfileDropdownOpen}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="size-7.5 rounded-lg flex items-center justify-center bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shrink-0 shadow-2xs">
                      {getInitials(user.name)}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors leading-tight">
                        {user.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {user.role === "ADMIN"
                          ? "Ban Giám hiệu"
                          : user.role === "MANAGER"
                          ? "Trưởng đơn vị"
                          : "Chuyên viên"}
                        {user.departmentCode ? ` • ${user.departmentCode}` : ""}
                      </span>
                    </div>
                  </div>
                  <MoreHorizontal size={14} className="text-muted-foreground group-hover:text-foreground shrink-0" />
                </button>
              )}

              {/* Profile Dropdown Popover (Opens Upward) */}
              {isProfileDropdownOpen && (
                <div
                  className={cn(
                    "absolute bottom-full mb-2 rounded-xl border border-border/80 bg-card/98 backdrop-blur-md p-2.5 shadow-dropdown z-50 animate-in fade-in zoom-in-95",
                    isCollapsed ? "left-2 w-64" : "left-2 right-2"
                  )}
                >
                  {isOfflineReadOnly && (
                    <div className="mb-2 p-1.5 rounded-md bg-amber-50 border border-amber-300 text-[11px] text-amber-900 font-medium leading-relaxed">
                      Chế độ chỉ xem từ bộ nhớ tạm.
                    </div>
                  )}

                  {/* User Summary */}
                  <div className="flex items-start gap-2.5 border-b border-border/50 pb-2.5 px-1">
                    <div className="size-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary border border-primary/20 text-xs font-semibold shrink-0">
                      {getInitials(user.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-foreground truncate" title={user.name}>
                        {user.name}
                      </p>
                      <p className="text-[11px] font-mono text-muted-foreground truncate" title={user.email}>
                        {user.email}
                      </p>
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="mt-2 space-y-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        setIsProfileModalOpen(true);
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                    >
                      <User size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                      <span>Hồ sơ cá nhân</span>
                    </button>

                    <Link
                      href="/settings"
                      onClick={() => setIsProfileDropdownOpen(false)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                    >
                      <Settings size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                      <span>Cài đặt hệ thống</span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new CustomEvent("qcet:open-install-modal"));
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                    >
                      <Smartphone size={13} strokeWidth={1.5} className="text-primary shrink-0" />
                      <span>Cài đặt ứng dụng di động</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        if (typeof window !== "undefined") {
                          window.dispatchEvent(new CustomEvent("qcet:restart-onboarding"));
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors cursor-pointer text-left"
                    >
                      <Compass size={13} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                      <span>Hướng dẫn sử dụng</span>
                    </button>
                  </div>

                  {/* Dev Role Switcher */}
                  <RoleSwitcherPill className="border-t border-border/50 pt-1.5 mt-1 px-1" />

                  {/* Logout */}
                  <div className="border-t border-border/50 pt-1 mt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileDropdownOpen(false);
                        logout();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                    >
                      <LogOut size={13} strokeWidth={1.5} className="shrink-0" />
                      <span>Đăng xuất</span>
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Collapsed Expand Trigger at Bottom */}
          {isCollapsed && (
            <div className="pt-1 flex justify-center">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={toggleCollapse}
                      className="size-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                      aria-label="Mở rộng thanh bên [⌘B]"
                    >
                      <PanelLeftOpen size={14} strokeWidth={1.5} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <span>Mở rộng [⌘B]</span>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      </aside>

      {/* User Profile Modal Container */}
      <UserProfileModal />

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
