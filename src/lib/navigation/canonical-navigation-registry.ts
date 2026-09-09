import type { WorkspaceZone } from "@/types/workspace";

export type NavigationSection = "personal" | "workspace" | "operations";

export interface CanonicalRouteConfig {
  id: string;
  href: string;
  label: string;
  shortLabel: string;
  section: NavigationSection;
  iconName: "LayoutDashboard" | "Calendar" | "CheckSquare" | "FileText" | "Building2" | "Bell" | "Settings";
  zone?: WorkspaceZone;
  badgeKey?: "calendar" | "notifications" | "docsInbox" | "docsOutbox" | "docsPending";
  aliases?: string[];
  mobilePlacement?: "bottom-bar" | "drawer" | "none";
  order: number;
}

export const CANONICAL_ROUTES: readonly CanonicalRouteConfig[] = [
  {
    id: "desk",
    href: "/",
    label: "Bàn làm việc",
    shortLabel: "Bàn làm việc",
    section: "personal",
    iconName: "LayoutDashboard",
    zone: "dashboard",
    aliases: ["/dashboard"],
    mobilePlacement: "bottom-bar",
    order: 1,
  },
  {
    id: "calendar",
    href: "/calendar",
    label: "Lịch công tác",
    shortLabel: "Lịch tuần",
    section: "personal",
    iconName: "Calendar",
    zone: "calendar",
    badgeKey: "calendar",
    aliases: ["/?zone=calendar", "/?view=calendar", "/?view=month"],
    mobilePlacement: "drawer",
    order: 2,
  },
  {
    id: "tasks",
    href: "/tasks",
    label: "Quản lý nhiệm vụ",
    shortLabel: "Nhiệm vụ",
    section: "workspace",
    iconName: "CheckSquare",
    zone: "tasks",
    aliases: ["/unit-tasks", "/?zone=tasks"],
    mobilePlacement: "bottom-bar",
    order: 3,
  },
  {
    id: "documents",
    href: "/documents",
    label: "Văn bản & Công văn",
    shortLabel: "Văn bản",
    section: "workspace",
    iconName: "FileText",
    zone: "documents",
    badgeKey: "docsInbox",
    aliases: ["/?zone=documents"],
    mobilePlacement: "drawer",
    order: 4,
  },
  {
    id: "org",
    href: "/org",
    label: "Cơ cấu & Danh bạ",
    shortLabel: "Tổ chức",
    section: "operations",
    iconName: "Building2",
    zone: "org",
    aliases: ["/?zone=org"],
    mobilePlacement: "drawer",
    order: 5,
  },
  {
    id: "notifications",
    href: "/notifications",
    label: "Thông báo & Nhắc việc",
    shortLabel: "Thông báo",
    section: "personal",
    iconName: "Bell",
    badgeKey: "notifications",
    mobilePlacement: "bottom-bar",
    order: 6,
  },
  {
    id: "settings",
    href: "/settings",
    label: "Cài đặt hệ thống",
    shortLabel: "Cài đặt",
    section: "operations",
    iconName: "Settings",
    mobilePlacement: "drawer",
    order: 7,
  },
] as const;

export const CANONICAL_ZONES: readonly WorkspaceZone[] = [
  "dashboard",
  "calendar",
  "tasks",
  "documents",
  "org",
] as const;

export function getSidebarNavItems(): CanonicalRouteConfig[] {
  return [...CANONICAL_ROUTES].sort((a, b) => a.order - b.order);
}

export function getMobileBottomNavItems(): CanonicalRouteConfig[] {
  return CANONICAL_ROUTES.filter((r) => r.mobilePlacement === "bottom-bar").sort((a, b) => a.order - b.order);
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

export const CANONICAL_NAV_ITEMS = {
  WORKBENCH: {
    id: "desk",
    href: "/",
    label: "Bàn làm việc",
    iconName: "LayoutDashboard" as const,
  },
  TASKS: {
    id: "tasks",
    href: "/tasks",
    label: "Nhiệm vụ",
    iconName: "CheckSquare" as const,
  },
  CALENDAR: {
    id: "calendar",
    href: "/calendar",
    label: "Lịch công tác",
    iconName: "Calendar" as const,
  },
  DOCUMENTS: {
    id: "documents",
    href: "/documents",
    label: "Sổ văn bản",
    iconName: "FileText" as const,
  },
  ORG: {
    id: "org",
    href: "/org",
    label: "Cơ cấu & Danh bạ",
    iconName: "Building2" as const,
  },
} as const;

export interface ResolveTasksUrlOptions {
  scope?: "school" | "unit" | "my";
  category?: string;
  view?: string;
  departmentCode?: string;
}

export function resolveTasksUrl(options: ResolveTasksUrlOptions = {}): string {
  const params = new URLSearchParams();
  if (options.scope) {
    params.set("scope", options.scope);
  }
  if (options.category) {
    params.set("category", options.category);
  }
  if (options.view) {
    params.set("view", options.view);
  }
  if (options.departmentCode) {
    params.set("departmentCode", options.departmentCode);
  }

  const query = params.toString();
  return query ? `/tasks?${query}` : "/tasks";
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
