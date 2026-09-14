import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  CANONICAL_ROUTES,
  getMobileBottomBarItems,
  getMobileDrawerItems,
} from "../src/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "../src/lib/navigation/active-matcher";
import { MobileBottomNav } from "../src/components/navigation/mobile-bottom-nav";
import { MobileMenuDrawer } from "../src/components/layout/mobile-menu-drawer";

describe("Task 6: Mobile Navigation Synchronization & Touch Ergonomics", () => {
  describe("1. Canonical Route Alignment for Mobile Bottom Bar (4 Destinations)", () => {
    it("getMobileBottomBarItems returns canonical bottom-bar routes, order, hrefs, and short labels", () => {
      const items = getMobileBottomBarItems();
      assert.equal(items.length, 4, "Mobile bottom bar must have exactly 4 canonical route slots");
      assert.deepEqual(
        items.map((i) => i.id),
        ["desk", "tasks", "documents", "calendar"]
      );
      assert.equal(items[0].href, "/");
      assert.equal(items[1].href, "/tasks");
      assert.equal(items[2].href, "/documents");
      assert.equal(items[3].href, "/calendar");

      assert.equal(items[0].shortLabel, "Tổng quan");
      assert.equal(items[1].shortLabel, "Nhiệm vụ");
      assert.equal(items[2].shortLabel, "Văn bản");
      assert.equal(items[3].shortLabel, "Lịch");
    });
  });

  describe("2. Active State Matching via isRouteActive", () => {
    it("isRouteActive accurately computes bottom bar active state matrix", () => {
      const deskItem = CANONICAL_ROUTES.find((r) => r.id === "desk")!;
      const tasksItem = CANONICAL_ROUTES.find((r) => r.id === "tasks")!;
      const docsItem = CANONICAL_ROUTES.find((r) => r.id === "documents")!;
      const calendarItem = CANONICAL_ROUTES.find((r) => r.id === "calendar")!;

      // On root without query: desk is active, others are not
      assert.equal(isRouteActive(deskItem.href, "/", null, deskItem.aliases), true);
      assert.equal(isRouteActive(tasksItem.href, "/", null, tasksItem.aliases), false);
      assert.equal(isRouteActive(docsItem.href, "/", null, docsItem.aliases), false);
      assert.equal(isRouteActive(calendarItem.href, "/", null, calendarItem.aliases), false);

      // On root with ?zone=tasks: tasks is active, desk is not
      const taskParams = new URLSearchParams("zone=tasks");
      assert.equal(isRouteActive(deskItem.href, "/", taskParams, deskItem.aliases), false);
      assert.equal(isRouteActive(tasksItem.href, "/", taskParams, tasksItem.aliases), true);

      // On /tasks direct path: tasks is active
      assert.equal(isRouteActive(tasksItem.href, "/tasks", null, tasksItem.aliases), true);

      // On subroute /tasks/item-1: tasks is active
      assert.equal(isRouteActive(tasksItem.href, "/tasks/item-1", null, tasksItem.aliases), true);

      // On /documents: documents is active
      assert.equal(isRouteActive(docsItem.href, "/documents", null, docsItem.aliases), true);
      assert.equal(isRouteActive(deskItem.href, "/documents", null, deskItem.aliases), false);

      // On /calendar: calendar is active
      assert.equal(isRouteActive(calendarItem.href, "/calendar", null, calendarItem.aliases), true);
      assert.equal(isRouteActive(deskItem.href, "/calendar", null, deskItem.aliases), false);
    });
  });

  describe("3. Mobile Menu Drawer Synchronization with Canonical Routes", () => {
    it("getMobileDrawerItems provides canonical secondary routes for drawer", () => {
      const drawerItems = getMobileDrawerItems();
      assert.ok(drawerItems.length >= 2, "Must have at least 2 secondary drawer items");
      const ids = drawerItems.map((i) => i.id);
      assert.ok(ids.includes("org"), "Must include org");
      assert.ok(ids.includes("settings"), "Must include settings");
    });
  });

  describe("4. Component Contracts", () => {
    it("MobileBottomNav is defined and is a valid React component", () => {
      assert.equal(typeof MobileBottomNav, "function");
    });

    it("MobileMenuDrawer is defined and is a valid React component", () => {
      assert.equal(typeof MobileMenuDrawer, "function");
    });
  });
});
