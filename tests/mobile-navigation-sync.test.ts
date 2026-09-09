import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  CANONICAL_ROUTES,
  getMobileBottomBarItems,
  getMobileBottomNavItems,
  getMobileDrawerItems,
} from "../src/lib/navigation/canonical-navigation-registry";
import { isRouteActive } from "../src/lib/navigation/active-matcher";

describe("Task 6: Mobile Navigation Synchronization & Touch Ergonomics", () => {
  const bottomNavPath = path.resolve(process.cwd(), "src/components/layout/mobile-bottom-nav.tsx");
  const drawerPath = path.resolve(process.cwd(), "src/components/layout/mobile-menu-drawer.tsx");

  describe("1. Canonical Route Alignment for Mobile Bottom Bar (4 Destinations)", () => {
    it("getMobileBottomBarItems returns canonical bottom-bar routes in order", () => {
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
    });

    it("mobile-bottom-nav.tsx exists and imports from canonical registry", () => {
      assert.ok(fs.existsSync(bottomNavPath), "mobile-bottom-nav.tsx must exist");
      const content = fs.readFileSync(bottomNavPath, "utf-8");
      assert.ok(
        content.includes("canonical-navigation-registry"),
        "mobile-bottom-nav.tsx must import from canonical-navigation-registry"
      );
      assert.ok(
        content.includes("getMobileBottomBarItems") ||
          content.includes("getMobileBottomNavItems") ||
          content.includes("CANONICAL_ROUTES"),
        "mobile-bottom-nav.tsx must use canonical bottom bar items"
      );
    });
  });

  describe("2. Active State Matching via isRouteActive", () => {
    it("mobile-bottom-nav.tsx uses isRouteActive for active route highlight", () => {
      const content = fs.readFileSync(bottomNavPath, "utf-8");
      assert.ok(
        content.includes("isRouteActive"),
        "mobile-bottom-nav.tsx must use isRouteActive for active state detection"
      );
      assert.ok(
        content.includes('from "@/lib/navigation/active-matcher"') ||
          content.includes('from "../lib/navigation/active-matcher"') ||
          content.includes("active-matcher"),
        "mobile-bottom-nav.tsx must import isRouteActive from active-matcher"
      );
    });

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

  describe("3. Elimination of Dead /kiosk Route", () => {
    it("mobile-menu-drawer.tsx contains zero references to /kiosk or Kiosk TV", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");
      assert.equal(
        content.includes("/kiosk"),
        false,
        "mobile-menu-drawer.tsx must not contain any reference to /kiosk"
      );
      assert.equal(
        content.includes("Kiosk"),
        false,
        "mobile-menu-drawer.tsx must not contain dead Kiosk labels"
      );
    });
  });

  describe("4. Mobile Menu Drawer Synchronization with Canonical Routes", () => {
    it("getMobileDrawerItems provides canonical secondary routes for drawer", () => {
      const drawerItems = getMobileDrawerItems();
      assert.ok(drawerItems.length >= 2, "Must have at least 2 secondary drawer items");
      const ids = drawerItems.map((i) => i.id);
      assert.ok(ids.includes("org"), "Must include org");
      assert.ok(ids.includes("settings"), "Must include settings");
    });

    it("mobile-menu-drawer.tsx imports and synchronizes with canonical routes", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");
      assert.ok(
        content.includes("canonical-navigation-registry"),
        "mobile-menu-drawer.tsx must import from canonical-navigation-registry"
      );
      assert.ok(
        content.includes("isRouteActive"),
        "mobile-menu-drawer.tsx must use isRouteActive for drawer active state"
      );
    });
  });

  describe("5. Touch Target Ergonomics (44px Minimum Standard)", () => {
    it("mobile-bottom-nav.tsx enforces at least 44px (standardized 48px) touch targets and touch-manipulation", () => {
      const content = fs.readFileSync(bottomNavPath, "utf-8");
      const minHMatches = content.match(/min-h-\[(44|48)px\]/g) || [];
      const minWMatches = content.match(/min-w-\[(44|48)px\]/g) || [];

      assert.ok(
        minHMatches.length >= 1,
        `Expected min-h-[44|48px] touch targets in bottom bar template, found ${minHMatches.length}`
      );
      assert.ok(
        minWMatches.length >= 1,
        `Expected min-w-[44|48px] touch targets in bottom bar template, found ${minWMatches.length}`
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "mobile-bottom-nav.tsx must specify touch-manipulation"
      );
      assert.ok(
        content.includes("safe-area-inset-bottom"),
        "mobile-bottom-nav.tsx must support safe-area-inset-bottom"
      );
    });

    it("mobile-menu-drawer.tsx enforces at least 44px min-h touch targets on all interactive items", () => {
      const content = fs.readFileSync(drawerPath, "utf-8");
      const minHMatches = content.match(/min-h-\[(44|48)px\]/g) || [];

      // Close button + navigation links + profile button + push toggle + test button + (install or iOS guide) + logout = 7+ targets
      assert.ok(
        minHMatches.length >= 7,
        `Expected at least 7 min-h-[44|48px] touch targets in drawer, found ${minHMatches.length}`
      );
      assert.ok(
        content.includes("touch-manipulation"),
        "mobile-menu-drawer.tsx must use touch-manipulation"
      );
    });
  });

  describe("6. Anti-slop and Clean UI Standards", () => {
    it("contains zero emojis across mobile bottom nav and drawer", () => {
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      const bottomContent = fs.readFileSync(bottomNavPath, "utf-8");
      const drawerContent = fs.readFileSync(drawerPath, "utf-8");

      assert.equal(emojiRegex.test(bottomContent), false, "mobile-bottom-nav.tsx must have 0% emojis");
      assert.equal(emojiRegex.test(drawerContent), false, "mobile-menu-drawer.tsx must have 0% emojis");
    });

    it("strictly follows Light-Only standard (zero dark: classes)", () => {
      const bottomContent = fs.readFileSync(bottomNavPath, "utf-8");
      const drawerContent = fs.readFileSync(drawerPath, "utf-8");

      assert.equal(bottomContent.includes("dark:"), false, "mobile-bottom-nav.tsx must not contain dark: classes");
      assert.equal(drawerContent.includes("dark:"), false, "mobile-menu-drawer.tsx must not contain dark: classes");
    });
  });
});
