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
  SquarePen,
  Focus,
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
import { Menu } from "@base-ui/react/menu";
import { cn } from "@/lib/utils";

const UserProfileModal = dynamic(
  () => import("@/components/auth/user-profile-modal").then((m) => m.UserProfileModal),
  { ssr: false }
);

const ICON_MAP: Record<CanonicalRouteConfig["iconName"], LucideIcon> = {
  LayoutDashboard,
  Calendar,
  CheckSquare: Focus,
  FileText,
  Building2,
  Bell,
  Settings,
  Inbox,
};

export function formatDisplayName(name?: string | null): string {
  if (!name || !name.trim()) return "Người dùng";
  let cleaned = name.trim();

  // 1. Loại bỏ các tiền tố học hàm, học vị (kể cả ghép như PGS.TS., GS.TS., ThS.BS.,...)
  const titlePrefixRegex = /^(GS\.|PGS\.|TS\.|ThS\.|BS\.|BSCK[I|II]\.|KS\.|CN\.|NCS\.|GS|PGS|TS|ThS|BS|KS|CN|Giáo sư|Phó Giáo sư|Tiến sĩ|Thạc sĩ|Bác sĩ|Kỹ sư|Cử nhân)\s*/i;
  while (titlePrefixRegex.test(cleaned)) {
    cleaned = cleaned.replace(titlePrefixRegex, "").trim();
  }

  // 2. Loại bỏ phần ghi chú chức vụ/đơn vị trong ngoặc đơn ở cuối hoặc giữa tên: (Hiệu trưởng), (Phó Hiệu trưởng), (Trưởng khoa...), (...)
  cleaned = cleaned.replace(/\s*\([^)]*\)/g, "").trim();

  return cleaned || name.trim();
}

