import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { updateOnboardingSchema } from "../src/app/api/users/onboarding/route";
import { mapDbUserToAuthUser } from "../src/lib/auth-context";
import { OnboardingData, AuthUser } from "../src/types/auth";

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
});
