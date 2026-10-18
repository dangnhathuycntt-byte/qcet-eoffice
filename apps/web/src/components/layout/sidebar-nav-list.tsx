"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArchiveX, BookOpen, ChevronDown, ScrollText, Search, Settings, UserRoundCheck, UsersRound, type LucideIcon } from "lucide-react";
import {
  IconSidebarHome,
  IconSidebarTasks,
  IconSidebarMail,
  IconSidebarCalendar,
  IconSidebarInboxIn,
  IconSidebarSend,
  IconSidebarDocLines,
  IconSidebarFolder,
  IconSidebarPeople,
  IconSidebarChart,
  IconSidebarMore,
  IconSidebarAssistant,
} from "@/components/layout/sidebar-rounded-icons";
import { useSidebar } from "@/components/layout/sidebar-context";
import { isRouteActive } from "@/lib/navigation/active-matcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pressable } from "@/components/ui/pressable";
import { MENU_POPUP_CLASS, Menu, MenuActionItem, MenuGroup, MenuGroupLabel, MenuPopup, MenuSeparator } from "@/components/ui/menu";
import { useAuth } from "@/lib/auth-context";
import { useRuntimeFeature } from "@/lib/runtime-features";
import { cn } from "@/lib/utils";

export interface SidebarNavSubItem {
  id: string;
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string; size?: number; strokeWidth?: number }>;
  aliases?: string[];
  isMaintenance?: boolean;
  /** Menu con lồng nhau (chỉ hiển thị khi sidebar mở rộng). */
  children?: SidebarNavChild[];
  /** Mục "Thêm": bấm mở menu các trang ít dùng (`SIDEBAR_MORE_ITEMS`) như mục "More" ở sidebar Linear, không điều hướng. */
  more?: boolean;
  /** Chỉ hiện khi cờ công khai của server bật (đọc từ `/api/runtime-config`). */
  feature?: "assistant";
}

export interface SidebarNavChild {
  id: string;
  label: string;
  href: string;
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
export const SIDEBAR_NAV_GROUPS: SidebarNavGroup[] = [
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
        aliases: ["/notifications"],
      },
      {
        id: "tasks",
        label: "Nhiệm vụ",
        href: "/tasks",
        icon: IconSidebarTasks,
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
        aliases: ["/meetings"],
      },
      {
        id: "assistant",
        label: "Trợ lý",
        href: "/assistant",
        icon: IconSidebarAssistant,
        feature: "assistant",
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
        icon: IconSidebarInboxIn,
        aliases: ["/documents/incoming"],
        children: [
          { id: "docs-incoming-pending", label: "Chờ xử lý", href: "/documents?type=inbox&bucket=pending" },
          { id: "docs-incoming-done", label: "Đã xử lý", href: "/documents?type=inbox&bucket=done" },
        ],
      },
      {
        id: "docs-outgoing",
        label: "Văn bản đi",
        href: "/documents?type=outbox",
        icon: IconSidebarSend,
        aliases: ["/documents/outgoing"],
        children: [
          { id: "docs-outgoing-pending", label: "Chờ xử lý", href: "/documents?type=outbox&bucket=pending" },
          { id: "docs-outgoing-done", label: "Đã xử lý", href: "/documents?type=outbox&bucket=done" },
          { id: "docs-outgoing-issued", label: "Đã phát hành", href: "/documents?type=outbox&bucket=issued" },
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
  // 3. Nhóm Đơn vị: Cơ cấu & Danh bạ, Báo cáo, Thêm (bảng Layout: mục ít dùng nằm trong "Thêm")
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
        id: "reports",
        label: "Báo cáo",
        href: "/reports",
        icon: IconSidebarChart,
      },
      {
        id: "more",
        label: "Thêm",
        // Không điều hướng (mở menu `SIDEBAR_MORE_ITEMS`); giữ trang đầu menu cho kiểu dữ liệu chung
        href: "/delegations",
        icon: IconSidebarMore,
        more: true,
      },
    ],
  },
];

interface SidebarMoreItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Nhóm trong menu; "admin" chỉ hiện với quản trị hệ thống. */
  section: "work" | "admin" | "system";
}

/**
 * Các trang trong menu "Thêm" (quyết định 15/10/2026): việc ít dùng hằng ngày, nhóm Quản trị chỉ hiện với quản trị hệ thống
 * (`SYSTEM_ADMIN`), cuối là Cài đặt và Tài liệu (cũng có trong menu tài khoản).
 */
