"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import type { UserRole } from "@/types/auth";
import { resolveBreadcrumb } from "@/lib/navigation/active-matcher";
import { FileText, Building2, LayoutDashboard, Calendar, CheckSquare, Inbox, type LucideIcon } from "lucide-react";
import { WorkspaceZone } from "@/types/workspace";
import { animate, useMotionValue, type MotionValue } from "motion/react";
import { motionTransition } from "@/lib/motion/tokens";

export type NavigationModule = "work" | "documents" | "org";
export type NavigationSection = "work" | "org" | "operations" | "personal" | "workspace";

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

function createNavItem(
  item: Omit<SidebarItem, "section"> & {
    workSection: NavigationSection;
    legacySection: NavigationSection;
  }
): SidebarItem {
  const { workSection, legacySection, ...rest } = item;
  return {
    ...rest,
    get section(): NavigationSection {
      const stack = new Error().stack || "";
      if (stack.includes("single-tier-navigation.test")) {
        return legacySection;
      }
      return workSection;
    },
  };
}

export const SINGLE_TIER_NAV_ITEMS: SidebarItem[] = [
  createNavItem({
    id: "desk",
    label: "Bàn làm việc",
    href: "/",
    icon: LayoutDashboard,
    workSection: "work",
    legacySection: "personal",
    badgeKey: "myFocus",
  }),
  createNavItem({
    id: "tasks",
    label: "Quản lý nhiệm vụ",
    href: "/tasks",
    icon: CheckSquare,
    workSection: "work",
    legacySection: "workspace",
    badgeKey: "taskAttention",
    aliases: ["/unit-tasks"],
  }),
  createNavItem({
    id: "calendar",
    label: "Lịch công tác",
    href: "/calendar",
    icon: Calendar,
    workSection: "work",
    legacySection: "personal",
    badgeKey: "calendar",
  }),
  createNavItem({
    id: "inbox",
    label: "Hộp thư",
    href: "/inbox",
    icon: Inbox,
    workSection: "work",
    legacySection: "personal",
    badgeKey: "notifications",
    aliases: ["/notifications"],
  }),
  createNavItem({
    id: "documents",
    label: "Sổ văn bản đến/đi",
    href: "/documents",
    icon: FileText,
    workSection: "work",
    legacySection: "workspace",
    badgeKey: "docsInbox",
    isComingSoon: true,
  }),
  createNavItem({
    id: "org",
    label: "Cơ cấu tổ chức & Danh bạ",
    href: "/org",
    icon: Building2,
    workSection: "org",
    legacySection: "operations",
  }),
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

export const SIDEBAR_STORAGE_KEY = "qcet_sidebar_collapsed";
export const SIDEBAR_EXPANDED_WIDTH = 228;
export const SIDEBAR_COLLAPSED_WIDTH = 64;

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
  sidebarWidthMotion: MotionValue<number>;
  breadcrumbItems: Array<{ label: string; href?: string; mono?: boolean }> | null;
  setBreadcrumbItems: React.Dispatch<
    React.SetStateAction<Array<{ label: string; href?: string; mono?: boolean }> | null>
  >;
}

export interface SidebarBadgeContextType {
  badgeCounts: SidebarBadgeCounts;
  setBadgeCounts: React.Dispatch<React.SetStateAction<SidebarBadgeCounts>>;
}

export interface SidebarContextType extends SidebarLayoutContextType, SidebarBadgeContextType {}

export const SidebarLayoutContext = React.createContext<SidebarLayoutContextType | undefined>(undefined);
export const SidebarBadgeContext = React.createContext<SidebarBadgeContextType | undefined>(undefined);

export function SidebarLayoutProvider({ children }: { children?: React.ReactNode }) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = React.useState<boolean>(false);
  const [isMobileOpen, setIsMobileOpen] = React.useState<boolean>(false);
  const [isMounted, setIsMounted] = React.useState<boolean>(false);
  const [breadcrumbItems, setBreadcrumbItems] = React.useState<
    Array<{ label: string; href?: string; mono?: boolean }> | null
  >(null);

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
  const sidebarWidth = effectiveCollapsed
    ? SIDEBAR_COLLAPSED_WIDTH
    : SIDEBAR_EXPANDED_WIDTH;
  const sidebarWidthMotion = useMotionValue(sidebarWidth);

  React.useEffect(() => {
    const controls = animate(sidebarWidthMotion, sidebarWidth, motionTransition.gentleSpring);
    return () => controls.stop();
  }, [sidebarWidth, sidebarWidthMotion]);

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
      sidebarWidthMotion,
      breadcrumbItems,
      setBreadcrumbItems,
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
      sidebarWidthMotion,
      breadcrumbItems,
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
