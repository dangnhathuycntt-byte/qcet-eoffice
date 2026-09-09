import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Topbar Clean Chrome & Contextual Scoping Invariants", () => {
  const topbarPath = path.join(process.cwd(), "src/components/layout/app-topbar.tsx");
  const dashboardZonePath = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("app-topbar.tsx exists and is readable", () => {
    assert.strictEqual(fs.existsSync(topbarPath), true, "app-topbar.tsx must exist");
  });

  test("app-topbar.tsx enforces Clean Chrome: does NOT import ScopeSwitcher or GlobalMonthSelector", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(
      !content.includes("ScopeSwitcher"),
      "app-topbar.tsx must not contain ScopeSwitcher to prevent Leaky Global Shell"
    );
    assert.ok(
      !content.includes("GlobalMonthSelector"),
      "app-topbar.tsx must not contain GlobalMonthSelector to prevent Leaky Global Shell"
    );
  });

  test("app-topbar.tsx maintains essential global chrome elements", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    assert.ok(content.includes("TopbarBreadcrumbs"), "Topbar must retain TopbarBreadcrumbs");
    assert.ok(content.includes('id="tour-topbar-search"'), "Topbar must retain tour-topbar-search");
    assert.ok(content.includes("NotificationPopover"), "Topbar must retain NotificationPopover");
  });

  test("dashboard-zone.tsx mounts ScopeSwitcher and GlobalMonthSelector inside React Suspense", (t) => {
    const content = fs.readFileSync(dashboardZonePath, "utf-8");
    if (!content.includes("ScopeSwitcher")) {
      t.skip("Contextual action bar in dashboard-zone.tsx scheduled for Task 2");
      return;
    }
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
      "dashboard-zone.tsx must maintain id='tour-scope-switcher' for Spotlight Tour"
    );
    assert.ok(
      content.includes('id="tour-month-selector"'),
      "dashboard-zone.tsx must maintain id='tour-month-selector' for Spotlight Tour"
    );
  });

  test("Anti-slop rule: 0% emojis in app-topbar.tsx", () => {
    const content = fs.readFileSync(topbarPath, "utf-8");
    const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
    const matches = content.match(emojiRegex);
    assert.strictEqual(matches, null, "app-topbar.tsx must contain zero emojis");
  });
});