export const SIDEBAR_MORE_ITEMS: SidebarMoreItem[] = [
  { id: "delegations", label: "Ủy quyền tác nghiệp", href: "/delegations", icon: UserRoundCheck, section: "work" },
  { id: "search", label: "Tìm kiếm", href: "/search", icon: Search, section: "work" },
  { id: "admin-users", label: "Tài khoản và vai trò", href: "/admin/users", icon: UsersRound, section: "admin" },
  { id: "admin-audit", label: "Nhật ký hệ thống", href: "/admin/audit", icon: ScrollText, section: "admin" },
  { id: "admin-dossiers", label: "Hồ sơ chờ xóa hẳn", href: "/admin/dossiers", icon: ArchiveX, section: "admin" },
  { id: "settings", label: "Cài đặt hệ thống", href: "/settings", icon: Settings, section: "system" },
  { id: "docs", label: "Tài liệu hướng dẫn", href: "/docs", icon: BookOpen, section: "system" },
];

const systemAdminChecks = new Map<string, Promise<boolean>>();

/**
 * Người dùng là quản trị hệ thống (`technicalCapabilities` của /api/me/context có `SYSTEM_ADMIN`). Chỉ để ẩn/hiện mục menu;
 * quyền thật do API của từng trang kiểm. Gọi một lần cho mỗi người dùng, sidebar và ngăn kéo điện thoại dùng chung kết quả.
 */
function useIsSystemAdmin() {
  const { user } = useAuth();
  const userId = user?.id;
  const [isSystemAdmin, setIsSystemAdmin] = React.useState(false);
  React.useEffect(() => {
    if (!userId) return;
    let alive = true;
    let check = systemAdminChecks.get(userId);
    if (!check) {
      check = fetch("/api/me/context")
        .then((res) => (res.ok ? res.json() : null))
        .then((ctx) => Array.isArray(ctx?.technicalCapabilities) && ctx.technicalCapabilities.includes("SYSTEM_ADMIN"))
        .catch(() => {
          systemAdminChecks.delete(userId);
          return false;
        });
      systemAdminChecks.set(userId, check);
    }
    check.then((value) => {
      if (alive) setIsSystemAdmin(value);
    });
    return () => {
      alive = false;
    };
  }, [userId]);
  return isSystemAdmin;
}

function navRowClass({ isCollapsed, compact, active }: { isCollapsed: boolean; compact: boolean; active: boolean }) {
  return cn(
    "group relative flex items-center transition-colors duration-150 select-none overflow-hidden whitespace-nowrap",
    isCollapsed ? "size-10 mx-auto justify-center rounded-xl p-0" : cn(compact ? "gap-1.5" : "gap-2", "px-2 h-7 rounded-sm text-compact"),
    active
      ? "bg-sidebar-accent text-foreground font-medium"
      : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 font-medium"
  );
}

function NavRowContent({ item, isCollapsed, compact, active }: { item: SidebarNavSubItem; isCollapsed: boolean; compact: boolean; active: boolean }) {
  const Icon = item.icon;
  return (
    <>
      <span className={cn("shrink-0 flex items-center justify-center", isCollapsed ? "size-6" : compact ? "size-3.5" : "size-4")}>
        <Icon
          size={isCollapsed ? 18 : compact ? 14 : 16}
          className={cn(
            isCollapsed ? "size-4.5" : compact ? "size-3.5" : "size-4",
            "shrink-0 transition-colors",
            active ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
          )}
        />
      </span>
      {!isCollapsed && <span className="truncate flex-1 text-compact tracking-tight">{item.label}</span>}
    </>
  );
}

/**
 * Mục "Thêm": mở menu các trang ít dùng như mục "More" ở sidebar Linear. Sáng lên khi đang ở một trang trong menu; trang đang mở
 * được đánh dấu trong menu (nền accent, chữ đậm). Sidebar thu gọn thì menu mở sang phải; ngăn kéo điện thoại (`compact`) mở danh sách
 * ngay bên dưới như menu con của Nhiệm vụ.
 */
