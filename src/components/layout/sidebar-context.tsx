"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/auth";
import { resolveBreadcrumb } from "@/lib/navigation/active-matcher";
import {
  Briefcase,
  FileText,
  Building2,
  LayoutDashboard,
  Calendar,
  Bell,
  CheckSquare,
  Inbox,
  Send,
  FileCheck,
  Archive,
  Users,
  LayoutGrid,
  Network,
  Home,
  FileBadge,
  Eye,
  Search,
  BookUser,
  CalendarDays,
  ClipboardList,
  Headphones,
  Settings,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceZone } from "@/types/workspace";

export type NavigationModule = "work" | "documents" | "org";
export type NavigationSection = "personal" | "workspace" | "operations";

export interface ModuleMeta {
  id: NavigationModule;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  defaultHref: string;
  description: string;
  isComingSoon?: boolean;
}

export const MODULES: ModuleMeta[] = [
  {
    id: "work",
    label: "Quản lý công việc",
    shortLabel: "Công việc",
    icon: Briefcase,
    defaultHref: "/",
    description: "Bàn làm việc, lịch công tác, kho nhiệm vụ",
  },
  {
    id: "documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    icon: FileText,
    defaultHref: "/documents",
    description: "Sổ văn bản đến/đi, tờ trình & ký số điện tử",
    isComingSoon: true,
  },
  {
    id: "org",
    label: "Cơ cấu & Danh bạ",
    shortLabel: "Cơ cấu",
    icon: Building2,
    defaultHref: "/org",
    description: "Sơ đồ tổ chức 11 đơn vị, nhân sự",
  },
];

export interface SidebarItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  section: NavigationSection;
  badgeKey?: string;
  isComingSoon?: boolean;
  isMaintenance?: boolean;
  hasSubmenu?: boolean;
  aliases?: string[];
  allowedRoles?: UserRole[];
}

export const MODULE_NAV_ITEMS: Record<NavigationModule, SidebarItem[]> = {
  work: [
    {
      id: "desk",
      label: "Bàn làm việc",
      href: "/",
      icon: LayoutDashboard,
      section: "personal",
      badgeKey: "myFocus",
    },
    {
      id: "calendar",
      label: "Lịch công tác",
      href: "/calendar",
      icon: Calendar,
      section: "personal",
      badgeKey: "calendar",
    },
    {
      id: "notifications",
      label: "Thông báo",
      href: "/notifications",
      icon: Bell,
      section: "personal",
      badgeKey: "notifications",
    },
    {
      id: "tasks",
      label: "Kho nhiệm vụ",
      href: "/tasks",
      icon: CheckSquare,
      section: "workspace",
      badgeKey: "allTasks",
    },
  ],
  documents: [
    {
      id: "docs-inbox",
      label: "Văn bản đến",
      href: "/documents?tab=inbox",
      icon: Inbox,
      section: "personal",
      badgeKey: "docsInbox",
      hasSubmenu: true,
    },
    {
      id: "docs-outbox",
      label: "Văn bản đi",
      href: "/documents?tab=outbox",
      icon: Send,
      section: "personal",
      badgeKey: "docsOutbox",
      hasSubmenu: true,
    },
    {
      id: "docs-starred",
      label: "Văn bản đánh dấu",
      href: "/maintenance?feature=starred-docs&title=V%C4%83n%20b%E1%BA%A3n%20%C4%91%C3%A1nh%20d%E1%BA%A5u",
      icon: FileBadge,
      section: "personal",
      isMaintenance: true,
    },
    {
      id: "docs-fyi",
      label: "Văn bản xem để biết",
      href: "/maintenance?feature=fyi-docs&title=V%C4%83n%20b%E1%BA%A3n%20xem%20%C4%91%E1%BB%83%20bi%E1%BA%BFt",
      icon: Eye,
      section: "personal",
      isMaintenance: true,
    },
    {
      id: "docs-search",
      label: "Tra cứu văn bản",
      href: "/maintenance?feature=search-docs&title=Tra%20c%E1%BB%A9u%20v%C4%83n%20b%E1%BA%A3n",
      icon: Search,
      section: "workspace",
      isMaintenance: true,
    },
    {
      id: "docs-pending",
      label: "Tờ trình duyệt",
      href: "/documents?tab=pending",
      icon: FileCheck,
      section: "workspace",
      badgeKey: "docsPending",
    },
    {
      id: "docs-archive",
      label: "Sổ lưu trữ toàn trường",
      href: "/documents?tab=archive",
      icon: Archive,
      section: "workspace",
    },
  ],
  org: [
    {
      id: "org-structure",
      label: "Sơ đồ tổ chức",
      href: "/org",
      icon: Building2,
      section: "workspace",
    },
    {
      id: "org-directory",
      label: "Danh bạ cán bộ",
      href: "/org?tab=directory",
      icon: Users,
      section: "workspace",
    },
  ],
};

