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
});
