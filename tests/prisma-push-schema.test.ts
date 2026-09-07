import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

describe("Prisma Push & Notification Schema", () => {
  test("schema.prisma defines PushSubscription and Notification models with User relations", () => {
    const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    assert.ok(schemaContent.includes("model PushSubscription"), "PushSubscription model must be present");
    assert.ok(schemaContent.includes("model Notification"), "Notification model must be present");
    assert.ok(schemaContent.includes("enum PushSubscriptionStatus"), "PushSubscriptionStatus enum must be present");
    assert.ok(schemaContent.includes("pushSubscriptions PushSubscription[]"), "User must have pushSubscriptions relation");
    assert.ok(schemaContent.includes("notifications     Notification[]"), "User must have notifications relation");
    assert.ok(schemaContent.includes("endpoint         String                 @unique"), "endpoint must be unique");
  });
});
