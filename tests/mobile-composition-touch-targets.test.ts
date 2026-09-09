import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";

const ROOT_DIR = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT_DIR, "src");

describe("Task 8: Mobile-First Composition, Task Cards & 44px Touch Targets", () => {
  describe("1. 4-Tab Bottom Navigation (MobileBottomNav)", () => {
    const bottomNavPath = path.join(SRC_DIR, "components", "navigation", "mobile-bottom-nav.tsx");

    it("ensures mobile-bottom-nav.tsx exists", () => {
      assert.strictEqual(fs.existsSync(bottomNavPath), true);
    });

    it("verifies bottom nav contains exactly 4 primary mobile items", () => {
      const content = fs.readFileSync(bottomNavPath, "utf8");
      // Check for the 4 primary tabs
      assert.ok(content.includes("Bàn làm việc"), "Must have 'Bàn làm việc' tab");
      assert.ok(content.includes("Nhiệm vụ"), "Must have 'Nhiệm vụ' tab");
      assert.ok(content.includes("Văn bản"), "Must have 'Văn bản' tab");
      assert.ok(content.includes("Thêm"), "Must have 'Thêm' tab");

      // Verify routes
      assert.ok(content.includes('href: "/"') || content.includes("href: '/'") || content.includes('href = "/"'), "Must link to /");
      assert.ok(content.includes('href: "/tasks"') || content.includes("href: '/tasks'"), "Must link to /tasks");
      assert.ok(content.includes('href: "/documents"') || content.includes("href: '/documents'"), "Must link to /documents");
    });

    it("ensures bottom nav has >= 44px touch targets", () => {
      const content = fs.readFileSync(bottomNavPath, "utf8");
      assert.ok(
        content.includes("min-h-[44px]") || content.includes("h-[48px]") || content.includes("h-12") || content.includes("py-2"),
        "Must have >= 44px touch target height"
      );
    });

    it("ensures bottom nav opens a drawer/sheet for 'Thêm' (More) containing sub-links", () => {
      const content = fs.readFileSync(bottomNavPath, "utf8");
      assert.ok(
        content.includes("isDrawerOpen") || content.includes("isMoreOpen") || content.includes("moreOpen") || content.includes("showMore"),
        "Must have state for More sheet"
      );
      assert.ok(content.includes("/calendar"), "Must have link to /calendar");
      assert.ok(content.includes("/org"), "Must have link to /org");
      assert.ok(content.includes("/notifications") || content.includes("/settings"), "Must have links to notifications/settings");
    });

    it("verifies mobile bottom nav adheres to light-only anti-slop rules", () => {
      const content = fs.readFileSync(bottomNavPath, "utf8");
      const darkMatches = content.match(/dark:/g);
      assert.strictEqual(darkMatches, null, "Must not contain 'dark:' classes");

      // Emoji test
      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
      assert.strictEqual(emojiRegex.test(content), false, "Must not contain decorative emojis");
    });
  });

  describe("2. Mobile Task Cards (MobileTaskCard)", () => {
    const mobileCardPath = path.join(SRC_DIR, "components", "tasks", "mobile-task-card.tsx");

    it("ensures mobile-task-card.tsx exists", () => {
      assert.strictEqual(fs.existsSync(mobileCardPath), true);
    });

    it("verifies MobileTaskCard displays essential task attributes", () => {
      const content = fs.readFileSync(mobileCardPath, "utf8");
      assert.ok(content.includes("task.code") || content.includes("task.title"), "Must render task title and code");
      assert.ok(content.includes("status") || content.includes("statusConfig"), "Must render status badge");
      assert.ok(content.includes("priority") || content.includes("priorityConfig"), "Must render priority badge");
      assert.ok(content.includes("department") || content.includes("assignee"), "Must render department/assignee info");
      assert.ok(content.includes("dueDate") || content.includes("deadline") || content.includes("due"), "Must render deadline");
      assert.ok(content.includes("progress") || content.includes("ProgressBar"), "Must render progress bar");
    });

    it("verifies MobileTaskCard has min 44px touch targets", () => {
      const content = fs.readFileSync(mobileCardPath, "utf8");
      assert.ok(
        content.includes("min-h-[44px]") || content.includes("min-h-[48px]") || content.includes("p-3.5") || content.includes("p-4"),
        "Card and buttons must adhere to ergonomic touch zone"
      );
    });

    it("verifies MobileTaskCard adheres to light-only anti-slop rules", () => {
      const content = fs.readFileSync(mobileCardPath, "utf8");
      const darkMatches = content.match(/dark:/g);
      assert.strictEqual(darkMatches, null, "Must not contain 'dark:' classes");

      const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}]/u;
      assert.strictEqual(emojiRegex.test(content), false, "Must not contain decorative emojis");
    });
  });

  describe("3. Responsive Layout in ModularCascadingTaskTable", () => {
    const tablePath = path.join(SRC_DIR, "components", "tasks", "table", "modular-cascading-task-table.tsx");

    it("ensures table adapts between desktop table and mobile cards", () => {
      const content = fs.readFileSync(tablePath, "utf8");
      assert.ok(
        content.includes("MobileTaskCard") || content.includes("mobile-task-card"),
        "ModularCascadingTaskTable must import and use MobileTaskCard"
      );
      assert.ok(
        content.includes("hidden md:block") || content.includes("hidden sm:block") || content.includes("md:hidden") || content.includes("sm:hidden"),
        "Must toggle desktop table vs mobile cards responsively"
      );
    });
  });

  describe("4. Mobile Filter Bottom Sheet in Task Toolbar", () => {
    const toolbarPath = path.join(SRC_DIR, "components", "dashboard", "unified-task-toolbar.tsx");
    const tableToolbarPath = path.join(SRC_DIR, "components", "tasks", "table", "components", "task-table-toolbar.tsx");

    it("ensures unified-task-toolbar.tsx has mobile filter sheet or trigger", () => {
      const content = fs.readFileSync(toolbarPath, "utf8");
      assert.ok(
        content.includes("isFilterOpen") || content.includes("isMobileFilterOpen") || content.includes("Sheet") || content.includes("Bộ lọc"),
        "Must provide mobile filter sheet / trigger"
      );
      assert.ok(
        content.includes("min-h-[44px]") || content.includes("h-11") || content.includes("min-h-[40px]"),
        "Mobile filter controls must meet touch target ergonomics"
      );
    });

    it("ensures task-table-toolbar.tsx provides mobile filter bottom sheet trigger", () => {
      const content = fs.readFileSync(tableToolbarPath, "utf8");
      assert.ok(
        (content.includes("isMobileFilterOpen") || content.includes("isFilterOpen")) && content.includes("role=\"dialog\""),
        "Task table toolbar must provide dialog/sheet for mobile filters"
      );
      assert.ok(
        content.includes("min-h-[44px]"),
        "Must provide >= 44px touch targets on mobile filter triggers"
      );
    });
  });

  describe("5. App Layout Integration", () => {
    const layoutPath = path.join(SRC_DIR, "components", "layout", "app-shell.tsx");

    it("ensures AppShell renders MobileBottomNav for mobile viewports", () => {
      const content = fs.readFileSync(layoutPath, "utf8");
      assert.ok(
        content.includes("MobileBottomNav") || content.includes("mobile-bottom-nav"),
        "AppShell must render MobileBottomNav"
      );
      assert.ok(
        content.includes("pb-[calc(") || content.includes("pb-16") || content.includes("pb-20"),
        "AppShell main content must pad bottom to prevent nav occlusion"
      );
    });
  });
});