export const SINGLE_TIER_NAV_ITEMS: SidebarItem[] = [
  // SECTION 1: ĐIỀU HÀNH & CÁ NHÂN (OPERATIONS & PERSONAL)
  {
    id: "desk",
    label: "Bàn làm việc",
    href: "/",
    icon: LayoutDashboard,
    section: "personal",
    badgeKey: "myFocus",
  },
  {
    id: "calendar",
    label: "Lịch công tác",
    href: "/calendar",
    icon: Calendar,
    section: "personal",
    badgeKey: "calendar",
  },
  {
    id: "notifications",
    label: "Thông báo & Hoạt động",
    href: "/notifications",
    icon: Bell,
    section: "personal",
    badgeKey: "notifications",
  },
  // SECTION 2: NGHIỆP VỤ CỐT LÕI (CORE MODULES)
  {
    id: "tasks",
    label: "Quản lý nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
    section: "workspace",
    badgeKey: "allTasks",
    aliases: ["/unit-tasks"],
  },
  {
    id: "documents",
    label: "Sổ văn bản đến/đi",
    href: "/documents",
    icon: FileText,
    section: "workspace",
    badgeKey: "docsInbox",
    isComingSoon: true,
  },
  // SECTION 3: HỆ THỐNG & TỔ CHỨC (SYSTEM & DIRECTORY)
  {
    id: "org",
    label: "Cơ cấu tổ chức & Danh bạ",
    href: "/org",
    icon: Building2,
    section: "operations",
  },
];

export interface QCETMenuItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  isMaintenance?: boolean;
  hasSubmenu?: boolean;
  badge?: string;
  badgeVariant?: "primary" | "sky" | "muted" | "danger";
}

/**
 * Danh mục chuẩn Chuyển đổi số Trường CĐ KTCN Quy Nhơn (Version 2.4.3)
 * Bao gồm đầy đủ 12 mục theo cấu trúc hệ thống nhà trường.
 */
export const QCET_CDS_MENU_ITEMS: QCETMenuItem[] = [
  {
    id: "home",
    label: "Trang chủ",
    href: "/",
    icon: Home,
  },
  {
    id: "docs-inbox",
    label: "Văn bản đến",
    href: "/documents?tab=inbox",
    icon: FileText,
    hasSubmenu: true,
  },
  {
    id: "docs-outbox",
    label: "Văn bản đi",
    href: "/documents?tab=outbox",
    icon: FileText,
    hasSubmenu: true,
  },
  {
    id: "docs-starred",
    label: "Văn bản đánh dấu",
    href: "/maintenance?feature=starred-docs&title=V%C4%83n%20b%E1%BA%A3n%20%C4%91%C3%A1nh%20d%E1%BA%A5u",
    icon: FileBadge,
    isMaintenance: true,
  },
  {
    id: "docs-fyi",
    label: "Văn bản xem để biết",
    href: "/maintenance?feature=fyi-docs&title=V%C4%83n%20b%E1%BA%A3n%20xem%20%C4%91%E1%BB%83%20bi%E1%BA%BFt",
    icon: Eye,
    isMaintenance: true,
  },
  {
    id: "docs-search",
    label: "Tra cứu văn bản",
    href: "/maintenance?feature=search-docs&title=Tra%20c%E1%BB%A9u%20v%C4%83n%20b%E1%BA%A3n",
    icon: Search,
    isMaintenance: true,
  },
  {
    id: "org-directory",
    label: "Danh bạ",
    href: "/org?tab=directory",
    icon: BookUser,
  },
  {
    id: "unit-calendar",
    label: "Quản lý lịch đơn vị",
    href: "/calendar",
    icon: CalendarDays,
    hasSubmenu: true,
  },
  {
    id: "task-management",
    label: "Quản lý công việc",
    href: "/tasks",
    icon: ClipboardList,
    hasSubmenu: true,
  },
  {
    id: "executive-info",
    label: "Thông tin điều hành",
    href: "/notifications",
    icon: Headphones,
    hasSubmenu: true,
  },
  {
    id: "system-settings",
    label: "Cài đặt hệ thống",
    href: "/maintenance?feature=settings&title=C%C3%A0i%20%C4%91%E1%BA%B7t%20h%E1%BB%87%20th%E1%BB%91ng",
    icon: Settings,
    hasSubmenu: true,
    isMaintenance: true,
  },
  {
    id: "logout",
    label: "Đăng xuất",
    href: "/maintenance?feature=logout&title=%C4%90%C4%83ng%20xu%E1%BA%A5t",
    icon: LogOut,
    isMaintenance: true,
  },
];

export function resolveModuleFromPathname(pathname: string): NavigationModule {
  if (!pathname) return "work";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/org")) return "org";
  return "work";
}

export interface NavigationItem {
  href: string;
  label: string;
  icon: LucideIcon;
  zone?: WorkspaceZone;
  badge?: string;
  badgeVariant?: "primary" | "warning" | "danger" | "muted" | "sky";
}

export interface SidebarBadgeCounts {
  tasks?: number | string;
  calendar?: number | string;
  org?: number | string;
  notifications?: number | string;
  myFocus?: number | string;
  allTasks?: number | string;
  [key: string]: number | string | undefined;
}

