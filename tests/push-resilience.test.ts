import { describe, it } from "node:test";
import assert from "node:assert/strict";
import manifest from "../src/app/manifest";
import prisma from "../src/lib/prisma";
import {
  sendPushNotificationToUser,
  setPushSenderForTesting,
  ensureVapidConfigured,
} from "../src/lib/push-service";
import { areServerKeysEqual } from "../src/hooks/use-push-notification";

describe("Task 3: PWA & Service Worker Resilience", () => {
  it("manifest() includes id and scope properties for iOS/Android standalone mode", () => {
    const m = manifest();
    assert.equal(m.id, "/");
    assert.equal(m.scope, "/");
    assert.equal(m.display, "standalone");
  });
});

describe("Task 4: Push Circuit Breaker & Key Rotation", { concurrency: 1 }, () => {
  async function getOrCreateResilienceUser(suffix: string) {
    const id = `user-push-resilience-${suffix}`;
    return prisma.user.upsert({
      where: { id },
      update: {},
      create: {
        id,
        email: `push-circuit-${suffix}@test.com`,
        name: `Push Resilience Circuit Tester ${suffix}`,
        role: "CHUYEN_VIEN",
      },
    });
  }

  it("revokes subscription immediately on 404 or 410 Gone", async () => {
    const user = await getOrCreateResilienceUser("410");

    // Clean up any existing active subscriptions for this test user to isolate counts
    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id },
    });

    const endpoint = `https://fcm.googleapis.com/fcm/send/test-410-${Date.now()}`;
    const testSub = await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint,
        p256dh: "test-p256dh",
        auth: "test-auth",
        status: "ACTIVE",
      },
    });

    setPushSenderForTesting(async () => {
      const err: any = new Error("Subscription expired");
      err.statusCode = 410;
      throw err;
    });

    try {
      const res = await sendPushNotificationToUser(user.id, {
        title: "Test",
        body: "Test Body",
        tag: "test-tag-410",
        data: { linkHref: "/portal" },
      });

      assert.equal(res.revokedCount, 1);
      const updated = await prisma.pushSubscription.findUnique({ where: { id: testSub.id } });
      assert.equal(updated?.status, "REVOKED");
      assert.equal(updated?.lastFailureCode, 410);
    } finally {
      setPushSenderForTesting(null);
      await prisma.pushSubscription.delete({ where: { id: testSub.id } }).catch(() => {});
    }
  });

  it("marks subscription as REVOKED and increments revokedCount when failureCount reaches 5", async () => {
    const user = await getOrCreateResilienceUser("circuit");

    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id },
    });

    const endpoint = `https://fcm.googleapis.com/fcm/send/test-500-circuit-${Date.now()}`;
    const testSub = await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint,
        p256dh: "test-p256dh",
        auth: "test-auth",
        status: "ACTIVE",
        failureCount: 4, // Next failure makes it 5
      },
    });

    setPushSenderForTesting(async () => {
      const err: any = new Error("Server error");
      err.statusCode = 500;
      throw err;
    });

    try {
      const res = await sendPushNotificationToUser(user.id, {
        title: "Test",
        body: "Test",
        tag: "test-tag-circuit",
        data: { linkHref: "/portal" },
      });

      const updated = await prisma.pushSubscription.findUnique({ where: { id: testSub.id } });
      assert.equal(updated?.failureCount, 5);
      assert.equal(updated?.status, "REVOKED");
      assert.equal(updated?.lastFailureCode, 500);
      assert.equal(res.revokedCount, 1, "revokedCount should be incremented when circuit trips");
    } finally {
      setPushSenderForTesting(null);
      await prisma.pushSubscription.delete({ where: { id: testSub.id } }).catch(() => {});
    }
  });

  it("increments failureCount and keeps status ACTIVE when failureCount < 5", async () => {
    const user = await getOrCreateResilienceUser("sub5");

    await prisma.pushSubscription.deleteMany({
      where: { userId: user.id },
    });

    const endpoint = `https://fcm.googleapis.com/fcm/send/test-500-sub5-${Date.now()}`;
    const testSub = await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint,
        p256dh: "test-p256dh",
        auth: "test-auth",
        status: "ACTIVE",
        failureCount: 2,
      },
    });

    setPushSenderForTesting(async () => {
      const err: any = new Error("Internal push service error");
      err.statusCode = 500;
      throw err;
    });

    try {
      const res = await sendPushNotificationToUser(user.id, {
        title: "Test",
        body: "Test Body",
        tag: "test-tag-500",
        data: { linkHref: "/portal" },
      });

      const updated = await prisma.pushSubscription.findUnique({ where: { id: testSub.id } });
      assert.equal(updated?.failureCount, 3);
      assert.equal(updated?.status, "ACTIVE");
      assert.equal(updated?.lastFailureCode, 500);
      assert.equal(res.revokedCount, 0);
      assert.equal(res.failedCount, 1);
    } finally {
      setPushSenderForTesting(null);
      await prisma.pushSubscription.delete({ where: { id: testSub.id } }).catch(() => {});
    }
  });

  it("strictly requires VAPID keys when NODE_ENV is production", () => {
    const originalEnv = process.env.NODE_ENV;
    const originalPubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const originalPrivKey = process.env.VAPID_PRIVATE_KEY;
    try {
      (process.env as any).NODE_ENV = "production";
      delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PRIVATE_KEY;

      assert.throws(
        () => {
          ensureVapidConfigured();
        },
        /Missing required VAPID credentials in production environment/
      );
    } finally {
      (process.env as any).NODE_ENV = originalEnv;
      if (originalPubKey) process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY = originalPubKey;
      if (originalPrivKey) process.env.VAPID_PRIVATE_KEY = originalPrivKey;
    }
  });

  it("areServerKeysEqual detects matching and mismatched keys correctly", () => {
    const keyBytes1 = new Uint8Array([1, 2, 3, 4, 5]);
    const keyBytes2 = new Uint8Array([1, 2, 3, 4, 5]);
    const keyBytes3 = new Uint8Array([1, 2, 3, 4, 6]);
    const keyBytesShorter = new Uint8Array([1, 2, 3, 4]);

    assert.equal(areServerKeysEqual(keyBytes1, keyBytes2), true);
    assert.equal(areServerKeysEqual(keyBytes1.buffer, keyBytes2), true);
    assert.equal(areServerKeysEqual(keyBytes3, keyBytes1), false);
    assert.equal(areServerKeysEqual(keyBytesShorter, keyBytes1), false);
    assert.equal(areServerKeysEqual(null, keyBytes1), false);
    assert.equal(areServerKeysEqual(undefined, keyBytes1), false);
  });
});

