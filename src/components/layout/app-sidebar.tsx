"use client";

import * as React from "react";
import Link from "next/link";
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

export function formatDisplayName(name?: string | null): string {
  if (!name || !name.trim()) return "Người dùng";
  // Loại bỏ các tiền tố học hàm, học vị phổ biến
  const cleaned = name
    .replace(/^(GS\.|PGS\.|TS\.|ThS\.|BS\.|BSCK[I|II]\.|KS\.|CN\.|NCS\.|Giáo sư|Phó Giáo sư|Tiến sĩ|Thạc sĩ|Bác sĩ|Kỹ sư|Cử nhân)\s+/gi, "")
    .replace(/^(GS|PGS|TS|ThS|BS|KS|CN)\s+/g, "")
    .trim();
  return cleaned || name.trim();
}

export function getInitials(name?: string | null): string {
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
  .filter((item) => item.id !== "settings" && item.id !== "documents")
  .map((item) => ({
    ...item,
    icon: ICON_MAP[item.iconName] || LayoutDashboard,
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
  { key: "work", label: "Công việc" },
  { key: "org", label: "Tổ chức" },
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

  const userRoleLabel =
    user?.role === "ADMIN"
      ? "Ban Giám hiệu"
      : user?.role === "MANAGER"
      ? "Trưởng đơn vị"
      : "Chuyên viên";

  const userDepartment =
    user?.department ||
    user?.departmentCode ||
    "Trường QCET";

  return (
    <>
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng chính"
        className={cn(
          "fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col transition-all duration-200 ease-in-out bg-[#f4f5f7] dark:bg-zinc-950 text-foreground select-none group/sidebar",
          isCollapsed ? "w-14" : "w-[208px]"
        )}
      >
        {/* ========================================================= */}
        {/* 1. WORKSPACE IDENTITY HEADER (TOP OF SIDEBAR)              */}
        {/* ========================================================= */}
        <div className="shrink-0 w-full">
          {isCollapsed ? (
            <div className="p-2 pb-1.5 flex items-center justify-center">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <div className="size-8 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center shrink-0 cursor-default shadow-2xs select-none">
                    QC
                  </div>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex flex-col">
                    <span className="font-semibold">QCET Work</span>
                    <span className="text-[11px] text-muted-foreground">Trường QCET</span>
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="px-2 pt-2.5 pb-1">
              <div className="flex items-center gap-2 px-2 py-1 rounded-md hover:bg-black/[0.035] dark:hover:bg-white/[0.04] transition-colors cursor-default select-none group/ws">
                {/* Workspace Mark */}
                <div className="size-5.5 rounded-md bg-primary text-primary-foreground font-bold text-[11px] flex items-center justify-center shrink-0 tracking-tight shadow-2xs">
                  QC
                </div>
                {/* Workspace Identity */}
                <div className="flex flex-col min-w-0 flex-1 leading-none">
                  <span className="text-[13px] font-semibold text-foreground truncate">
                    QCET Work
                  </span>
                  <span className="text-[11px] text-muted-foreground/70 truncate mt-0.5">
                    Trường QCET
                  </span>
                </div>
                <ChevronDown size={12} strokeWidth={1.5} className="text-muted-foreground/60 shrink-0" />
              </div>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 2. COMPACT SEARCH ROW (DIRECTLY BELOW WORKSPACE)           */}
        {/* ========================================================= */}
        <div className="shrink-0">
          {isCollapsed ? (
            <div className="p-2 py-1 flex items-center justify-center">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                    aria-label="Tìm kiếm toàn hệ thống (⌘K)"
                  >
                    <Search size={16} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Tìm kiếm (⌘K)</span>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="px-2 py-1">
              <button
                type="button"
                onClick={handleOpenSearch}
                className="w-full flex items-center justify-between h-8 px-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-black/[0.035] dark:hover:bg-white/[0.04] transition-colors cursor-pointer group text-[13px] select-none"
                title="Tìm kiếm toàn hệ thống (⌘K hoặc Ctrl+K)"
                aria-label="Tìm kiếm toàn hệ thống"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <Search
                    size={16}
                    strokeWidth={1.5}
                    className="text-muted-foreground/70 group-hover:text-foreground shrink-0 transition-colors"
                  />
                  <span className="truncate font-normal text-muted-foreground/80 group-hover:text-foreground">
                    Tìm kiếm
                  </span>
                </div>
                <kbd className="text-[10px] font-sans font-medium px-1.5 py-0.5 rounded bg-black/[0.04] dark:bg-white/[0.06] text-muted-foreground/70 group-hover:text-foreground border border-black/[0.04] dark:border-white/[0.06]">
                  ⌘K
                </kbd>
              </button>
            </div>
          )}
        </div>

        {/* ========================================================= */}
        {/* 3. NAVIGATION ITEMS BODY                                  */}
        {/* ========================================================= */}
        {isCollapsed ? (
          /* Collapsed Mode (Icon-only) */
          <div className="overflow-y-auto flex-1 py-1.5 flex flex-col items-center gap-1.5 w-full thin-scrollbar">
            <TooltipProvider>
              {SECTIONS.map((sec, idx) => {
                const items = SINGLE_TIER_NAV_ITEMS.filter(
                  (item) => item.section === sec.key
                );
                if (items.length === 0) return null;
                return (
                  <React.Fragment key={sec.key}>
                    {idx > 0 && (
                      <div className="w-6 h-px bg-border/40 my-1 shrink-0" />
                    )}
                    {items.map((item) => {
                      const active = isItemActive(item);
                      const Icon = item.icon;
                      const badge = getBadgeInfo(item);
                      return (
                        <Tooltip key={item.id} delayDuration={300}>
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
                              }}
                              aria-label={`${item.label}${badge ? ` (${badge.text})` : ""}`}
                              aria-current={active ? "page" : undefined}
                              className={cn(
                                "size-8 rounded-lg relative flex items-center justify-center transition-colors",
                                active
                                  ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
                              )}
                            >
                              <Icon size={16} strokeWidth={1.5} />
                              {badge ? (
                                <span
                                  aria-label={`${badge.text} mục`}
                                  className={cn(
                                    "absolute -top-1 -right-1 flex items-center justify-center min-w-[15px] h-3.5 px-0.5 rounded-full text-[9px] font-mono font-bold tabular-nums leading-none select-none pointer-events-none shadow-2xs",
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
                              {badge ? (
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
          /* Expanded Mode (~208px width, compact, precise grid) */
          <div className="overflow-y-auto flex-1 px-2 py-1.5 space-y-3.5 thin-scrollbar">
            {SECTIONS.map((sec) => {
              const items = SINGLE_TIER_NAV_ITEMS.filter(
                (item) => item.section === sec.key
              );
              if (items.length === 0) return null;
              return (
                <div key={sec.key} className="space-y-0.5">
                  <div className="text-[11px] font-medium text-muted-foreground/60 px-2 py-0.5 select-none tracking-tight">
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
                          }}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "group relative flex items-center gap-2 rounded-md px-2 h-8 text-[13px] transition-colors select-none",
                            active
                              ? "bg-black/[0.06] dark:bg-white/[0.08] text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-black/[0.035] dark:hover:bg-white/[0.04] font-normal"
                          )}
                        >
                          <Icon
                            size={16}
                            strokeWidth={1.5}
                            className={cn(
                              "shrink-0 transition-colors",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground/80 group-hover:text-foreground"
                            )}
                          />
                          <span className="truncate flex-1">{item.label}</span>
                          {badge ? (
                            <span
                              className={cn(
                                "ml-auto inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-[10px] font-mono font-medium tabular-nums leading-none border select-none",
                                badge.variant === "rose" && "bg-rose-500 text-white border-rose-600 shadow-2xs",
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
        {/* 4. USER ACCOUNT FOOTER & ACCOUNT MENU (BOTTOM OF SIDEBAR) */}
        {/* ========================================================= */}
        <div className="shrink-0 p-2 relative" ref={profileDropdownRef}>
          {isCollapsed ? (
            <div className="flex flex-col items-center gap-1.5">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                    className={cn(
                      "size-8 rounded-lg flex items-center justify-center font-semibold text-xs transition-all cursor-pointer shadow-2xs",
                      isProfileDropdownOpen
                        ? "bg-primary text-primary-foreground ring-2 ring-primary/30"
                        : "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20"
                    )}
                    aria-label={`Tài khoản: ${user?.name || "Người dùng"}`}
                    aria-expanded={isProfileDropdownOpen}
                  >
                    {getInitials(user?.name)}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <div className="flex flex-col">
                    <span className="font-semibold">{formatDisplayName(user?.name)}</span>
                    <span className="text-[11px] text-muted-foreground">{userDepartment}</span>
                  </div>
                </TooltipContent>
              </Tooltip>

              {/* Discreet Expand Button on Hover when Collapsed */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="size-8 rounded-lg flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer"
                    aria-label="Mở rộng thanh bên (⌘B)"
                  >
                    <PanelLeftOpen size={15} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  <span>Mở rộng [⌘B]</span>
                </TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="relative w-full flex items-center gap-1">
              {/* Account Dropdown Trigger Button */}
              <button
                type="button"
                onClick={() => setIsProfileDropdownOpen((prev) => !prev)}
                className={cn(
                  "flex-1 flex items-center gap-2 px-2 h-8.5 rounded-md transition-colors cursor-pointer text-left min-w-0 group/user",
                  isProfileDropdownOpen ? "bg-black/[0.06] dark:bg-white/[0.08]" : "hover:bg-black/[0.035] dark:hover:bg-white/[0.04]"
                )}
                aria-label={`Tài khoản: ${user?.name || "Người dùng"}`}
                aria-expanded={isProfileDropdownOpen}
              >
                {/* Avatar */}
                <div className="size-6 rounded-md flex items-center justify-center bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold shrink-0 shadow-2xs group-hover/user:scale-105 transition-transform">
                  {getInitials(user?.name)}
                </div>

                {/* User Name */}
                <span className="text-[13px] font-medium text-foreground truncate flex-1 leading-tight group-hover/user:text-primary transition-colors">
                  {formatDisplayName(user?.name)}
                </span>

                {/* Dropdown Chevron */}
                <ChevronUp
                  size={13}
                  strokeWidth={1.5}
                  className={cn(
                    "text-muted-foreground/60 group-hover/user:text-foreground shrink-0 transition-transform duration-200",
                    isProfileDropdownOpen && "rotate-180 text-foreground"
                  )}
                />
              </button>

              {/* Discreet Sidebar Collapse Toggle Button (Bottom right, visible on hover/focus) */}
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={toggleCollapse}
                    className="size-7 rounded-md flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-black/[0.05] dark:hover:bg-white/[0.05] opacity-0 group-hover/sidebar:opacity-100 focus:opacity-100 transition-opacity cursor-pointer shrink-0"
                    aria-label="Thu gọn thanh bên (⌘B)"
                  >
                    <PanelLeftClose size={14} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" sideOffset={6}>
                  <span>Thu gọn thanh bên [⌘B]</span>
                </TooltipContent>
              </Tooltip>
            </div>
          )}

          {/* Unified Account Dropdown Popover (Opens upwards above footer on desktop) */}
          {isProfileDropdownOpen && user && (
            <div
              className={cn(
                "rounded-xl border border-border/80 bg-white/98 dark:bg-zinc-900/98 backdrop-blur-md p-2.5 shadow-dropdown z-50 animate-in fade-in zoom-in-95",
                isCollapsed
                  ? "absolute left-full bottom-2 ml-2 w-64"
                  : "absolute left-2 right-2 bottom-full mb-1.5"
              )}
            >
              {isOfflineReadOnly && (
                <div className="mb-2 p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                  Chế độ chỉ xem từ bộ nhớ tạm.
                </div>
              )}

              {/* User Identity Card */}
              <div className="flex items-center gap-2.5 p-2 rounded-lg bg-muted/50 dark:bg-zinc-800/50">
                <div className="size-8 rounded-lg flex items-center justify-center bg-primary text-primary-foreground text-xs font-bold shrink-0 shadow-2xs">
                  {getInitials(user.name)}
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-foreground truncate" title={user.name}>
                    {user.name}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate" title={user.email}>
                    {userRoleLabel}
                    {userDepartment ? ` • ${userDepartment}` : ""}
                  </p>
                  <p className="text-[10px] text-primary/90 font-medium truncate mt-0.5">
                    QCET E-Office
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
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <User size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
                  <span>Hồ sơ cá nhân</span>
                </button>

                <Link
                  href="/settings"
                  onClick={() => setIsProfileDropdownOpen(false)}
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <Settings size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
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
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <Smartphone size={14} strokeWidth={1.5} className="text-primary shrink-0" />
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
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-muted/80 dark:hover:bg-zinc-800/80 transition-colors cursor-pointer text-left"
                >
                  <Compass size={14} strokeWidth={1.5} className="text-muted-foreground shrink-0" />
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
                  className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors cursor-pointer text-left"
                >
                  <LogOut size={14} strokeWidth={1.5} className="shrink-0" />
                  <span>Đăng xuất</span>
                </button>
              </div>
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
