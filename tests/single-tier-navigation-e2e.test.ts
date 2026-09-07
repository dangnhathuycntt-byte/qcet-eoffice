import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  NAVIGATION_ITEMS,
  SINGLE_TIER_NAV_ITEMS,
  resolveBreadcrumb,
  SIDEBAR_STORAGE_KEY,
  DEFAULT_SIDEBAR_BADGES,
} from "../src/components/layout/sidebar-context";

describe("Single-Tier Navigation Configuration (sidebar-context.tsx)", () => {
  it("exports SINGLE_TIER_NAV_ITEMS across personal, workspace, and operations sections", () => {
    assert.ok(Array.isArray(SINGLE_TIER_NAV_ITEMS), "SINGLE_TIER_NAV_ITEMS must be an array");
    assert.strictEqual(SINGLE_TIER_NAV_ITEMS.length, 6, "SINGLE_TIER_NAV_ITEMS must have 6 items");

    const personalItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "personal");
    const workspaceItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "workspace");
    const operationsItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "operations");

    assert.strictEqual(personalItems.length, 3, "Personal section must have 3 items");
    assert.strictEqual(workspaceItems.length, 1, "Workspace section must have 1 item");
    assert.strictEqual(operationsItems.length, 2, "Operations section must have 2 items");
  });

  it("verifies personal section routes and Vietnamese labels", () => {
    const personalItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "personal");

    assert.strictEqual(personalItems[0].href, "/");
    assert.strictEqual(personalItems[0].label, "Bàn làm việc");
    assert.strictEqual(personalItems[0].badgeKey, "myFocus");

    assert.strictEqual(personalItems[1].href, "/calendar");
    assert.strictEqual(personalItems[1].label, "Lịch công tác");
    assert.strictEqual(personalItems[1].badgeKey, "calendar");

    assert.strictEqual(personalItems[2].href, "/notifications");
    assert.strictEqual(personalItems[2].label, "Thông báo");
    assert.strictEqual(personalItems[2].badgeKey, "notifications");
  });

  it("verifies workspace and operations section routes and Vietnamese labels", () => {
    const workspaceItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "workspace");
    assert.strictEqual(workspaceItems[0].href, "/tasks");
    assert.strictEqual(workspaceItems[0].label, "Kho nhiệm vụ");
    assert.strictEqual(workspaceItems[0].badgeKey, "allTasks");

    const operationsItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "operations");
    assert.strictEqual(operationsItems[0].href, "/documents");
    assert.strictEqual(operationsItems[0].label, "Sổ văn bản đến/đi");
    assert.strictEqual(operationsItems[0].badgeKey, "docsInbox");

    assert.strictEqual(operationsItems[1].href, "/org");
    assert.strictEqual(operationsItems[1].label, "Cơ cấu & Danh bạ");
  });

  it("exports baseline NAVIGATION_ITEMS for core portal routes", () => {
    assert.ok(Array.isArray(NAVIGATION_ITEMS), "NAVIGATION_ITEMS must be an array");
    assert.strictEqual(NAVIGATION_ITEMS.length, 4);
    assert.strictEqual(NAVIGATION_ITEMS[0].href, "/");
    assert.strictEqual(NAVIGATION_ITEMS[0].label, "Quản lý công việc");
    assert.strictEqual(NAVIGATION_ITEMS[1].href, "/dashboard");
    assert.strictEqual(NAVIGATION_ITEMS[1].label, "Báo cáo KPI");
    assert.strictEqual(NAVIGATION_ITEMS[2].href, "/org");
    assert.strictEqual(NAVIGATION_ITEMS[2].label, "Cơ cấu & Danh bạ");
    assert.strictEqual(NAVIGATION_ITEMS[3].href, "/notifications");
    assert.strictEqual(NAVIGATION_ITEMS[3].label, "Thông báo");
  });

  it("provides default badge configuration for operational counters", () => {
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.calendar, 1);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.notifications, 5);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsInbox, 6);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsOutbox, 4);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsPending, 2);
  });

  it("resolves breadcrumbs accurately for all system routes", () => {
    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", "Quản lý công việc"]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", "Nhiệm vụ cấp Trường"]);
    assert.deepStrictEqual(resolveBreadcrumb("/unit-tasks"), ["QCET E-Office", "Công việc Đơn vị"]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", "Lịch công tác"]);
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", "Báo cáo & Thống kê KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", "Thông báo điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/documents"), ["QCET E-Office", "Văn bản & Công văn"]);
  });

  it("anti-slop rule: 0% emojis in navigation item definitions and breadcrumbs", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    for (const item of SINGLE_TIER_NAV_ITEMS) {
      assert.ok(!emojiRegex.test(item.label), `Item ${item.label} contains emoji`);
      if (item.badgeKey) {
        assert.ok(!emojiRegex.test(item.badgeKey), `Badge key ${item.badgeKey} contains emoji`);
      }
    }
    for (const item of NAVIGATION_ITEMS) {
      assert.ok(!emojiRegex.test(item.label), `Item ${item.label} contains emoji`);
    }
  });

  it("uses qcet_sidebar_collapsed for single-tier sidebar storage", () => {
    assert.strictEqual(SIDEBAR_STORAGE_KEY, "qcet_sidebar_collapsed");
  });
});

