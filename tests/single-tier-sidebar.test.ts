import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Single-Tier Sidebar Component Contracts (app-sidebar.tsx)", () => {
  const sidebarPath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
  const railPath = path.join(process.cwd(), "src/components/layout/app-primary-rail.tsx");

  test("app-primary-rail.tsx is completely deleted from codebase", () => {
    assert.strictEqual(
      fs.existsSync(railPath),
      false,
      "app-primary-rail.tsx must be deleted"
    );
  });

  test("app-sidebar.tsx exists and exports AppSidebar component", () => {
    assert.strictEqual(fs.existsSync(sidebarPath), true, "app-sidebar.tsx must exist");
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("export function AppSidebar()"),
      "Must export AppSidebar component"
    );
  });

  test("app-sidebar.tsx does NOT import or reference AppPrimaryRail or app-primary-rail", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.strictEqual(
      content.includes("AppPrimaryRail"),
      false,
      "Must not reference AppPrimaryRail"
    );
    assert.strictEqual(
      content.includes("app-primary-rail"),
      false,
      "Must not reference app-primary-rail"
    );
  });

  test("app-sidebar.tsx defines single-tier width dimensions (w-[248px] expanded, w-16 collapsed)", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes('isCollapsed ? "w-16" : "w-[248px]"'),
      "Must define fixed width: w-[248px] expanded and w-16 collapsed"
    );
    assert.ok(
      content.includes("transition-all duration-200 ease-in-out"),
      "Must have 200ms smooth transition"
    );
  });

  test("app-sidebar.tsx contains h-12 for 48px Brand Header with QCET logo & school year", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("h-12"), "Must use h-12 (48px) for Brand Header");
    assert.ok(content.includes("/logo-qcet.png"), "Must use /logo-qcet.png");
    assert.ok(content.includes("QUẢN LÝ CÔNG VIỆC"), "Must render QUẢN LÝ CÔNG VIỆC title");
    assert.ok(content.includes("Năm học 2026–2027"), "Must render academic year 2026–2027");
  });

  test("app-sidebar.tsx renders sections CÁ NHÂN, TOÀN TRƯỜNG & ĐƠN VỊ, VĂN BẢN & ĐIỀU HÀNH", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("CÁ NHÂN"), "Must render CÁ NHÂN section");
    assert.ok(
      content.includes("TOÀN TRƯỜNG & ĐƠN VỊ"),
      "Must render TOÀN TRƯỜNG & ĐƠN VỊ section"
    );
    assert.ok(
      content.includes("VĂN BẢN & ĐIỀU HÀNH"),
      "Must render VĂN BẢN & ĐIỀU HÀNH section"
    );
  });

  test("app-sidebar.tsx renders subtle active indicator bar", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("bg-primary/10 text-primary font-semibold"),
      "Must apply subtle active tint"
    );
    assert.ok(
      content.includes("w-[3px] bg-primary rounded-r-full"),
      "Must render 3px rounded active indicator bar on left"
    );
  });

  test("app-sidebar.tsx includes settings link and collapse button with ⌘B shortcut in footer", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(content.includes("/settings"), "Must link to /settings");
    assert.ok(content.includes("Cài đặt"), "Must have Cài đặt label");
    assert.ok(content.includes("toggleCollapse"), "Must wire toggleCollapse");
    assert.ok(content.includes("⌘B"), "Must advertise ⌘B shortcut");
    assert.ok(content.includes("ChevronLeft"), "Must render ChevronLeft when expanded");
    assert.ok(content.includes("ChevronRight"), "Must render ChevronRight when collapsed");
  });

  test("app-sidebar.tsx applies thin-scrollbar to navigation scroll containers", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    assert.ok(
      content.includes("thin-scrollbar"),
      "Must apply thin-scrollbar to scrollable navigation"
    );
  });

  test("Anti-slop rule: 0% emojis in app-sidebar.tsx source file", () => {
    const content = fs.readFileSync(sidebarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    assert.strictEqual(
      emojiRegex.test(content),
      false,
      "app-sidebar.tsx must contain zero emojis"
    );
  });
});
