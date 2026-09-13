import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Monthly Partitioning", () => {
  const zonePath = path.resolve(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx drives the monthly partition from the canonical academic month", () => {
    const content = fs.readFileSync(zonePath, "utf8");
    // The active academic month is surfaced through the GlobalMonthSelector control
    // and every summary the zone renders derives from the shared scope+period slice
    // (plan T03). The prior-overdue backlog is a per-cycle concern owned by the
    // calendar and task-table surfaces, not the zone.
    assert.match(content, /GlobalMonthSelector/);
    assert.match(content, /displayedStats/);
    assert.match(content, /KỲ VẬN HÀNH THÁNG/);
  });
});