describe("AppShell Responsive Layout & Container Padding (app-shell.tsx)", () => {
  const shellPath = path.resolve(__dirname, "../src/components/layout/app-shell.tsx");

  it("app-shell.tsx exists and is readable", () => {
    assert.ok(fs.existsSync(shellPath), "app-shell.tsx must exist");
  });

  it("configures single-tier sidebar layout offset (248px expanded, 64px collapsed)", () => {
    const content = fs.readFileSync(shellPath, "utf-8");
    // Expanded padding: md:pl-[248px]
    assert.ok(
      content.includes("md:pl-[248px]"),
      "Must apply md:pl-[248px] padding when sidebar is expanded"
    );
    // Collapsed padding: md:pl-16 (64px)
    assert.ok(
      content.includes("md:pl-16"),
      "Must apply md:pl-16 padding when sidebar is collapsed"
    );
  });

  it("applies smooth transitions to layout padding changes", () => {
    const content = fs.readFileSync(shellPath, "utf-8");
    assert.ok(
      content.includes("transition-all"),
      "Must include transition-all for smooth sidebar expansion/collapse"
    );
    assert.ok(
      content.includes("duration-200"),
      "Must specify duration-200 animation"
    );
  });

  it("strictly removes dual-tier primary rail imports and elements", () => {
    const content = fs.readFileSync(shellPath, "utf-8");
    assert.ok(
      !content.includes("AppPrimaryRail"),
      "AppPrimaryRail must be completely eliminated from app-shell.tsx"
    );
    assert.ok(
      !content.includes("md:pl-[296px]"),
      "Legacy 296px dual-tier padding must not exist"
    );
    assert.ok(
      !content.includes("md:pl-28"),
      "Legacy 28/72px dual-tier padding must not exist"
    );
  });
});

describe("Single-Tier Sidebar Architecture (app-sidebar.tsx)", () => {
  const sidebarPath = path.resolve(__dirname, "../src/components/layout/app-sidebar.tsx");

  it("app-sidebar.tsx exists and exports AppSidebar", () => {
    assert.ok(fs.existsSync(sidebarPath), "app-sidebar.tsx must exist");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("export function AppSidebar()"), "Must export AppSidebar");
  });

  it("defines single-tier dimensions (248px expanded, 64px collapsed)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("w-[248px]"),
      "Sidebar width must be w-[248px] when expanded"
    );
    assert.ok(
      content.includes("w-16"),
      "Sidebar width must be w-16 when collapsed"
    );
  });

  it("renders structured sections: CÁ NHÂN, CÔNG VIỆC, and VĂN BẢN & ĐIỀU HÀNH", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("SINGLE_TIER_NAV_ITEMS"),
      "Must iterate over SINGLE_TIER_NAV_ITEMS"
    );
    assert.ok(
      content.includes("CÁ NHÂN"),
      "Must render CÁ NHÂN section"
    );
    assert.ok(
      content.includes("CÔNG VIỆC"),
      "Must render CÔNG VIỆC section"
    );
    assert.ok(
      content.includes("VĂN BẢN & ĐIỀU HÀNH"),
      "Must render VĂN BẢN & ĐIỀU HÀNH section"
    );
  });

  it("anti-slop rule: 0% emojis in AppSidebar source file", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = content.match(emojiRegex);
    assert.strictEqual(matches, null, `Found emojis in app-sidebar.tsx: ${matches?.join(", ")}`);
  });
});

