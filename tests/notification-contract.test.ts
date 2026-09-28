/**
 * Test: Notification Push Contract Validation
 *
 * Verifies PushSubscriptionSchema, SubscribePushSchema, and TestPushSchema
 * boundary conditions for the notification push endpoints.
 */

import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  PushSubscriptionSchema,
  SubscribePushSchema,
  TestPushSchema,
} from "@/contracts/notifications";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const validKeys = { p256dh: "BNcRdre...", auth: "tBHItQ..." };
const validEndpoint = "https://fcm.googleapis.com/fcm/send/abc123";

// ---------------------------------------------------------------------------
// PushSubscriptionSchema
// ---------------------------------------------------------------------------

describe("PushSubscriptionSchema", () => {
  test("accepts valid with endpoint + nested keys", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("accepts valid with endpoint + flat p256dh/auth", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      p256dh: "BNcRdre...",
      auth: "tBHItQ...",
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("rejects HTTP endpoint (must be HTTPS)", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: "http://fcm.googleapis.com/fcm/send/abc123",
      keys: validKeys,
    });
    assert.equal(result.success, false);
  });

  test("rejects invalid URL endpoint", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: "not-a-url",
      keys: validKeys,
    });
    assert.equal(result.success, false);
  });

  test("rejects missing endpoint", () => {
    const result = PushSubscriptionSchema.safeParse({
      keys: validKeys,
    });
    assert.equal(result.success, false);
  });

  test("rejects missing both keys and flat p256dh/auth (refine)", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
    });
    assert.equal(result.success, false);
    // The refine error should be on 'keys' path
    const issue = result.error!.issues.find(
      (i) => i.path.includes("keys")
    );
    assert.ok(issue, "Expected an error on the 'keys' path");
  });

  test("rejects keys with empty p256dh", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: "", auth: "tBHItQ..." },
    });
    assert.equal(result.success, false);
  });

  test("rejects keys with empty auth", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: "BNcRdre...", auth: "" },
    });
    assert.equal(result.success, false);
  });

  test("accepts with deviceType and userAgent", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
      deviceType: "desktop",
      userAgent: "Mozilla/5.0",
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("rejects endpoint exceeding 1024 chars", () => {
    const longEndpoint = "https://example.com/" + "a".repeat(1010);
    assert.ok(longEndpoint.length > 1024);
    const result = PushSubscriptionSchema.safeParse({
      endpoint: longEndpoint,
      keys: validKeys,
    });
    assert.equal(result.success, false);
  });

  test("does NOT reject unknown extra fields (not strict)", () => {
    const result = PushSubscriptionSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
      unknownField: "should pass through",
    });
    assert.ok(result.success, JSON.stringify(result));
  });
});

// ---------------------------------------------------------------------------
// SubscribePushSchema
// ---------------------------------------------------------------------------

describe("SubscribePushSchema", () => {
  test("accepts valid minimal (endpoint + keys)", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("accepts full input with deviceType + userAgent", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
      deviceType: "mobile",
      userAgent: "Chrome/120",
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("rejects invalid URL endpoint", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: "not-a-url",
      keys: validKeys,
    });
    assert.equal(result.success, false);
  });

  test("rejects missing keys (required)", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
    });
    assert.equal(result.success, false);
  });

  test("rejects keys with missing p256dh", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: { auth: "tBHItQ..." },
    });
    assert.equal(result.success, false);
  });

  test("rejects keys with missing auth", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: "BNcRdre..." },
    });
    assert.equal(result.success, false);
  });

  test("rejects keys with extra fields (keys schema is strict)", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: { ...validKeys, extra: "not-allowed" },
    });
    assert.equal(result.success, false);
  });

  test("rejects p256dh exceeding 255 chars", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: "x".repeat(256), auth: "tBHItQ..." },
    });
    assert.equal(result.success, false);
  });

  test("rejects auth exceeding 255 chars", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: { p256dh: "BNcRdre...", auth: "x".repeat(256) },
    });
    assert.equal(result.success, false);
  });

  test("rejects unknown extra fields (strict)", () => {
    const result = SubscribePushSchema.safeParse({
      endpoint: validEndpoint,
      keys: validKeys,
      unknownField: "should fail",
    });
    assert.equal(result.success, false);
  });
});

// ---------------------------------------------------------------------------
// TestPushSchema
// ---------------------------------------------------------------------------

describe("TestPushSchema", () => {
  test("accepts empty body (all optional)", () => {
    const result = TestPushSchema.safeParse({});
    assert.ok(result.success, JSON.stringify(result));
  });

  test("accepts full input", () => {
    const result = TestPushSchema.safeParse({
      title: "Thông báo test",
      body: "Nội dung test",
      linkHref: "/tasks/123",
    });
    assert.ok(result.success, JSON.stringify(result));
  });

  test("rejects title exceeding 100 chars", () => {
    const result = TestPushSchema.safeParse({
      title: "x".repeat(101),
    });
    assert.equal(result.success, false);
  });

  test("rejects body exceeding 255 chars", () => {
    const result = TestPushSchema.safeParse({
      body: "x".repeat(256),
    });
    assert.equal(result.success, false);
  });

  test("rejects linkHref exceeding 255 chars", () => {
    const result = TestPushSchema.safeParse({
      linkHref: "x".repeat(256),
    });
    assert.equal(result.success, false);
  });

  test("rejects unknown extra fields (strict)", () => {
    const result = TestPushSchema.safeParse({
      title: "OK",
      extraField: "should fail",
    });
    assert.equal(result.success, false);
  });
});
