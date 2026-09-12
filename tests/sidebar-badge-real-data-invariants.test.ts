import { test, describe } from "node:test";
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { DEFAULT_SIDEBAR_BADGES } from "@/components/layout/sidebar-context";

describe("P0 Attention Signals: Sidebar Badge Invariants", () => {
  test("DEFAULT_SIDEBAR_BADGES contains zero fake counts", () => {
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.calendar, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.notifications, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsInbox, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsOutbox, 0);
    assert.strictEqual(DEFAULT_SIDEBAR_BADGES.docsPending, 0);
  });

  test("app-sidebar.tsx does not contain fake fallback badge numbers (?? 1, ?? 5, ?? 6)", () => {
    const filePath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    assert.strictEqual(
      content.includes("badgeCounts?.calendar ?? 1"),
      false,
      "Must not contain calendar ?? 1"
    );
    assert.strictEqual(
      content.includes("badgeCounts?.notifications ?? 5"),
      false,
      "Must not contain notifications ?? 5"
    );
    assert.strictEqual(
      content.includes("badgeCounts?.docsInbox ?? 6"),
      false,
      "Must not contain docsInbox ?? 6"
    );
  });

  test("app-sidebar.tsx strictly suppresses zero, empty, or undefined badge counters", () => {
    const filePath = path.join(process.cwd(), "src/components/layout/app-sidebar.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    // Verify zero/empty/undefined suppression logic exists
    assert.ok(
      content.includes("text === undefined") &&
      content.includes("text === null") &&
      content.includes('text === ""') &&
      content.includes("text === 0") &&
      content.includes('text === "0"'),
      "app-sidebar must explicitly suppress undefined, null, empty string, 0, and '0' from rendering badges"
    );
  });
});
