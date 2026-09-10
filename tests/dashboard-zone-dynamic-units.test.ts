import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { QCET_DEPARTMENTS } from "../src/components/org/organization-tree";

describe("DashboardZone Dynamic Units Suite", () => {
  const filePath = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx does NOT hardcode '11 đơn vị'", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes("của 11 đơn vị"),
      "Must not hardcode 'của 11 đơn vị' in DashboardZone subtitle"
    );
  });

  test("dashboard-zone.tsx references dynamic unit count or 16 subordinate units", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    const operationalCount = QCET_DEPARTMENTS.filter((d) => d.category !== "BGH").length;
    assert.strictEqual(operationalCount, 16);
    assert.ok(
      content.includes("QCET_DEPARTMENTS") || content.includes(`${operationalCount} đơn vị`),
      "Must reference operational units dynamically from QCET_DEPARTMENTS or display accurate operational count"
    );
  });
});
