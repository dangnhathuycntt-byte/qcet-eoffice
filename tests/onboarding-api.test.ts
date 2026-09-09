import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { z } from "zod";
import { updateOnboardingSchema } from "../src/lib/onboarding-schema";
import { mapDbUserToAuthUser } from "../src/lib/auth-context";
import { OnboardingData, AuthUser } from "../src/types/auth";
import {
  getOnboardingStorageKey,
  resolveOnboardingState,
  DEFAULT_ONBOARDING_STATE,
} from "../src/lib/onboarding-constants";
import { PATCH, DELETE } from "../src/app/api/users/onboarding/route";
import { prisma } from "../src/lib/prisma";
import { Prisma } from "@prisma/client";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

describe("Onboarding Schema & Contracts", () => {
  test("Onboarding Schema validates valid payload", () => {
    const valid = {
      hasSeenWelcome: true,
      hasCompletedTour: false,
      completedSteps: ["step-profile", "step-push"],
      isDismissed: false,
      snoozedUntil: "2026-09-08T00:00:00.000Z",
    };
    const parsed = updateOnboardingSchema.safeParse(valid);
    assert.equal(parsed.success, true);
    if (parsed.success) {
      assert.equal(parsed.data.hasSeenWelcome, true);
      assert.equal(parsed.data.hasCompletedTour, false);
      assert.deepEqual(parsed.data.completedSteps, ["step-profile", "step-push"]);
    }
  });

  test("Onboarding Schema rejects invalid step types", () => {
    const invalid = {
      completedSteps: [123],
    };
    const parsed = updateOnboardingSchema.safeParse(invalid);
    assert.equal(parsed.success, false);
  });

  test("Onboarding Schema accepts partial payloads", () => {
    const partial1 = { hasSeenWelcome: true };
    assert.equal(updateOnboardingSchema.safeParse(partial1).success, true);

    const partial2 = { isDismissed: true };
    assert.equal(updateOnboardingSchema.safeParse(partial2).success, true);

    const partial3 = { snoozedUntil: null };
    assert.equal(updateOnboardingSchema.safeParse(partial3).success, true);
  });

  test("Prisma schema defines onboardedAt and onboardingData fields in User model", () => {
    const schemaPath = path.join(process.cwd(), "prisma/schema.prisma");
    const schemaContent = fs.readFileSync(schemaPath, "utf-8");

    assert.ok(
      schemaContent.includes("onboardedAt") &&
      schemaContent.includes("@map(\"onboarded_at\")"),
      "User model should have onboardedAt with mapping"
    );
    assert.ok(
      schemaContent.includes("onboardingData") &&
      schemaContent.includes("@map(\"onboarding_data\")"),
      "User model should have onboardingData with mapping"
    );
  });

  test("mapDbUserToAuthUser maps onboardedAt and onboardingData correctly", () => {
    const sampleDbUser = {
      id: "user-test-1",
      email: "test@cdktcnqn.edu.vn",
      name: "Nguyễn Văn Test",
      role: "CHUYEN_VIEN",
      departmentId: "CNTT",
      onboardedAt: new Date("2026-09-07T10:00:00Z"),
      onboardingData: {
        hasSeenWelcome: true,
        hasCompletedTour: true,
        completedSteps: ["step-1", "step-2", "step-3", "step-4"],
      },
    };

    const authUser: AuthUser = mapDbUserToAuthUser(sampleDbUser);

    assert.equal(authUser.id, "user-test-1");
    assert.equal(authUser.onboardedAt, "2026-09-07T10:00:00.000Z");
    assert.deepEqual(authUser.onboardingData, {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      completedSteps: ["step-1", "step-2", "step-3", "step-4"],
    });
    assert.equal(authUser.dbRole, "CHUYEN_VIEN");
  });

  test("mapDbUserToAuthUser handles null onboarding state", () => {
    const sampleDbUser = {
      id: "user-test-2",
      email: "fresh@cdktcnqn.edu.vn",
      name: "Người dùng mới",
      role: "TRUONG_PHONG",
      departmentId: "TCHC",
      onboardedAt: null,
      onboardingData: null,
    };

    const authUser: AuthUser = mapDbUserToAuthUser(sampleDbUser);

    assert.equal(authUser.onboardedAt, null);
    assert.equal(authUser.onboardingData, null);
    assert.equal(authUser.dbRole, "TRUONG_PHONG");
    assert.equal(authUser.role, "MANAGER");
  });

  test("getOnboardingStorageKey returns user-scoped key to isolate localStorage across accounts", () => {
    assert.equal(getOnboardingStorageKey("user-123"), "qcet_onboarding_state_user-123");
    assert.equal(getOnboardingStorageKey("cly999"), "qcet_onboarding_state_cly999");
    assert.equal(getOnboardingStorageKey(null), "qcet_onboarding_state_guest");
    assert.equal(getOnboardingStorageKey(undefined), "qcet_onboarding_state_guest");
  });

  test("resolveOnboardingState preserves fresh onboarding for newly created accounts even with dirty localStorage", () => {
    // Giả lập tài khoản mới tạo (onboardedAt: null, onboardingData: null)
    const freshUser = {
      id: "new-user-abc",
      onboardedAt: null,
      onboardingData: null,
    };

    // Giả lập localStorage còn sót lại từ người dùng trước đó (ví dụ BGH đã hoàn thành)
    const dirtyPreviousUserState = {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      isDismissed: true,
      completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
    };

    // Với user-scoped key, parsed từ localStorage của new-user-abc sẽ là null
    const resolvedState = resolveOnboardingState(freshUser, null);

    assert.equal(resolvedState.hasSeenWelcome, false, "Tài khoản mới phải chưa thấy welcome modal");
    assert.equal(resolvedState.hasCompletedTour, false, "Tài khoản mới phải chưa hoàn thành tour");
    assert.equal(resolvedState.isDismissed, false, "Tài khoản mới không được bị dismissed");
    assert.deepEqual(resolvedState.completedSteps, ["step-profile"], "Tài khoản mới khởi đầu với step-profile");
  });

  test("resolveOnboardingState marks completed when onboardedAt is present", () => {
    const completedUser = {
      id: "bgh-user",
      onboardedAt: "2026-09-08T00:24:56.893Z",
      onboardingData: null,
    };

    const resolved = resolveOnboardingState(completedUser, null);
    assert.equal(resolved.hasSeenWelcome, true);
    assert.equal(resolved.hasCompletedTour, true);
    assert.equal(resolved.isDismissed, true);
  });

  test("resolveOnboardingState resets to default when server onboarding was wiped (null) even if localStorage is dirty", () => {
    const wipedUser = {
      id: "dangnhathuycntt-id",
      onboardedAt: null,
      onboardingData: null,
    };

    const staleLocalStorageState = {
      hasSeenWelcome: true,
      hasCompletedTour: true,
      isDismissed: true,
      completedSteps: ["step-profile", "step-push", "step-action", "step-search"],
      snoozedUntil: null,
    };

    const resolved = resolveOnboardingState(wipedUser, staleLocalStorageState);
    assert.equal(resolved.hasSeenWelcome, false, "Phải reset lại chưa xem welcome");
    assert.equal(resolved.hasCompletedTour, false, "Phải reset lại chưa xong tour");
    assert.equal(resolved.isDismissed, false, "Không được bị dismissed");
    assert.deepEqual(resolved.completedSteps, ["step-profile"]);
  });

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
