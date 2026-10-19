import type { WorkspaceZone } from "@qcet/contracts/types/workspace";

export type NavigationSection = "work" | "org" | "operations" | "personal" | "workspace";

export interface CanonicalRouteConfig {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  section: NavigationSection;
  iconName: "LayoutDashboard" | "Calendar" | "CheckSquare" | "FileText" | "Building2" | "Bell" | "Settings" | "Inbox";
  zone?: WorkspaceZone;
  badgeKey?: "calendar" | "notifications" | "docsInbox" | "docsOutbox" | "docsPending" | "tasks" | "taskAttention";
  aliases?: string[];
  mobilePlacement?: "bottom-bar" | "drawer" | "none";
  mobileOrder?: number;
  order: number;
}

export const CANONICAL_ROUTES: readonly CanonicalRouteConfig[] = [
  {
    id: "desk",
    href: "/",
    label: "Tổng quan",
    shortLabel: "Tổng quan",
    section: "work",
    iconName: "LayoutDashboard",
    zone: "dashboard",
    badgeKey: "tasks",
    aliases: ["/dashboard", "/workbench"],
    mobilePlacement: "none",
    order: 1,
  },
  {
    id: "tasks",
    href: "/tasks",
    label: "Nhiệm vụ",
    shortLabel: "Nhiệm vụ",
    section: "work",
    iconName: "CheckSquare",
    zone: "tasks",
    badgeKey: "taskAttention",
    aliases: ["/unit-tasks", "/?zone=tasks"],
    mobilePlacement: "bottom-bar",
    mobileOrder: 1,
    order: 2,
  },
  {
    id: "calendar",
    href: "/calendar",
    label: "Lịch công tác",
    shortLabel: "Lịch",
    section: "work",
    iconName: "Calendar",
    zone: "calendar",
    badgeKey: "calendar",
    aliases: ["/?zone=calendar", "/?view=calendar", "/?view=month"],
    mobilePlacement: "bottom-bar",
    mobileOrder: 2,
    order: 3,
  },
  {
    id: "inbox",
    href: "/inbox",
    label: "Hộp thư",
    shortLabel: "Hộp thư",
    section: "work",
    iconName: "Inbox",
    badgeKey: "notifications",
    aliases: ["/notifications"],
    mobilePlacement: "bottom-bar",
    mobileOrder: 3,
    order: 4,
  },
  {
    id: "documents",
    href: "/documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    section: "work",
    iconName: "FileText",
    zone: "documents",
    badgeKey: "docsInbox",
    aliases: ["/?zone=documents"],
    mobilePlacement: "bottom-bar",
    mobileOrder: 4,
    order: 5,
  },
  {
    id: "org",
    href: "/org",
    label: "Cơ cấu & Danh bạ",
    shortLabel: "Tổ chức",
    section: "org",
    iconName: "Building2",
    zone: "org",
    aliases: ["/?zone=org"],
    mobilePlacement: "drawer",
    order: 6,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Cài đặt hệ thống",
    shortLabel: "Cài đặt",
    section: "org",
    iconName: "Settings",
    mobilePlacement: "drawer",
    order: 7,
  },
] as const;

export function getSidebarNavItems(): CanonicalRouteConfig[] {
  return [...CANONICAL_ROUTES].sort((a, b) => a.order - b.order);
}

export function getMobileBottomNavItems(): CanonicalRouteConfig[] {
  return CANONICAL_ROUTES.filter((r) => r.mobilePlacement === "bottom-bar").sort(
    (a, b) => (a.mobileOrder ?? a.order) - (b.mobileOrder ?? b.order)
  );
}

export const getMobileBottomBarItems = getMobileBottomNavItems;

export function getMobileDrawerItems(): CanonicalRouteConfig[] {
  return CANONICAL_ROUTES.filter((r) => r.mobilePlacement === "drawer").sort((a, b) => a.order - b.order);
}

export function getRouteByPath(pathname: string): CanonicalRouteConfig | undefined {
  const cleanPath = pathname.split("?")[0].split("#")[0].trim();
  return CANONICAL_ROUTES.find(
    (r) => r.href === cleanPath || r.aliases?.some((alias) => alias === cleanPath || cleanPath.startsWith(`${alias}/`))
  );
}

export function resolveCanonicalHref(pathname: string, searchParams?: URLSearchParams | string): string {
  const cleanPath = pathname.split("?")[0].split("#")[0].trim();
  const params = typeof searchParams === "string" ? new URLSearchParams(searchParams) : searchParams;

  if (cleanPath === "/dashboard") {
    return "/";
  }

  if (cleanPath === "/unit-tasks") {
    return "/tasks?scope=unit";
  }

  if (cleanPath === "/" && params?.get("zone") === "tasks") {
    return "/tasks";
  }

  const route = getRouteByPath(cleanPath);
  return route ? route.href : cleanPath;
}

export { isRouteActive } from "./active-matcher";
