import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  isRouteActive,
  normalizePath,
  resolveBreadcrumb,
} from "../src/lib/navigation/active-matcher";
import {
  CANONICAL_ROUTES,
  CANONICAL_ZONES,
  getRouteByPath,
  getSidebarNavItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
  getMobileBottomBarItems,
} from "../src/lib/navigation/canonical-navigation-registry";
import { NAV_ITEMS } from "../src/lib/navigation/nav-config";

describe("Navigation Active Matcher & Breadcrumb Resolution Suite", () => {
  test("isRouteActive: matches exact pathnames correctly", () => {
    assert.strictEqual(isRouteActive("/", "/"), true);
    assert.strictEqual(isRouteActive("/calendar", "/calendar"), true);
    assert.strictEqual(isRouteActive("/tasks", "/tasks"), true);
    assert.strictEqual(isRouteActive("/documents", "/documents"), true);
    assert.strictEqual(isRouteActive("/notifications", "/notifications"), true);
    assert.strictEqual(isRouteActive("/org", "/org"), true);
  });

  test("isRouteActive: matches dynamic subroutes", () => {
    assert.strictEqual(isRouteActive("/tasks", "/tasks/task-123"), true);
    assert.strictEqual(isRouteActive("/documents", "/documents/doc-abc"), true);
    assert.strictEqual(isRouteActive("/org", "/org/department-1"), true);
    // Should NOT falsely match prefix that isn't subroute
    assert.strictEqual(isRouteActive("/tasks", "/tasks-archive"), false);
  });

  test("isRouteActive: supports route aliases", () => {
    assert.strictEqual(isRouteActive("/tasks", "/unit-tasks", null, ["/unit-tasks"]), true);
    assert.strictEqual(isRouteActive("/tasks", "/unit-tasks/detail", null, ["/unit-tasks"]), true);
  });

  test("isRouteActive: handles root '/' override by query parameters", () => {
    const calendarParams = new URLSearchParams("view=calendar");
    assert.strictEqual(isRouteActive("/", "/", calendarParams), false);
    assert.strictEqual(isRouteActive("/calendar", "/", calendarParams), true);

    const taskParams = new URLSearchParams("zone=tasks");
    assert.strictEqual(isRouteActive("/", "/", taskParams), false);
    assert.strictEqual(isRouteActive("/tasks", "/", taskParams), true);
  });

  test("isRouteActive: accurately activates root '/' when no query parameter is present", () => {
    assert.equal(isRouteActive("/", "/", null), true);
    assert.equal(isRouteActive("/tasks", "/", null), false);
    assert.equal(isRouteActive("/calendar", "/", null), false);
  });

  test("isRouteActive: root '/' exact match vs subpaths", () => {
    assert.equal(isRouteActive("/", "/"), true);
    assert.equal(isRouteActive("/", "/tasks"), false);
    assert.equal(isRouteActive("/", "/calendar"), false);
    assert.equal(isRouteActive("/", "/settings"), false);
    assert.equal(isRouteActive("/", "/tasks/123"), false);
  });

  test("isRouteActive: boundary check prevents subroute collision", () => {
    assert.equal(isRouteActive("/tasks", "/tasks/task-001"), true);
    assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
    assert.equal(isRouteActive("/documents", "/documents-audit"), false);
    assert.equal(isRouteActive("/org", "/organization"), false);
  });

  test("isRouteActive: respects query parameter ?zone=tasks on root '/'", () => {
    const params = new URLSearchParams("zone=tasks");
    assert.equal(isRouteActive("/", "/", params), false);
    assert.equal(isRouteActive("/tasks", "/", params), true);
  });

  test("isRouteActive: query-aware zone matching on root '/' across all canonical zones", () => {
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("zone=calendar")), true);
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=calendar")), true);
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=month")), true);
    assert.equal(isRouteActive("/documents", "/", new URLSearchParams("zone=documents")), true);
    assert.equal(isRouteActive("/org", "/", new URLSearchParams("zone=org")), true);
    assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=documents")), false);
    assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=org")), false);
  });

  test("isRouteActive & normalizePath: clean parameter normalization and trailing slashes", () => {
    assert.equal(normalizePath("/tasks/"), "/tasks");
    assert.equal(normalizePath("/tasks///"), "/tasks");
    assert.equal(normalizePath("/tasks?tab=1"), "/tasks");
    assert.equal(normalizePath("/tasks#header"), "/tasks");
    assert.equal(normalizePath(""), "/");
    assert.equal(normalizePath("/"), "/");

    // Route matching with trailing slashes
    assert.equal(isRouteActive("/tasks/", "/tasks"), true);
    assert.equal(isRouteActive("/tasks", "/tasks/"), true);
    assert.equal(isRouteActive("/tasks/", "/tasks/task-001/"), true);
    assert.equal(isRouteActive("/", "/"), true);
  });

  test("isRouteActive: automatic resolution of aliases from CANONICAL_ROUTES", () => {
    // /unit-tasks is an alias of /tasks in CANONICAL_ROUTES
    assert.equal(isRouteActive("/tasks", "/unit-tasks"), true);
    assert.equal(isRouteActive("/tasks", "/unit-tasks/abc-123"), true);
    // /dashboard is an alias of the workbench route "/"
    assert.equal(isRouteActive("/", "/dashboard"), true);
  });

  test("isRouteActive: handles query parameters in target href", () => {
    const params = new URLSearchParams("tab=inbox");
    assert.strictEqual(isRouteActive("/documents?tab=inbox", "/documents", params), true);
    assert.strictEqual(isRouteActive("/documents?tab=sent", "/documents", params), false);
  });

  test("T87 · nested task / document / calendar / org subroutes stay active", () => {
    assert.equal(isRouteActive("/tasks", "/tasks/task-123/edit"), true);
    assert.equal(isRouteActive("/calendar", "/calendar/2026/week-3"), true);
    assert.equal(isRouteActive("/org", "/org/khoa-cntt"), true);
  });

  test("T87 · root query zones map to the matching canonical route", () => {
    assert.equal(isRouteActive("/tasks", "/", new URLSearchParams("zone=tasks")), true);
    assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=month")), true);
    assert.equal(isRouteActive("/documents", "/", new URLSearchParams("zone=documents")), true);
    assert.equal(isRouteActive("/org", "/", new URLSearchParams("zone=org")), true);
    assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=tasks")), false);
  });

  test("resolveBreadcrumb: maps routes and query states to clean Vietnamese titles", () => {
    // T88: the breadcrumb title is the canonical registry label for the route,
    // read from the registry here so the expectation can never drift again.
    const label = (href: string) =>
      CANONICAL_ROUTES.find((r) => r.href === href)!.label;

    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", label("/calendar")]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", label("/notifications")]);
    assert.deepStrictEqual(resolveBreadcrumb("/documents"), ["QCET E-Office", label("/documents")]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", label("/tasks")]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", label("/org")]);
    assert.deepStrictEqual(resolveBreadcrumb("/settings"), ["QCET E-Office", label("/settings")]);
  });

  test("NAV_ITEMS: defines clean canonical items without duplicates", () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);
    const uniqueHrefs = new Set(hrefs);
    assert.strictEqual(hrefs.length, uniqueHrefs.size, "NAV_ITEMS must contain zero duplicate hrefs");
    assert.ok(NAV_ITEMS.length >= 5, "Must have comprehensive navigation set");
  });

  describe("Canonical Navigation Registry (single source of truth)", () => {
    test("defines exactly 7 canonical routes with zero duplicates", () => {
      assert.equal(CANONICAL_ROUTES.length, 7);
      const hrefs = CANONICAL_ROUTES.map((r) => r.href);
      const uniqueHrefs = new Set(hrefs);
      assert.equal(uniqueHrefs.size, 7, "All route hrefs must be unique");
      for (const href of ["/", "/calendar", "/tasks", "/documents", "/org", "/notifications", "/settings"]) {
        assert.ok(hrefs.includes(href), `Must contain ${href}`);
      }
    });

    test("yields correct desktop and mobile item breakdowns", () => {
      const sidebarItems = getSidebarNavItems();
      assert.ok(sidebarItems.length >= 6, "Sidebar items should cover primary modules");

      const bottomItems = getMobileBottomNavItems();
      assert.equal(bottomItems.length, 4, "Bottom nav must have exactly 4 canonical destinations");
      assert.ok(bottomItems.some((item) => item.href === "/"), "Bottom nav must include Home");
      assert.ok(bottomItems.some((item) => item.href === "/tasks"), "Bottom nav must include Tasks");
      assert.ok(bottomItems.some((item) => item.href === "/documents"), "Bottom nav must include Documents");
      assert.ok(bottomItems.some((item) => item.href === "/calendar"), "Bottom nav must include Calendar");

      const drawerItems = getMobileDrawerItems();
      assert.ok(drawerItems.some((item) => item.href === "/org"), "Drawer must include Org");
      assert.ok(drawerItems.some((item) => item.href === "/settings"), "Drawer must include Settings");
      assert.equal(drawerItems.some((item) => item.href === "/kiosk"), false, "Must not contain dead /kiosk route");
    });

    test("bottom destinations come from the registry in canonical order", () => {
      assert.deepEqual(
        getMobileBottomBarItems().map((i) => i.id),
        ["desk", "tasks", "documents", "calendar"]
      );
    });

    test("exports CANONICAL_ZONES and getRouteByPath resolves accurately", () => {
      assert.ok(Array.isArray(CANONICAL_ZONES), "CANONICAL_ZONES must be an array");
      for (const zone of ["dashboard", "tasks", "calendar", "documents", "org"]) {
        assert.ok(CANONICAL_ZONES.includes(zone as never), `CANONICAL_ZONES must include ${zone}`);
      }

      assert.equal(getRouteByPath("/")?.id, "desk");
      assert.equal(getRouteByPath("/dashboard")?.id, "desk");
      assert.equal(getRouteByPath("/unit-tasks")?.id, "tasks");
      assert.equal(getRouteByPath("/calendar?month=2026-09#top")?.id, "calendar");
      assert.equal(getRouteByPath("/unknown-route"), undefined);
    });
  });

  describe("T88 · one semantic naming system (breadcrumb + nav-config follow the registry)", () => {
    test("resolveBreadcrumb uses the canonical registry label for every canonical route", () => {
      for (const route of CANONICAL_ROUTES) {
        const [, pageTitle] = resolveBreadcrumb(route.href);
        assert.equal(
          pageTitle,
          route.label,
          `breadcrumb for "${route.href}" must equal registry label`
        );
      }
    });

    test("resolveBreadcrumb zone/scope overrides resolve to registry labels", () => {
      const tasks = getRouteByPath("/tasks")!;
      assert.deepEqual(resolveBreadcrumb("/", "zone=tasks"), ["QCET E-Office", tasks.label]);
      assert.deepEqual(resolveBreadcrumb("/", "scope=unit"), ["QCET E-Office", tasks.label]);
      const calendar = getRouteByPath("/calendar")!;
      assert.deepEqual(resolveBreadcrumb("/", "view=month"), ["QCET E-Office", calendar.label]);
    });

    test("resolveBreadcrumb gives a nested path its owning route's label", () => {
      // A nested path under a canonical route must not fall through to the generic
      // fallback — the previous prefix-matching behaviour is preserved.
      const [root, page] = resolveBreadcrumb("/tasks/task-123");
      assert.equal(root, "QCET E-Office");
      assert.equal(page, getRouteByPath("/tasks")!.label);
    });

    test("every NAV_ITEMS badgeKey exists in the canonical registry", () => {
      const registryBadgeKeys = new Set(
        CANONICAL_ROUTES.map((r) => r.badgeKey).filter(Boolean)
      );
      for (const item of NAV_ITEMS) {
        if (item.badgeKey === undefined) continue;
        assert.ok(
          registryBadgeKeys.has(item.badgeKey as never),
          `nav-config badgeKey "${item.badgeKey}" (${item.id}) must exist in the registry`
        );
      }
    });

    test("every NAV_ITEMS entry maps to a canonical route with identical href and label", () => {
      for (const item of NAV_ITEMS) {
        const route = CANONICAL_ROUTES.find((r) => r.href === item.href);
        assert.ok(route, `nav-config item "${item.id}" must map to a canonical route`);
        assert.equal(item.label, route.label);
      }
    });
  });
});
