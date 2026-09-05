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
    assert.deepStrictEqual(resolveBreadcrumb("/dashboard"), ["QCET E-Office", "Báo cáo & Thống kê KPI"]);
    assert.deepStrictEqual(resolveBreadcrumb("/org"), ["QCET E-Office", "Cơ cấu tổ chức & Danh bạ"]);
    assert.deepStrictEqual(resolveBreadcrumb("/notifications"), ["QCET E-Office", "Thông báo điều hành"]);
    assert.deepStrictEqual(resolveBreadcrumb("/login"), ["QCET E-Office", "Đăng nhập"]);
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

  it("conforms to 240px (w-60) expanded and 64px (w-16) collapsed width specifications", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes('isCollapsed ? "w-16" : "w-60"'), "Sidebar must switch between w-16 and w-60");
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
  });

  it("wires dynamic breadcrumbs trail with resolveBreadcrumb", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("resolveBreadcrumb"), "Must call resolveBreadcrumb");
    assert.ok(content.includes("rootTitle"), "Must render rootTitle");
    assert.ok(content.includes("pageTitle"), "Must render pageTitle");
  });

  it("integrates primary action controls and modals", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("CreateTaskModal"), "Must render CreateTaskModal");
    assert.ok(content.includes("RoleSwitcherPill"), "Must render RoleSwitcherPill");
    assert.ok(content.includes("UserProfileModal"), "Must render UserProfileModal");
    assert.ok(content.includes("LiveClock"), "Must render LiveClock");
    assert.ok(content.includes("ZoomToggle"), "Must render ZoomToggle");
    assert.ok(content.includes("toggleTheme"), "Must wire theme toggle");
    assert.ok(content.includes("⌘K"), "Must display ⌘K keyboard shortcut badge");
    assert.ok(content.includes("qcet:open-create-task"), "Must listen to qcet:open-create-task event");
    assert.ok(content.includes("qcet:task-created"), "Must dispatch qcet:task-created event");
  });
});

