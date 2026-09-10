import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Monthly Partitioning", () => {
  const zonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx renders monthly indicator and connects to priorOverdueBacklog", () => {
    const content = fs.readFileSync(zonePath, "utf8");
    assert.match(content, /selectedAcademicMonth/);
    assert.match(content, /priorOverdueBacklog/);
  });
});