describe("Topbar ScopeSwitcher Component (scope-switcher.tsx & app-topbar.tsx)", () => {
  const scopeSwitcherPath = path.resolve(__dirname, "../src/components/layout/scope-switcher.tsx");
  const topbarPath = path.resolve(__dirname, "../src/components/layout/app-topbar.tsx");

  it("scope-switcher.tsx exists and exports ScopeSwitcher", () => {
    assert.ok(fs.existsSync(scopeSwitcherPath), "scope-switcher.tsx must exist");
    const content = fs.readFileSync(scopeSwitcherPath, "utf-8");
    assert.ok(content.includes("export function ScopeSwitcher("), "Must export ScopeSwitcher");
  });

  it("supports all 3 operational scopes (school, unit, my)", () => {
    const content = fs.readFileSync(scopeSwitcherPath, "utf-8");
    assert.ok(content.includes('"school"'), "Must support school scope");
    assert.ok(content.includes('"unit"'), "Must support unit scope");
    assert.ok(content.includes('"my"'), "Must support my scope");
    assert.ok(content.includes("Toàn trường"), "Must label school as Toàn trường");
    assert.ok(content.includes("Đơn vị"), "Must label unit as Đơn vị");
    assert.ok(content.includes("Cá nhân"), "Must label my as Cá nhân");
  });

  it("synchronizes scope selection with URL search parameters", () => {
    const content = fs.readFileSync(scopeSwitcherPath, "utf-8");
    assert.ok(content.includes("useSearchParams"), "Must use useSearchParams for URL binding");
    assert.ok(content.includes("useRouter"), "Must use useRouter for scope navigation");
    assert.ok(content.includes('params.set("scope"'), "Must set scope parameter in URL");
  });

  it("AppTopbar mounts ScopeSwitcher inside React Suspense boundary", () => {
    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("ScopeSwitcher"), "AppTopbar must import ScopeSwitcher");
    assert.ok(content.includes("<Suspense"), "Must wrap ScopeSwitcher with Suspense");
  });

  it("anti-slop rule: 0% emojis in ScopeSwitcher and AppTopbar", () => {
    const switcherContent = fs.readFileSync(scopeSwitcherPath, "utf-8");
    const topbarContent = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

    const switcherMatches = switcherContent.match(emojiRegex);
    assert.strictEqual(switcherMatches, null, `Found emojis in scope-switcher: ${switcherMatches?.join(", ")}`);

    const topbarMatches = topbarContent.match(emojiRegex);
    assert.strictEqual(topbarMatches, null, `Found emojis in app-topbar: ${topbarMatches?.join(", ")}`);
  });
});

describe("Workspace URL Scope Synchronization (page.tsx)", () => {
  const pagePath = path.resolve(__dirname, "../src/app/page.tsx");

  it("page.tsx synchronizes scope state with URL query parameters", () => {
    assert.ok(fs.existsSync(pagePath), "page.tsx must exist");
    const content = fs.readFileSync(pagePath, "utf-8");

    assert.ok(content.includes("searchParams.get(\"scope\")"), "Must read scope query parameter");
    assert.ok(content.includes("parseScopeParam(scopeQuery"), "Must parse scope query parameter");
  });

  it("verifies legacy in-page scope switcher button is removed", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    // Ensure the old redundant toggle button in the page body has been deprecated
    assert.ok(
      !content.includes('aria-label="Chuyển đổi phạm vi hiển thị"'),
      "Legacy scope switcher button in page body must be removed"
    );
  });
});
