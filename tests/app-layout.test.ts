import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  NAVIGATION_ITEMS,
  resolveBreadcrumb,
  SIDEBAR_STORAGE_KEY,
} from "../src/components/layout/sidebar-context";

describe("Two-Tier Layout Configuration & Breadcrumbs", () => {
  it("defines required 4 navigation items with routes and icons", () => {
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

  it("resolves breadcrumbs accurately for all system routes", () => {
    assert.deepStrictEqual(resolveBreadcrumb("/"), ["QCET E-Office", "Quản lý công việc"]);
    assert.deepStrictEqual(resolveBreadcrumb("/tasks"), ["QCET E-Office", "Nhiệm vụ cấp Trường"]);
    assert.deepStrictEqual(resolveBreadcrumb("/unit-tasks"), ["QCET E-Office", "Công việc Đơn vị"]);
    assert.deepStrictEqual(resolveBreadcrumb("/calendar"), ["QCET E-Office", "Lịch công tác"]);
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", "Báo cáo & Thống kê KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", "Thông báo điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/login"), ["QCET E-Office", "Đăng nhập"]);
  });

  it("resolves breadcrumbs accurately for contextual zones via query parameters", () => {
    // Embedded in pathname
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=dashboard"), ["QCET E-Office", "Dashboard Điều hành & KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/?zone=tasks"), ["QCET E-Office", "Quản lý công việc"]);

    // Query string as second parameter
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=dashboard"), ["QCET E-Office", "Dashboard Điều hành & KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "zone=tasks"), ["QCET E-Office", "Quản lý công việc"]);

    // URLSearchParams object as second parameter
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=portal")), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=dashboard")), ["QCET E-Office", "Dashboard Điều hành & KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", new URLSearchParams("zone=tasks")), ["QCET E-Office", "Quản lý công việc"]);

    // Backward compatibility for direct zone name
    assert.deepStrictEqual(resolveBreadcrumb("/", "portal"), ["QCET E-Office", "Cổng Portal Điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "dashboard"), ["QCET E-Office", "Dashboard Điều hành & KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/", "tasks"), ["QCET E-Office", "Quản lý công việc"]);
  });

  it("zero emojis in navigation labels and breadcrumbs (anti-slop rule)", () => {
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    for (const item of NAVIGATION_ITEMS) {
      assert.ok(!emojiRegex.test(item.label), `Item ${item.label} contains emojis`);
    }
  });

  it("uses qcet_sidebar_collapsed as persistent storage key", () => {
    assert.strictEqual(SIDEBAR_STORAGE_KEY, "qcet_sidebar_collapsed");
  });
});

describe("AppSidebar Component Contracts", () => {
  const sidebarPath = path.resolve(__dirname, "../src/components/layout/app-sidebar.tsx");

  it("creates app-sidebar.tsx with exported AppSidebar component", () => {
    assert.ok(fs.existsSync(sidebarPath), "app-sidebar.tsx must exist");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("export function AppSidebar()"), "Must export AppSidebar component");
  });

  it("anti-slop rule: 0% emojis in AppSidebar source file", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.strictEqual(matches.length, 0, `Found emojis in app-sidebar.tsx: ${matches.map((m) => m[0]).join(", ")}`);
  });

  it("conforms to dual-rail expanded (w-[280px]) and collapsed (w-28) width specifications", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes('isCollapsed ? "w-28" : "w-[280px]"') ||
        content.includes('isCollapsed ? "w-16" : "w-60"'),
      "Sidebar must switch between collapsed and expanded width"
    );
    assert.ok(content.includes("transition-all duration-200"), "Sidebar must have 200ms transition");
  });

  it("implements mobile drawer slide-over with backdrop overlay", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"), "Must have backdrop");
    assert.ok(content.includes('isMobileOpen ? "translate-x-0" : "-translate-x-full"'), "Must slide translate-x");
    assert.ok(content.includes("setIsMobileOpen(false)"), "Must allow closing mobile drawer");
  });

  it("implements Notion sync status pill with active green dot", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("Notion: Đang kết nối"), "Must display Notion connection status text");
    assert.ok(content.includes("bg-emerald-500"), "Must display green status indicator");
  });

  it("includes collapse and expand toggles with keyboard shortcut indicators", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("toggleCollapse"), "Must wire toggleCollapse");
    assert.ok(content.includes("Ctrl+B"), "Must advertise Ctrl+B shortcut");
    assert.ok(content.includes("ChevronLeft"), "Must render ChevronLeft when expanded");
    assert.ok(content.includes("ChevronRight"), "Must render ChevronRight when collapsed");
  });
});

