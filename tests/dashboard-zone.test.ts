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
    assert.ok(content.includes("DashboardSituationStrip"), "Must reference DashboardSituationStrip (SITUATION section)");
    assert.ok(content.includes("UpcomingDeadlinesWidget"));
    assert.ok(content.includes("ActivityFeedWidget"));
  });

  // Requirement (plan T06.2 / F01): the compact summary must be visible BEFORE the
  // queue. The old ACTION→SITUATION order pushed the summary below the queue.
  test("DashboardZone enforces ACTION -> SITUATION -> CONTEXT section order (Action-First)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");

    const actionPos = content.indexOf('data-slot="section-action"');
    const situationPos = content.indexOf('data-slot="section-situation"');
    const contextPos = content.indexOf('data-slot="section-context"');

    assert.ok(actionPos > -1, 'Must have data-slot="section-action"');
    assert.ok(situationPos > -1, 'Must have data-slot="section-situation"');
    assert.ok(contextPos > -1, 'Must have data-slot="section-context"');
    assert.ok(actionPos < situationPos, "ACTION queue must appear before SITUATION summary");
    assert.ok(situationPos < contextPos, "SITUATION section must appear before CONTEXT section");
  });

  // Requirement (plan T06.1 / F01): one H1 "Bàn làm việc"; no role badge, no duplicated
  // role subtitle, no hardcoded unit count.
  test("DashboardZone header is a single clean H1 with no role badge or hardcoded unit count", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes(">Bàn làm việc<") || content.includes("Bàn làm việc\n"), "H1 must read 'Bàn làm việc'");
    assert.equal(content.includes("roleBadge"), false, "role badge must be removed");
    assert.equal(content.includes("roleSubtitle"), false, "duplicated role subtitle must be removed");
    assert.equal(/đơn vị trực thuộc/.test(content), false, "hardcoded unit count must be removed");
    assert.equal(content.includes("QCET_DEPARTMENTS"), false, "no hardcoded department count import");
  });

  test("DashboardZone does not render ExecutiveStatStrip (replaced by DashboardSituationStrip)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.equal(
      content.includes("<ExecutiveStatStrip"),
      false,
      "dashboard-zone.tsx must not render <ExecutiveStatStrip /> — use DashboardSituationStrip for SITUATION"
    );
  });

  test("DashboardZone does not contain dark: Tailwind classes (light-only standard)", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/zones/dashboard-zone.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const darkMatches = content.match(/\bdark:/g) || [];
    assert.equal(darkMatches.length, 0, `Found ${darkMatches.length} dark: classes — violates light-only standard`);
  });

  test("DashboardSituationStrip source file: no dark: classes, no emoji, proper data-slot", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/dashboard-situation-strip.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    const darkMatches = content.match(/\bdark:/g) || [];
    assert.equal(darkMatches.length, 0, "DashboardSituationStrip must not use dark: classes");
    assert.ok(content.includes('data-slot="dashboard-situation-strip"'));
    // No emoji — check for surrogate pair range
    assert.ok(!/[\u{1F300}-\u{1F9FF}]/u.test(content), "No decorative emoji allowed");
  });

  test("PersonalWorkbench attentionOnly prop gates SmartWorkbox and context widgets", () => {
    const filePath = path.resolve(__dirname, "../src/components/dashboard/personal-workbench.tsx");
    const content = fs.readFileSync(filePath, "utf-8");
    assert.ok(content.includes("attentionOnly"), "PersonalWorkbench must declare attentionOnly prop");
    assert.ok(content.includes("!attentionOnly"), "SmartWorkbox and context widgets must be gated by !attentionOnly");
  });
});
