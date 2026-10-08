import { describe, it } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskActivityFeed } from "../src/components/tasks/detail/task-activity-feed";
import type { ConsolidatedActivityItem } from "../src/lib/tasks/activity-feed-aggregator";

const ev = (id: string, action: string, timestamp: string, description?: string): ConsolidatedActivityItem =>
  ({ id, action, timestamp, actorName: "Đặng Nhật Huy", description, count: 1, firstTimestamp: timestamp, lastTimestamp: timestamp, isConsolidated: false, rawEvents: [] }) as ConsolidatedActivityItem;

describe("TaskActivityFeed", () => {
  const now = new Date("2026-10-08T08:00:00Z"); // 15:00 giờ Việt Nam ngày 08/10
  const events = [
    ev("1", "UPDATE_DESCRIPTION", "2026-10-08T07:30:00Z", "Cập nhật mô tả nhiệm vụ (3 lần chỉnh sửa liên tiếp)"),
    ev("2", "TASK_STATUS_CHANGED", "2026-10-08T03:00:00Z", 'Chuyển trạng thái sang "Chờ duyệt"'),
    ev("3", "TASK_DEADLINE_CHANGED", "2026-10-07T10:00:00Z"),
    ev("4", "TASK_CREATED", "2026-10-01T10:00:00Z"),
  ];
  const html = renderToStaticMarkup(React.createElement(TaskActivityFeed, { events, now }));

  it("nhóm theo ngày: Hôm nay, Hôm qua, rồi ngày cụ thể", () => {
    assert.ok(html.includes("Hôm nay") && html.includes("Hôm qua") && html.includes("01/10/2026"));
    assert.ok(html.indexOf("Hôm nay") < html.indexOf("Hôm qua"));
  });

  it("mỗi sự kiện một dòng có người thao tác, nội dung và giờ theo múi giờ Việt Nam", () => {
    assert.equal((html.match(/<li /g) ?? []).length, 4);
    assert.ok(html.includes("Đặng Nhật Huy"));
    assert.ok(html.includes("14:30"), "07:30 UTC = 14:30 giờ Việt Nam");
    assert.ok(html.includes("Điều chỉnh thời hạn hoàn thành"), "dùng nhãn mặc định khi không có mô tả");
  });

  it("không còn kiểu dòng cũ: chấm tròn, nhãn 'lần lưu', dòng 'Người thao tác:'", () => {
    assert.ok(!html.includes("Người thao tác:") && !html.includes("lần lưu") && !html.includes("rounded-full bg-primary"));
  });

  it("icon dùng nét 1,5", () => {
    assert.ok(!html.includes('stroke-width="2"'));
  });
});
