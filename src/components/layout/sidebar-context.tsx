"use client";

import * as React from "react";
import {
  LayoutGrid,
  CheckSquare,
  LayoutDashboard,
  Calendar,
  Network,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { WorkspaceZone } from "@/types/workspace";

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
}

export const DEFAULT_SIDEBAR_BADGES: SidebarBadgeCounts = {
  tasks: 304,
  calendar: 7,
  org: 11,
  notifications: 5,
};

export const NAVIGATION_ITEMS: NavigationItem[] = [
  { href: "/", label: "Quản lý công việc", icon: CheckSquare },
  { href: "/dashboard", label: "Báo cáo KPI", icon: LayoutDashboard },
  { href: "/org", label: "Cơ cấu & Danh bạ", icon: Network },
  { href: "/notifications", label: "Thông báo", icon: Bell },
];

export const SIDEBAR_ZONE_ITEMS: NavigationItem[] = [
  { href: "/?zone=portal", label: "Cổng Portal", icon: LayoutGrid, zone: "portal" },
  { href: "/?zone=dashboard", label: "Dashboard Điều hành", icon: LayoutDashboard, zone: "dashboard" },
  { href: "/?zone=tasks", label: "Quản lý công việc", icon: CheckSquare, zone: "tasks", badge: "304", badgeVariant: "primary" },
  { href: "/?zone=calendar", label: "Lịch công tác", icon: Calendar, zone: "calendar", badge: "7", badgeVariant: "sky" },
  { href: "/?zone=org", label: "Cơ cấu & Danh bạ", icon: Network, zone: "org", badge: "11", badgeVariant: "muted" },
  { href: "/notifications", label: "Thông báo", icon: Bell, badge: "5", badgeVariant: "danger" },
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

  if (path.startsWith("/unit-tasks")) return ["QCET E-Office", "Công việc Đơn vị"];
  if (path.startsWith("/tasks")) return ["QCET E-Office", "Nhiệm vụ cấp Trường"];
  if (path.startsWith("/calendar")) return ["QCET E-Office", "Lịch công tác"];
  if (path.startsWith("/dashboard")) return ["QCET E-Office", "Báo cáo & Thống kê KPI"];
  if (path.startsWith("/org")) return ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"];
  if (path.startsWith("/notifications")) return ["QCET E-Office", "Thông báo điều hành"];
  if (path.startsWith("/login")) return ["QCET E-Office", "Đăng nhập"];

  return ["QCET E-Office", "Tổng quan"];
}

interface SidebarContextValue {
  isCollapsed: boolean;
  toggleCollapse: () => void;
  setCollapsed: (collapsed: boolean) => void;
  isMobileOpen: boolean;
  setIsMobileOpen: (open: boolean) => void;
  toggleMobile: () => void;
  badgeCounts: SidebarBadgeCounts;
  setBadgeCounts: React.Dispatch<React.SetStateAction<SidebarBadgeCounts>>;
}

const SidebarContext = React.createContext<SidebarContextValue | undefined>(undefined);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [mounted, setMounted] = React.useState<boolean>(false);
  const [badgeCounts, setBadgeCounts] = React.useState<SidebarBadgeCounts>(DEFAULT_SIDEBAR_BADGES);

  React.useEffect(() => {
    setMounted(true);
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

  const value = React.useMemo(
    () => ({
      isCollapsed: mounted ? isCollapsed : false,
      toggleCollapse,
      setCollapsed,
      isMobileOpen,
      setIsMobileOpen,
      toggleMobile,
      badgeCounts,
      setBadgeCounts,
    }),
    [isCollapsed, isMobileOpen, mounted, setCollapsed, setIsMobileOpen, toggleCollapse, toggleMobile, badgeCounts]
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
}
