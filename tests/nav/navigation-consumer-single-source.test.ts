import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_ROUTES,
  getMobileBottomBarItems,
} from "../../src/lib/navigation/canonical-navigation-registry";
import { NAV_ITEMS } from "../../src/lib/navigation/nav-config";
import { isRouteActive } from "../../src/lib/navigation/active-matcher";

const ROOT = path.resolve(__dirname, "..", "..");

const mobileNavPath = path.join(ROOT, "src/components/navigation/mobile-bottom-nav.tsx");
const sidebarPath = path.join(ROOT, "src/components/layout/app-sidebar.tsx");
const drawerPath = path.join(ROOT, "src/components/layout/mobile-menu-drawer.tsx");

const mobileNav = fs.readFileSync(mobileNavPath, "utf-8");
const sidebar = fs.readFileSync(sidebarPath, "utf-8");
const drawer = fs.readFileSync(drawerPath, "utf-8");

describe("P6 · navigation consumers share one canonical source (T86, T87, T88)", () => {
  describe("T86 · mobile nav consumes the canonical registry", () => {
    test("the mounted mobile bottom nav is registry-driven", () => {
      assert.ok(
        mobileNav.includes("canonical-navigation-registry"),
        "mobile bottom nav must import the canonical registry"
      );
      assert.ok(
        mobileNav.includes("getMobileBottomBarItems"),
        "mobile bottom nav must use getMobileBottomBarItems"
      );
      assert.ok(
        mobileNav.includes("isRouteActive"),
        "mobile bottom nav must resolve active state via isRouteActive"
      );
    });

    test("no hard-coded route owner / duplicate route array remains in the mobile nav", () => {
      for (const dead of ["MOBILE_PRIMARY_TABS", "MOBILE_CANONICAL_TABS", "isMobileTabActive"]) {
        assert.equal(
          mobileNav.includes(dead),
          false,
          `legacy hard-coded route owner "${dead}" must be deleted`
        );
      }
      assert.equal(
        mobileNav.includes("href:"),
        false,
        "mobile nav must not define its own route objects"
      );
    });

    test("bottom destinations come from the registry in canonical order", () => {
      const ids = getMobileBottomBarItems().map((i) => i.id);
      assert.deepEqual(ids, ["desk", "tasks", "documents", "calendar"]);
      assert.equal(new Set(CANONICAL_ROUTES.map((r) => r.href)).size, CANONICAL_ROUTES.length);
    });
  });

  describe("T86 · sidebar and drawer share the same registry", () => {
    test("sidebar derives its items from getSidebarNavItems and isRouteActive", () => {
      assert.ok(sidebar.includes("getSidebarNavItems"), "sidebar must use getSidebarNavItems");
      assert.ok(sidebar.includes("isRouteActive"), "sidebar must use isRouteActive");
    });

    test("mobile drawer derives its items from getMobileDrawerItems and isRouteActive", () => {
      assert.ok(drawer.includes("getMobileDrawerItems"), "drawer must use getMobileDrawerItems");
      assert.ok(drawer.includes("isRouteActive"), "drawer must use isRouteActive");
    });
  });

  describe("T87 · active-route parity across nested routes and aliases", () => {
    const tasks = CANONICAL_ROUTES.find((r) => r.id === "tasks")!;
    const documents = CANONICAL_ROUTES.find((r) => r.id === "documents")!;
    const calendar = CANONICAL_ROUTES.find((r) => r.id === "calendar")!;
    const org = CANONICAL_ROUTES.find((r) => r.id === "org")!;

    test("nested task / document / calendar / org subroutes stay active", () => {
      assert.equal(isRouteActive(tasks.href, "/tasks/task-123", null, tasks.aliases), true);
      assert.equal(isRouteActive(tasks.href, "/tasks/task-123/edit", null, tasks.aliases), true);
      assert.equal(
        isRouteActive(documents.href, "/documents/doc-9", null, documents.aliases),
        true
      );
      assert.equal(
        isRouteActive(calendar.href, "/calendar/2026/week-3", null, calendar.aliases),
        true
      );
      assert.equal(isRouteActive(org.href, "/org/khoa-cntt", null, org.aliases), true);
    });

    test("legacy aliases resolve to their canonical route", () => {
      assert.equal(isRouteActive("/tasks", "/unit-tasks", null, tasks.aliases), true);
      assert.equal(isRouteActive("/tasks", "/unit-tasks/detail", null, tasks.aliases), true);
      assert.equal(isRouteActive("/", "/dashboard", null), true);
    });

    test("root query zones map to the matching canonical route", () => {
      assert.equal(isRouteActive("/tasks", "/", new URLSearchParams("zone=tasks")), true);
      assert.equal(isRouteActive("/calendar", "/", new URLSearchParams("view=month")), true);
      assert.equal(isRouteActive("/documents", "/", new URLSearchParams("zone=documents")), true);
      assert.equal(isRouteActive("/org", "/", new URLSearchParams("zone=org")), true);
      assert.equal(isRouteActive("/", "/", new URLSearchParams("zone=tasks")), false);
    });

    test("boundary safety prevents sibling-prefix false positives", () => {
      assert.equal(isRouteActive("/tasks", "/tasks-archive"), false);
      assert.equal(isRouteActive("/documents", "/documents-audit"), false);
      assert.equal(isRouteActive("/org", "/organization"), false);
    });
  });

  describe("T88 · one semantic naming system across surfaces", () => {
    test("legacy nav-config labels agree with the canonical registry", () => {
      for (const item of NAV_ITEMS) {
        const route = CANONICAL_ROUTES.find((r) => r.href === item.href);
        assert.ok(route, `nav-config item "${item.id}" must map to a canonical route`);
        assert.equal(
          item.label,
          route.label,
          `nav-config label for "${item.href}" must match the registry label`
        );
      }
    });
  });
});
