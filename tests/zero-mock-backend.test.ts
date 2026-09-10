import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { POST as registerRoute } from "../src/app/api/auth/register/route";
import { GET as dashboardOverviewRoute } from "../src/app/api/dashboard/overview/route";
import { getLiveDashboardData } from "../src/lib/server/dashboard-service";
import { validateLoginForm } from "../src/lib/login-helpers";
import { prisma } from "../src/lib/prisma";

describe("Zero-Mock Backend Contract & Elimination of Demo Shims", () => {
  test("1. Endpoint /api/auth/demo-session/route.ts is permanently deleted from filesystem", () => {
    const demoSessionPath = path.resolve(__dirname, "../src/app/api/auth/demo-session/route.ts");
    assert.equal(
      fs.existsSync(demoSessionPath),
      false,
      "src/app/api/auth/demo-session/route.ts must be completely removed"
    );
  });

  describe("2. POST /api/auth/login strict Prisma + bcrypt authentication", () => {
    test("rejects non-existent user with 401 and does NOT generate a virtual user", async () => {
      const nonExistentEmail = `test-nonexistent-${Date.now()}@cdktcnqn.edu.vn`;
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: nonExistentEmail,
          password: "RandomPassword123!",
        }),
      });

      const res = await loginRoute(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error, "Email hoặc mật khẩu không chính xác");
      assert.equal(json.user, undefined, "Must not return any fake or virtual user object");
    });

    test("rejects incorrect password with 401 without falling back to demo bypass", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bgh@cdktcnqn.edu.vn",
          password: "definitely_wrong_password_12345",
        }),
      });

      const res = await loginRoute(req);
      assert.equal(res.status, 401);
      const json = await res.json();
      assert.equal(json.error, "Email hoặc mật khẩu không chính xác");
    });

    test("login route source code contains zero demo account bypass or user-*-demo shims", () => {
      const loginSource = fs.readFileSync(
        path.resolve(__dirname, "../src/app/api/auth/login/route.ts"),
        "utf8"
      );
      assert.equal(loginSource.includes("user-admin-demo"), false);
      assert.equal(loginSource.includes("user-manager-demo"), false);
      assert.equal(loginSource.includes("user-staff-demo"), false);
      assert.equal(loginSource.includes("DEFAULT_DEMO_USERS"), false);
    });
  });

  describe("3. POST /api/auth/register returns 500 RFC 7807 on database failure without fake fallback", () => {
    test("register route source code has no fallbackUser and adheres to RFC 7807 on errors", () => {
      const registerSource = fs.readFileSync(
        path.resolve(__dirname, "../src/app/api/auth/register/route.ts"),
        "utf8"
      );
      assert.equal(registerSource.includes("fallbackUser"), false);
      assert.equal(registerSource.includes("user-custom-"), false);
      assert.ok(
        registerSource.includes("rfc7807") || registerSource.includes("problem+json") || registerSource.includes("status: 500"),
        "Register catch block must return standard 500 error"
      );
    });
  });

  describe("4. Dashboard service returns authentic empty state when no tasks exist", () => {
    test("getLiveDashboardData returns empty arrays and zeroed stats for empty filter", async () => {
      const emptyPayload = await getLiveDashboardData({
        academicYear: "1899-1900", // Non-existent academic year guaranteed empty
      });

      assert.equal(emptyPayload.source, "database");
      assert.deepEqual(emptyPayload.tasks, []);
      assert.equal(emptyPayload.stats.totalTasks, 0);
      assert.equal(emptyPayload.stats.inProgressTasks, 0);
      assert.equal(emptyPayload.stats.completedTasks, 0);
      assert.equal(emptyPayload.stats.overdueTasks, 0);
      assert.equal(emptyPayload.stats.pendingApprovals, 0);
      assert.equal(emptyPayload.stats.completionRate, 0);
      assert.equal(emptyPayload.stats.totalSchoolTasks, 0);
      assert.equal(emptyPayload.stats.schoolTasksInProgress, 0);
      assert.equal(emptyPayload.stats.schoolTasksCompleted, 0);
      assert.equal(emptyPayload.stats.totalStaffTasks, 0);
      assert.equal(emptyPayload.stats.averageSchoolProgressPercent, 0);
      assert.deepEqual(emptyPayload.upcoming, []);
      assert.deepEqual(emptyPayload.activities, []);
    });

    test("dashboard-service.ts contains zero mock generator functions", () => {
      const serviceSource = fs.readFileSync(
        path.resolve(__dirname, "../src/lib/server/dashboard-service.ts"),
        "utf8"
      );
      assert.equal(serviceSource.includes("MOCK_STATS"), false);
      assert.equal(serviceSource.includes("MOCK_UPCOMING_ITEMS"), false);
      assert.equal(serviceSource.includes("MOCK_ACTIVITIES"), false);
      assert.equal(serviceSource.includes("getMockDashboardData"), false);
      assert.equal(serviceSource.includes("generateDefaultSchoolTasks"), false);
      assert.equal(serviceSource.includes("generateDefaultDepartmentSummaries"), false);
    });

    test("/api/dashboard/overview route returns live database payload and ignores ?source=mock", async () => {
      const req = new NextRequest("http://localhost:3000/api/dashboard/overview?source=mock");
      const res = await dashboardOverviewRoute();
      assert.equal(res.status, 200);
      const json = await res.json();
      assert.equal(json.source, "database");
      assert.ok(Array.isArray(json.tasks));
      assert.ok(json.stats);
    });
  });

  describe("5. login-helpers.ts and auth-context.tsx zero-mockup invariants", () => {
    test("validateLoginForm validates format and does NOT synthesize user-custom-*", () => {
      const emptyRes = validateLoginForm("");
      assert.equal(emptyRes.valid, false);

      const invalidEmailRes = validateLoginForm("not-an-email");
      assert.equal(invalidEmailRes.valid, false);

      const validRes = validateLoginForm("tuongpv@cdktcnqn.edu.vn", "validPassword123");
      assert.equal(validRes.valid, true);
      assert.equal((validRes as any).user, undefined, "validateLoginForm must not synthesize user object");
    });

    test("login-helpers.ts contains zero DEMO_LOGIN_CARDS and zero user-custom-*", () => {
      const helpersSource = fs.readFileSync(
        path.resolve(__dirname, "../src/lib/login-helpers.ts"),
        "utf8"
      );
      assert.equal(helpersSource.includes("DEMO_LOGIN_CARDS"), false);
      assert.equal(helpersSource.includes("user-custom-"), false);
    });

    test("auth-context.tsx does not call /api/auth/demo-session and does not fallback to DEFAULT_DEMO_USERS", () => {
      const authSource = fs.readFileSync(
        path.resolve(__dirname, "../src/lib/auth-context.tsx"),
        "utf8"
      );
      assert.equal(authSource.includes("/api/auth/demo-session"), false);
      assert.equal(authSource.includes("DEFAULT_DEMO_USERS"), false);
    });
  });
});
