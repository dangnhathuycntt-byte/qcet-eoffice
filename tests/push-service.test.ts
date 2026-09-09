import test, { describe, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  formatTaskPushPayload,
  truncatePushText,
  getVapidPublicKey,
  sendPushNotificationToUser,
  setPushSenderForTesting,
  PushNotificationPayload,
} from "../src/lib/push-service";
import { prisma } from "../src/lib/prisma";

describe("Push Notification Copywriting & Truncation Suite", () => {
  test("truncatePushText enforces character budget strictly", () => {
    const longTitle = "[GIAO VIỆC] Kế hoạch triển khai đào tạo năm học mới 2026-2027 cho toàn bộ các khoa chuyên ngành";
    const truncated = truncatePushText(longTitle, 35);
    assert.ok(truncated.length <= 35, `Title length ${truncated.length} exceeds 35 chars`);
    assert.ok(truncated.endsWith("…"), "Truncated title must end with ellipsis");

    const shortText = "Nhiệm vụ ngắn";
    assert.strictEqual(truncatePushText(shortText, 35), shortText);

    const emptyText = "";
    assert.strictEqual(truncatePushText(emptyText, 35), "");
  });

  test("formatTaskPushPayload formats GIAO_VIEC correctly within budget", () => {
    const payload = formatTaskPushPayload({
      event: "TASK_ASSIGNED",
      taskTitle: "Tuyển sinh ĐH 2026",
      actorName: "BGH QCET",
      dueDateStr: "17h00 15/09",
      taskId: "t-101",
    });

    assert.ok(payload.title.includes("[GIAO VIỆC]"));
    assert.ok(payload.title.length <= 35, "Title must be <= 35 chars");
    assert.ok(payload.body.length <= 90, "Body must be <= 90 chars");
    assert.strictEqual(payload.tag, "task-t-101-assign");
    assert.ok(payload.data.linkHref.includes("t-101"));
    assert.strictEqual(payload.actions?.[0]?.action, "open");
    assert.strictEqual(payload.actions?.[0]?.title, "Xem ngay");
  });

  test("formatTaskPushPayload formats PHÊ DUYỆT and YÊU CẦU SỬA correctly", () => {
    const approvedPayload = formatTaskPushPayload({
      event: "DELIVERABLE_APPROVED",
      taskTitle: "Kế hoạch thực tập",
      actorName: "Hiệu trưởng",
      taskId: "t-102",
    });
    assert.ok(approvedPayload.title.includes("[ĐÃ DUYỆT]"));
    assert.ok(approvedPayload.title.length <= 35);
    assert.ok(approvedPayload.body.length <= 90);
    assert.strictEqual(approvedPayload.tag, "task-t-102-approve");

    const revisionPayload = formatTaskPushPayload({
      event: "DELIVERABLE_REVISION",
      taskTitle: "Báo cáo tài chính",
      actorName: "Trưởng phòng",
      taskId: "t-103",
    });
    assert.ok(revisionPayload.title.includes("[YÊU CẦU SỬA]"));
    assert.ok(revisionPayload.title.length <= 35);
    assert.ok(revisionPayload.body.length <= 90);
    assert.strictEqual(revisionPayload.tag, "task-t-103-revision");
  });

  test("formatTaskPushPayload formats SUBMIT, DEADLINE, and EXECUTIVE DIRECTIVE correctly", () => {
    const submitPayload = formatTaskPushPayload({
      event: "DELIVERABLE_SUBMITTED",
      taskTitle: "Đề án mở ngành CNTT",
      actorName: "TS. Nguyễn Văn A",
      taskId: "t-104",
    });
    assert.ok(submitPayload.title.includes("[NỘP DUYỆT]"));
    assert.strictEqual(submitPayload.tag, "task-t-104-submit");

    const deadlinePayload = formatTaskPushPayload({
      event: "DEADLINE_WARNING_24H",
      taskTitle: "Khảo sát việc làm",
      actorName: "Hệ thống",
      dueDateStr: "17h00 ngày mai",
      taskId: "t-105",
    });
    assert.ok(deadlinePayload.title.includes("[SẮP HẾT HẠN]"));
    assert.strictEqual(deadlinePayload.tag, "task-t-105-deadline");

    const directivePayload = formatTaskPushPayload({
      event: "EXECUTIVE_DIRECTIVE",
      taskTitle: "Chỉ đ��o phòng Đào tạo",
      actorName: "Hiệu trưởng",
      directiveNote: "Hoàn tất kiểm tra trước thứ Sáu",
      taskId: "t-106",
    });
    assert.ok(directivePayload.title.includes("[CHỈ ĐẠO BGH]"));
    assert.strictEqual(directivePayload.tag, "task-t-106-directive");
    assert.ok(directivePayload.body.includes("Hoàn tất kiểm tra trước thứ Sáu"));
  });

  test("getVapidPublicKey returns a valid non-empty public key string", () => {
    const key = getVapidPublicKey();
    assert.ok(typeof key === "string" && key.length > 20, "VAPID key should be a valid string");
  });
});

