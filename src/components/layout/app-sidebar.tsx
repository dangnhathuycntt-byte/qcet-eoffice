"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ChevronDown,
  ChevronsUpDown,
  User,
  Settings,
  Smartphone,
  HelpCircle,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import {
  IconSidebarHome,
  IconSidebarTasks,
  IconSidebarMail,
  IconSidebarCalendar,
  IconSidebarReports,
  IconSidebarSend,
  IconSidebarDocLines,
  IconSidebarFolder,
  IconSidebarPeople,
  IconSidebarSettingsBracket,
} from "@/components/layout/sidebar-rounded-icons";
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
import { UserAvatar } from "@/components/ui/user-avatar";
import { cn, getInitials as baseGetInitials } from "@/lib/utils";
import * as m from "motion/react-m";
import { QcetIcon } from "@/components/icons";
import { Pressable } from "@/components/ui/pressable";

const UserProfileModal = dynamic(
  () => import("@/components/auth/user-profile-modal").then((m) => m.UserProfileModal),
  { ssr: false }
);

const ICON_MAP: Record<CanonicalRouteConfig["iconName"], React.ComponentType<any>> = {
  LayoutDashboard: (props: any) => <QcetIcon name="dashboard" size={16} {...props} />,
  Calendar: (props: any) => <QcetIcon name="calendar" size={16} {...props} />,
  CheckSquare: (props: any) => <QcetIcon name="tasks" size={16} {...props} />,
  FileText: (props: any) => <QcetIcon name="documents" size={16} {...props} />,
  Building2: (props: any) => <QcetIcon name="organization" size={16} {...props} />,
  Bell: (props: any) => <QcetIcon name="notification" size={16} {...props} />,
  Settings: (props: any) => <QcetIcon name="settings" size={16} {...props} />,
  Inbox: (props: any) => <QcetIcon name="inbox" size={16} {...props} />,
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
  return baseGetInitials(cleanName);
}

export interface DesktopSidebarItem extends CanonicalRouteConfig {
  icon: React.ComponentType<any>;
  isComingSoon?: boolean;
  isMaintenance?: boolean;
}

