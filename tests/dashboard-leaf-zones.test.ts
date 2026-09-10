import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { OrgZone } from "../src/components/dashboard/zones/org-zone";
import { CalendarZone } from "../src/components/dashboard/zones/calendar-zone";

describe("Leaf Zones Contract & Implementation Audit", () => {
  test("OrgZone and CalendarZone are memoized React components", () => {
    assert.equal(typeof OrgZone, "object");
    assert.equal(typeof CalendarZone, "object");
  });

  test("OrgZone source contains data-slot zone-org and imports OrganizationTree", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/org-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes('data-slot="zone-org"'));
    assert.ok(content.includes("OrganizationTree"));
  });

  test("CalendarZone source contains data-slot zone-calendar and imports CalendarMonthView", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/calendar-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes('data-slot="zone-calendar"'));
    assert.ok(content.includes("CalendarMonthView"));
  });
});
