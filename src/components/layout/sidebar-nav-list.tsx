"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
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
  IconSidebarMore,
} from "@/components/layout/sidebar-rounded-icons";
import { useSidebar } from "@/components/layout/sidebar-context";
import { isRouteActive } from "@/lib/navigation/active-matcher";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Pressable } from "@/components/ui/pressable";
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
        icon: IconSidebarMore,
        aliases: ["/settings", "/more"],
      },
    ],
  },
];

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
      {SIDEBAR_NAV_GROUPS.map((group) => {
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
                  const Icon = item.icon;
                  const children = visibleChildren?.length ? visibleChildren : undefined;
                  const isExpanded = expandedItems[item.id] ?? true;

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
                          className={cn(
                            "group relative flex items-center transition-colors duration-150 select-none overflow-hidden whitespace-nowrap",
                            isCollapsed
                              ? "size-10 mx-auto justify-center rounded-xl p-0"
                              : cn(compact ? "gap-1.5" : "gap-2", "px-2 h-7 rounded-sm text-compact"),
                            !isCollapsed && children && "pr-7",
                            active
                              ? "bg-sidebar-accent text-foreground font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60 font-medium"
                          )}
                        >
                          <span className={cn(
                            "shrink-0 flex items-center justify-center",
                            isCollapsed ? "size-6" : compact ? "size-3.5" : "size-4"
                          )}>
                            <Icon
                              size={isCollapsed ? 18 : compact ? 14 : 16}
                              className={cn(
                                isCollapsed ? "size-4.5" : compact ? "size-3.5" : "size-4",
                                "shrink-0 transition-colors",
                                active
                                  ? "text-foreground"
                                  : "text-muted-foreground group-hover:text-foreground"
                              )}
                            />
                          </span>

                          {!isCollapsed && (
                            <>
                              <span className="truncate flex-1 text-compact tracking-tight">
                                {item.label}
                              </span>
                            </>
                          )}
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
