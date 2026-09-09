import test from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ROUTES,
  CANONICAL_ZONES,
  getSidebarNavItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
  getRouteByPath,
} from "../src/lib/navigation/canonical-navigation-registry.js";

test("Canonical Navigation Registry defines exactly 7 canonical routes with zero duplicates", () => {
  assert.equal(CANONICAL_ROUTES.length, 7);
  const hrefs = CANONICAL_ROUTES.map((r) => r.href);
  const uniqueHrefs = new Set(hrefs);
  assert.equal(uniqueHrefs.size, 7, "All route hrefs must be unique");
  assert.ok(hrefs.includes("/"), "Must contain root /");
  assert.ok(hrefs.includes("/calendar"), "Must contain /calendar");
  assert.ok(hrefs.includes("/tasks"), "Must contain /tasks");
  assert.ok(hrefs.includes("/documents"), "Must contain /documents");
  assert.ok(hrefs.includes("/org"), "Must contain /org");
  assert.ok(hrefs.includes("/notifications"), "Must contain /notifications");
  assert.ok(hrefs.includes("/settings"), "Must contain /settings");
});

test("Canonical Navigation Registry yields correct desktop and mobile item breakdowns", () => {
  const sidebarItems = getSidebarNavItems();
  assert.ok(sidebarItems.length >= 6, "Sidebar items should cover primary modules");

  const bottomItems = getMobileBottomNavItems();
  assert.ok(bottomItems.some((item) => item.href === "/"), "Bottom nav must include Home");
  assert.ok(bottomItems.some((item) => item.href === "/tasks"), "Bottom nav must include Tasks");
  assert.ok(bottomItems.some((item) => item.href === "/notifications"), "Bottom nav must include Notifications");

  const drawerItems = getMobileDrawerItems();
  assert.ok(drawerItems.some((item) => item.href === "/calendar"), "Drawer must include Calendar");
  assert.ok(drawerItems.some((item) => item.href === "/documents"), "Drawer must include Documents");
  assert.ok(drawerItems.some((item) => item.href === "/org"), "Drawer must include Org");
  assert.equal(drawerItems.some((item) => item.href === "/kiosk"), false, "Must not contain dead /kiosk route");
});

test("Canonical Navigation Registry exports CANONICAL_ZONES and getRouteByPath resolves accurately", () => {
  assert.ok(Array.isArray(CANONICAL_ZONES), "CANONICAL_ZONES must be an array");
  assert.ok(CANONICAL_ZONES.includes("dashboard"));
  assert.ok(CANONICAL_ZONES.includes("tasks"));
  assert.ok(CANONICAL_ZONES.includes("calendar"));
  assert.ok(CANONICAL_ZONES.includes("documents"));
  assert.ok(CANONICAL_ZONES.includes("org"));

  const rootRoute = getRouteByPath("/");
  assert.equal(rootRoute?.id, "desk");

  const aliasRoute = getRouteByPath("/dashboard");
  assert.equal(aliasRoute?.id, "desk");

  const taskAliasRoute = getRouteByPath("/unit-tasks");
  assert.equal(taskAliasRoute?.id, "tasks");

  const pathWithQuery = getRouteByPath("/calendar?month=2026-09#top");
  assert.equal(pathWithQuery?.id, "calendar");

  const unknownRoute = getRouteByPath("/unknown-route");
  assert.equal(unknownRoute, undefined);
});