describe("AppTopbar Component Contracts", () => {
  const topbarPath = path.resolve(__dirname, "../src/components/layout/app-topbar.tsx");

  it("creates app-topbar.tsx with exported AppTopbar component", () => {
    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("export function AppTopbar()"), "Must export AppTopbar component");
  });

  it("anti-slop rule: 0% emojis in AppTopbar source file", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.strictEqual(matches.length, 0, `Found emojis in app-topbar.tsx: ${matches.map((m) => m[0]).join(", ")}`);
  });

  it("conforms to 52px height and slot specifications", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes('data-slot="app-topbar"'), "Must define data-slot app-topbar");
    assert.ok(content.includes("h-[52px]"), "Must set height to exactly 52px (h-[52px])");
    assert.ok(content.includes("sticky top-0"), "Must be sticky top-0");
  });

  it("includes mobile menu toggle and desktop collapse toggle buttons", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("toggleMobile"), "Must wire toggleMobile on mobile trigger");
    assert.ok(content.includes("toggleCollapse"), "Must wire toggleCollapse on desktop trigger");
    assert.ok(content.includes("PanelLeftOpen"), "Must render PanelLeftOpen when collapsed");
    assert.ok(content.includes("PanelLeftClose"), "Must render PanelLeftClose when expanded");
    assert.ok(content.includes("Menu"), "Must render Menu icon for mobile");
  });

  it("wires dynamic breadcrumbs trail with resolveBreadcrumb", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("resolveBreadcrumb"), "Must call resolveBreadcrumb");
    assert.ok(content.includes("rootTitle"), "Must render rootTitle");
    assert.ok(content.includes("pageTitle"), "Must render pageTitle");
  });

  it("integrates center command search trigger bar", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Search"), "Must render Search icon");
    assert.ok(content.includes("⌘K"), "Must display ⌘K keyboard shortcut badge");
    assert.ok(
      content.includes("Tìm nhanh công việc, nhân sự..."),
      "Must have search placeholder text"
    );
    assert.ok(
      content.includes("qcet:open-command-search"),
      "Must dispatch qcet:open-command-search event"
    );
  });

  it("integrates right utilities: notification bell, theme toggle, and user profile", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Bell"), "Must render Bell icon");
    assert.ok(content.includes("/notifications"), "Must link to /notifications");
    assert.ok(content.includes("toggleTheme"), "Must wire theme toggle");
    assert.ok(content.includes("UserProfileModal"), "Must render UserProfileModal");
  });

  it("integrates embedded dev role testing simulator within user profile dropdown", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("switchRole"), "Must wire switchRole for role switching");
    assert.ok(content.includes("ADMIN"), "Must support ADMIN role testing");
    assert.ok(content.includes("MANAGER"), "Must support MANAGER role testing");
    assert.ok(content.includes("STAFF"), "Must support STAFF role testing");
    assert.ok(content.includes("FlaskConical"), "Must render FlaskConical icon for dev simulator");
  });

  it("anti-pattern assertions: cleans legacy widgets and preserves event listeners", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(!content.includes("LiveClock"), "LiveClock must NOT be rendered in AppTopbar");
    assert.ok(!content.includes("ZoomToggle"), "ZoomToggle must NOT be rendered in AppTopbar");
    assert.ok(!content.includes("RoleSwitcherPill"), "RoleSwitcherPill must NOT be rendered in AppTopbar");

    // Modal backward compatibility event listeners preserved
    assert.ok(content.includes("CreateTaskModal"), "Must preserve CreateTaskModal");
    assert.ok(content.includes("qcet:open-create-task"), "Must listen to qcet:open-create-task event");
    assert.ok(content.includes("qcet:task-created"), "Must dispatch qcet:task-created event");
  });
});

