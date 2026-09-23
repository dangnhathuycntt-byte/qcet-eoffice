import { test, describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { signSessionToken, verifySessionToken, getJwtSecret, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { resetRateLimits } from "../src/server/security/rate-limit";
import { POST as logoutPost } from "../src/app/api/auth/logout/route";
import { POST as loginPost } from "../src/app/api/auth/login/route";
import { POST as registerPost } from "../src/app/api/auth/register/route";
import { GET as meGet } from "../src/app/api/auth/me/route";
import { NextRequest } from "next/server";

describe("JWT Session Utilities", () => {
  test("sign and verify session token", () => {
    const payload = {
      id: "usr_123",
      email: "test@qcet.edu.vn",
      role: "CHUYEN_VIEN" as const,
      name: "Nguyễn Văn Test",
    };

    const token = signSessionToken(payload);
    assert.ok(typeof token === "string" && token.length > 20);

    const verified = verifySessionToken(token);
    assert.ok(verified);
    assert.strictEqual(verified?.id, payload.id);
    assert.strictEqual(verified?.email, payload.email);
    assert.strictEqual(verified?.role, payload.role);
  });

  test("verifySessionToken returns null on invalid or tampered token", () => {
    const invalid = verifySessionToken("invalid.token.payload");
    assert.strictEqual(invalid, null);
  });

  test("SESSION_COOKIE_NAME is defined and equals authjs.session-token or legacy cookie", () => {
    assert.ok(SESSION_COOKIE_NAME === "authjs.session-token" || SESSION_COOKIE_NAME === "qcet_session");
  });

  test("getJwtSecret throws error in production environment when JWT_SECRET is missing", () => {
    const env = process.env as Record<string, string | undefined>;
    const originalNodeEnv = env.NODE_ENV;
    const originalSecret = env.JWT_SECRET;
    const originalAuthSecret = env.AUTH_SECRET;
    try {
      env.NODE_ENV = "production";
      delete env.JWT_SECRET;
      delete env.AUTH_SECRET;
      assert.throws(() => {
        getJwtSecret();
      }, /(?:JWT_SECRET|AUTH_SECRET).*required in production/);
    } finally {
      env.NODE_ENV = originalNodeEnv;
      if (originalSecret !== undefined) {
        env.JWT_SECRET = originalSecret;
      }
      if (originalAuthSecret !== undefined) {
        env.AUTH_SECRET = originalAuthSecret;
      }
    }
  });
});

describe("Auth API Route Handlers Contracts", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  test("POST /api/auth/logout clears session cookie and returns success", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/logout", { method: "POST" });
    const res = await logoutPost(req);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.deepStrictEqual(json, { success: true });

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(cookie);
    assert.strictEqual(cookie?.value, "");
    assert.strictEqual(cookie?.maxAge, 0);
  });

  test("POST /api/auth/login is disabled before processing credentials", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "" }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 403);

    const json = await res.json();
    assert.ok(json.error);
    const errorMessage = json.error?.message || json.error || json.message;
    assert.match(errorMessage, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
  });

  test("POST /api/auth/register is completely disabled and returns status 403", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@qcet.edu.vn",
        password: "ValidPassword123",
        name: "Test User",
      }),
    });

    const res = await registerPost(req);
    assert.strictEqual(res.status, 403);

    const json = await res.json();
    assert.strictEqual(json.success, false);
    const errorMessage = json.error?.message || json.error || json.message;
    assert.match(errorMessage, /Đăng ký công khai đã bị vô hiệu hóa/);
  });

  test("GET /api/auth/me returns unauthenticated when no cookie provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me");
    const res = await meGet(req);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.authenticated, false);
    assert.strictEqual(json.user, null);
  });

  test("GET /api/auth/me returns unauthenticated on tampered cookie token", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=invalid.token.payload`,
      },
    });
    const res = await meGet(req);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.authenticated, false);
    assert.strictEqual(json.user, null);
  });
});

describe("End-to-End Authentication Lifecycle with PostgreSQL", () => {
  beforeEach(() => {
    resetRateLimits();
  });

  const testEmail = "e2e_tester@qcet.edu.vn";
  const testPassword = "Password@123";

  test("POST /api/auth/login rejects password authentication regardless of password", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bgh@cdktcnqn.edu.vn",
        password: "WrongPassword999",
      }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 403);
    const json = await res.json();
    assert.ok(json.error);
    const errorMessage = json.error?.message || json.error || json.message;
    assert.match(errorMessage, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
  });

  test("POST /api/auth/login does not issue a cookie for a seeded account", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bgh@cdktcnqn.edu.vn",
        password: "Qcet@2026",
      }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 403);

    const json = await res.json();
    const errorMessage = json.error?.message || json.error || json.message;
    assert.match(errorMessage, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.equal(cookie, undefined);
  });

  test("Public register and password login stay disabled together", async () => {
    const regReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Kiểm Thử E2E",
        email: testEmail,
        password: testPassword,

      }),
    });

    const regRes = await registerPost(regReq);
    assert.strictEqual(regRes.status, 403);

    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginRes = await loginPost(loginReq);
    assert.strictEqual(loginRes.status, 403);
    const loginJson = await loginRes.json();
    const errorMessage = loginJson.error?.message || loginJson.error || loginJson.message;
    assert.match(errorMessage, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);
    assert.equal(loginRes.cookies.get(SESSION_COOKIE_NAME), undefined);
  });

  test("POST /api/auth/register rejects arbitrary role escalation and mass-assignment with status 403", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const roleEscalateEmail = "hacker@qcet.edu.vn";

    await prisma.user.deleteMany({
      where: { email: roleEscalateEmail },
    });

    try {
      const regReq = new Request("http://localhost:3000/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Attacker Role",
          email: roleEscalateEmail,
          password: "SecurePassword123",
          role: "ADMIN",

        }),
      });

      const regRes = await registerPost(regReq);
      assert.strictEqual(regRes.status, 403);

      const dbUser = await prisma.user.findUnique({
        where: { email: roleEscalateEmail },
      });
      assert.strictEqual(dbUser, null);
    } finally {
      await prisma.user.deleteMany({
        where: { email: roleEscalateEmail },
      });
      await prisma.$disconnect();
    }
  });

  test("POST /api/auth/login rejects inactive user (isActive: false) with status 403", async () => {
    const { prisma } = await import("../src/lib/prisma");
    const { hashPassword } = await import("../src/lib/password");
    const inactiveEmail = "locked_user@qcet.edu.vn";
    const inactivePassword = "PasswordLocked123";

    await prisma.user.deleteMany({
      where: { email: inactiveEmail },
    });

    try {
      const hashedPassword = await hashPassword(inactivePassword);
      await prisma.user.create({
        data: {
          email: inactiveEmail,
          name: "Locked User",
          passwordHash: hashedPassword,
          role: "CHUYEN_VIEN",
          isActive: false,
        },
      });

      // Attempt login
      const loginReq = new Request("http://localhost:3000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: inactiveEmail,
          password: inactivePassword,
        }),
      });
      const loginRes = await loginPost(loginReq);
      assert.strictEqual(loginRes.status, 403);
      const loginJson = await loginRes.json();
      assert.ok(loginJson.error);
      const errorMessage = loginJson.error?.message || loginJson.error || loginJson.message;
      assert.match(errorMessage, /Đăng nhập bằng mật khẩu đã bị vô hiệu hóa/);

      // Verify me query also returns unauthenticated for inactive user
      const { signSessionToken } = await import("../src/lib/jwt-session");
      const dbUser = await prisma.user.findUnique({
        where: { email: inactiveEmail },
      });
      assert.ok(dbUser);
      const sessionToken = signSessionToken({
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        role: dbUser.role,
      });

      const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${sessionToken}`,
        },
      });
      const meRes = await meGet(meReq);
      const meJson = await meRes.json();
      assert.strictEqual(meJson.authenticated, false);
      assert.strictEqual(meJson.user, null);
    } finally {
      await prisma.user.deleteMany({
        where: { email: inactiveEmail },
      });
      await prisma.$disconnect();
    }
  });
});
