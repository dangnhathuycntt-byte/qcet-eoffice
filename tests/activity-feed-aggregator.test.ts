import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  consolidateActivityFeed,
  canConsolidate,
  isConsolidatableAction,
  getEditCategory,
  getAuditActionLabel,
  type RawAuditLogItem,
} from "@/lib/tasks/activity-feed-aggregator";

describe("Activity Feed Aggregator & Consolidation Engine Suite", () => {
  const baseTime = new Date("2026-09-17T09:00:00.000Z").getTime();

  it("consolidates consecutive description edits by the same person within 60-second threshold", () => {
    const rawEvents: RawAuditLogItem[] = [
      // Sắp xếp desc: mới nhất đến cũ nhất
      {
        id: "evt-3",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 45000).toISOString(), // +45s
        actorName: "ThS. Phạm Văn Tường",
        actorId: "user-tuong",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      {
        id: "evt-2",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 20000).toISOString(), // +20s
        actorName: "ThS. Phạm Văn Tường",
        actorId: "user-tuong",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      {
        id: "evt-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(), // 0s
        actorName: "ThS. Phạm Văn Tường",
        actorId: "user-tuong",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);

    // Phải gộp 3 sự kiện thành 1 sự kiện duy nhất trên feed
    assert.equal(feed.length, 1);
    assert.equal(feed[0].count, 3);
    assert.equal(feed[0].isConsolidated, true);
    assert.equal(feed[0].actorName, "ThS. Phạm Văn Tường");
    assert.match(feed[0].description!, /3 lần chỉnh sửa liên tiếp/);
    assert.equal(feed[0].rawEvents.length, 3);
  });

  it("splits into separate entries when the inactivity gap exceeds 60 seconds", () => {
    const rawEvents: RawAuditLogItem[] = [
      // Đợt 2 (sau 5 phút)
      {
        id: "evt-3",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 300000 + 10000).toISOString(), // 5m10s
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      {
        id: "evt-2",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 300000).toISOString(), // 5m00s (cách đợt 1 tận 4m40s)
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      // Đợt 1
      {
        id: "evt-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);

    // Phải chia thành 2 nhóm hoạt động
    assert.equal(feed.length, 2);
    // Nhóm gần nhất có 2 lần sửa
    assert.equal(feed[0].count, 2);
    assert.match(feed[0].description!, /2 lần chỉnh sửa/);
    // Nhóm cũ hơn có 1 lần sửa
    assert.equal(feed[1].count, 1);
    assert.equal(feed[1].isConsolidated, false);
  });

  it("never consolidates across different users (interleaved edits by two people)", () => {
    const rawEvents: RawAuditLogItem[] = [
      // Người A sửa lần 2 (+30s)
      {
        id: "evt-3",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 30000).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        actorId: "user-tuong",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      // Người B xen vào (+15s)
      {
        id: "evt-2",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 15000).toISOString(),
        actorName: "TS. Trần Minh Quang",
        actorId: "user-quang",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      // Người A sửa lần 1 (0s)
      {
        id: "evt-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        actorId: "user-tuong",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);

    // Không được gộp Người A qua Người B -> phải có 3 entries riêng biệt!
    assert.equal(feed.length, 3);
    assert.equal(feed[0].actorName, "ThS. Phạm Văn Tường");
    assert.equal(feed[1].actorName, "TS. Trần Minh Quang");
    assert.equal(feed[2].actorName, "ThS. Phạm Văn Tường");
  });

  it("never consolidates across business actions (status change, delegation, deadline, progress)", () => {
    const rawEvents: RawAuditLogItem[] = [
      // Sửa mô tả sau khi đổi trạng thái (+25s)
      {
        id: "evt-3",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime + 25000).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      // Đổi trạng thái nhiệm vụ (+10s) -> Business Barrier!
      {
        id: "evt-2",
        action: "IN_PROGRESS",
        timestamp: new Date(baseTime + 10000).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Đổi trạng thái sang: Đang thực hiện",
      },
      // Sửa mô tả trước đó (0s)
      {
        id: "evt-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);

    // Hành động đổi trạng thái nằm ở giữa ngăn cách 2 đợt sửa mô tả
    assert.equal(feed.length, 3);
    assert.equal(feed[0].action, "UPDATE_DESCRIPTION");
    assert.equal(feed[1].action, "IN_PROGRESS");
    assert.equal(feed[2].action, "UPDATE_DESCRIPTION");
  });

  it("does not consolidate title edits with description edits (different fields)", () => {
    const rawEvents: RawAuditLogItem[] = [
      {
        id: "evt-2",
        action: "UPDATE_TITLE",
        timestamp: new Date(baseTime + 5000).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: 'Đổi tiêu đề nhiệm vụ thành: "Kế hoạch năm học mới"',
      },
      {
        id: "evt-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);
    assert.equal(feed.length, 2);
    assert.equal(feed[0].action, "UPDATE_TITLE");
    assert.equal(feed[1].action, "UPDATE_DESCRIPTION");
  });

  it("deduplicates retry attempts and duplicate events arriving within 1 second", () => {
    const rawEvents: RawAuditLogItem[] = [
      {
        id: "evt-retry-1",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
      // Bản ghi trùng lặp do retry mạng cùng nội dung, cùng timestamp
      {
        id: "evt-retry-2",
        action: "UPDATE_DESCRIPTION",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Phạm Văn Tường",
        description: "Cập nhật mô tả nhiệm vụ",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].count, 1);
  });

  it("formats raw technical audit actions into natural Vietnamese labels", () => {
    assert.equal(getAuditActionLabel("TASK_UPDATED"), "Cập nhật thông tin nhiệm vụ");
    assert.equal(getAuditActionLabel("TASK_CREATED"), "Tạo mới nhiệm vụ");
    assert.equal(getAuditActionLabel("TASK_ASSIGNED"), "Phân công người phụ trách");
    assert.equal(getAuditActionLabel("TASK_STATUS_CHANGED"), "Thay đổi trạng thái");

    // Fallback in consolidated description when description is missing
    const rawEvents: RawAuditLogItem[] = [
      {
        id: "evt-raw-1",
        action: "TASK_UPDATED",
        timestamp: new Date(baseTime).toISOString(),
        actorName: "ThS. Đặng Nhật Huy",
      },
    ];

    const feed = consolidateActivityFeed(rawEvents, 60000);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].description, "Cập nhật thông tin nhiệm vụ");
  });
});