export const DEFAULT_SIDEBAR_BADGES: SidebarBadgeCounts = {
  calendar: 0,
  notifications: 0,
  docsInbox: 0,
  docsOutbox: 0,
  docsPending: 0,
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/", label: "Quản lý công việc", icon: CheckSquare },
  { href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: Network },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

export const SIDEBAR_ZONE_ITEMS: NavigationItem[] = [
  { href: "/", label: "Bàn làm việc", icon: LayoutDashboard, zone: "dashboard" },
  { href: "/tasks", label: "Kho nhiệm vụ", icon: CheckSquare, zone: "tasks" },
  { href: "/calendar", label: "Lịch công tác", icon: Calendar, zone: "calendar" },
  { href: "/documents", label: "Sổ văn bản đến/đi", icon: FileText, zone: "documents" },
  { href: "/org", label: "Sơ đồ tổ chức & Nhân sự", icon: Network, zone: "org" },
  { href: "/notifications", label: "Thông báo & Nhắc việc", icon: Bell },
];

export const SIDEBAR_STORAGE_KEY = "qcet_sidebar_collapsed";

export { resolveBreadcrumb };

export interface SidebarLayoutContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  currentModule: NavigationModule;
  setCurrentModule: (module: NavigationModule) => void;
  isMounted: boolean;
  sidebarWidth: number;
}

export interface SidebarBadgeContextType {
  badgeCounts: SidebarBadgeCounts;
  setBadgeCounts: React.Dispatch<React.SetStateAction<SidebarBadgeCounts>>;
}

export interface SidebarContextType extends SidebarLayoutContextType, SidebarBadgeContextType {}

export type SidebarContextValue = SidebarContextType;

export const SidebarLayoutContext = React.createContext<SidebarLayoutContextType | undefined>(undefined);
export const SidebarBadgeContext = React.createContext<SidebarBadgeContextType | undefined>(undefined);
const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function SidebarLayoutProvider({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState<boolean>(false);

  const currentModule = React.useMemo<NavigationModule>(() => {
    return resolveModuleFromPathname(pathname || "");
  }, [pathname]);

  const setCurrentModule = React.useCallback((_module: NavigationModule) => {
    // Pure derivation from pathname, setter retained for interface contract compatibility
  }, []);

  React.useEffect(() => {
    setIsMounted(true);
    try {
      const saved = localStorage.getItem(SIDEBAR_STORAGE_KEY);
      if (saved !== null) {
        setIsCollapsed(saved === "true");
      }
    } catch {
      // safe fallback if storage unavailable
    }
  }, []);

  const toggleCollapse = React.useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // safe fallback
      }
      return next;
    });
  }, []);

  const setCollapsed = React.useCallback((val: boolean) => {
    setIsCollapsed(val);
    try {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(val));
    } catch {
      // safe fallback
    }
  }, []);

  const toggleMobile = React.useCallback(() => {
    setIsMobileOpen((prev) => !prev);
  }, []);

  const effectiveCollapsed = isMounted ? isCollapsed : false;
  const sidebarWidth = effectiveCollapsed ? 64 : 248;

  const value = React.useMemo<SidebarLayoutContextType>(
    () => ({
      isCollapsed: effectiveCollapsed,
      toggleCollapse,
      setCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleMobile,
      currentModule,
      setCurrentModule,
      isMounted,
      sidebarWidth,
    }),
    [
      effectiveCollapsed,
      toggleCollapse,
      setCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleMobile,
      currentModule,
      isMounted,
      sidebarWidth,
    ]
  );

  return (
    <SidebarLayoutContext.Provider value={value}>
      {children}
    </SidebarLayoutContext.Provider>
  );
}

export function SidebarBadgeProvider({
  children,
  initialBadges = DEFAULT_SIDEBAR_BADGES,
}: {
  children?: React.ReactNode;
  initialBadges?: SidebarBadgeCounts;
}) {
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>(initialBadges);

  const value = React.useMemo<SidebarBadgeContextType>(
    () => ({
      badgeCounts,
      setBadgeCounts,
    }),
    [badgeCounts]
  );

  return (
    <SidebarBadgeContext.Provider value={value}>
      {children}
    </SidebarBadgeContext.Provider>
  );
}

export function SidebarProvider({ children }: { children?: React.ReactNode }) {
  return (
    <SidebarLayoutProvider>
      <SidebarBadgeProvider>{children}</SidebarBadgeProvider>
    </SidebarLayoutProvider>
  );
}

export function useSidebarLayout(): SidebarLayoutContextType {
  const context = React.useContext(SidebarLayoutContext);
  if (!context) {
    throw new Error("useSidebarLayout must be used within a SidebarLayoutProvider or SidebarProvider");
  }
  return context;
}

export function useSidebarBadges(): SidebarBadgeContextType {
  const context = React.useContext(SidebarBadgeContext);
  if (!context) {
    throw new Error("useSidebarBadges must be used within a SidebarBadgeProvider or SidebarProvider");
  }
  return context;
}

export function useSidebar(): SidebarContextType {
  const layout = useSidebarLayout();
  const badges = useSidebarBadges();
  return React.useMemo<SidebarContextType>(
    () => ({
      ...layout,
      ...badges,
    }),
    [layout, badges]
  );
}

export const useSidebarContext = useSidebar;

