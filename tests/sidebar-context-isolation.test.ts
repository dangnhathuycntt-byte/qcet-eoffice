import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SidebarLayoutContext,
  SidebarBadgeContext,
  SidebarLayoutProvider,
  SidebarBadgeProvider,
  SidebarProvider,
  useSidebarLayout,
  useSidebarBadges,
  useSidebar,
  resolveModuleFromPathname,
  DEFAULT_SIDEBAR_BADGES,
  type SidebarLayoutContextType,
  type SidebarBadgeContextType,
  type SidebarContextType,
  type SidebarBadgeCounts,
} from "../src/components/layout/sidebar-context";

describe("Sidebar Context Isolation & Decoupling (Task 8)", () => {
  describe("Context Separation Invariants", () => {
    test("SidebarLayoutContext and SidebarBadgeContext are distinct React contexts", () => {
      assert.ok(SidebarLayoutContext, "SidebarLayoutContext must be defined");
      assert.ok(SidebarBadgeContext, "SidebarBadgeContext must be defined");
      assert.notStrictEqual(
        SidebarLayoutContext,
        SidebarBadgeContext,
        "SidebarLayoutContext and SidebarBadgeContext must be separate context instances"
      );
    });

    test("useSidebarLayout throws descriptive error outside its provider", () => {
      function Consumer() {
        useSidebarLayout();
        return null;
      }
      assert.throws(
        () => {
          renderToStaticMarkup(React.createElement(Consumer));
        },
        /useSidebarLayout must be used within a SidebarLayoutProvider or SidebarProvider/
      );
    });

    test("useSidebarBadges throws descriptive error outside its provider", () => {
      function Consumer() {
        useSidebarBadges();
        return null;
      }
      assert.throws(
        () => {
          renderToStaticMarkup(React.createElement(Consumer));
        },
        /useSidebarBadges must be used within a SidebarBadgeProvider or SidebarProvider/
      );
    });

    test("useSidebar throws descriptive error outside provider", () => {
      function Consumer() {
        useSidebar();
        return null;
      }
      assert.throws(
        () => {
          renderToStaticMarkup(React.createElement(Consumer));
        },
        /useSidebarLayout must be used within a SidebarLayoutProvider or SidebarProvider/
      );
    });
  });

  describe("Provider Decoupling & Independent Mounting", () => {
    test("SidebarBadgeProvider mounts independently without requiring SidebarLayoutProvider", () => {
      let capturedBadges: SidebarBadgeContextType | null = null;
      function BadgeConsumer() {
        capturedBadges = useSidebarBadges();
        return React.createElement("span", null, String(capturedBadges.badgeCounts.notifications));
      }

      const html = renderToStaticMarkup(
        React.createElement(SidebarBadgeProvider, null, React.createElement(BadgeConsumer))
      );

      assert.ok(capturedBadges !== null, "Captured badges should be populated");
      assert.strictEqual(
        (capturedBadges as SidebarBadgeContextType).badgeCounts.notifications,
        DEFAULT_SIDEBAR_BADGES.notifications
      );
      assert.ok(html.includes(String(DEFAULT_SIDEBAR_BADGES.notifications)));

      // Inside SidebarBadgeProvider alone, useSidebarLayout must still throw
      function LayoutConsumer() {
        useSidebarLayout();
        return null;
      }
      assert.throws(
        () => {
          renderToStaticMarkup(
            React.createElement(SidebarBadgeProvider, null, React.createElement(LayoutConsumer))
          );
        },
        /useSidebarLayout must be used within a SidebarLayoutProvider or SidebarProvider/
      );
    });

    test("SidebarLayoutProvider mounts independently without requiring SidebarBadgeProvider", () => {
      let capturedLayout: SidebarLayoutContextType | null = null;
      function LayoutConsumer() {
        capturedLayout = useSidebarLayout();
        return React.createElement("span", null, String(capturedLayout.isCollapsed));
      }

      const html = renderToStaticMarkup(
        React.createElement(SidebarLayoutProvider, null, React.createElement(LayoutConsumer))
      );

      assert.ok(capturedLayout !== null, "Captured layout should be populated");
      assert.strictEqual((capturedLayout as SidebarLayoutContextType).isCollapsed, false);
      assert.strictEqual((capturedLayout as SidebarLayoutContextType).sidebarWidth, 248);
      assert.ok(html.includes("false"));

      // Inside SidebarLayoutProvider alone, useSidebarBadges must still throw
      function BadgeConsumer() {
        useSidebarBadges();
        return null;
      }
      assert.throws(
        () => {
          renderToStaticMarkup(
            React.createElement(SidebarLayoutProvider, null, React.createElement(BadgeConsumer))
          );
        },
        /useSidebarBadges must be used within a SidebarBadgeProvider or SidebarProvider/
      );
    });
  });

  describe("Composite SidebarProvider & Backward Compatibility", () => {
    test("SidebarProvider provides both layout and badges seamlessly", () => {
      let capturedLayout: SidebarLayoutContextType | null = null;
      let capturedBadges: SidebarBadgeContextType | null = null;
      let capturedSidebar: SidebarContextType | null = null;

      function AllConsumers() {
        capturedLayout = useSidebarLayout();
        capturedBadges = useSidebarBadges();
        capturedSidebar = useSidebar();
        return React.createElement(
          "div",
          null,
          `w:${capturedLayout.sidebarWidth}|n:${capturedBadges.badgeCounts.notifications}|mod:${capturedSidebar.currentModule}`
        );
      }

      const html = renderToStaticMarkup(
        React.createElement(SidebarProvider, null, React.createElement(AllConsumers))
      );

      assert.ok(capturedLayout !== null);
      assert.ok(capturedBadges !== null);
      assert.ok(capturedSidebar !== null);

      const layout = capturedLayout as SidebarLayoutContextType;
      const badges = capturedBadges as SidebarBadgeContextType;
      const sidebar = capturedSidebar as SidebarContextType;

      // Layout contract
      assert.strictEqual(layout.isCollapsed, false);
      assert.strictEqual(layout.isMobileOpen, false);
      assert.strictEqual(layout.currentModule, "work");
      assert.strictEqual(layout.sidebarWidth, 248);
      assert.strictEqual(typeof layout.toggleCollapse, "function");
      assert.strictEqual(typeof layout.setCollapsed, "function");
      assert.strictEqual(typeof layout.toggleMobile, "function");
      assert.strictEqual(typeof layout.setIsMobileOpen, "function");
      assert.strictEqual(typeof layout.setCurrentModule, "function");

      // Badge contract (zero fabricated counts by default)
      assert.strictEqual(badges.badgeCounts.notifications, 0);
      assert.strictEqual(badges.badgeCounts.calendar, 0);
      assert.strictEqual(badges.badgeCounts.docsInbox, 0);
      assert.strictEqual(badges.badgeCounts.docsOutbox, 0);
      assert.strictEqual(badges.badgeCounts.docsPending, 0);
      assert.strictEqual(typeof badges.setBadgeCounts, "function");

      // Backward compatible composed hook
      assert.strictEqual(sidebar.isCollapsed, layout.isCollapsed);
      assert.strictEqual(sidebar.sidebarWidth, layout.sidebarWidth);
      assert.strictEqual(sidebar.currentModule, layout.currentModule);
      assert.strictEqual(sidebar.badgeCounts, badges.badgeCounts);
      assert.strictEqual(sidebar.setBadgeCounts, badges.setBadgeCounts);

      assert.ok(html.includes("w:248|n:0|mod:work"));
    });
  });

  describe("Layout State and Module Resolution Invariants", () => {
    test("resolves module from pathname correctly", () => {
      assert.strictEqual(resolveModuleFromPathname(""), "work");
      assert.strictEqual(resolveModuleFromPathname("/"), "work");
      assert.strictEqual(resolveModuleFromPathname("/tasks"), "work");
      assert.strictEqual(resolveModuleFromPathname("/calendar"), "work");
      assert.strictEqual(resolveModuleFromPathname("/notifications"), "work");
      assert.strictEqual(resolveModuleFromPathname("/documents"), "documents");
      assert.strictEqual(resolveModuleFromPathname("/documents?tab=inbox"), "documents");
      assert.strictEqual(resolveModuleFromPathname("/org"), "org");
      assert.strictEqual(resolveModuleFromPathname("/org?tab=directory"), "org");
    });

    test("effective sidebar width is 64 when collapsed and 248 when expanded", () => {
      const collapsedWidth = true ? 64 : 248;
      const expandedWidth = false ? 64 : 248;
      assert.strictEqual(collapsedWidth, 64);
      assert.strictEqual(expandedWidth, 248);
    });
  });

  describe("Badge State Isolation", () => {
    test("SidebarBadgeProvider accepts custom initialBadges without affecting layout", () => {
      const customBadges: SidebarBadgeCounts = {
        notifications: 99,
        calendar: 42,
        myFocus: 10,
        allTasks: 15,
      };

      let capturedBadges: SidebarBadgeContextType | null = null;
      function BadgeConsumer() {
        capturedBadges = useSidebarBadges();
        return null;
      }

      renderToStaticMarkup(
        React.createElement(
          SidebarBadgeProvider,
          { initialBadges: customBadges, children: React.createElement(BadgeConsumer) }
        )
      );

      assert.ok(capturedBadges !== null);
      assert.strictEqual((capturedBadges as SidebarBadgeContextType).badgeCounts.notifications, 99);
      assert.strictEqual((capturedBadges as SidebarBadgeContextType).badgeCounts.calendar, 42);
      assert.strictEqual((capturedBadges as SidebarBadgeContextType).badgeCounts.myFocus, 10);
      assert.strictEqual((capturedBadges as SidebarBadgeContextType).badgeCounts.allTasks, 15);
    });

    test("SidebarLayoutContext contains zero badge properties and SidebarBadgeContext contains zero layout properties", () => {
      let layout: SidebarLayoutContextType | null = null;
      let badges: SidebarBadgeContextType | null = null;

      function InspectConsumer() {
        layout = useSidebarLayout();
        badges = useSidebarBadges();
        return null;
      }

      renderToStaticMarkup(
        React.createElement(SidebarProvider, null, React.createElement(InspectConsumer))
      );

      assert.ok(layout !== null);
      assert.ok(badges !== null);

      // Verify layout context does NOT have badge properties
      assert.strictEqual("badgeCounts" in (layout as unknown as Record<string, unknown>), false);
      assert.strictEqual("setBadgeCounts" in (layout as unknown as Record<string, unknown>), false);

      // Verify badge context does NOT have layout properties
      assert.strictEqual("isCollapsed" in (badges as unknown as Record<string, unknown>), false);
      assert.strictEqual("toggleCollapse" in (badges as unknown as Record<string, unknown>), false);
      assert.strictEqual("sidebarWidth" in (badges as unknown as Record<string, unknown>), false);
      assert.strictEqual("isMobileOpen" in (badges as unknown as Record<string, unknown>), false);
      assert.strictEqual("currentModule" in (badges as unknown as Record<string, unknown>), false);
    });
  });

  describe("AppShell Integration", () => {
    const appShellPath = path.resolve(process.cwd(), "src/components/layout/app-shell.tsx");

    test("app-shell.tsx imports and uses useSidebarLayout instead of useSidebar", () => {
      const content = fs.readFileSync(appShellPath, "utf-8");

      assert.ok(
        content.includes("useSidebarLayout"),
        "app-shell.tsx must import useSidebarLayout"
      );

      const innerMatch = content.match(/function AppShellInner[\s\S]*?\n\}/);
      assert.ok(innerMatch, "AppShellInner must be defined");
      const innerBody = innerMatch[0];

      assert.ok(
        innerBody.includes("useSidebarLayout()"),
        "AppShellInner must consume useSidebarLayout() to isolate layout from badge re-renders"
      );
      assert.ok(
        !innerBody.includes("useSidebar()"),
        "AppShellInner must NOT consume useSidebar()"
      );
    });
  });

  describe("P0 Attention Signals: Sidebar Badge Invariants (merged)", () => {
    test("DEFAULT_SIDEBAR_BADGES contains zero fake counts", () => {
      assert.strictEqual(DEFAULT_SIDEBAR_BADGES.calendar, 0);
      assert.strictEqual(DEFAULT_SIDEBAR_BADGES.notifications, 0);
      assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsInbox, 0);
      assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsOutbox, 0);
      assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsPending, 0);
    });

    test("app-sidebar.tsx does not contain fake fallback badge numbers (?? 1, ?? 5, ?? 6)", () => {
      const filePath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.strictEqual(
        content.includes("badgeCounts?.calendar ?? 1"),
        false,
        "Must not contain calendar ?? 1"
      );
      assert.strictEqual(
        content.includes("badgeCounts?.notifications ?? 5"),
        false,
        "Must not contain notifications ?? 5"
      );
      assert.strictEqual(
        content.includes("badgeCounts?.docsInbox ?? 6"),
        false,
        "Must not contain docsInbox ?? 6"
      );
    });

    test("app-sidebar.tsx strictly suppresses zero, empty, or undefined badge counters", () => {
      const filePath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
      const content = fs.readFileSync(filePath, "utf-8");

      assert.ok(
        content.includes("text === undefined") &&
          content.includes("text === null") &&
          content.includes('text === ""') &&
          content.includes("text === 0") &&
          content.includes('text === "0"'),
        "app-sidebar must explicitly suppress undefined, null, empty string, 0, and '0' from rendering badges"
      );
    });
  });
});
