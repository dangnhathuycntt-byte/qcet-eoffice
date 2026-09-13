/**
 * Routing and Navigation Active Matcher & Breadcrumbs Helper
 * QCET E-Office Light-Only Standard
 */

import {
  CANONICAL_ROUTES,
  getRouteByPath,
  resolveCanonicalHref,
} from "./canonical-navigation-registry";

/**
 * Normalizes a URL path by stripping query strings, hash fragments,
 * whitespace, and trailing slashes (while preserving root '/').
 */
export function normalizePath(path: string): string {
  if (!path) return "/";
  const clean = path.split("?")[0].split("#")[0].trim();
  const stripped = clean.replace(/\/+$/, "");
  return stripped || "/";
}

/**
 * Determines whether a given navigation route is active based on
 * current pathname, search parameters, and route aliases.
 * Boundary-safe matching prevents prefix collisions (e.g. /tasks vs /tasks-archive).
 */
export function isRouteActive(
  targetHref: string,
  currentPathname: string,
  searchParams?: URLSearchParams | null,
  aliases?: string[]
): boolean {
  if (!targetHref || !currentPathname) return false;

  const pathname = normalizePath(currentPathname);

  // Handle targetHref containing query parameters (e.g. /documents?tab=inbox)
  if (targetHref.includes("?")) {
    const [targetPath, targetQuery] = targetHref.split("?");
    const normalizedTargetPath = normalizePath(targetPath);
    if (pathname !== normalizedTargetPath) return false;
    if (!searchParams) return false;
    const targetParams = new URLSearchParams(targetQuery);
    for (const [key, val] of targetParams.entries()) {
      if (searchParams.get(key) !== val) {
        return false;
      }
    }
    return true;
  }

  const targetBase = normalizePath(targetHref);
  const zone = searchParams?.get("zone")?.toLowerCase();
  const view = searchParams?.get("view")?.toLowerCase();

  // 1. Phân định Bàn làm việc ("/" or "/dashboard")
  if (targetBase === "/" || targetBase === "/dashboard") {
    if (pathname === "/dashboard") return true;
    if (pathname === "/") {
      if (zone && ["tasks", "calendar", "documents", "org"].includes(zone)) {
        return false;
      }
      if (view && ["calendar", "month"].includes(view)) {
        return false;
      }
      return true;
    }
    return false;
  }

  // 2. Khi đang ở "/" kèm query zone hoặc view tương ứng
  if (pathname === "/") {
    if (targetBase === "/tasks" && zone === "tasks") return true;
    if (targetBase === "/calendar" && (zone === "calendar" || view === "calendar" || view === "month")) return true;
    if (targetBase === "/documents" && zone === "documents") return true;
    if (targetBase === "/org" && zone === "org") return true;
  }

  // 3. Khớp chính xác Pathname
  if (pathname === targetBase) return true;

  // 4. Khớp Aliases (kết hợp aliases tham số với CANONICAL_ROUTES)
  const canonicalRoute = CANONICAL_ROUTES.find((r) => normalizePath(r.href) === targetBase);
  const combinedAliases = [
    ...(aliases || []),
    ...(canonicalRoute?.aliases || []),
  ];

  if (combinedAliases.length > 0) {
    for (const alias of combinedAliases) {
      if (alias.includes("?")) continue;
      const cleanAlias = normalizePath(alias);
      if (pathname === cleanAlias || pathname.startsWith(`${cleanAlias}/`)) {
        return true;
      }
    }
  }

  // 5. Khớp Subroutes phân cấp an toàn (boundary safety)
  if (targetBase !== "/" && pathname.startsWith(`${targetBase}/`)) {
    return true;
  }

  return false;
}

/**
 * Resolves breadcrumb titles [rootTitle, pageTitle] from current pathname and search params.
 */
export function resolveBreadcrumb(
  pathname: string,
  searchParams?: URLSearchParams | string | null
): [string, string] {
  let path = pathname || "/";
  let zone: string | null = null;
  let view: string | null = null;
  let scope: string | null = null;

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
    if (typeof searchParams === "object" && typeof (searchParams as URLSearchParams).get === "function") {
      zone = (searchParams as URLSearchParams).get("zone");
      view = (searchParams as URLSearchParams).get("view");
      scope = (searchParams as URLSearchParams).get("scope");
    } else if (typeof searchParams === "string") {
      const trimmed = searchParams.startsWith("?") ? searchParams.slice(1) : searchParams;
      if (trimmed.includes("=")) {
        try {
          const sp = new URLSearchParams(trimmed);
          zone = sp.get("zone");
          view = sp.get("view");
          scope = sp.get("scope");
        } catch {
          zone = null;
        }
      } else {
        zone = trimmed;
      }
    }
  }

  // T88: zone and query overrides resolve through the canonical registry, so the
  // breadcrumb shares one naming system with the sidebar, mobile bars and command
  // palette instead of carrying its own copy of the route titles.
  const canonicalLabel = (href: string): string | null => getRouteByPath(href)?.label ?? null;

  const zoneRoute = zone ? CANONICAL_ROUTES.find((r) => r.zone === zone) : undefined;
  if (zoneRoute) return ["QCET E-Office", zoneRoute.label];
  if (zone === "portal") return ["QCET E-Office", "Cổng Portal Điều hành"];
  if (view === "calendar" || view === "month") {
    return ["QCET E-Office", canonicalLabel("/calendar") ?? "Lịch công tác"];
  }
  if (scope === "school" || scope === "unit") {
    return ["QCET E-Office", canonicalLabel("/tasks") ?? "Quản lý nhiệm vụ"];
  }

  const cleanPath = normalizePath(path);

  // Non-canonical surfaces keep their own titles; everything a canonical route
  // claims — including its aliases and the zones routed to it — uses the registry.
  if (cleanPath === "/portal" || cleanPath.startsWith("/portal/")) {
    return ["QCET E-Office", "Cổng Portal Điều hành"];
  }
  if (cleanPath.startsWith("/maintenance")) return ["QCET E-Office", "Bảo trì & Nâng cấp"];
  if (cleanPath.startsWith("/login")) return ["QCET E-Office", "Đăng nhập"];

  const matchedRoute =
    getRouteByPath(cleanPath) ??
    getRouteByPath(resolveCanonicalHref(cleanPath)) ??
    // Nested paths under a canonical route (e.g. a future `/documents/<id>`)
    // inherit that route's title; longest href wins so `/tasks` never shadows a
    // more specific prefix.
    [...CANONICAL_ROUTES]
      .filter((r) => r.href !== "/" && cleanPath.startsWith(`${r.href}/`))
      .sort((a, b) => b.href.length - a.href.length)[0];
  if (matchedRoute) {
    return ["QCET E-Office", matchedRoute.label];
  }

  return ["QCET E-Office", "Tổng quan"];
}
