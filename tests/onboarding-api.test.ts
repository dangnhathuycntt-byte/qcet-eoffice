import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { PATCH, DELETE } from "../src/app/api/users/onboarding/route";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

describe("PATCH/DELETE /api/users/onboarding route", () => {
  test("PATCH /api/users/onboarding rejects unauthenticated requests", async () => {
    const req = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hasSeenWelcome: true }),
    });
    const res = await PATCH(req);
    assert.equal(res.status, 401);
  });

  test("PATCH and DELETE /api/users/onboarding syncs state and resets properly", async () => {
    // Find or pick a test user
    const dbUser = await prisma.user.findFirst();
    if (!dbUser) return; // Skip if no DB user

    const token = signSessionToken({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    });

    // 1. PATCH valid onboarding data
    const patchReq = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        hasSeenWelcome: true,
        completedSteps: ["step-profile", "step-push"],
      }),
    });
    const patchRes = await PATCH(patchReq);
    assert.equal(patchRes.status, 200);
    const patchJson = await patchRes.json();
    assert.equal(patchJson.success, true);
    assert.equal(patchJson.user.onboardingData.hasSeenWelcome, true);
    assert.deepEqual(patchJson.user.onboardingData.completedSteps, ["step-profile", "step-push"]);

    // 2. DELETE onboarding to wipe state
    const deleteReq = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "DELETE",
      headers: {
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
    });
    const deleteRes = await DELETE(deleteReq);
    assert.equal(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.equal(deleteJson.success, true);
    assert.equal(deleteJson.user.onboardedAt, null);
    assert.equal(deleteJson.user.onboardingData, null);
  });

  test("PATCH /api/users/onboarding safely handles legacy array data in database without spreading indices", async () => {
    const dbUser = await prisma.user.findFirst();
    if (!dbUser) return;

    // Simulate legacy data where onboardingData was stored as an array
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        onboardingData: ["legacy-step-1", "legacy-step-2"],
      },
    });

    const token = signSessionToken({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    });

    const patchReq = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        hasSeenWelcome: true,
        completedSteps: ["step-profile"],
      }),
    });

    const patchRes = await PATCH(patchReq);
    assert.equal(patchRes.status, 200);
    const patchJson = await patchRes.json();
    assert.equal(patchJson.success, true);
    assert.equal(patchJson.user.onboardingData.hasSeenWelcome, true);
    assert.deepEqual(patchJson.user.onboardingData.completedSteps, ["step-profile"]);
    // Verify numeric array indices "0", "1" were NOT spread into the object
    assert.equal("0" in patchJson.user.onboardingData, false, "Array index 0 must not be spread as object key");
    assert.equal("1" in patchJson.user.onboardingData, false, "Array index 1 must not be spread as object key");

    // Clean up
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        onboardedAt: null,
        onboardingData: Prisma.DbNull,
      },
    });
  });

  test("PATCH /api/users/onboarding performs atomic Set Union for incremental completedSteps and persists snoozedUntil", async () => {
    const dbUser = await prisma.user.findFirst();
    if (!dbUser) return;

    const token = signSessionToken({
      id: dbUser.id,
      name: dbUser.name,
      email: dbUser.email,
      role: dbUser.role,
    });

    // Reset user onboarding state first
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        onboardedAt: null,
        onboardingData: Prisma.DbNull,
      },
    });

    // 1. Initial PATCH: ["step-profile", "step-push"] + snoozedUntil ISO string
    const snoozeDate = new Date(Date.now() + 86400000).toISOString();
    const patch1 = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        completedSteps: ["step-profile", "step-push"],
        snoozedUntil: snoozeDate,
      }),
    });
    const res1 = await PATCH(patch1);
    assert.equal(res1.status, 200);
    const data1 = await res1.json();
    assert.deepEqual(data1.user.onboardingData.completedSteps, ["step-profile", "step-push"]);
    assert.equal(data1.user.onboardingData.snoozedUntil, snoozeDate);
    assert.equal(data1.user.onboardedAt, null);

    // 2. Incremental PATCH: only ["step-action"]
    const patch2 = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        completedSteps: ["step-action"],
      }),
    });
    const res2 = await PATCH(patch2);
    assert.equal(res2.status, 200);
    const data2 = await res2.json();
    assert.deepEqual(data2.user.onboardingData.completedSteps, [
      "step-profile",
      "step-push",
      "step-action",
    ]);
    // snoozedUntil should be preserved
    assert.equal(data2.user.onboardingData.snoozedUntil, snoozeDate);
    assert.equal(data2.user.onboardedAt, null);

    // Verify directly in database
    const userInDbAfterStep3 = await prisma.user.findUnique({
      where: { id: dbUser.id },
      select: { onboardingData: true, onboardedAt: true },
    });
    const dbData = userInDbAfterStep3?.onboardingData as Record<string, unknown>;
    assert.deepEqual(dbData.completedSteps, ["step-profile", "step-push", "step-action"]);

    // 3. Clear snoozedUntil with null
    const patch3 = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        snoozedUntil: null,
      }),
    });
    const res3 = await PATCH(patch3);
    assert.equal(res3.status, 200);
    const data3 = await res3.json();
    assert.equal(data3.user.onboardingData.snoozedUntil, null);
    assert.deepEqual(data3.user.onboardingData.completedSteps, [
      "step-profile",
      "step-push",
      "step-action",
    ]);

    // 4. Send final required step: ["step-search"]
    const patch4 = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        completedSteps: ["step-search"],
      }),
    });
    const res4 = await PATCH(patch4);
    assert.equal(res4.status, 200);
    const data4 = await res4.json();
    assert.deepEqual(data4.user.onboardingData.completedSteps, [
      "step-profile",
      "step-push",
      "step-action",
      "step-search",
    ]);
    assert.ok(data4.user.onboardedAt !== null, "onboardedAt should be set when all 4 core steps are completed");
    const firstOnboardedAt = data4.user.onboardedAt;

    // 5. Subsequent PATCH (e.g. isDismissed: true) must NOT overwrite or lose onboardedAt timestamp
    const patch5 = new NextRequest("http://localhost:3000/api/users/onboarding", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Cookie: `${SESSION_COOKIE_NAME}=${token}`,
        Origin: "http://localhost:3000",
      },
      body: JSON.stringify({
        isDismissed: true,
      }),
    });
    const res5 = await PATCH(patch5);
    assert.equal(res5.status, 200);
    const data5 = await res5.json();
    assert.equal(data5.user.onboardingData.isDismissed, true);
    assert.equal(data5.user.onboardedAt, firstOnboardedAt, "onboardedAt timestamp must be preserved across updates");

    // Clean up
    await prisma.user.update({
      where: { id: dbUser.id },
      data: {
        onboardedAt: null,
        onboardingData: Prisma.DbNull,
      },
    });
  });
});
