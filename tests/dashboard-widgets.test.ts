import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  formatDeadlineDistance,
  isDateOverdue,
  getInitials,
} from "../src/components/dashboard/upcoming-deadlines-widget";
import {
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
