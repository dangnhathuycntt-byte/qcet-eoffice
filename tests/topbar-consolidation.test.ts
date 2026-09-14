import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Topbar Consolidation & Anti-Slop Suite", () => {
  const topbarPath = path.resolve(process.cwd(), "src/components/layout/app-topbar.tsx");

  test("app-topbar.tsx exists on disk", () => {
    assert.ok(fs.existsSync(topbarPath), "app-topbar.tsx must exist");
  });

  test("canonical resolveBreadcrumb integration for breadcrumb rendering", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      content.includes("resolveBreadcrumb"),
      "Must import or call canonical resolveBreadcrumb"
    );
    assert.ok(
      content.includes("TopbarBreadcrumbs"),
      "Must have TopbarBreadcrumbs component"
    );
    assert.ok(
      content.includes("rootTitle") && content.includes("pageTitle"),
      "Must render rootTitle and pageTitle from resolveBreadcrumb cleanly"
    );
  });

  test("duplicate CreateTaskModal is eliminated from topbar to prevent collision", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.equal(
      content.includes("<CreateTaskModal"),
      false,
      "Topbar must not mount CreateTaskModal directly"
    );
    assert.equal(
      content.includes("isCreateModalOpen"),
      false,
      "Topbar must not maintain isCreateModalOpen state"
    );
    assert.equal(
      content.includes('addEventListener("qcet:open-create-task"'),
      false,
      "Topbar must not listen to qcet:open-create-task; event belongs to dedicated modal hosts"
    );
  });

  test("visual anti-slop: zero emojis in AppTopbar source file", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = [...content.matchAll(emojiRegex)];
    assert.strictEqual(
      matches.length,
      0,
      `Found emojis in app-topbar.tsx: ${matches.map((m) => m[0]).join(", ")}`
    );
  });

  test("visual anti-slop: clean functional layout without unnecessary dev shims or clutter", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    // Ensure no dev role testing simulator
    assert.equal(content.includes("FlaskConical"), false, "Must not contain dev test icon");
    assert.equal(content.includes("Chế độ kiểm thử vai trò"), false, "Must not contain dev simulator");
    assert.equal(content.includes("devRoles"), false, "Must not contain devRoles");

    // Ensure header structural integrity
    assert.ok(content.includes('data-slot="app-topbar"'), "Must define data-slot app-topbar");
    assert.ok(content.includes("sticky top-0"), "Header must be sticky top-0");
  });

  test("topbar search trigger remains functional with keyboard shortcut guard", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Search"), "Must render Search icon");
    assert.ok(content.includes("⌘K"), "Must display ⌘K keyboard shortcut badge");
    assert.ok(
      content.includes("qcet:open-command-search"),
      "Must dispatch qcet:open-command-search on click and shortcut"
    );
    // Keyboard listener must guard editable form elements
    assert.ok(
      content.includes("INPUT") && content.includes("TEXTAREA"),
      "Keyboard shortcut listener must check for input/textarea to prevent hijacking"
    );
  });

  test("topbar notification bell remains functional with unread badge indicator", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Bell"), "Must render Bell icon");
    assert.ok(content.includes('href="/notifications"'), "Must link directly to /notifications");
    assert.ok(
      content.includes("badgeCounts?.notifications") || content.includes("unreadNotifications"),
      "Must inspect notification badge counts"
    );
  });

  test("topbar profile trigger renders initials and authentic user dropdown", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("getInitials"), "Must use getInitials helper");
    assert.ok(content.includes("UserProfileModal"), "Must render UserProfileModal when opened");
    assert.ok(content.includes("logout"), "Must provide logout action");
  });

  test("Wave A2: true 3-zone grid layout and quiet surface styling", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    // Height & quiet surface
    assert.ok(
      content.includes("h-[calc(52px+env(safe-area-inset-top,0px))]"),
      "Must maintain 52px height"
    );
    assert.ok(
      content.includes("bg-background/95"),
      "Must use quiet bg-background/95 shell styling"
    );
    // 3-zone grid structure
    assert.ok(
      content.includes("minmax(280px,384px)"),
      "Must use bounded center track minmax(280px, 384px)"
    );
    assert.ok(
      content.includes("justify-self-end"),
      "Must justify right actions to the end"
    );
    // Top-level PWA install button removed from topbar right actions
    // Smartphone icon must only appear inside the dropdown, not as a standalone topbar button
    assert.equal(
      content.includes('aria-label="Cài đặt ứng dụng di động"\n            title="Cài đặt ứng dụng di động"\n            className="hidden sm:flex min-h-[44px]'),
      false,
      "Top-level PWA install button must be removed from topbar chrome"
    );
    // Compact profile trigger: no persistent role/department paragraph in the trigger
    assert.equal(
      content.includes("title={user.roleLabel}"),
      false,
      "Profile trigger must not render persistent second-line role/department"
    );
  });

  test("Plan 10.2: level-1 /tasks renders no redundant breadcrumb", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes('"/tasks"'), "LEVEL_1_ROOTS must include /tasks");
    assert.ok(
      content.includes("isLevel1 && !hasDeeperContext"),
      "TopbarBreadcrumbs must return null for level-1 without deeper context"
    );
    assert.ok(content.includes("return null"), "Level-1 breadcrumb must return null");
  });

  test("Plan 10.2: deep task context with taskId/id can render breadcrumb", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      content.includes("hasDeeperContext"),
      "Must define hasDeeperContext guard"
    );
    assert.ok(
      content.includes('searchParams?.get("taskId")'),
      "Deep context must inspect taskId query param"
    );
    assert.ok(
      content.includes('searchParams?.get("id")'),
      "Deep context must inspect id query param"
    );
  });

  test("Plan 10.2: global search launcher with CmdK label present", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      content.includes('id="tour-topbar-search"'),
      "Must retain global search launcher tour anchor"
    );
    assert.ok(content.includes("⌘K"), "Must display ⌘K label on search launcher");
    assert.ok(
      content.includes("qcet:open-command-search"),
      "Search launcher must dispatch qcet:open-command-search"
    );
  });

  test("Plan 10.2: no top-level PWA button but profile menu retains install action", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.equal(
      content.includes('aria-label="Cài đặt ứng dụng di động"'),
      false,
      "No top-level PWA Smartphone button in header right zone"
    );
    assert.strictEqual(
      (content.match(/<Smartphone/g) || []).length,
      1,
      "Smartphone icon must appear exactly once (inside profile dropdown)"
    );
    assert.ok(
      content.includes("qcet:open-install-modal"),
      "Profile menu must retain qcet:open-install-modal install action"
    );
    assert.ok(
      content.includes("Cài đặt ứng dụng di động"),
      "Profile menu must retain install menu label"
    );
  });

  test("Plan 10.2: notifications and account remain accessible", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("Bell"), "Must render Bell icon");
    assert.ok(
      content.includes('aria-label="Thông báo điều hành"'),
      "Notifications trigger must expose accessible name"
    );
    assert.ok(content.includes('href="/notifications"'), "Must link to /notifications");
    assert.ok(content.includes("getInitials"), "Account trigger must render user initials");
    assert.ok(content.includes("logout"), "Account menu must provide logout action");
  });

  test("Plan 10.2: no Giao viec / New Task CTA in topbar", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.equal(content.includes("Giao việc"), false, "Topbar must not contain Giao việc CTA");
    assert.equal(content.includes("Giao viec"), false, "Topbar must not contain ascii Giao viec CTA");
    assert.equal(content.includes("New Task"), false, "Topbar must not contain New Task CTA");
    assert.equal(
      content.includes("qcet:open-create-task"),
      false,
      "Topbar must not dispatch qcet:open-create-task"
    );
  });

  describe("Clean Chrome & Contextual Scoping (merged)", () => {
    const dashboardZonePath = path.resolve(
      process.cwd(),
      "src/components/dashboard/zones/dashboard-zone.tsx"
    );

    test("app-topbar enforces Clean Chrome: no ScopeSwitcher or GlobalMonthSelector", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(
        !content.includes("ScopeSwitcher"),
        "app-topbar.tsx must not contain ScopeSwitcher (Leaky Global Shell)"
      );
      assert.ok(
        !content.includes("GlobalMonthSelector"),
        "app-topbar.tsx must not contain GlobalMonthSelector (Leaky Global Shell)"
      );
    });

    test("app-topbar retains NotificationPopover", () => {
      const content = fs.readFileSync(topbarPath, "utf-8");
      assert.ok(content.includes("NotificationPopover"), "Topbar must retain NotificationPopover");
    });

    test("dashboard-zone mounts ScopeSwitcher and GlobalMonthSelector inside React Suspense", () => {
      const content = fs.readFileSync(dashboardZonePath, "utf-8");
      assert.match(
        content,
        /import\s+\{\s*ScopeSwitcher\s*\}\s+from\s+["']@\/components\/layout\/scope-switcher["']/,
        "dashboard-zone.tsx must import ScopeSwitcher"
      );
      assert.match(
        content,
        /import\s+\{\s*GlobalMonthSelector\s*\}\s+from\s+["']@\/components\/layout\/global-month-selector["']/,
        "dashboard-zone.tsx must import GlobalMonthSelector"
      );
      assert.ok(
        content.includes('id="tour-scope-switcher"'),
        "dashboard-zone.tsx must maintain id='tour-scope-switcher'"
      );
      assert.ok(
        content.includes('id="tour-month-selector"'),
        "dashboard-zone.tsx must maintain id='tour-month-selector'"
      );
      assert.ok(content.includes("<Suspense"), "DashboardZone must wrap scope chrome with Suspense");
    });
  });
});