export const SINGLE_TIER_NAV_ITEMS: DesktopSidebarItem[] = getSidebarNavItems()
  .filter((item) => item.id !== "settings" && item.id !== "desk")
  .map((item) => ({
    ...item,
    icon: ICON_MAP[item.iconName] || ICON_MAP.LayoutDashboard,
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

export interface SidebarNavSubItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  badgeKey?: string;
  defaultBadge?: number;
  aliases?: string[];
  isMaintenance?: boolean;
  /** Menu con lồng nhau (chỉ hiển thị khi sidebar mở rộng). */
  children?: SidebarNavChild[];
}

export interface SidebarNavChild {
  id: string;
  label: string;
  href: string;
  badgeKey?: string;
  /** Chỉ hiện khi máy chủ báo người dùng có quyền xem mục này. */
  requiresApprovalReport?: boolean;
}

export interface SidebarNavGroup {
  id: string;
  label?: string;
  collapsible?: boolean;
  items: SidebarNavSubItem[];
}

/**
 * Danh mục nhóm điều hướng bám sát thiết kế chuẩn (3. Danh sách · 1440×900@1x.png)
 * Sử dụng bộ icon bo tròn mềm mại đồng bộ với Vector 2758.svg và mẫu UI
 */
const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
  // 1. Nhóm chính (Core Workspace): Tổng quan, Hộp thư, Nhiệm vụ, Lịch công tác
  {
    id: "core",
    items: [
      {
        id: "desk",
        label: "Tổng quan",
        href: "/",
        icon: IconSidebarHome,
        aliases: ["/dashboard", "/workbench"],
      },
      {
        id: "inbox",
        label: "Hộp thư",
        href: "/inbox",
        icon: IconSidebarMail,
        badgeKey: "notifications",
        defaultBadge: 4,
        aliases: ["/notifications"],
      },
      {
        id: "tasks",
        label: "Nhiệm vụ",
        href: "/tasks",
        icon: IconSidebarTasks,
        badgeKey: "taskAttention",
        aliases: ["/unit-tasks"],
        children: [
          { id: "tasks-unit-requests", label: "Yêu cầu phối hợp", href: "/tasks/unit-requests" },
          { id: "tasks-templates", label: "Mẫu và lặp lại", href: "/tasks/templates" },
        ],
      },
      {
        id: "calendar",
        label: "Lịch công tác",
        href: "/calendar",
        icon: IconSidebarCalendar,
        badgeKey: "calendar",
        aliases: ["/meetings"],
      },
    ],
  },
  // 2. Nhóm Văn bản: Văn bản đến, Văn bản đi, Tờ trình nội bộ, Hồ sơ công việc
  {
    id: "documents",
    label: "Văn bản",
    collapsible: true,
    items: [
      {
        id: "docs-incoming",
        label: "Văn bản đến",
        href: "/documents?type=inbox",
        icon: IconSidebarReports,
        aliases: ["/documents/incoming"],
        children: [
          { id: "docs-incoming-pending", label: "Chờ xử lý", href: "/documents?type=inbox&bucket=pending", badgeKey: "docsIncomingPending" },
          { id: "docs-incoming-done", label: "Đã xử lý", href: "/documents?type=inbox&bucket=done", badgeKey: "docsIncomingDone" },
        ],
      },
      {
        id: "docs-outgoing",
        label: "Văn bản đi",
        href: "/documents?type=outbox",
        icon: IconSidebarSend,
        aliases: ["/documents/outgoing"],
        children: [
          { id: "docs-outgoing-pending", label: "Chờ xử lý", href: "/documents?type=outbox&bucket=pending", badgeKey: "docsOutgoingPending" },
          { id: "docs-outgoing-done", label: "Đã xử lý", href: "/documents?type=outbox&bucket=done", badgeKey: "docsOutgoingDone" },
          { id: "docs-outgoing-issued", label: "Đã phát hành", href: "/documents?type=outbox&bucket=issued", badgeKey: "docsOutgoingIssued" },
          { id: "docs-outgoing-recalled", label: "Đã thu hồi", href: "/documents?type=outbox&bucket=recalled" },
        ],
      },
      {
        id: "docs-internal",
        label: "Tờ trình nội bộ",
        href: "/documents?tab=submission",
        icon: IconSidebarDocLines,
        aliases: ["/documents/internal", "/documents?tab=submission", "/documents?tab=pending", "/documents?type=submission"],
        children: [{ id: "docs-approval-report", label: "Báo cáo thời gian duyệt", href: "/documents/approval-report", requiresApprovalReport: true }],
      },
      {
        id: "docs-dossiers",
        label: "Hồ sơ công việc",
        href: "/documents?tab=dossiers",
        icon: IconSidebarFolder,
        aliases: ["/documents/dossiers", "/documents?tab=archive", "/documents?type=dossier", "/dossiers"],
      },
    ],
  },
  // 3. Nhóm Đơn vị: Cơ cấu & Danh bạ, Thêm
  {
    id: "org",
    label: "Đơn vị",
    collapsible: true,
    items: [
      {
        id: "org-directory",
        label: "Cơ cấu & Danh bạ",
        href: "/org",
        icon: IconSidebarPeople,
        aliases: ["/organization", "/directory", "/?zone=org"],
      },
      {
        id: "more",
        label: "Thêm",
        href: "/settings",
        icon: IconSidebarSettingsBracket,
        defaultBadge: 1,
        aliases: ["/settings", "/more"],
      },
    ],
  },
];

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    sidebarWidthMotion,
    badgeCounts,
    setBadgeCounts,
  } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, logout, isProfileModalOpen, setIsProfileModalOpen, isOfflineReadOnly } = useAuth();

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Quản lý trạng thái mở/đóng của các nhóm collapsible
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});

  const toggleGroup = React.useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  }, []);

  // Menu con có thể mở/đóng thủ công; mặc định mở khi đang ở bên trong.
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});

  // Số đếm thật cho menu con "Văn bản" (theo quyền đọc của người dùng).
  const docsUserId = user?.id;
  const [canViewApprovalReport, setCanViewApprovalReport] = React.useState(false);
  React.useEffect(() => {
    if (!docsUserId) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/documents/stats", { signal: ctrl.signal });
        if (!res.ok) return;
        const json = await res.json();
        setCanViewApprovalReport(json?.data?.canViewApprovalReport === true);
        const b = json?.data?.buckets;
        if (!b) return;
        setBadgeCounts((prev) => ({
          ...prev,
          docsIncomingPending: b.incomingPending ?? 0,
          docsIncomingDone: b.incomingDone ?? 0,
          docsOutgoingPending: b.outgoingPending ?? 0,
          docsOutgoingDone: b.outgoingDone ?? 0,
          docsOutgoingIssued: b.outgoingIssued ?? 0,
        }));
      } catch {
        // giữ nguyên số đếm cũ khi lỗi mạng
      }
    })();
    return () => ctrl.abort();
  }, [docsUserId, pathname, searchParams, setBadgeCounts]);

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
    (item: SidebarNavSubItem) => {
      return isRouteActive(
        item.href,
        pathname,
        searchParams,
        item.aliases
      );
    },
    [pathname, searchParams]
  );

  // Helper to get badge counter
  const getBadgeNumber = React.useCallback(
    (item: SidebarNavSubItem): string | null => {
      let val: string | number | undefined;

      if (item.badgeKey && badgeCounts?.[item.badgeKey] !== undefined) {
        val = badgeCounts[item.badgeKey];
      } else if (item.defaultBadge !== undefined) {
        val = item.defaultBadge;
      }

      if (val === undefined || val === null || val === "" || val === 0 || val === "0") {
        return null;
      }
      return String(val);
    },
    [badgeCounts]
  );

  const isChildActive = React.useCallback(
    (child: SidebarNavChild) => isRouteActive(child.href, pathname, searchParams),
    [pathname, searchParams]
  );

  const getChildBadge = React.useCallback(
    (child: SidebarNavChild): string | null => {
      const val = child.badgeKey ? badgeCounts?.[child.badgeKey] : undefined;
      return val === undefined || val === null || val === "" || val === 0 || val === "0"
        ? null
        : String(val);
    },
    [badgeCounts]
  );

  const userRoleLabel =
    user?.role === "ADMIN"
      ? "Ban Giám hiệu"
      : user?.role === "MANAGER"
      ? "Trưởng đơn vị"
      : "Chuyên viên";

  return (
    <TooltipProvider>
      <>
        <m.aside
          id="app-sidebar"
          data-slot="app-sidebar"
          aria-label="Thanh điều hướng chính"
          style={{ width: sidebarWidthMotion }}
          className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col bg-sidebar text-foreground select-none group/sidebar overflow-hidden"
        >
          {/* ========================================================= */}
          {/* 1. SIDEBAR TOP HEADER: QCET LOGO + QCET E-OFFICE          */}
          {/* ========================================================= */}
          <div className="shrink-0 w-full pt-3.5 pb-2.5 px-3">
            <div className={cn(
              "flex items-center",
              isCollapsed ? "justify-center" : "justify-between"
            )}>
              <Link
                href="/"
                className={cn(
                  "flex items-center gap-2.5 rounded-lg py-1 transition-opacity hover:opacity-90 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isCollapsed ? "justify-center px-0" : "px-1.5"
                )}
                title="QCET E-Office"
              >
                <Image
                  src="/logo-qcet.png"
                  alt="QCET"
                  width={24}
                  height={24}
                  className="size-6 rounded-full object-contain shrink-0"
                  priority
                />
                {!isCollapsed && (
                  <span className="font-semibold text-compact tracking-tight text-foreground truncate select-none">
                    QCET E-Office
                  </span>
                )}
              </Link>

            </div>
          </div>

          {/* ========================================================= */}
          {/* 2. NAVIGATION ITEMS BODY                                  */}
          {/* ========================================================= */}
          <div className="overflow-y-auto flex-1 px-2.5 pt-1.5 pb-2 space-y-3 thin-scrollbar">
            {SIDEBAR_NAV_GROUPS.map((group) => {
              const isGroupCollapsed = Boolean(collapsedGroups[group.id]);

              return (
                <div key={group.id} className="space-y-0.5">
                  {/* Group Section Header (Văn bản, Đơn vị) */}
                  {group.label && !isCollapsed ? (
                    <Pressable
                      type="button"
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center gap-1 px-2 pt-2.5 pb-1 text-xs font-medium text-muted-foreground select-none hover:text-foreground transition-colors text-left cursor-pointer group/gh"
                    >
                      <span>{group.label}</span>
                      <ChevronDown
                        size={11}
                        strokeWidth={1.5}
                        className={cn(
                          "text-muted-foreground/70 transition-transform duration-150 shrink-0",
                          isGroupCollapsed && "-rotate-90"
                        )}
                      />
                    </Pressable>
                  ) : null}

                  {/* Divider when collapsed */}
                  {group.label && isCollapsed ? (
                    <div className="w-6 mx-auto my-2 border-t border-border/50" />
                  ) : null}

                  {/* Group Items */}
                  {(!group.label || !isGroupCollapsed) && (
                    <div className="space-y-0.5">
                      {group.items.map((item) => {
                        const visibleChildren = item.children?.filter((c) => !c.requiresApprovalReport || canViewApprovalReport);
                        const hasActiveChild = Boolean(visibleChildren?.some(isChildActive));
                        const active = isItemActive(item) && !hasActiveChild;
                        const Icon = item.icon;
                        const children = visibleChildren?.length ? visibleChildren : undefined;
                        const isExpanded = expandedItems[item.id] ?? true;
                        const badgeText = children
                          ? (() => {
                              const first = children[0].badgeKey;
                              const pending = first ? badgeCounts?.[first] : undefined;

                              return pending ? String(pending) : null;
                            })()
                          : getBadgeNumber(item);

                        return (
                          <React.Fragment key={item.id}>
                          <div className="relative">
                          <Tooltip>
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
                                aria-current={active ? "page" : undefined}
                                aria-label={item.label}
                                className={cn(
                                  "group relative flex items-center transition-colors duration-150 select-none overflow-hidden whitespace-nowrap",
                                  isCollapsed
                                    ? "size-10 mx-auto justify-center rounded-xl p-0"
                                    : "gap-2.5 px-2 h-8 rounded-md text-compact",
                                  !isCollapsed && children && "pr-7",
                                  active
                                    ? "bg-bg-hover text-foreground font-medium"
                                    : "text-foreground/80 hover:text-foreground hover:bg-muted/50 font-medium"
                                )}
                              >
                                <span className={cn(
                                  "shrink-0 flex items-center justify-center",
                                  isCollapsed ? "size-6" : "size-4"
                                )}>
                                  <Icon
                                    size={isCollapsed ? 19 : 16}
                                    strokeWidth={1.5}
                                    className={cn(
                                      isCollapsed ? "size-[19px]" : "size-4",
                                      "shrink-0 transition-colors",
                                      active
                                        ? "text-foreground"
                                        : "text-foreground/70 group-hover:text-foreground"
                                    )}
                                  />
                                </span>

                                {!isCollapsed && (
                                  <>
                                    <span className="truncate flex-1 text-compact tracking-tight">
                                      {item.label}
                                    </span>
                                    {badgeText ? (
                                      <span className="text-xs font-normal text-muted-foreground/75 tabular-nums ml-auto shrink-0 select-none">
                                        {badgeText}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </Link>
                            </TooltipTrigger>
                            {isCollapsed && (
                              <TooltipContent side="right" sideOffset={8}>
                                <span>
                                  {item.label}
                                  {badgeText ? ` (${badgeText})` : ""}
                                </span>
                              </TooltipContent>
                            )}
                          </Tooltip>
                          {children && !isCollapsed ? (
                            <Pressable
                              type="button"
                              aria-label={isExpanded ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
                              aria-expanded={isExpanded}
                              onClick={() =>
                                setExpandedItems((prev) => ({ ...prev, [item.id]: !isExpanded }))
                              }
                              className="absolute right-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer"
                            >
                              <ChevronDown
                                size={12}
                                strokeWidth={1.5}
                                className={cn("transition-transform duration-150", !isExpanded && "-rotate-90")}
                              />
                            </Pressable>
                          ) : null}
                          </div>
                          {children && !isCollapsed && isExpanded ? (
                            <div className="ml-[15px] border-l border-border/60 pl-1.5 space-y-0.5">
                              {children.map((child) => {
                                const childActive = isChildActive(child);
                                const childBadge = getChildBadge(child);
                                return (
                                  <Link
                                    key={child.id}
                                    href={child.href}
                                    aria-current={childActive ? "page" : undefined}
                                    className={cn(
                                      "flex items-center gap-2 px-2 h-7 rounded-md text-compact tracking-tight transition-colors whitespace-nowrap",
                                      childActive
                                        ? "bg-accent text-foreground font-medium"
                                        : "text-foreground/70 hover:text-foreground hover:bg-muted/50"
                                    )}
                                  >
                                    <span className="truncate flex-1">{child.label}</span>
                                    {childBadge ? (
                                      <span className="text-xs font-normal text-muted-foreground/75 tabular-nums shrink-0">
                                        {childBadge}
                                      </span>
                                    ) : null}
                                  </Link>
                                );
                              })}
                            </div>
                          ) : null}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* ========================================================= */}
          {/* 3. SIDEBAR BOTTOM FOOTER: USER ACCOUNT PROFILE CARD       */}
          {/* ========================================================= */}
          <div className="shrink-0 w-full p-2 mt-auto border-t border-border/40">
            <Menu.Root
              open={isProfileDropdownOpen && Boolean(user)}
              onOpenChange={(open) => setIsProfileDropdownOpen(open)}
            >
              <Menu.Trigger
                ref={accountTriggerRef}
                type="button"
                className={cn(
                  "flex items-center transition-colors cursor-pointer text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                  isCollapsed
                    ? "size-10 mx-auto justify-center rounded-xl p-0"
                    : "w-full gap-2.5 px-2 py-1.5 rounded-lg",
                  isProfileDropdownOpen
                    ? "bg-muted"
                    : "hover:bg-muted/60"
                )}
                aria-label={`Tài khoản: ${formatDisplayName(user?.name)}`}
                aria-expanded={isProfileDropdownOpen}
              >
                <UserAvatar
                  name={formatDisplayName(user?.name)}
                  avatarUrl={user?.avatar}
                  size="sm"
                  className="shrink-0 size-7"
                />

                {!isCollapsed && (
                  <>
                    <div className="flex flex-col min-w-0 flex-1 leading-none gap-0.5">
                      <span className="text-compact font-medium text-foreground truncate">
                        {formatDisplayName(user?.name)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {userRoleLabel}
                      </span>
                    </div>

                    <ChevronsUpDown
                      size={13}
                      strokeWidth={1.5}
                      className="text-muted-foreground/50 shrink-0 ml-1"
                    />
                  </>
                )}
              </Menu.Trigger>

              {/* Account Dropdown Menu via Base UI Popover (Bay lên trên vì ở đáy) */}
              <Menu.Portal>
                <Menu.Positioner
                  className="z-50"
                  side="top"
                  align="start"
                  sideOffset={8}
                  collisionPadding={12}
                >
                  <Menu.Popup
                    style={{
                      maxWidth: "var(--available-width)",
                      maxHeight: "var(--available-height)",
                      overflowY: "auto",
                    }}
                    className="w-56 p-1 shadow-dropdown border border-border/80 bg-popover rounded-xl text-popover-foreground select-none"
                    role="menu"
                    aria-label="Menu tài khoản"
                  >
                    {user && (
                      <div>
                        {isOfflineReadOnly && (
                          <div className="mb-1.5 p-1.5 rounded-md bg-warning/10 border border-warning/40 text-xs text-warning font-medium leading-relaxed">
                            Chế độ chỉ xem từ bộ nhớ tạm.
                          </div>
                        )}

                        {/* Menu Items */}
                        <div className="space-y-0.5">
                          <Pressable
                            type="button"
                            onClick={() => {
                              setIsProfileDropdownOpen(false);
                              setIsProfileModalOpen(true);
                            }}
                            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-xs font-normal text-foreground/90 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                          >
                            <User size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
                            <span>Hồ sơ cá nhân</span>
                          </Pressable>

                          <Link
                            href="/settings"
                            onClick={() => setIsProfileDropdownOpen(false)}
                            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-xs font-normal text-foreground/90 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                          >
                            <Settings size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
                            <span>Cài đặt hệ thống</span>
                          </Link>

                          <Pressable
                            type="button"
                            onClick={() => {
                              setIsProfileDropdownOpen(false);
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(new CustomEvent("qcet:open-install-modal"));
                              }
                            }}
                            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-xs font-normal text-foreground/90 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                          >
                            <Smartphone size={14} strokeWidth={1.5} className="text-primary/85 shrink-0" />
                            <span>Cài đặt ứng dụng di động</span>
                          </Pressable>

                          <Pressable
                            type="button"
                            onClick={() => {
                              setIsProfileDropdownOpen(false);
                              if (typeof window !== "undefined") {
                                window.dispatchEvent(new CustomEvent("qcet:open-help-guide"));
                              }
                            }}
                            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-xs font-normal text-foreground/90 hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer text-left"
                          >
                            <HelpCircle size={14} strokeWidth={1.5} className="text-muted-foreground/75 shrink-0" />
                            <span>Trợ giúp &amp; Hướng dẫn</span>
                          </Pressable>
                        </div>

                        {/* Logout */}
                        <div className="border-t border-border/60 pt-1 mt-1">
                          <Pressable
                            type="button"
                            onClick={() => {
                              setIsProfileDropdownOpen(false);
                              logout();
                            }}
                            className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors cursor-pointer text-left"
                          >
                            <LogOut size={14} strokeWidth={1.5} className="shrink-0" />
                            <span>Đăng xuất</span>
                          </Pressable>
                        </div>
                      </div>
                    )}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </div>
        </m.aside>

        {/* Collapse toggle — mỏng, dính mép sidebar, grip luôn hiện để người dùng biết bấm/thu gọn được */}
        <m.div
          style={{ left: sidebarWidthMotion }}
          className="fixed top-0 bottom-0 z-50 hidden md:flex items-center -ml-px group/collapse-trigger"
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={toggleCollapse}
                aria-label={isCollapsed ? "Mở rộng thanh điều hướng (⌘B)" : "Thu gọn thanh điều hướng (⌘B)"}
                aria-expanded={!isCollapsed}
                aria-controls="app-sidebar"
                className="flex h-12 w-3 items-center justify-center rounded-full cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="h-8 w-1 rounded-full bg-border group-hover/collapse-trigger:bg-muted-foreground/50 transition-colors duration-150" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={10}>
              {isCollapsed ? "Mở rộng thanh bên [⌘B]" : "Thu gọn thanh bên [⌘B]"}
            </TooltipContent>
          </Tooltip>
        </m.div>

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
    </TooltipProvider>
  );
}
