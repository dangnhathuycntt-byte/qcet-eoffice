import test, { describe } from "node:test";
import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

if (!process.env.QCET_ALLOW_DB_TESTS) {
  process.env.QCET_ALLOW_DB_TESTS = "1";
}
if (!process.env.NODE_ENV || process.env.NODE_ENV !== "test") {
  (process.env as Record<string, string | undefined>).NODE_ENV = "test";
}
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/qcet_eoffice?schema=public";
}

import { UpdateUserProfileSchema } from "../src/contracts/users";
import { PATCH, GET } from "../src/app/api/auth/me/route";
import { prisma } from "../src/lib/prisma";
import { signSessionToken } from "../src/lib/jwt-session";

describe("R7: User Profile Persistence & Security Suite", () => {
  describe("1. UpdateUserProfileSchema Contract Validation", () => {
    test("accepts valid profile fields", () => {
      const validPayload = {
        name: "Nguyễn Văn An",
        phone: "0912345678",
        title: "Giảng viên chính",
      };
      const result = UpdateUserProfileSchema.safeParse(validPayload);
      assert.strictEqual(result.success, true);
      if (result.success) {
        assert.strictEqual(result.data.name, "Nguyễn Văn An");
        assert.strictEqual(result.data.phone, "0912345678");
        assert.strictEqual(result.data.title, "Giảng viên chính");
      }
    });

    test("accepts nullable phone and title", () => {
      const result = UpdateUserProfileSchema.safeParse({
        name: "Trần Thị B",
        phone: null,
        title: null,
      });
      assert.strictEqual(result.success, true);
    });

    test("accepts partial updates (e.g. only name)", () => {
      const result = UpdateUserProfileSchema.safeParse({
        name: "Lê Văn C",
      });
      assert.strictEqual(result.success, true);
    });

    test("strictly rejects role tampering attempts", () => {
      const tamperingPayload = {
        name: "Hacker",
        role: "ADMIN",
      };
      const result = UpdateUserProfileSchema.safeParse(tamperingPayload);
      assert.strictEqual(result.success, false);
      if (!result.success) {
        const errorMessages = result.error.issues.map((i) => i.message);
        assert.ok(
          errorMessages.some((m) => m.includes("Unrecognized key") || m.includes("role")),
          "Schema must reject role field"
        );
      }
    });

    test("strictly rejects departmentId tampering attempts", () => {
      const tamperingPayload = {
        name: "Hacker",
        departmentId: "DEPT_ADMIN",
      };
      const result = UpdateUserProfileSchema.safeParse(tamperingPayload);
      assert.strictEqual(result.success, false);
    });

    test("strictly rejects isActive tampering attempts", () => {
      const tamperingPayload = {
        name: "Hacker",
        isActive: true,
      };
      const result = UpdateUserProfileSchema.safeParse(tamperingPayload);
      assert.strictEqual(result.success, false);
    });

    test("rejects name shorter than 2 characters", () => {
      const result = UpdateUserProfileSchema.safeParse({
        name: "A",
      });
      assert.strictEqual(result.success, false);
    });
  });

  describe("2. PATCH /api/auth/me Endpoint Security & Persistence", () => {
    test("rejects unauthenticated request with 401", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-proto": "http",
          "host": "localhost:3000",
        },
        body: JSON.stringify({ name: "Unauthenticated User" }),
      });

      const res = await PATCH(req);
      assert.strictEqual(res.status, 401);
      const json = await res.json();
      assert.strictEqual(json.success, false);
    });

    test("rejects payload with role tampering with 400 Bad Request", async () => {
      // Find or create test user
      let testUser = await prisma.user.findFirst({
        where: { isActive: true },
      });

      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            email: "test.profile.tamper@qcet.edu.vn",
            name: "Original Name",
            role: "CHUYEN_VIEN",
            isActive: true,
          },
        });
      }

      const token = signSessionToken({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        name: testUser.name,
      });

      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-forwarded-proto": "http",
          "host": "localhost:3000",
        },
        body: JSON.stringify({
          name: "New Name",
          role: "ADMIN",
        }),
      });

      const res = await PATCH(req);
      assert.strictEqual(res.status, 400);
      const json = await res.json();
      assert.strictEqual(json.success, false);

      // Verify user role in DB was NOT changed
      const dbUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      assert.strictEqual(dbUser?.role, testUser.role);
    });

    test("rejects empty update with 400 Bad Request", async () => {
      let testUser = await prisma.user.findFirst({
        where: { isActive: true },
      });

      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            email: "test.profile.empty@qcet.edu.vn",
            name: "Test User",
            role: "CHUYEN_VIEN",
            isActive: true,
          },
        });
      }

      const token = signSessionToken({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        name: testUser.name,
      });

      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-forwarded-proto": "http",
          "host": "localhost:3000",
        },
        body: JSON.stringify({}),
      });

      const res = await PATCH(req);
      assert.strictEqual(res.status, 400);
    });

    test("successfully updates profile and persists to database", async () => {
      let testUser = await prisma.user.findFirst({
        where: { isActive: true },
      });

      if (!testUser) {
        testUser = await prisma.user.create({
          data: {
            email: "test.profile.success@qcet.edu.vn",
            name: "Original Teacher",
            title: "Tập sự",
            phone: "0900000000",
            role: "CHUYEN_VIEN",
            isActive: true,
          },
        });
      }

      const originalName = testUser.name;
      const originalTitle = testUser.title;
      const originalPhone = testUser.phone;

      const token = signSessionToken({
        id: testUser.id,
        email: testUser.email,
        role: testUser.role,
        name: testUser.name,
      });

      const updatedName = "ThS. Nguyễn Văn Cập Nhật";
      const updatedTitle = "Giảng viên chính Khoa CNTT";
      const updatedPhone = "0987654321";

      const req = new Request("http://localhost:3000/api/auth/me", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
          "x-forwarded-proto": "http",
          "host": "localhost:3000",
        },
        body: JSON.stringify({
          name: updatedName,
          title: updatedTitle,
          phone: updatedPhone,
        }),
      });

      const res = await PATCH(req);
      assert.strictEqual(res.status, 200);
      const json = await res.json();
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.user.name, updatedName);
      assert.strictEqual(json.user.title, updatedTitle);
      assert.strictEqual(json.user.phone, updatedPhone);

      // Verify database persistence
      const dbUser = await prisma.user.findUnique({
        where: { id: testUser.id },
      });
      assert.strictEqual(dbUser?.name, updatedName);
      assert.strictEqual(dbUser?.title, updatedTitle);
      assert.strictEqual(dbUser?.phone, updatedPhone);

      // Subsequent GET /api/auth/me returns the updated profile from server truth
      const getReq = new Request("http://localhost:3000/api/auth/me", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "x-forwarded-proto": "http",
          "host": "localhost:3000",
        },
      });
      const getRes = await GET(getReq);
      assert.strictEqual(getRes.status, 200);
      const getJson = await getRes.json();
      assert.strictEqual(getJson.user.name, updatedName);
      assert.strictEqual(getJson.user.title, updatedTitle);
      assert.strictEqual(getJson.user.phone, updatedPhone);

      // Restore original profile values for hygiene
      await prisma.user.update({
        where: { id: testUser.id },
        data: {
          name: originalName,
          title: originalTitle,
          phone: originalPhone,
        },
      });
    });
  });
});
