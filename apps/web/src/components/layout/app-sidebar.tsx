"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  User,
  Settings,
  Smartphone,
  LogOut,
} from "lucide-react";
import { SidebarNavList } from "@/components/layout/sidebar-nav-list";
import dynamic from "next/dynamic";
import {
  getSidebarNavItems,
  type CanonicalRouteConfig,
} from "@/lib/navigation/canonical-navigation-registry";
import {
  useSidebar,
} from "@/components/layout/sidebar-context";
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
import { MENU_POPUP_CLASS, MenuActionItem, MenuSeparator } from "@/components/ui/menu";
import { OPEN_INBOX_EVENT, SidebarInbox } from "@/components/inbox/inbox-panel";
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
  .filter((item) => item.id !== "settings")
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

/** Hộp thư không nằm trong danh sách điều hướng desktop: nút ở đầu sidebar mở khung nổi (drawer điện thoại vẫn có mục này). */
const DESKTOP_HIDDEN_NAV_ITEMS = ["inbox"] as const;

export function AppSidebar() {
  const {
    isCollapsed,
    toggleCollapse,
    sidebarWidthMotion,
    setBadgeCounts,
  } = useSidebar();
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, setIsProfileModalOpen, isOfflineReadOnly } = useAuth();

  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
  const accountTriggerRef = React.useRef<HTMLButtonElement>(null);

  // Quyền xem "Báo cáo thời gian duyệt" (menu con của Tờ trình nội bộ), làm mới khi chuyển trang.
  const docsUserId = user?.id;
  React.useEffect(() => {
    if (!docsUserId) return;
    const ctrl = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/documents/stats", { signal: ctrl.signal });
        if (!res.ok) return;
        const json = await res.json();
        const canViewReport = json?.data?.canViewApprovalReport === true;
        setBadgeCounts((prev) => ({ ...prev, docsApprovalReport: canViewReport ? 1 : 0 }));
      } catch {
        // giữ nguyên trạng thái cũ khi lỗi mạng
      }
    })();
    return () => ctrl.abort();
  }, [docsUserId, pathname, setBadgeCounts]);

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
          // Hộp thư mở khung nổi cạnh sidebar như nút ở đầu sidebar (điện thoại vẫn sang trang /inbox)
          if (href === "/inbox") window.dispatchEvent(new CustomEvent(OPEN_INBOX_EVENT));
          else router.push(href);
        },
      });
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleOpenSearch, toggleCollapse, router]);

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
          {/* 1. SIDEBAR TOP HEADER: TÀI KHOẢN (AVATAR + TÊN) MỞ MENU,   */}
          {/*    NÚT HỘP THƯ BÊN PHẢI NHƯ NOTION                          */}
          {/* ========================================================= */}
          <div className={cn("shrink-0 w-full pt-3.5 pb-2.5 px-3 flex items-center gap-1", isCollapsed && "flex-col")}>
            <Menu.Root
              open={isProfileDropdownOpen && Boolean(user)}
              onOpenChange={(open) => setIsProfileDropdownOpen(open)}
            >
              <Menu.Trigger
                ref={accountTriggerRef}
                type="button"
                className={cn(
                  "flex items-center transition-colors cursor-pointer text-left outline-none focus-visible:bg-sidebar-accent",
                  isCollapsed
                    ? "size-7 mx-auto justify-center rounded-sm p-0"
                    : "min-w-0 max-w-full gap-1.5 px-1.5 h-7 rounded-sm",
                  isProfileDropdownOpen
                    ? "bg-sidebar-accent"
                    : "hover:bg-sidebar-accent/60"
                )}
                aria-label={`Tài khoản: ${formatDisplayName(user?.name)}`}
                aria-expanded={isProfileDropdownOpen}
              >
                <UserAvatar
                  name={formatDisplayName(user?.name)}
                  avatarUrl={user?.avatar}
                  size="sm"
                  className="shrink-0"
                />

                {!isCollapsed && (
                  <>
                    <span className="min-w-0 truncate text-compact font-medium text-foreground">
                      {formatDisplayName(user?.name)}
                    </span>
                    <ChevronDown aria-hidden className="size-3 shrink-0 text-muted-foreground" />
                  </>
                )}
              </Menu.Trigger>

              {/* Menu tài khoản mở xuống dưới, như menu workspace góc trên trái của Linear */}
              <Menu.Portal>
                <Menu.Positioner
                  className="z-50"
                  side="bottom"
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
                    className={cn(MENU_POPUP_CLASS, "w-56 select-none")}
                    role="menu"
                    aria-label="Menu tài khoản"
                  >
                    {user && (
                      <div>
                        {/* Đầu menu: chỉ email (tên đã có ở nút ngay trên; không ghi chức vụ vì vai trò phân quyền không phải chức vụ thật) */}
                        {user.email ? <p className="truncate px-2 pb-1.5 pt-1 text-muted-foreground">{user.email}</p> : null}
                        {isOfflineReadOnly && (
                          <div className="mb-1 rounded-md bg-warning/10 px-2 py-1.5 text-xs text-warning">
                            Chế độ chỉ xem từ bộ nhớ tạm.
                          </div>
                        )}

                        <MenuSeparator className="-mx-1 my-1 h-px bg-border/60" />
                        <MenuActionItem leading={<User />} onClick={() => setIsProfileModalOpen(true)}>
                          Hồ sơ cá nhân
                        </MenuActionItem>
                        <MenuActionItem leading={<Settings />} render={<Link href="/settings" />}>
                          Cài đặt hệ thống
                        </MenuActionItem>

                        <MenuSeparator className="-mx-1 my-1 h-px bg-border/60" />
                        <MenuActionItem leading={<BookOpen />} render={<Link href="/docs" />}>
                          Tài liệu hướng dẫn
                        </MenuActionItem>
                        <MenuActionItem
                          leading={<Smartphone />}
                          onClick={() => window.dispatchEvent(new CustomEvent("qcet:open-install-modal"))}
                        >
                          Cài ứng dụng trên điện thoại
                        </MenuActionItem>

                        <MenuSeparator className="-mx-1 my-1 h-px bg-border/60" />
                        <MenuActionItem leading={<LogOut />} destructive onClick={() => logout()}>
                          Đăng xuất
                        </MenuActionItem>
                      </div>
                    )}
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            {!isCollapsed && <span className="flex-1" aria-hidden />}
            <SidebarInbox isCollapsed={isCollapsed} />
          </div>

          {/* ========================================================= */}
          {/* 2. NAVIGATION ITEMS BODY                                  */}
          {/* ========================================================= */}
          <SidebarNavList
            isCollapsed={isCollapsed}
            hiddenItemIds={DESKTOP_HIDDEN_NAV_ITEMS}
            onMaintenance={(item) => setMaintenanceDialog({ isOpen: true, title: item.label, feature: item.id })}
          />

        </m.aside>

        {/* Collapse toggle — mỏng, dính mép sidebar, grip luôn hiện để người dùng biết bấm/thu gọn được.
            Cùng tầng z-40 với sidebar: nằm trên sidebar và nội dung, nhưng dưới lớp phủ của hộp thoại, ngăn kéo
            (portal ra cuối body, z-40/z-50) để grip không sáng lên giữa lớp phủ tối. */}
        <m.div
          style={{ left: sidebarWidthMotion }}
          className="fixed top-0 bottom-0 z-40 hidden md:flex items-center -ml-px group/collapse-trigger"
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
