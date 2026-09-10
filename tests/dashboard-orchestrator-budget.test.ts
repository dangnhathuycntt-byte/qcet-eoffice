import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Dashboard Orchestrator Line Budget & Architecture Invariants", () => {
  const pagePath = path.resolve(__dirname, "../src/app/page.tsx");

  test("src/app/page.tsx is reduced to under 250 lines", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    const lines = content.split("\n").length;
    assert.ok(
      lines <= 250,
      `Expected page.tsx to be <= 250 lines, but found ${lines} lines`
    );
  });

  test("src/app/page.tsx does not contain dead portal zone inline", () => {
    const content = fs.readFileSync(pagePath, "utf-8");
    assert.equal(
      content.includes("<BentoPortalHub"),
      false,
      "Expected inline BentoPortalHub to be eliminated (redirects to /portal)"
    );
  });

  test("All zone container files exist and are focused under 350 lines", () => {
    const zones = [
      "../src/components/dashboard/zones/org-zone.tsx",
      "../src/components/dashboard/zones/calendar-zone.tsx",
      "../src/components/dashboard/zones/dashboard-zone.tsx",
      "../src/components/dashboard/zones/tasks-zone.tsx",
      "../src/components/dashboard/zones/tasks-focus-landing.tsx",
      "../src/components/dashboard/zones/tasks-expanded-views.tsx",
      "../src/components/dashboard/dashboard-modals-host.tsx",
    ];

    for (const relPath of zones) {
      const fullPath = path.resolve(__dirname, relPath);
      assert.ok(fs.existsSync(fullPath), `Missing expected file: ${relPath}`);
      const lines = fs.readFileSync(fullPath, "utf-8").split("\n").length;
      assert.ok(
        lines <= 350,
        `Expected ${relPath} to be <= 350 lines, but found ${lines}`
      );
    }
  });
});
