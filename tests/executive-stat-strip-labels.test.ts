import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { getStatCardData, formatNumber } from "../src/components/dashboard/executive-stat-strip";
import type { DashboardStats } from "../src/types/dashboard";

test("executive-stat-strip displays accurate average progress title and transparent subtext", () => {
  const content = fs.readFileSync("src/components/dashboard/executive-stat-strip.tsx", "utf8");
  assert.ok(
    content.includes("Tiến độ trung bình toàn trường"),
    "Must include updated title 'Tiến độ trung bình toàn trường'"
  );
  assert.ok(
    content.includes("Tiến độ bình quân"),
    "Must include progress bar tooltip/label 'Tiến độ bình quân'"
  );
});

test("getStatCardData produces accurate MECE subtexts and card 4 progress format", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 304,
    schoolTasksInProgress: 212,
    schoolTasksCompleted: 92,
    schoolTasksNotStarted: 0,
    totalStaffTasks: 920,
    staffTasksInProgress: 580,
    staffTasksCompleted: 290,
    staffTasksNotStarted: 50,
    needsReviewTasksCount: 42,
    overdueTasksCount: 5,
    averageSchoolProgressPercent: 74,
    completionRate: 30,
  };

  const cards = getStatCardData(mockStats);

  // Card 1: Nhiệm vụ cấp Trường
  assert.equal(cards[0].id, "school-tasks");
  assert.equal(cards[0].title, "Nhiệm vụ cấp Trường");
  assert.equal(cards[0].value, "304");
  assert.equal(cards[0].subtext, "212 đang làm · 0 chưa làm · 92 hoàn thành");

  // Card 2: Công việc Đơn vị
  assert.equal(cards[1].id, "unit-tasks");
  assert.equal(cards[1].title, "Công việc Đơn vị");
  assert.equal(cards[1].value, "920");
  assert.equal(cards[1].subtext, "580 đang làm · 50 chưa làm · 290 hoàn thành");

  // Card 3: Cần xử lý & Trễ hạn
  assert.equal(cards[2].id, "urgent-tasks");
  assert.equal(cards[2].title, "Cần xử lý & Trễ hạn");
  assert.ok(cards[2].subtext.includes("42 cần duyệt · 5 trễ hạn"));

  // Card 4: Tiến độ trung bình toàn trường
  assert.equal(cards[3].id, "overall-progress");
  assert.equal(cards[3].title, "Tiến độ trung bình toàn trường");
  assert.equal(cards[3].value, "74%");
  assert.equal(cards[3].subtext, "Hoàn tất 92/304 (30%)");
  assert.equal(cards[3].progress, 74);
});

test("Card 4 calculates completionRate fallback when completionRate is undefined", () => {
  const mockStats: DashboardStats = {
    totalSchoolTasks: 100,
    schoolTasksInProgress: 50,
    schoolTasksCompleted: 25,
    totalStaffTasks: 50,
    staffTasksInProgress: 30,
    staffTasksCompleted: 20,
    needsReviewTasksCount: 2,
    overdueTasksCount: 1,
    averageSchoolProgressPercent: 45,
  };

  const cards = getStatCardData(mockStats);
  assert.equal(cards[3].subtext, "Hoàn tất 25/100 (25%)");
});