describe("Web Push Dispatch & Stale Token Purge Suite", () => {
  let testUserId: string;
  const createdSubIds: string[] = [];

  before(async () => {
    const user = await prisma.user.findFirst();
    assert.ok(user, "User must exist in database");
    testUserId = user.id;

    // Clean up any old test subscriptions for this user
    await prisma.pushSubscription.deleteMany({
      where: {
        userId: testUserId,
      },
    });
  });

  after(async () => {
    if (createdSubIds.length > 0) {
      await prisma.pushSubscription.deleteMany({
        where: { id: { in: createdSubIds } },
      });
    }
  });

  test("sendPushNotificationToUser handles user with no subscriptions gracefully", async () => {
    const nonExistentUserId = "user-without-subscriptions-" + Date.now();
    const payload: PushNotificationPayload = {
      title: "[TEST] Thông báo",
      body: "Nội dung thử nghiệm",
      tag: "test-tag",
      data: { linkHref: "/portal" },
    };

    const result = await sendPushNotificationToUser(nonExistentUserId, payload);
    assert.strictEqual(result.totalSubscriptions, 0);
    assert.strictEqual(result.sentCount, 0);
    assert.strictEqual(result.failedCount, 0);
    assert.strictEqual(result.revokedCount, 0);
    assert.strictEqual(result.success, true);
  });

  test("sendPushNotificationToUser dispatches to active subscription and handles 410 Gone by revoking", async () => {
    // Create 2 test subscriptions: 1 will succeed, 1 will return 410 Gone
    const subSuccess = await prisma.pushSubscription.create({
      data: {
        userId: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-success-${Date.now()}`,
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
        auth: "tBHItJI5svbpez7KI4CCXg==",
        status: "ACTIVE",
      },
    });
    createdSubIds.push(subSuccess.id);

    const subExpired = await prisma.pushSubscription.create({
      data: {
        userId: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-expired-${Date.now()}`,
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
        auth: "tBHItJI5svbpez7KI4CCXg==",
        status: "ACTIVE",
      },
    });
    createdSubIds.push(subExpired.id);

    // Mock sender using setPushSenderForTesting
    setPushSenderForTesting(async (subscription: any) => {
      if (subscription.endpoint === subExpired.endpoint) {
        const err: any = new Error("Subscription has expired or is no longer valid");
        err.statusCode = 410;
        throw err;
      }
      return { statusCode: 201, body: "", headers: {} as any };
    });

    try {
      const payload: PushNotificationPayload = {
        title: "[TEST] Kiểm thử Push",
        body: "Kiểm tra cơ chế self-healing khi token bị 410 Gone",
        tag: "test-self-healing",
        data: { linkHref: "/portal" },
      };

      const result = await sendPushNotificationToUser(testUserId, payload);
      assert.strictEqual(result.sentCount, 1, "One subscription should succeed");
      assert.strictEqual(result.revokedCount, 1, "One subscription should be revoked");

      // Verify that subExpired is now marked REVOKED in DB
      const updatedExpired = await prisma.pushSubscription.findUnique({
        where: { id: subExpired.id },
      });
      assert.strictEqual(updatedExpired?.status, "REVOKED");
      assert.strictEqual(updatedExpired?.lastFailureCode, 410);

      // Verify subSuccess remains ACTIVE
      const updatedSuccess = await prisma.pushSubscription.findUnique({
        where: { id: subSuccess.id },
      });
      assert.strictEqual(updatedSuccess?.status, "ACTIVE");
    } finally {
      setPushSenderForTesting(null);
    }
  });

  test("sendPushNotificationToUser handles 404 Not Found by revoking, and 500 by incrementing failureCount", async () => {
    const subNotFound = await prisma.pushSubscription.create({
      data: {
        userId: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-404-${Date.now()}`,
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
        auth: "tBHItJI5svbpez7KI4CCXg==",
        status: "ACTIVE",
      },
    });
    createdSubIds.push(subNotFound.id);

    const subServerError = await prisma.pushSubscription.create({
      data: {
        userId: testUserId,
        endpoint: `https://fcm.googleapis.com/fcm/send/test-500-${Date.now()}`,
        p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM=",
        auth: "tBHItJI5svbpez7KI4CCXg==",
        status: "ACTIVE",
        failureCount: 1,
      },
    });
    createdSubIds.push(subServerError.id);

    setPushSenderForTesting(async (subscription: any) => {
      if (subscription.endpoint === subNotFound.endpoint) {
        const err: any = new Error("Subscription not found");
        err.statusCode = 404;
        throw err;
      }
      if (subscription.endpoint === subServerError.endpoint) {
        const err: any = new Error("Internal push service error");
        err.statusCode = 500;
        throw err;
      }
      return { statusCode: 201, body: "", headers: {} as any };
    });

    try {
      const payload: PushNotificationPayload = {
        title: "[TEST] Lỗi 404 & 500",
        body: "Kiểm tra xử lý lỗi 404 và 500",
        tag: "test-errors",
        data: { linkHref: "/portal" },
      };

      const result = await sendPushNotificationToUser(testUserId, payload);
      assert.ok(result.revokedCount >= 1, "At least one subscription should be revoked for 404");
      assert.ok(result.failedCount >= 1, "At least one subscription should fail with 500");

      const updated404 = await prisma.pushSubscription.findUnique({
        where: { id: subNotFound.id },
      });
      assert.strictEqual(updated404?.status, "REVOKED");
      assert.strictEqual(updated404?.lastFailureCode, 404);

      const updated500 = await prisma.pushSubscription.findUnique({
        where: { id: subServerError.id },
      });
      assert.strictEqual(updated500?.status, "ACTIVE");
      assert.strictEqual(updated500?.failureCount, 2);
      assert.strictEqual(updated500?.lastFailureCode, 500);
    } finally {
      setPushSenderForTesting(null);
    }
  });
});
