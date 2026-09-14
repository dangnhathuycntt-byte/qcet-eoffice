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
import { CANONICAL_ROUTES } from "../src/lib/navigation/canonical-navigation-registry";

describe("Single-Tier Navigation Configuration (sidebar-context.tsx)", () => {
  it("exports SINGLE_TIER_NAV_ITEMS across work and org sections", () => {
    assert.ok(Array.isArray(SINGLE_TIER_NAV_ITEMS), "SINGLE_TIER_NAV_ITEMS must be an array");
    assert.strictEqual(SINGLE_TIER_NAV_ITEMS.length, 6, "SINGLE_TIER_NAV_ITEMS must have 6 items");

    const workItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "work");
    const orgItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "org");

    assert.strictEqual(workItems.length, 5, "Work section must have 5 items (Desk, Tasks, Calendar, Notifications, Documents)");
    assert.strictEqual(orgItems.length, 1, "Org section must have 1 item (Org)");
  });

  it("verifies work and org section routes and Vietnamese labels", () => {
    const workItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "work");

    assert.strictEqual(workItems[0].href, "/");
    assert.strictEqual(workItems[0].label, "Bàn làm việc");
    assert.strictEqual(workItems[0].badgeKey, "myFocus");

    assert.strictEqual(workItems[1].href, "/tasks");
    assert.ok(
      workItems[1].label === "Quản lý nhiệm vụ" || workItems[1].label === "Kho nhiệm vụ",
      "Must have tasks label"
    );
    assert.strictEqual(workItems[1].badgeKey, "taskAttention");

    assert.strictEqual(workItems[2].href, "/calendar");
    assert.strictEqual(workItems[2].label, "Lịch công tác");
    assert.strictEqual(workItems[2].badgeKey, "calendar");

    assert.strictEqual(workItems[3].href, "/notifications");
    assert.ok(
      workItems[3].label === "Thông báo & Nhắc việc" || workItems[3].label === "Thông báo",
      "Must have notifications label"
    );
    assert.strictEqual(workItems[3].badgeKey, "notifications");

    assert.strictEqual(workItems[4].href, "/documents");
    assert.ok(
      workItems[4].label === "Văn bản & Công văn" || workItems[4].label === "Sổ văn bản đến/đi",
      "Must have documents label"
    );

    const orgItems = SINGLE_TIER_NAV_ITEMS.filter((i) => i.section === "org");
    assert.strictEqual(orgItems[0].href, "/org");
    assert.ok(
      orgItems[0].label === "Cơ cấu & Danh bạ" || orgItems[0].label === "Cơ cấu tổ chức & Danh bạ",
      "Must have org label"
    );
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
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.calendar, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.notifications, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsInbox, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsOutbox, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsPending, 0);
  });

  it("resolves breadcrumbs accurately for all system routes", () => {
    // T88: breadcrumb titles are the canonical registry labels.
    const label = (href: string) =>
      CANONICAL_ROUTES.find((r) => r.href === href)!.label;

    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", label("/tasks")]);
    assert.deepStrictEqual(resolveBreadcrumb("/unit-tasks"), ["QCET E-Office", label("/tasks")]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", label("/calendar")]);
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", label("/")]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", label("/org")]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", label("/notifications")]);
    assert.deepStrictEqual(resolveBreadcrumb("/documents"), ["QCET E-Office", label("/documents")]);
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
  const railPath = path.resolve(__dirname, "../src/components/layout/app-primary-rail.tsx");

  it("app-primary-rail.tsx is completely deleted from the codebase", () => {
    assert.strictEqual(fs.existsSync(railPath), false, "app-primary-rail.tsx must be deleted");
  });

  it("app-sidebar.tsx does NOT import or reference AppPrimaryRail or app-primary-rail", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.strictEqual(content.includes("AppPrimaryRail"), false, "Must not reference AppPrimaryRail");
    assert.strictEqual(
      content.includes("app-primary-rail"),
      false,
      "Must not reference app-primary-rail"
    );
  });

  it("app-sidebar.tsx renders the QCET brand header with school year", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("/logo-qcet.png"), "Must use /logo-qcet.png");
    assert.ok(
      content.includes("CỔNG ĐIỀU HÀNH QCET") || content.includes("QUẢN LÝ CÔNG VIỆC"),
      "Must render brand header title"
    );
    assert.ok(content.includes("Năm học 2026–2027"), "Must render academic year 2026–2027");
  });

  it("app-sidebar.tsx includes settings link in footer", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("/settings"), "Must link to /settings");
    assert.ok(content.includes("Cài đặt"), "Must have Cài đặt label");
  });

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

  it("renders structured sections: CÔNG VIỆC and TỔ CHỨC", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("CÔNG VIỆC"),
      "Must render CÔNG VIỆC section"
    );
    assert.ok(
      content.includes("TỔ CHỨC"),
      "Must render TỔ CHỨC section"
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
  const dashboardZonePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");

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

  it("AppTopbar maintains Clean Chrome and DashboardZone mounts ScopeSwitcher inside React Suspense boundary", () => {
    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
    const topbarContent = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(!topbarContent.includes("ScopeSwitcher"), "AppTopbar must maintain Clean Chrome (no ScopeSwitcher import)");

    assert.ok(fs.existsSync(dashboardZonePath), "dashboard-zone.tsx must exist");
    const dashboardContent = fs.readFileSync(dashboardZonePath, "utf-8");
    assert.ok(dashboardContent.includes("ScopeSwitcher"), "DashboardZone must import ScopeSwitcher");
    assert.ok(dashboardContent.includes("<Suspense"), "DashboardZone must wrap ScopeSwitcher with Suspense");
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
  const urlSyncPath = path.resolve(__dirname, "../src/hooks/use-url-params-sync.ts");

  it("page.tsx synchronizes scope state with URL query parameters", () => {
    assert.ok(fs.existsSync(pagePath), "page.tsx must exist");
    const pageContent = fs.readFileSync(pagePath, "utf-8");
    const syncContent = fs.existsSync(urlSyncPath) ? fs.readFileSync(urlSyncPath, "utf-8") : "";
    const combined = pageContent + "\n" + syncContent;

    assert.ok(combined.includes("searchParams.get(\"scope\")"), "Must read scope query parameter");
    assert.ok(combined.includes("parseScopeParam(scopeQuery"), "Must parse scope query parameter");
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