export function getInitials(name?: string | null): string {
  const cleanName = formatDisplayName(name);
  if (!cleanName || cleanName === "Người dùng") return "QC";
  const parts = cleanName.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "QC";
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
  .filter((item) => item.id !== "settings" && item.id !== "documents" && item.id !== "desk")
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

const SECTIONS: { key: NavigationSection; label?: string }[] = [
  { key: "work" },
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
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);

  // ponytail: click-outside handled by Base UI Popover

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

  // Quick create task helper
  const handleQuickCreate = React.useCallback(() => {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("qcet:open-create-task"));
    }
    if (pathname !== "/tasks") {
      router.push("/tasks?create=true");
    }
  }, [pathname, router]);

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

  const roleDepartmentSubtitle = React.useMemo(() => {
    const role = userRoleLabel || "";
    const dept = userDepartment || "";
    if (!dept || dept === "Trường QCET" || role.trim().toLowerCase() === dept.trim().toLowerCase()) {
      return role || dept;
    }
    return `${role} • ${dept}`;
  }, [userRoleLabel, userDepartment]);

  return (
    <>
      <aside
        data-slot="app-sidebar"
        aria-label="Thanh điều hướng chính"
        className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col bg-[#f8f9fa] dark:bg-zinc-950 text-foreground select-none group/sidebar w-[228px]"
      >
        {/* ========================================================= */}
        {/* 1. LINEAR-STYLE TOP HEADER: USER IDENTITY + SEARCH + CREATE */}
        {/* ========================================================= */}
        <Menu.Root open={isProfileDropdownOpen && Boolean(user)} onOpenChange={(open) => setIsProfileDropdownOpen(open)}>
        <div className="shrink-0 w-full relative" ref={profileDropdownRef}>
          {/* Linear Header: Avatar + Name + Chevron (Left) & Search + Floating Create (Right) */}
          <div className="px-2 pt-2.5 pb-1 flex items-center justify-between gap-1 w-full">
            {/* Left: User Identity / Account Menu Trigger */}
            <Menu.Trigger
              ref={accountTriggerRef}
              type="button"
              className={cn(
                "h-7 flex items-center gap-1.5 px-1.5 rounded-[6px] transition-colors cursor-pointer text-left min-w-0 flex-1 outline-none focus-visible:ring-1 focus-visible:ring-black/10 dark:focus-visible:ring-white/15 group/user",
                isProfileDropdownOpen
                  ? "bg-black/[0.06] dark:bg-white/[0.08]"
                  : "hover:bg-black/[0.04] dark:hover:bg-white/[0.04]"
              )}
              aria-label={`Tài khoản: ${formatDisplayName(user?.name)}`}
              aria-expanded={isProfileDropdownOpen}
            >
              <div className="size-5 rounded-[5px] flex items-center justify-center bg-pink-500/90 dark:bg-pink-500 text-white font-medium text-[10px] shrink-0 shadow-2xs">
                {getInitials(user?.name)}
              </div>
              <span className="text-[13px] font-medium text-foreground/90 truncate leading-none group-hover/user:text-foreground transition-colors">
                {formatDisplayName(user?.name)}
              </span>
              <ChevronDown
                size={10}
                strokeWidth={1.5}
                className={cn(
                  "text-muted-foreground/45 shrink-0 ml-0.5 transition-transform duration-200",
                  isProfileDropdownOpen && "rotate-180 text-foreground"
                )}
              />
            </Menu.Trigger>

            {/* Right: Quick Action Buttons (Search & Floating Create Task) */}
            <div className="flex items-center gap-1 shrink-0 ml-0.5">
              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleOpenSearch}
                    className="size-7 rounded-[6px] flex items-center justify-center text-muted-foreground/75 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-black/10 dark:focus-visible:ring-white/15"
                    aria-label="Tìm kiếm (⌘K)"
                  >
                    <Search size={14} strokeWidth={1.5} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <span>Tìm kiếm [⌘K]</span>
                </TooltipContent>
              </Tooltip>

              <Tooltip delayDuration={300}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={handleQuickCreate}
                    className="size-7 rounded-full flex items-center justify-center bg-white dark:bg-zinc-800 border border-black/10 dark:border-white/15 text-foreground shadow-[0_1px_2px_rgba(0,0,0,0.06)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.35)] hover:bg-zinc-50 dark:hover:bg-zinc-700/80 hover:shadow-xs active:scale-95 transition-all cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    aria-label="Giao việc mới (C)"
                  >
                    <SquarePen size={13.5} strokeWidth={1.75} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" sideOffset={4}>
                  <span>Giao việc mới [C]</span>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* Account dropdown via Base UI Popover */}

          <Menu.Portal>
          <Menu.Positioner className="z-50" align="start" sideOffset={6} collisionPadding={12}>
          <Menu.Popup style={{ maxWidth: "var(--available-width)", maxHeight: "var(--available-height)", overflowY: "auto" }}
            className="w-60 p-2 shadow-2xl border border-border/80 bg-popover rounded-xl"
            role="menu"
            aria-label="Menu tài khoản"
          >
            {user && (
              <div>
                {isOfflineReadOnly && (
                  <div className="mb-2 p-1.5 rounded-md bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 font-medium leading-relaxed">
                    Chế độ chỉ xem từ bộ nhớ tạm.
                  </div>
                )}

                {/* User Identity Card */}
                <div className="flex items-center gap-2.5 p-2 rounded-lg bg-black/[0.03] dark:bg-white/[0.04] border border-black/[0.04] dark:border-white/[0.05]">
                  <div className="size-8 rounded-[7px] flex items-center justify-center bg-pink-500/90 dark:bg-pink-500 text-white text-xs font-semibold shrink-0 shadow-2xs">
                    {getInitials(user.name)}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate" title={formatDisplayName(user.name)}>
                      {formatDisplayName(user.name)}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate" title={user.email}>
                      {roleDepartmentSubtitle}
                    </p>
                    <p className="text-[10px] text-primary/80 font-medium truncate mt-0.5">
                      QCET E-Office
                    </p>
                  </div>
                </div>

                {/* Menu Items */}
                <div className="mt-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      setIsProfileModalOpen(true);
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-normal text-foreground/90 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
                  >
                    <User size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
                    <span>Hồ sơ cá nhân</span>
                  </button>

                  <Link
                    href="/settings"
                    onClick={() => setIsProfileDropdownOpen(false)}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-normal text-foreground/90 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
                  >
                    <Settings size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
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
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-normal text-foreground/90 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
                  >
                    <Smartphone size={14} strokeWidth={1.5} className="text-primary/85 shrink-0" />
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
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-normal text-foreground/90 hover:text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.05] transition-colors cursor-pointer text-left"
                  >
                    <Compass size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
                    <span>Hướng dẫn sử dụng</span>
                  </button>
                </div>

                {/* Logout */}
                <div className="border-t border-black/[0.06] dark:border-white/[0.08] pt-1 mt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsProfileDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-[12.5px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer text-left"
                  >
                    <LogOut size={14} strokeWidth={1.5} className="shrink-0" />
                    <span>Đăng xuất</span>
                  </button>
                </div>
              </div>
            )}
          </Menu.Popup>
          </Menu.Positioner>
          </Menu.Portal>

        </div>
        </Menu.Root>

        {/* ========================================================= */}
        {/* 2. NAVIGATION ITEMS BODY                                  */}
        {/* ========================================================= */}
        <div className="overflow-y-auto flex-1 px-2 pt-2 pb-2 space-y-1 thin-scrollbar mt-2.5">
          {SECTIONS.map((sec) => {
            const items = SINGLE_TIER_NAV_ITEMS.filter(
              (item) => item.section === sec.key
            );
            if (items.length === 0) return null;
            return (
              <div key={sec.key} className="space-y-0.5">
                {sec.label ? (
                  <div className="text-[10.5px] font-semibold text-muted-foreground/60 px-2 pt-2 pb-0.5 select-none tracking-wider uppercase">
                    {sec.label}
                  </div>
                ) : null}
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
                          "group relative flex items-center gap-2.5 rounded-[6px] px-2 h-[34px] text-[13px] transition-colors select-none tracking-tight",
                          active
                            ? "bg-black/[0.06] text-foreground font-medium"
                            : "text-muted-foreground/80 hover:text-foreground hover:bg-black/[0.035] font-normal"
                        )}
                      >
                        <span className="size-4 shrink-0 flex items-center justify-center">
                          <Icon
                            size={16}
                            strokeWidth={active ? 1.75 : 1.5}
                            className={cn(
                              "shrink-0 transition-colors",
                              active
                                ? "text-foreground"
                                : "text-muted-foreground/75 group-hover:text-foreground"
                            )}
                          />
                        </span>
                        <span className="truncate flex-1">{item.label}</span>
                        {badge ? (
                          <span
                            className={cn(
                              "ml-auto inline-flex items-center justify-center min-w-[15px] h-3.5 px-1 rounded-full text-[9px] font-mono font-medium tabular-nums leading-none select-none",
                              badge.variant === "rose" && "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                              badge.variant === "primary" && "bg-primary/10 text-primary border border-primary/20",
                              badge.variant === "sky" && "bg-sky-500/10 text-sky-700 border border-sky-500/20",
                              badge.variant === "amber" && "bg-amber-500/10 text-amber-800 border border-amber-500/20",
                              (!badge.variant || badge.variant === "muted") && "bg-muted/70 text-muted-foreground border border-border/40"
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

        {/* ========================================================= */}
        {/* 3. LINEAR-STYLE BOTTOM FOOTER: GLOBAL HELP & SHORTCUTS (?) */}
        {/* ========================================================= */}
        <div className="shrink-0 px-3 py-2.5 mt-auto flex items-center">
          <TooltipProvider>
            <Tooltip delayDuration={300}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== "undefined") {
                      window.dispatchEvent(new CustomEvent("qcet:open-shortcuts"));
                    }
                  }}
                  className="size-7 rounded-full flex items-center justify-center bg-white dark:bg-zinc-800 border border-black/12 dark:border-white/15 shadow-2xs hover:shadow-xs hover:border-black/20 dark:hover:border-white/25 text-muted-foreground/80 hover:text-foreground font-mono font-semibold text-[13.5px] leading-none transition-all active:scale-95 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-primary"
                  aria-label="Phím tắt và trợ giúp (?)"
                >
                  ?
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8} className="text-xs">
                Phím tắt & Trợ giúp (?)
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
