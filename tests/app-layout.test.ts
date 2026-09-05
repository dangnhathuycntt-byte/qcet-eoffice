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

