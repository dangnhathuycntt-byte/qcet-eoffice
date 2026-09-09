/**
 * Routing and Navigation Active Matcher & Breadcrumbs Helper
 * QCET E-Office Light-Only Standard
 */

/**
 * Determines whether a given navigation route is active based on
 * current pathname, search parameters, and route aliases.
 */
export function isRouteActive(
  targetHref: string,
  currentPathname: string,
  searchParams?: URLSearchParams | null,
  aliases?: string[]
): boolean {
  const pathname = currentPathname || "/";

  // Handle targetHref containing query parameters (e.g. /documents?tab=inbox)
  if (targetHref.includes("?")) {
    const [targetPath, targetQuery] = targetHref.split("?");
    if (pathname !== targetPath) return false;
    if (!searchParams) return false;
    const targetParams = new URLSearchParams(targetQuery);
    for (const [key, val] of targetParams.entries()) {
      if (searchParams.get(key) !== val) {
        return false;
      }
    }
    return true;
  }

  // Handle aliases matching (e.g. /unit-tasks matching /tasks, or /unit-tasks/[id])
  if (aliases && aliases.length > 0) {
    for (const alias of aliases) {
      if (pathname === alias || pathname.startsWith(alias + "/")) {
        return true;
      }
    }
  }

  // Extract query parameters for zone/view overrides
  const zone = searchParams?.get("zone");
  const view = searchParams?.get("view");

  // Root route "/" special handling
  if (targetHref === "/") {
    if (pathname !== "/") return false;
    // Overridden by zone or view query parameters
    if (
      zone === "calendar" ||
      view === "calendar" ||
      view === "month" ||
      zone === "tasks" ||
      zone === "documents" ||
      zone === "org"
    ) {
      return false;
    }
    return true;
  }

  // Parameter-based override matching for non-root target routes
  if (pathname === "/") {
    if (targetHref === "/calendar" && (zone === "calendar" || view === "calendar" || view === "month")) {
      return true;
    }
    if (targetHref === "/tasks" && zone === "tasks") {
      return true;
    }
    if (targetHref === "/documents" && zone === "documents") {
      return true;
    }
    if (targetHref === "/org" && zone === "org") {
      return true;
    }
  }

  // Strict pathname match
  if (pathname === targetHref) {
    return true;
  }

  // Dynamic subroutes match (e.g. /tasks/[id] or /documents/[id])
  if (pathname.startsWith(targetHref + "/")) {
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

  // Zone and query overrides
  if (zone === "portal") return ["QCET E-Office", "Cổng Portal Điều hành"];
  if (zone === "dashboard") return ["QCET E-Office", "Dashboard Điều hành & KPI"];
  if (zone === "calendar" || view === "calendar" || view === "month") return ["QCET E-Office", "Lịch công tác"];
  if (zone === "tasks" || scope === "school" || scope === "unit") return ["QCET E-Office", "Quản lý công việc"];
  if (zone === "documents") return ["QCET E-Office", "Văn bản & Công văn"];
  if (zone === "org") return ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"];

  if (path === "/") {
    return ["QCET E-Office", "Bàn làm việc"];
  }

  if (path.startsWith("/maintenance")) return ["QCET E-Office", "Bảo trì & Nâng cấp"];
  if (path.startsWith("/settings")) return ["QCET E-Office", "Cài đặt hệ thống"];
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
