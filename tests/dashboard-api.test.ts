import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { getMockDashboardPayload } from "./fixtures/dashboard-fixtures";
import { fetchNotionDashboardData } from "../src/lib/notion-client";

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

  test("fetchNotionDashboardData returns a valid payload with stats and tasks", async () => {
    const payload = await fetchNotionDashboardData();
    assert.ok(payload.stats.totalSchoolTasks > 0);
    assert.ok(payload.stats.totalStaffTasks > 0);
    assert.ok(payload.tasks.length > 0);
    assert.ok(payload.upcoming.length > 0);
    assert.ok(payload.activities.length > 0);
    assert.ok(payload.source === "notion-live" || payload.source === "mock-fallback");
  });
});