describe("AppShell Layout Container & Root Integration", () => {
  const appShellPath = path.resolve(__dirname, "../src/components/layout/app-shell.tsx");
  const layoutPath = path.resolve(__dirname, "../src/app/layout.tsx");
  const navPath = path.resolve(__dirname, "../src/components/navigation.tsx");

  it("creates app-shell.tsx with exported AppShell component", () => {
    assert.ok(fs.existsSync(appShellPath), "app-shell.tsx must exist");
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes("export function AppShell("), "Must export AppShell component");
  });

  it("anti-slop rule: 0% emojis in app-shell.tsx source file", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.strictEqual(matches.length, 0, `Found emojis in app-shell.tsx: ${matches.map((m) => m[0]).join(", ")}`);
  });

  it("bypasses sidebar/topbar shell for login route (/login)", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes('pathname === "/login"'), "Must check pathname for /login");
    assert.ok(content.includes("return <>{children}</>;"), "Must render children directly on login route");
  });

  it("implements adaptive margins/padding conforming to collapsed (md:pl-28) and expanded (md:pl-[280px])", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes('isCollapsed ? "md:pl-28" : "md:pl-[280px]"'), "Must apply adaptive md:pl-28 / md:pl-[280px]");
    assert.ok(content.includes("transition-all duration-200 ease-in-out"), "Must animate transition smoothly");
    assert.ok(content.includes("max-w-[1440px]"), "Must constrain content width to 1440px max");
    assert.ok(content.includes('id="main-content"'), "Must contain id main-content for skip link target");
  });

  it("uses w-[280px] in Suspense fallback aside matching expanded dual-rail width", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes('aside className="hidden md:flex w-[280px] shrink-0'), "Must use w-[280px] for aside fallback");
  });

  it("wraps inner layout in SidebarProvider context", () => {
    const content = fs.readFileSync(appShellPath, "utf-8");
    assert.ok(content.includes("<SidebarProvider>"), "Must wrap with SidebarProvider");
    assert.ok(content.includes("<AppSidebar />"), "Must render AppSidebar");
    assert.ok(content.includes("<AppTopbar />"), "Must render AppTopbar");
  });

  it("re-exports NAVIGATION_ITEMS and maintains backwards compatibility in navigation.tsx", () => {
    const content = fs.readFileSync(navPath, "utf-8");
    assert.ok(
      content.includes('export { NAVIGATION_ITEMS } from "@/components/layout/sidebar-context"'),
      "Must re-export NAVIGATION_ITEMS from sidebar-context"
    );
    assert.ok(content.includes("export function getInitials("), "Must preserve getInitials");
    assert.ok(content.includes("export function LiveClock("), "Must preserve LiveClock");
    assert.ok(content.includes("export function ZoomToggle("), "Must preserve ZoomToggle");
    assert.ok(content.includes("export function MobileNav("), "Must preserve MobileNav");
    assert.ok(content.includes("export function Navigation("), "Must preserve Navigation");
  });

  it("wires AppShell into root layout (src/app/layout.tsx)", () => {
    const content = fs.readFileSync(layoutPath, "utf-8");
    assert.ok(content.includes('import { AppShell } from "@/components/layout/app-shell"'), "Must import AppShell");
    assert.ok(content.includes("<AppShell>{children}</AppShell>"), "Must render <AppShell>{children}</AppShell>");
    assert.ok(!content.includes("<Navigation />"), "Must no longer render legacy standalone <Navigation /> in root");
    assert.ok(content.includes('href="#main-content"'), "Must preserve skip to main content accessibility link");
  });
});


