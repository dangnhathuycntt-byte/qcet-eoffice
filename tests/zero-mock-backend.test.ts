import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST as loginRoute } from "../src/app/api/auth/login/route";
import { GET as dashboardOverviewRoute } from "../src/app/api/dashboard/overview/route";
import { getLiveDashboardData } from "../src/lib/server/dashboard-service";
import { validateLoginForm } from "../src/lib/login-helpers";
import { prisma } from "../src/lib/prisma";
import { signSessionToken } from "../src/lib/jwt-session";

describe("Zero-Mock Backend Contract & Elimination of Demo Shims", () => {
  describe("2. POST /api/auth/login is retired", () => {
    test("rejects non-existent user without generating a virtual user", async () => {
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
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error?.message || json.error, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
      assert.equal(json.user, undefined, "Must not return any fake or virtual user object");
    });

    test("rejects incorrect password without falling back to demo bypass", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "bgh@cdktcnqn.edu.vn",
          password: "definitely_wrong_password_12345",
        }),
      });

      const res = await loginRoute(req);
      assert.equal(res.status, 403);
      const json = await res.json();
      assert.match(json.error?.message || json.error, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
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

    test("/api/dashboard/overview route returns live database payload and ignores ?source=mock", async () => {
      let token = "";
      const user = await prisma.user.findFirst();
      if (user) {
        token = signSessionToken({
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          departmentId: user.departmentId ?? undefined,
        });
      }
      const req = new NextRequest("http://localhost:3000/api/dashboard/overview?source=mock", {
        headers: token ? { authorization: `Bearer ${token}` } : {},
      });
      const res = await dashboardOverviewRoute(req);
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
  });
});