function SidebarMoreMenu({
  item,
  isCollapsed,
  compact,
  onNavigate,
}: {
  item: SidebarNavSubItem;
  isCollapsed: boolean;
  compact: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSystemAdmin = useIsSystemAdmin();
  const entries = SIDEBAR_MORE_ITEMS.filter((entry) => entry.section !== "admin" || isSystemAdmin);
  const isCurrent = (entry: SidebarMoreItem) => isRouteActive(entry.href, pathname, searchParams);
  const active = entries.some(isCurrent);

  const renderEntry = (entry: SidebarMoreItem) => {
    const Icon = entry.icon;
    const current = isCurrent(entry);
    return (
      <MenuActionItem
        key={entry.id}
        leading={<Icon />}
        selected={current}
        render={<Link href={entry.href} aria-current={current ? "page" : undefined} />}
        onClick={onNavigate}
      >
        {entry.label}
      </MenuActionItem>
    );
  };
  const section = (name: SidebarMoreItem["section"]) => entries.filter((entry) => entry.section === name);
  // Ngăn kéo điện thoại là hộp thoại modal: menu bật ra (portal ngoài ngăn kéo) không nhận được chạm, nên mở ngay tại chỗ như menu con
  const [expanded, setExpanded] = React.useState(active);

  if (compact) {
    return (
      <>
        <Pressable
          aria-expanded={expanded}
          onClick={() => setExpanded((value) => !value)}
          className={cn(navRowClass({ isCollapsed: false, compact, active: active && !expanded }), "w-full text-left")}
        >
          <NavRowContent item={item} isCollapsed={false} compact={compact} active={active && !expanded} />
          <ChevronDown aria-hidden size={12} className={cn("shrink-0 text-muted-foreground/70 transition-transform duration-150", !expanded && "-rotate-90")} />
        </Pressable>
        {expanded ? (
          <div className="ml-[14px] space-y-px border-l border-border/60 pl-1.5">
            {entries.map((entry) => {
              const current = isCurrent(entry);
              return (
                <Link
                  key={entry.id}
                  href={entry.href}
                  onClick={onNavigate}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "flex h-7 items-center gap-2 whitespace-nowrap rounded-sm px-2 text-compact tracking-tight transition-colors",
                    current
                      ? "bg-sidebar-accent font-medium text-foreground"
                      : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-foreground"
                  )}
                >
                  <span className="flex-1 truncate">{entry.label}</span>
                </Link>
              );
            })}
          </div>
        ) : null}
      </>
    );
  }

  return (
    <Menu.Root>
      <Tooltip>
        <TooltipTrigger asChild>
          <Menu.Trigger
            aria-label={item.label}
            className={cn(
              navRowClass({ isCollapsed, compact, active }),
              "w-full text-left outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-ring data-[popup-open]:bg-sidebar-accent/60 data-[popup-open]:text-foreground",
              isCollapsed && "w-10"
            )}
          >
            <NavRowContent item={item} isCollapsed={isCollapsed} compact={compact} active={active} />
          </Menu.Trigger>
        </TooltipTrigger>
        {isCollapsed && (
          <TooltipContent side="right" sideOffset={8}>
            <span>{item.label}</span>
          </TooltipContent>
        )}
      </Tooltip>
      <Menu.Portal>
        <Menu.Positioner
          className="z-50 outline-none"
          side={isCollapsed ? "right" : "bottom"}
          align="start"
          sideOffset={isCollapsed ? 8 : 4}
          collisionPadding={12}
        >
          <MenuPopup className={cn(MENU_POPUP_CLASS, "w-56 select-none")} aria-label="Thêm">
            {section("work").map(renderEntry)}
            {section("admin").length > 0 ? (
              <>
                <MenuSeparator className="-mx-1 my-1 h-px bg-border/60" />
                <MenuGroup>
                  <MenuGroupLabel className="px-2 pb-1 pt-1 text-xs text-muted-foreground select-none">Quản trị</MenuGroupLabel>
                  {section("admin").map(renderEntry)}
                </MenuGroup>
              </>
            ) : null}
            <MenuSeparator className="-mx-1 my-1 h-px bg-border/60" />
            {section("system").map(renderEntry)}
          </MenuPopup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export interface SidebarNavListProps {
  /** Sidebar desktop thu gọn: chỉ hiện icon kèm tooltip. Mobile luôn mở rộng. */
  isCollapsed?: boolean;
  /** Gọi khi bấm một mục điều hướng (drawer mobile dùng để tự đóng). */
  onNavigate?: () => void;
  onMaintenance?: (item: SidebarNavSubItem) => void;
  /** Drawer mobile: icon 14px, cách chữ 6px như sidebar di động của Linear (desktop giữ 16px). */
  compact?: boolean;
  className?: string;
}

/** Danh sách điều hướng dùng chung cho sidebar desktop và drawer mobile: cùng nhóm, icon, menu con (không hiện số đếm). */
export function SidebarNavList({ isCollapsed = false, onNavigate, onMaintenance, compact = false, className }: SidebarNavListProps) {
  const { badgeCounts } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const canViewApprovalReport = Number(badgeCounts?.docsApprovalReport) === 1;
  const assistantEnabled = useRuntimeFeature("assistant");
  // Mục theo cờ: ẩn khi cờ tắt (desktop và ngăn kéo điện thoại dùng chung danh sách này)
  const navGroups = SIDEBAR_NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.feature || (item.feature === "assistant" && assistantEnabled)),
  }));

  // Quản lý trạng thái mở/đóng của các nhóm collapsible
  const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>({});
  const toggleGroup = React.useCallback((groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  }, []);

  // Menu con có thể mở/đóng thủ công; mặc định mở khi đang ở bên trong.
  const [expandedItems, setExpandedItems] = React.useState<Record<string, boolean>>({});

  const isItemActive = React.useCallback(
    (item: SidebarNavSubItem) => isRouteActive(item.href, pathname, searchParams, item.aliases),
    [pathname, searchParams]
  );

  const isChildActive = React.useCallback(
    (child: SidebarNavChild) => isRouteActive(child.href, pathname, searchParams),
    [pathname, searchParams]
  );

  return (
    <div className={cn("overflow-y-auto flex-1 px-3 pt-1.5 pb-2 space-y-3 thin-scrollbar", className)}>
      {navGroups.map((group) => {
        const isGroupCollapsed = Boolean(collapsedGroups[group.id]);

        return (
          <div key={group.id} className="space-y-0.5">
            {/* Group Section Header (Văn bản, Đơn vị) */}
            {group.label && !isCollapsed ? (
              <Pressable
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-1 px-2 pt-2.5 pb-1 text-xs font-medium text-muted-foreground select-none hover:text-foreground transition-colors text-left group/gh"
              >
                <span>{group.label}</span>
                <ChevronDown
                  size={11}
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
              <div className="space-y-px">
                {group.items.map((item) => {
                  const visibleChildren = item.children?.filter((c) => !c.requiresApprovalReport || canViewApprovalReport);
                  const hasActiveChild = Boolean(visibleChildren?.some(isChildActive));
                  const active = isItemActive(item) && !hasActiveChild;
                  const children = visibleChildren?.length ? visibleChildren : undefined;
                  const isExpanded = expandedItems[item.id] ?? true;

                  if (item.more) {
                    return (
                      <SidebarMoreMenu
                        key={item.id}
                        item={item}
                        isCollapsed={isCollapsed}
                        compact={compact}
                        onNavigate={onNavigate}
                      />
                    );
                  }

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
                              onMaintenance?.(item);
                              return;
                            }
                            onNavigate?.();
                          }}
                          aria-current={active ? "page" : undefined}
                          aria-label={item.label}
                          className={cn(navRowClass({ isCollapsed, compact, active }), !isCollapsed && children && "pr-7")}
                        >
                          <NavRowContent item={item} isCollapsed={isCollapsed} compact={compact} active={active} />
                        </Link>
                      </TooltipTrigger>
                      {isCollapsed && (
                        <TooltipContent side="right" sideOffset={8}>
                          <span>{item.label}</span>
                        </TooltipContent>
                      )}
                    </Tooltip>
                    {children && !isCollapsed ? (
                      <Pressable
                        aria-label={isExpanded ? `Thu gọn ${item.label}` : `Mở rộng ${item.label}`}
                        aria-expanded={isExpanded}
                        onClick={() =>
                          setExpandedItems((prev) => ({ ...prev, [item.id]: !isExpanded }))
                        }
                        className="absolute right-1 top-1/2 -translate-y-1/2 flex size-6 items-center justify-center rounded text-muted-foreground/70 hover:text-foreground hover:bg-muted/60 transition-colors"
                      >
                        <ChevronDown
                          size={12}
                          className={cn("transition-transform duration-150", !isExpanded && "-rotate-90")}
                        />
                      </Pressable>
                    ) : null}
                    </div>
                    {children && !isCollapsed && isExpanded ? (
                      <div className={cn(compact ? "ml-[14px]" : "ml-[15px]", "border-l border-border/60 pl-1.5 space-y-px")}>
                        {children.map((child) => {
                          const childActive = isChildActive(child);
                          return (
                            <Link
                              key={child.id}
                              href={child.href}
                              onClick={onNavigate}
                              aria-current={childActive ? "page" : undefined}
                              className={cn(
                                "flex items-center gap-2 px-2 h-7 rounded-sm text-compact tracking-tight transition-colors whitespace-nowrap",
                                childActive
                                  ? "bg-sidebar-accent text-foreground font-medium"
                                  : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60"
                              )}
                            >
                              <span className="truncate flex-1">{child.label}</span>
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
  );
}
