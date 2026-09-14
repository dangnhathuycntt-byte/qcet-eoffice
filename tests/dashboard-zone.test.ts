import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { DashboardZone } from "../src/components/dashboard/zones/dashboard-zone";
import { OrgZone } from "../src/components/dashboard/zones/org-zone";
import { CalendarZone } from "../src/components/dashboard/zones/calendar-zone";
import { TasksFocusLanding } from "../src/components/dashboard/zones/tasks-focus-landing";
import { TasksExpandedViews } from "../src/components/dashboard/zones/tasks-expanded-views";
import { TasksZone } from "../src/components/dashboard/zones/tasks-zone";
import { DashboardModalsHost } from "../src/components/dashboard/dashboard-modals-host";

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
});
