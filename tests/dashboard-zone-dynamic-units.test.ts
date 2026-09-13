import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("DashboardZone Dynamic Units Suite", () => {
  const filePath = path.join(process.cwd(), "src/components/dashboard/zones/dashboard-zone.tsx");

  test("dashboard-zone.tsx does NOT hardcode '11 đơn vị'", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(
      !content.includes("của 11 đơn vị"),
      "Must not hardcode 'của 11 đơn vị' in DashboardZone subtitle"
    );
  });

  // Requirement (plan T05.5 / T06.1): the header must not assert a hardcoded unit
  // count at all. The old test accepted "16 đơn vị" as literal text in the header.
  test("dashboard-zone.tsx does NOT hardcode any subordinate-unit count", () => {
    const content = fs.readFileSync(filePath, "utf-8");
    assert.equal(
      /\d+\s*đơn vị\s*trực thuộc/.test(content),
      false,
      "header must not hardcode a subordinate-unit count"
    );
    assert.equal(
      content.includes("QCET_DEPARTMENTS"),
      false,
      "header must not import a hardcoded department list just to count units"
    );
  });
});
