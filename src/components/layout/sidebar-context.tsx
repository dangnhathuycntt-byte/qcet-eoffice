"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
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
  type LucideIcon,
} from "lucide-react";
import { WorkspaceZone } from "@/types/workspace";

export type NavigationModule = "work" | "documents" | "org";
export type NavigationSection = "personal" | "workspace";

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
    shortLabel: "Công văn",
    icon: FileText,
    defaultHref: "/documents",
    isComingSoon: true,
    description: "Công văn đến/đi, tờ trình, ký số (Đang phát triển)",
  },
  {
    id: "org",
    label: "Cơ cấu & Danh bạ",
    shortLabel: "Tổ chức",
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
      label: "Công văn đến",
      href: "/documents?tab=inbox",
      icon: Inbox,
      section: "personal",
      isComingSoon: true,
    },
    {
      id: "docs-outbox",
      label: "Công văn đi & Tờ trình",
      href: "/documents?tab=outbox",
      icon: Send,
      section: "personal",
      isComingSoon: true,
    },
    {
      id: "docs-pending",
      label: "Chờ ký duyệt",
      href: "/documents?tab=pending",
      icon: FileCheck,
      section: "workspace",
      isComingSoon: true,
    },
    {
      id: "docs-archive",
      label: "Sổ văn bản",
      href: "/documents?tab=archive",
      icon: Archive,
      section: "workspace",
      isComingSoon: true,
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
  notifications: 5,
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
  { href: "/org", label: "Sơ đồ tổ chức & Nhân sự", icon: Network, zone: "org" },
  { href: "/notifications", label: "Thông báo & Nhắc việc", icon: Bell, badge: "5", badgeVariant: "danger" },
];

export const SIDEBAR_STORAGE_KEY = "qcet_sidebar_collapsed";

export function resolveBreadcrumb(
  pathname: string,
  searchParams?: string | URLSearchParams | null
): [string, string] {
  let path = pathname || "/";
  let zone: string | null = null;

  // Extract query if contained in pathname (e.g. "/?zone=portal")
  if (path.includes("?")) {
    const parts = path.split("?");
    path = parts[0] || "/";
    const queryStr = parts.slice(1).join("?");
    if (!searchParams && queryStr) {
      searchParams = queryStr;
    }
  }

  // Extract zone from searchParams (supports URLSearchParams, query string, or direct zone name)
  if (searchParams) {
    if (typeof searchParams === "object" && typeof searchParams.get === "function") {
      zone = searchParams.get("zone");
    } else if (typeof searchParams === "string") {
      const trimmed = searchParams.startsWith("?") ? searchParams.slice(1) : searchParams;
      if (trimmed.includes("=")) {
        try {
          zone = new URLSearchParams(trimmed).get("zone");
        } catch {
          zone = null;
        }
      } else {
        zone = trimmed;
      }
    }
  }

  // Zone overrides
  if (zone) {
    if (zone === "portal") return ["QCET E-Office", "Cổng Portal Điều hành"];
    if (zone === "dashboard") return ["QCET E-Office", "Dashboard Điều hành & KPI"];
    if (zone === "tasks") return ["QCET E-Office", "Quản lý công việc"];
    if (zone === "calendar") return ["QCET E-Office", "Lịch công tác"];
    if (zone === "org") return ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"];
  }

  if (path === "/") {
    return ["QCET E-Office", "Quản lý công việc"];
  }

  if (path.startsWith("/documents")) return ["QCET E-Office", "Văn bản & Công văn"];
  if (path.startsWith("/unit-tasks")) return ["QCET E-Office", "Công việc Đơn vị"];
  if (path.startsWith("/tasks")) return ["QCET E-Office", "Nhiệm vụ cấp Trường"];
  if (path.startsWith("/calendar")) return ["QCET E-Office", "Lịch công tác"];
  if (path.startsWith("/dashboard")) return ["QCET E-Office", "Báo cáo & Thống kê KPI"];
  if (path.startsWith("/org")) return ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"];
  if (path.startsWith("/notifications")) return ["QCET E-Office", "Thông báo điều hành"];
  if (path.startsWith("/login")) return ["QCET E-Office", "Đăng nhập"];

  return ["QCET E-Office", "Tổng quan"];
}

export interface SidebarContextType {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  badgeCounts: SidebarBadgeCounts;
  setBadgeCounts: React.Dispatch<React.SetStateAction<SidebarBadgeCounts>>;
  currentModule: NavigationModule;
  setCurrentModule: (module: NavigationModule) => void;
  isMounted: boolean;
  sidebarWidth: number;
}

export type SidebarContextValue = SidebarContextType;

const SidebarContext = React.createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState<boolean>(false);
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>(DEFAULT_SIDEBAR_BADGES);

  const [currentModule, setCurrentModule] = React.useState<NavigationModule>(() =>
    resolveModuleFromPathname(pathname || "")
  );
  const lastPathnameRef = React.useRef(pathname);

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

  React.useEffect(() => {
    if (pathname && pathname !== lastPathnameRef.current) {
      lastPathnameRef.current = pathname;
      setCurrentModule(resolveModuleFromPathname(pathname));
    }
  }, [pathname]);

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
  const sidebarWidth = effectiveCollapsed ? 112 : 280;

  const value = React.useMemo<SidebarContextType>(
    () => ({
      isCollapsed: effectiveCollapsed,
      toggleCollapse,
      setCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleMobile,
      badgeCounts,
      setBadgeCounts,
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
      badgeCounts,
      currentModule,
      isMounted,
      sidebarWidth,
    ]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar(): SidebarContextType {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
