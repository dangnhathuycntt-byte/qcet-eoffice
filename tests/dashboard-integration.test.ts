import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "../src/lib/mock-dashboard-data";
import { NAVIGATION_ITEMS } from "../src/components/navigation";

describe("Dashboard Assembly Integration", () => {
  test("full dashboard state mounts with all required sections", () => {
    const payload = getMockDashboardPayload();
    assert.ok(payload.stats.totalSchoolTasks >= 300, "school tasks >= 300");
    assert.ok(payload.stats.totalStaffTasks >= 900, "staff tasks >= 900");
    assert.ok(payload.tasks.length > 0, "tasks list is populated");
    assert.ok(payload.upcoming.length > 0, "upcoming deadlines populated");
    assert.ok(payload.activities.length > 0, "activities feed populated");
  });

  test("navigation items include Twenty Executive Dashboard links", () => {
    const labels = NAVIGATION_ITEMS.map((item) => item.label);
    assert.ok(labels.includes("Quản lý công việc") || labels.includes("Dashboard"), "includes Quản lý công việc or Dashboard");
    assert.ok(labels.includes("Cơ cấu & Danh bạ") || labels.includes("Cơ cấu tổ chức"), "includes Cơ cấu & Danh bạ");
    assert.ok(labels.includes("Báo cáo KPI"), "includes Báo cáo KPI");
    assert.ok(labels.includes("Thông báo"), "includes Thông báo");
  });
});
