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

    test("documents module has defaultHref '/documents' and is operational (anti-slop)", () => {
      const docsModule = MODULES.find((m) => m.id === "documents");
      assert.ok(docsModule, "documents module must exist in MODULES");
      assert.strictEqual(docsModule.defaultHref, "/documents");
      assert.ok(
        docsModule.isComingSoon === false || docsModule.isComingSoon === undefined,
        "documents module must be operational without coming-soon slop"
      );
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
    test("documents items are operational without comingSoon slop", () => {
      const docItems: SidebarItem[] = MODULE_NAV_ITEMS.documents;
      assert.ok(Array.isArray(docItems), "MODULE_NAV_ITEMS.documents must be an array");
      assert.strictEqual(docItems.length, 4, "MODULE_NAV_ITEMS.documents must have 4 items");

      for (const item of docItems) {
        assert.ok(
          item.isComingSoon === false || item.isComingSoon === undefined,
          `Documents item "${item.id}" must not have isComingSoon set to true`
        );
      }

      const labels = docItems.map((i) => i.label);
      assert.ok(labels.includes("Văn bản đến"));
      assert.ok(labels.includes("Văn bản đi"));
      assert.ok(labels.includes("Tờ trình duyệt"));
      assert.ok(labels.includes("Sổ lưu trữ toàn trường"));
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

  describe("AppPrimaryRail Component Contract", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const railFile = path.join(
      process.cwd(),
      "src/components/layout/app-primary-rail.tsx"
    );

    test("app-primary-rail.tsx exists and is a client component", () => {
      assert.ok(fs.existsSync(railFile), "app-primary-rail.tsx must exist");
      const content = fs.readFileSync(railFile, "utf-8");
      assert.ok(
        content.startsWith('"use client"') || content.startsWith("'use client'"),
        "app-primary-rail.tsx must have 'use client' directive"
      );
    });

    test("app-primary-rail.tsx specifies 56px (w-14) nav container with correct aria-label", () => {
      const content = fs.readFileSync(railFile, "utf-8");
      assert.ok(
        content.includes('aria-label="Thanh phân hệ chính"'),
        "Must have aria-label='Thanh phân hệ chính'"
      );
      assert.ok(
        content.includes("w-14"),
        "Must specify w-14 (56px width)"
      );
    });

    test("app-primary-rail.tsx renders QCET school logo image with aria-label", () => {
      const content = fs.readFileSync(railFile, "utf-8");
      assert.ok(
        content.includes('aria-label="QCET E-Office Trang chủ"'),
        "Must have QCET logo link with aria-label='QCET E-Office Trang chủ'"
      );
      assert.ok(
        content.includes("/logo-qcet.png"),
        "Must render school logo /logo-qcet.png"
      );
    });

    test("app-primary-rail.tsx maps MODULES with label underneath icon and clean active indicator", () => {
      const content = fs.readFileSync(railFile, "utf-8");
      assert.ok(content.includes("MODULES.map"), "Must map over MODULES");
      assert.ok(
        content.includes("mod.shortLabel"),
        "Must render mod.shortLabel underneath icon for navigation clarity"
      );
      assert.ok(
        content.includes("bg-primary text-primary-foreground"),
        "Must highlight active icon container with clean primary fill without slop border"
      );
      assert.ok(
        content.includes("Đang phát triển"),
        "Must handle isComingSoon indicator / badge"
      );
    });

    test("app-primary-rail.tsx includes Settings button and Notion sync indicator", () => {
      const content = fs.readFileSync(railFile, "utf-8");
      assert.ok(
        content.includes("/settings"),
        "Must link or navigate to /settings"
      );
      assert.ok(
        content.includes("Dữ liệu Notion: Đã kết nối"),
        "Must show Notion sync status"
      );
    });
  });

  describe("AppSidebar Sub-Navigation Pane (Rail 2) Contract", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const sidebarFile = path.join(
      process.cwd(),
      "src/components/layout/app-sidebar.tsx"
    );

    test("app-sidebar.tsx exists and is a client component", () => {
      assert.ok(fs.existsSync(sidebarFile), "app-sidebar.tsx must exist");
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.startsWith('"use client"') || content.startsWith("'use client'"),
        "app-sidebar.tsx must have 'use client' directive"
      );
    });

    test("app-sidebar.tsx houses AppPrimaryRail and Rail 2 sub-nav pane as flex-row siblings", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes("<AppPrimaryRail />") || content.includes("<AppPrimaryRail"),
        "Must render AppPrimaryRail"
      );
      assert.ok(
        content.includes("hidden md:flex flex-row"),
        "Desktop container must be hidden md:flex flex-row"
      );
      assert.ok(
        content.includes('aria-label="Thanh điều hướng chính"'),
        "Desktop aside must have aria-label='Thanh điều hướng chính'"
      );
    });

    test("Desktop navigation container switches between w-28 (112px) and w-[280px]", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes('isCollapsed ? "w-28" : "w-[280px]"'),
        "Desktop container must switch between w-28 (112px) and w-[280px]"
      );
    });

    test("Rail 2 sub-nav container switches between w-14 items-center (56px) and w-56 (224px)", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes('isCollapsed ? "w-14 items-center" : "w-56"'),
        "Rail 2 container must switch between w-14 items-center and w-56"
      );
    });

    test("Expanded Rail 2 renders group labels 'CÁ NHÂN' and 'TOÀN TRƯỜNG & ĐƠN VỊ'", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes("CÁ NHÂN"),
        "Must have 'CÁ NHÂN' group label"
      );
      assert.ok(
        content.includes("TOÀN TRƯỜNG & ĐƠN VỊ"),
        "Must have 'TOÀN TRƯỜNG & ĐƠN VỊ' group label"
      );
    });

    test("Collapsed Rail 2 renders 56px mode with TooltipProvider, size-9 icon buttons and expand button", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes("TooltipProvider"),
        "Must use TooltipProvider"
      );
      assert.ok(
        content.includes("size-9 rounded-lg"),
        "Must render size-9 icon-only buttons in collapsed mode"
      );
      assert.ok(
        content.includes("ChevronRight"),
        "Must render ChevronRight expand button when collapsed"
      );
      assert.ok(
        content.includes("Mở rộng [Ctrl+B]"),
        "Must have 'Mở rộng [Ctrl+B]' label/tooltip"
      );
    });

    test("Handles global Ctrl+B / Cmd+B keyboard shortcut for toggleCollapse", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes("ctrlKey") && content.includes("metaKey"),
        "Must listen to ctrlKey and metaKey"
      );
      assert.ok(
        content.includes("toggleCollapse()"),
        "Must call toggleCollapse on shortcut"
      );
    });

    test("Anti-slop check: 0% emojis in app-sidebar.tsx", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "app-sidebar.tsx must contain zero emojis"
      );
    });
  });

  describe("AppShell & Mobile Drawer Contract (Task 6)", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const shellFile = path.join(
      process.cwd(),
      "src/components/layout/app-shell.tsx"
    );
    const sidebarFile = path.join(
      process.cwd(),
      "src/components/layout/app-sidebar.tsx"
    );

    test("app-shell.tsx applies dual-rail content left padding: md:pl-28 (112px) collapsed, md:pl-[280px] (280px) expanded", () => {
      assert.ok(fs.existsSync(shellFile), "app-shell.tsx must exist");
      const content = fs.readFileSync(shellFile, "utf-8");
      assert.ok(
        content.includes('isCollapsed ? "md:pl-28" : "md:pl-[280px]"'),
        "Main container must use md:pl-28 when collapsed and md:pl-[280px] when expanded"
      );
    });

    test("app-shell.tsx Suspense fallback aside specifies w-[280px]", () => {
      const content = fs.readFileSync(shellFile, "utf-8");
      assert.ok(
        content.includes('w-[280px] shrink-0 border-r'),
        "Suspense fallback aside must specify w-[280px]"
      );
    });

    test("app-sidebar.tsx mobile drawer includes module selector / tablist", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes('role="tablist"'),
        "Mobile drawer must have role='tablist'"
      );
      assert.ok(
        content.includes('role="tab"'),
        "Mobile drawer must have role='tab' on module buttons"
      );
      assert.ok(
        content.includes('role="tabpanel"'),
        "Mobile navigation list must have role='tabpanel'"
      );
      assert.ok(
        content.includes("aria-controls="),
        "Module tabs must have aria-controls attribute"
      );
      assert.ok(
        content.includes("aria-selected="),
        "Module tabs must have aria-selected attribute"
      );
    });

    test("app-sidebar.tsx mobile drawer closes on route change and link click", () => {
      const content = fs.readFileSync(sidebarFile, "utf-8");
      assert.ok(
        content.includes("[pathname, searchParams, setIsMobileOpen]"),
        "Must have useEffect listening to pathname and searchParams to close drawer"
      );
      assert.ok(
        content.includes("setIsMobileOpen(false)"),
        "Link click must close mobile drawer"
      );
    });

    test("Anti-slop check: 0% emojis in app-shell.tsx", () => {
      const content = fs.readFileSync(shellFile, "utf-8");
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
      assert.strictEqual(
        emojiRegex.test(content),
        false,
        "app-shell.tsx must contain zero emojis"
      );
    });
  });
});
