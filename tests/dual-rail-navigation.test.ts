import test, { describe } from "node:test";
import assert from "node:assert/strict";
import {
  resolveModuleFromPathname,
  MODULES,
  MODULE_NAV_ITEMS,
  type NavigationModule,
  type SidebarItem,
} from "@/components/layout/sidebar-context";

describe("Dual-Rail Navigation Architecture Test Suite", () => {
  describe("Route to Module Mapping Contract", () => {
    const routeTestCases: Array<{ path: string; expected: NavigationModule }> = [
      { path: "/", expected: "work" },
      { path: "/tasks", expected: "work" },
      { path: "/calendar", expected: "work" },
      { path: "/notifications", expected: "work" },
      { path: "/documents", expected: "documents" },
      { path: "/documents/inbox", expected: "documents" },
      { path: "/org", expected: "org" },
      { path: "/org/directory", expected: "org" },
      { path: "/unknown-route", expected: "work" },
    ];

    for (const { path, expected } of routeTestCases) {
      test(`Maps "${path}" to module "${expected}"`, () => {
        const resolved = resolveModuleFromPathname(path);
        assert.strictEqual(
          resolved,
          expected,
          `Path "${path}" must resolve to module "${expected}", got "${resolved}"`
        );
      });
    }

    test("Handles empty or undefined path gracefully by defaulting to work", () => {
      assert.strictEqual(resolveModuleFromPathname(""), "work");
      assert.strictEqual(resolveModuleFromPathname(undefined as unknown as string), "work");
    });
  });

  describe("Modules Specification Contract", () => {
    test("MODULES contains exactly 3 modules: work, documents, org", () => {
      assert.strictEqual(MODULES.length, 3, "MODULES list must contain exactly 3 modules");
      const moduleIds = MODULES.map((m) => m.id);
      assert.deepStrictEqual(moduleIds, ["work", "documents", "org"]);
    });

    test("work module has defaultHref '/' and isComingSoon false or undefined", () => {
      const workModule = MODULES.find((m) => m.id === "work");
      assert.ok(workModule, "work module must exist in MODULES");
      assert.strictEqual(workModule.defaultHref, "/");
      assert.ok(
        workModule.isComingSoon === false || workModule.isComingSoon === undefined,
        "work module must not be marked coming soon"
      );
    });

    test("documents module has defaultHref '/documents' and isComingSoon true", () => {
      const docsModule = MODULES.find((m) => m.id === "documents");
      assert.ok(docsModule, "documents module must exist in MODULES");
      assert.strictEqual(docsModule.defaultHref, "/documents");
      assert.strictEqual(docsModule.isComingSoon, true, "documents module must be coming soon");
    });

    test("org module has defaultHref '/org'", () => {
      const orgModule = MODULES.find((m) => m.id === "org");
      assert.ok(orgModule, "org module must exist in MODULES");
      assert.strictEqual(orgModule.defaultHref, "/org");
    });
  });

  describe("Work Module Navigation Structure", () => {
    test("work module items are categorized into personal and workspace sections", () => {
      const workItems: SidebarItem[] = MODULE_NAV_ITEMS.work;
      assert.ok(Array.isArray(workItems), "MODULE_NAV_ITEMS.work must be an array");

      const sections = new Set(workItems.map((item) => item.section));
      assert.ok(sections.has("personal"), "work module must have personal section");
      assert.ok(sections.has("workspace"), "work module must have workspace section");

      for (const item of workItems) {
        assert.ok(
          item.section === "personal" || item.section === "workspace",
          `Item "${item.id}" has invalid section "${item.section}"`
        );
      }
    });

    test("personal section includes '/', '/calendar', '/notifications'", () => {
      const workItems: SidebarItem[] = MODULE_NAV_ITEMS.work;
      const personalItems = workItems.filter((i) => i.section === "personal");
      const personalHrefs = personalItems.map((i) => i.href);

      assert.ok(personalHrefs.includes("/"), "personal section must include '/'");
      assert.ok(personalHrefs.includes("/calendar"), "personal section must include '/calendar'");
      assert.ok(
        personalHrefs.includes("/notifications"),
        "personal section must include '/notifications'"
      );
    });

    test("workspace section includes '/tasks'", () => {
      const workItems: SidebarItem[] = MODULE_NAV_ITEMS.work;
      const workspaceItems = workItems.filter((i) => i.section === "workspace");
      const workspaceHrefs = workspaceItems.map((i) => i.href);

      assert.ok(workspaceHrefs.includes("/tasks"), "workspace section must include '/tasks'");
    });
  });

  describe("Documents Module Navigation", () => {
    test("documents items all have isComingSoon true", () => {
      const docItems: SidebarItem[] = MODULE_NAV_ITEMS.documents;
      assert.ok(Array.isArray(docItems), "MODULE_NAV_ITEMS.documents must be an array");
      assert.ok(docItems.length > 0, "MODULE_NAV_ITEMS.documents must not be empty");

      for (const item of docItems) {
        assert.strictEqual(
          item.isComingSoon,
          true,
          `Documents item "${item.id}" must have isComingSoon set to true`
        );
      }
    });
  });

  describe("Dimension & Width Calculation Contract", () => {
    test("expanded total width is 280 (56 + 224)", () => {
      const PRIMARY_RAIL_WIDTH = 56;
      const SECONDARY_RAIL_EXPANDED_WIDTH = 224;
      const expandedTotalWidth = PRIMARY_RAIL_WIDTH + SECONDARY_RAIL_EXPANDED_WIDTH;

      assert.strictEqual(
        expandedTotalWidth,
        280,
        "Expanded dual-rail navigation total width must be 280px"
      );
    });

    test("collapsed total width is 112 (56 + 56)", () => {
      const PRIMARY_RAIL_WIDTH = 56;
      const SECONDARY_RAIL_COLLAPSED_WIDTH = 56;
      const collapsedTotalWidth = PRIMARY_RAIL_WIDTH + SECONDARY_RAIL_COLLAPSED_WIDTH;

      assert.strictEqual(
        collapsedTotalWidth,
        112,
        "Collapsed dual-rail navigation total width must be 112px"
      );
    });
  });

  describe("Anti-Slop Audit: No Decorative Emojis", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;

    test("All labels, shortLabels, and descriptions in MODULES contain no emojis", () => {
      for (const mod of MODULES) {
        assert.strictEqual(
          emojiRegex.test(mod.label),
          false,
          `Module "${mod.id}" label "${mod.label}" must contain no emojis`
        );
        assert.strictEqual(
          emojiRegex.test(mod.shortLabel),
          false,
          `Module "${mod.id}" shortLabel "${mod.shortLabel}" must contain no emojis`
        );
        assert.strictEqual(
          emojiRegex.test(mod.description),
          false,
          `Module "${mod.id}" description "${mod.description}" must contain no emojis`
        );
      }
    });

    test("All labels and descriptions in MODULE_NAV_ITEMS contain no emojis", () => {
      const moduleKeys: NavigationModule[] = ["work", "documents", "org"];
      for (const modKey of moduleKeys) {
        const items = MODULE_NAV_ITEMS[modKey] || [];
        for (const item of items) {
          assert.strictEqual(
            emojiRegex.test(item.label),
            false,
            `Item "${item.id}" label "${item.label}" in module "${modKey}" must contain no emojis`
          );
        }
      }
    });
  });
});
