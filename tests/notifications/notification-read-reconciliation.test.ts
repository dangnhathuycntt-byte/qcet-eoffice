import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  applyOptimisticRead,
  beginOptimisticRead,
  settleOptimisticRead,
  mapDbNotification,
  type QCETNotification,
} from "../../src/lib/notification-triage";

function buildInbox(): QCETNotification[] {
  return [
    mapDbNotification({
      id: "n-1",
      title: "Giao nhiệm vụ NV-092",
      body: "Triển khai báo cáo",
      category: "Nhiệm vụ",
      type: "task_assigned",
      isRead: false,
      linkHref: "/tasks?taskId=NV-092",
      createdAt: new Date().toISOString(),
    }),
    mapDbNotification({
      id: "n-2",
      title: "Đã nộp minh chứng",
      body: "Chờ duyệt",
      category: "Minh chứng",
      type: "deliverable_submitted",
      isRead: true,
      linkHref: "/tasks?taskId=NV-093",
      createdAt: new Date().toISOString(),
    }),
    mapDbNotification({
      id: "n-3",
      title: "Văn bản đến 142/QĐ",
      body: "Chuyển phòng đào tạo",
      category: "Văn bản",
      type: "document_received",
      isRead: false,
      linkHref: "/documents?docId=142/QĐ",
      createdAt: new Date().toISOString(),
    }),
  ];
}

describe("T46: optimistic mark-read rolls back / reconciles with server truth", () => {
  test("single mark-read applies optimistically and keeps the change on success", () => {
    const inbox = buildInbox();
    const session = beginOptimisticRead(inbox, "n-1");
    assert.equal(session.optimistic.find((n) => n.id === "n-1")?.isRead, true);
    // snapshot is untouched server truth
    assert.equal(session.snapshot.find((n) => n.id === "n-1")?.isRead, false);

    const settled = settleOptimisticRead(session, { ok: true });
    assert.equal(settled.find((n) => n.id === "n-1")?.isRead, true);
  });

  test("failed single mark-read reverts the optimistic read state", () => {
    const inbox = buildInbox();
    const session = beginOptimisticRead(inbox, "n-1");
    const settled = settleOptimisticRead(session, { ok: false });

    assert.deepEqual(
      settled,
      session.snapshot,
      "a failed mark-read must roll back to the pre-mutation snapshot"
    );
    assert.equal(
      settled.find((n) => n.id === "n-1")?.isRead,
      false,
      "the notification must display unread again after rollback"
    );
  });

  test("mark-all applies optimistically and rolls back entirely on failure", () => {
    const inbox = buildInbox();
    const session = beginOptimisticRead(inbox, "all");
    assert.ok(session.optimistic.every((n) => n.isRead), "optimistic state marks all read");

    const reverted = settleOptimisticRead(session, { ok: false });
    assert.deepEqual(reverted, session.snapshot, "failed mark-all reverts all optimistic reads");
    assert.equal(reverted.filter((n) => !n.isRead).length, 2);
  });

  test("successful settlement adopts authoritative server notifications when provided", () => {
    const inbox = buildInbox();
    const session = beginOptimisticRead(inbox, "n-3");
    const serverTruth = inbox.map((n) => ({ ...n, isRead: n.id === "n-3" }));

    const settled = settleOptimisticRead(session, {
      ok: true,
      serverNotifications: serverTruth,
    });
    assert.deepEqual(settled, serverTruth);
  });

  test("applyOptimisticRead only mutates the targeted notification", () => {
    const inbox = buildInbox();
    const next = applyOptimisticRead(inbox, "n-3");
    assert.equal(next.find((n) => n.id === "n-3")?.isRead, true);
    assert.equal(next.find((n) => n.id === "n-1")?.isRead, false);
    assert.equal(next.find((n) => n.id === "n-2")?.isRead, true);
  });
});
