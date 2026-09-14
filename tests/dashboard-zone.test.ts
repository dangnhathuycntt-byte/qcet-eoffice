import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";
import { OrgZone } from "../src/components/dashboard/zones/org-zone";
import { CalendarZone } from "../src/components/dashboard/zones/calendar-zone";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import { TasksExpandedViews } from "../src/components/dashboard/zones/tasks-expanded-views";
import { TasksZone } from "../src/components/dashboard/zones/tasks-zone";
import { DashboardModalsHost } from "../src/components/dashboard/dashboard-modals-host";

const ZONE_DIR = "../src/components/dashboard/zones/";
const zoneFile = (rel: string) => path.resolve(__dirname, ZONE_DIR + rel);
const read = (rel: string) => fs.readFileSync(zoneFile(rel), "utf-8");

describe("Dashboard Zone & Orchestrator Contracts", () => {
  test("DashboardZone, leaf zones, tasks zones and modals host are memoized React components", () => {
    for (const component of [
      DashboardZone,
      OrgZone,
      CalendarZone,
      TasksFocusLanding,
      TasksExpandedViews,
      TasksZone,
      DashboardModalsHost,
    ]) {
      assert.equal(typeof component, "object");
    }
  });

  // Requirement (plan T06.1 / F01): one H1 "Bàn làm việc"; no role badge, no duplicated
  // role subtitle, no hardcoded unit count.
  test("DashboardZone header is a single clean H1 with no role badge or hardcoded unit count", () => {
    const content = read("dashboard-zone.tsx");
    assert.ok(content.includes(">Bàn làm việc<") || content.includes("Bàn làm việc\n"), "H1 must read 'Bàn làm việc'");
    assert.equal(content.includes("roleBadge"), false, "role badge must be removed");
    assert.equal(content.includes("roleSubtitle"), false, "duplicated role subtitle must be removed");
    assert.equal(/đơn vị trực thuộc/.test(content), false, "hardcoded unit count must be removed");
    assert.equal(content.includes("QCET_DEPARTMENTS"), false, "no hardcoded department count import");
    assert.equal(/\d+\s*đơn vị\s*trực thuộc/.test(content), false, "header must not hardcode a subordinate-unit count");
  });

  // Requirement (plan T03): the zone consumes the canonical reactive filter output
  // (`filteredTasks`) and must not grow a divergent filterDashboardReactiveTasks.
  test("DashboardZone consumes canonical filteredTasks and no divergent filterDashboardReactiveTasks", () => {
    const content = read("dashboard-zone.tsx");
    assert.equal(content.includes("filterDashboardReactiveTasks"), false, "DashboardZone must not use divergent filterDashboardReactiveTasks");
    assert.ok(content.includes("filteredTasks"), "DashboardZone must consume filteredTasks from useDashboardData");
    assert.equal(content.includes("DEFAULT_ACTION_ITEMS"), false, "DashboardZone must not reference DEFAULT_ACTION_ITEMS");
    assert.ok(
      content.includes("tasks={baseTasks}") || content.includes("tasks={filteredTasks}"),
      "DashboardZone must pass the task set to PersonalWorkbench"
    );
    assert.ok(
      content.includes("filteredTasks={filteredTasks}"),
      "DashboardZone must pass the reactive filtered tasks to PersonalWorkbench"
    );
  });

  test("PersonalWorkbench attentionOnly prop gates SmartWorkbox and context widgets", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/dashboard/personal-workbench.tsx"),
      "utf-8"
    );
    assert.ok(content.includes("attentionOnly"), "PersonalWorkbench must declare attentionOnly prop");
    assert.ok(content.includes("!attentionOnly"), "SmartWorkbox and context widgets must be gated by !attentionOnly");
  });

  test("OrgZone and CalendarZone wrap their canonical leaf components", () => {
    const orgContent = fs.readFileSync(zoneFile("org-zone.tsx"), "utf-8");
    assert.ok(orgContent.includes('data-slot="zone-org"'));
    assert.ok(orgContent.includes("OrganizationTree"));

    const calendarContent = fs.readFileSync(zoneFile("calendar-zone.tsx"), "utf-8");
    assert.ok(calendarContent.includes('data-slot="zone-calendar"'));
    assert.ok(calendarContent.includes("CalendarMonthView"));
  });

  test("DashboardModalsHost loads the 3 dashboard modals on demand", () => {
    const content = fs.readFileSync(
      path.resolve(__dirname, "../src/components/dashboard/dashboard-modals-host.tsx"),
      "utf-8"
    );
    assert.ok(content.includes("TaskDetailSideSheet"));
    assert.ok(content.includes("CreateTaskModal"));
    assert.ok(content.includes("DelegationManagementModal"));
    assert.ok(content.includes("useDashboardModal"));
    assert.ok(content.includes('data-slot="dashboard-modals-host"'));
  });

  test("Zone containers and DashboardModalsHost stay within the 350-line modularity budget", () => {
    const zones = [
      "org-zone.tsx",
      "calendar-zone.tsx",
      "dashboard-zone.tsx",
      "tasks-zone.tsx",
      "tasks-focus-landing.tsx",
      "tasks-expanded-views.tsx",
      "../dashboard-modals-host.tsx",
    ];

    for (const rel of zones) {
      const full = zoneFile(rel);
      assert.ok(fs.existsSync(full), `Missing expected file: ${rel}`);
      const lines = fs.readFileSync(full, "utf-8").split("\n").length;
      assert.ok(lines <= 350, `Expected ${rel} to be <= 350 lines, but found ${lines}`);
    }
  });

  test("DashboardZone stays within the < 150-line size budget", () => {
    const lines = read("dashboard-zone.tsx").split("\n").length;
    assert.ok(lines < 150, `DashboardZone exceeded 150 lines: ${lines}`);
  });

  test("src/app/page.tsx is a thin orchestrator (<=250 lines, no inline BentoPortalHub)", () => {
    const content = fs.readFileSync(path.resolve(__dirname, "../src/app/page.tsx"), "utf-8");
    const lines = content.split("\n").length;
    assert.ok(lines <= 250, `Expected page.tsx to be <= 250 lines, but found ${lines} lines`);
    assert.equal(
      content.includes("<BentoPortalHub"),
      false,
      "Expected inline BentoPortalHub to be eliminated (redirects to /portal)"
    );
  });
});
