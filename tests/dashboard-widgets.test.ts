import { test, describe } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  UpcomingDeadlinesWidget,
  formatDeadlineDistance,
  isDateOverdue,
  getInitials,
} from "../src/components/dashboard/upcoming-deadlines-widget";
import {
  ActivityFeedWidget,
  getActivityActionConfig,
} from "../src/components/dashboard/activity-feed-widget";
import type { UpcomingItem, ActivityEvent } from "../src/types/dashboard";

describe("UpcomingDeadlinesWidget Helpers", () => {
  test("formats relative due date correctly", () => {
    const today = new Date().toISOString().split("T")[0];
    assert.equal(formatDeadlineDistance(today), "Hôm nay");
  });

  test("formats tomorrow correctly", () => {
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    assert.equal(formatDeadlineDistance(tomorrowStr), "Ngày mai");
  });

  test("formats upcoming days within week correctly", () => {
    const base = new Date("2026-09-04T00:00:00Z");
    assert.equal(formatDeadlineDistance("2026-09-04", base), "Hôm nay");
    assert.equal(formatDeadlineDistance("2026-09-05", base), "Ngày mai");
    assert.equal(formatDeadlineDistance("2026-09-07", base), "Còn 3 ngày");
    assert.equal(formatDeadlineDistance("2026-09-11", base), "Còn 7 ngày");
  });

  test("formats past dates as overdue", () => {
    const base = new Date("2026-09-04T00:00:00Z");
    assert.equal(formatDeadlineDistance("2026-09-03", base), "Quá hạn 1 ngày");
    assert.equal(formatDeadlineDistance("2026-09-01", base), "Quá hạn 3 ngày");
  });

  test("isDateOverdue detects whether a date is before today", () => {
    const base = new Date("2026-09-04T00:00:00Z");
    assert.equal(isDateOverdue("2026-09-03", base), true);
    assert.equal(isDateOverdue("2026-09-04", base), false);
    assert.equal(isDateOverdue("2026-09-05", base), false);
  });

  test("getInitials generates 2-letter uppercase initials from Vietnamese names", () => {
    assert.equal(getInitials("Trần Hùng"), "TH");
    assert.equal(getInitials("Nguyễn Ngọc Vinh"), "NV");
    assert.equal(getInitials("Mai Đinh Thị Xuân"), "MX");
    assert.equal(getInitials(""), "QC");
  });
});

describe("ActivityFeedWidget Helpers", () => {
  test("getActivityActionConfig categorizes activity action verbs", () => {
    const complete = getActivityActionConfig("vừa hoàn thành công việc");
    assert.equal(complete.type, "completed");
    assert.ok(complete.badgeVariant === "success" || complete.badgeVariant === "default");

    const assign = getActivityActionConfig("vừa phân công nhiệm vụ");
    assert.equal(assign.type, "assigned");

    const upload = getActivityActionConfig("vừa tải lên ấn phẩm truyền thông");
    assert.equal(upload.type, "upload");

    const update = getActivityActionConfig("đã cập nhật tiến độ công việc");
    assert.equal(update.type, "updated");
  });
});

describe("Dashboard Widgets Compaction (Top 5 & Anti-Slop)", () => {
  const mockUpcoming: UpcomingItem[] = Array.from({ length: 12 }, (_, i) => ({
    id: `item-${i + 1}`,
    title: `Nhiệm vụ hạn chót thứ ${i + 1}`,
    dueDate: "2026-09-10",
    level: i % 2 === 0 ? "Trường" : "Đơn vị",
    assigneeName: `Giảng viên ${i + 1}`,
  }));

  const mockActivities: ActivityEvent[] = Array.from({ length: 12 }, (_, i) => ({
    id: `act-${i + 1}`,
    actorName: `Cán bộ ${i + 1}`,
    action: "vừa cập nhật tiến độ",
    targetTitle: `Kế hoạch số ${i + 1}`,
    timestamp: "10 phút trước",
    category: "CNTT",
  }));

  test("UpcomingDeadlinesWidget limits to 5 items by default with expand button", () => {
    const html = renderToStaticMarkup(
      React.createElement(UpcomingDeadlinesWidget, {
        items: mockUpcoming,
      })
    );

    assert.match(html, /Xem tất cả 12 nhiệm vụ hạn chót/);
    assert.match(html, /Hiển thị 5 nhiệm vụ sát hạn nhất/);
    assert.match(html, /Nhiệm vụ hạn chót thứ 1/);
    assert.match(html, /Nhiệm vụ hạn chót thứ 5/);
    assert.doesNotMatch(html, /Nhiệm vụ hạn chót thứ 6/);
  });

  test("ActivityFeedWidget limits to 5 items by default with expand button", () => {
    const html = renderToStaticMarkup(
      React.createElement(ActivityFeedWidget, {
        activities: mockActivities,
      })
    );

    assert.match(html, /Xem tất cả 12 hoạt động/);
    assert.match(html, /Hiển thị 5 hoạt động gần nhất/);
    assert.match(html, /Cán bộ 1/);
    assert.match(html, /Cán bộ 5/);
    assert.doesNotMatch(html, /Cán bộ 6/);
  });
});

