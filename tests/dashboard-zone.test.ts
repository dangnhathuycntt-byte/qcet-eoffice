import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";

describe("DashboardZone Contract & Structure Verification", () => {
  test("DashboardZone is a memoized React component", () => {
    assert.equal(typeof DashboardZone, "object");
  });

  test("DashboardZone source file exists and adheres to size budget (< 150 lines)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const lineCount = content.split("\n").length;
    assert.ok(lineCount < 150, `DashboardZone exceeded 150 lines: ${lineCount}`);
    assert.ok(content.includes('data-slot="zone-dashboard"'));
    assert.ok(content.includes("ExecutiveStatStrip"));
    assert.ok(content.includes("UpcomingDeadlinesWidget"));
    assert.ok(content.includes("ActivityFeedWidget"));
  });
});
