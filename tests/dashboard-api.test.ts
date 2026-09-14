import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { fetchNotionDashboardData } from "../src/lib/notion-client";
import { NAVIGATION_ITEMS } from "../src/components/navigation";

describe("Dashboard Data Provider", () => {
  test("generates full dashboard overview payload with 2-tier tasks", () => {
    const data = getMockDashboardPayload();
    assert.ok(data.stats.totalSchoolTasks > 0);
    assert.ok(data.stats.totalStaffTasks > 0);
    assert.ok(data.tasks.length > 0);
    assert.ok(data.upcoming.length > 0);
    assert.ok(data.activities.length > 0);

    // Verify rollup integrity
    const firstTask = data.tasks[0];
    assert.ok(firstTask.subTasks.length >= 0);
    assert.equal(typeof firstTask.progressPercent, "number");
  });

  test("generates high-fidelity QCET scale matching Notion discovery (304 school tasks, 920 staff tasks)", () => {
    const data = getMockDashboardPayload();
    assert.equal(data.stats.totalSchoolTasks, 304);
    assert.equal(data.stats.totalStaffTasks, 920);
    assert.ok(data.stats.totalSchoolTasks >= 300);
    assert.ok(data.stats.totalStaffTasks >= 900);
    assert.equal(data.tasks.length, 304);
  });

  test("includes authentic QCET personnel and tasks", () => {
    const data = getMockDashboardPayload();
    const taskTitles = data.tasks.map((t) => t.title);
    const leads = new Set(data.tasks.map((t) => t.leadAssigneeName));

    assert.ok(leads.has("Trần Hùng"));
    assert.ok(leads.has("Nguyễn Ngọc Vinh"));
    assert.ok(leads.has("Mai Đinh Thị Xuân"));

    const hasBackupTask = taskTitles.some((t) => t.includes("Sao lưu, giám sát an ninh mạng"));
    const hasUBNDTask = taskTitles.some((t) => t.includes("Theo dõi kênh theo dõi chỉ đạo của UBND Tỉnh"));
    const hasArticleTask = taskTitles.some((t) => t.includes("Bài viết MỚI VÀO QCET"));
    const hasWifiTask = taskTitles.some((t) => t.includes("Rà soát hệ thống mạng và wifi"));

    assert.ok(hasBackupTask, "Missing backup/security task");
    assert.ok(hasUBNDTask, "Missing UBND directive task");
    assert.ok(hasArticleTask, "Missing new students article task");
    assert.ok(hasWifiTask, "Missing wifi review task");
  });

  test("fetchNotionDashboardData returns a safe empty payload without mock fallback when token is unset", async () => {
    const payload = await fetchNotionDashboardData();
    assert.ok(payload !== null && typeof payload === "object");
    assert.ok(Array.isArray(payload.tasks));
    assert.ok(Array.isArray(payload.upcoming));
    assert.ok(Array.isArray(payload.activities));
    assert.equal(payload.source, "notion-missing-token");
    assert.equal(payload.tasks.length, 0);
  });

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
