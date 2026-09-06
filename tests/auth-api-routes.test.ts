import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { signSessionToken, verifySessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
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

  test("SESSION_COOKIE_NAME is defined and equals qcet_session", () => {
    assert.strictEqual(SESSION_COOKIE_NAME, "qcet_session");
  });
});

describe("Auth API Route Handlers Contracts", () => {
  test("POST /api/auth/logout clears session cookie and returns success", async () => {
    const res = await logoutPost();
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.deepStrictEqual(json, { success: true });

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(cookie);
    assert.strictEqual(cookie?.value, "");
    assert.strictEqual(cookie?.maxAge, 0);
  });

  test("POST /api/auth/login rejects empty email or password with status 400", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "", password: "" }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 400);

    const json = await res.json();
    assert.ok(json.error);
    assert.match(json.error, /Vui lòng nhập/);
  });

  test("POST /api/auth/register rejects missing required fields with status 400", async () => {
    const req = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@qcet.edu.vn" }),
    });

    const res = await registerPost(req);
    assert.strictEqual(res.status, 400);

    const json = await res.json();
    assert.ok(json.error);
    assert.match(json.error, /Vui lòng cung cấp đầy đủ/);
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
  const testEmail = "e2e_tester@qcet.edu.vn";
  const testPassword = "Password@123";

  test("POST /api/auth/login rejects incorrect password with status 401", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bgh@qcet.edu.vn",
        password: "WrongPassword999",
      }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.match(json.error, /Email hoặc mật khẩu không chính xác/);
  });

  test("POST /api/auth/login succeeds for seeded BGH account and issues session cookie", async () => {
    const req = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "bgh@qcet.edu.vn",
        password: "Qcet@2026",
      }),
    });

    const res = await loginPost(req);
    assert.strictEqual(res.status, 200);

    const json = await res.json();
    assert.strictEqual(json.success, true);
    assert.strictEqual(json.user.email, "bgh@qcet.edu.vn");
    assert.strictEqual(json.user.role, "BAN_GIAM_HIEU");

    const cookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(cookie);
    assert.ok(cookie.value.length > 20);

    // Verify GET /api/auth/me accepts this session token
    const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${cookie.value}`,
      },
    });
    const meRes = await meGet(meReq);
    assert.strictEqual(meRes.status, 200);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.authenticated, true);
    assert.strictEqual(meJson.user.email, "bgh@qcet.edu.vn");
    assert.strictEqual(meJson.user.name, "TS. Nguyễn Văn Hiệu");
  });

  test("Full lifecycle: register new user -> authenticate -> query me -> logout", async () => {
    const { prisma } = await import("../src/lib/prisma");

    // Clean up if previous run left test user
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });

    // 1. Register new user
    const regReq = new Request("http://localhost:3000/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Kiểm Thử E2E",
        email: testEmail,
        password: testPassword,
        departmentId: "CNTT",
      }),
    });

    const regRes = await registerPost(regReq);
    assert.strictEqual(regRes.status, 201);
    const regJson = await regRes.json();
    assert.strictEqual(regJson.success, true);
    assert.strictEqual(regJson.user.email, testEmail);

    // 2. Login with the newly registered user's credentials
    const loginReq = new Request("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });
    const loginRes = await loginPost(loginReq);
    assert.strictEqual(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.strictEqual(loginJson.success, true);
    assert.strictEqual(loginJson.user.email, testEmail);

    const loginCookie = loginRes.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(loginCookie);
    assert.ok(loginCookie.value.length > 20);

    // 3. Query /api/auth/me with newly issued session cookie
    const meReq = new NextRequest("http://localhost:3000/api/auth/me", {
      headers: {
        cookie: `${SESSION_COOKIE_NAME}=${loginCookie.value}`,
      },
    });
    const meRes = await meGet(meReq);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.authenticated, true);
    assert.strictEqual(meJson.user.email, testEmail);
    assert.strictEqual(meJson.user.name, "Kiểm Thử E2E");

    // 4. Logout clears session
    const logoutRes = await logoutPost();
    assert.strictEqual(logoutRes.status, 200);
    const logoutCookie = logoutRes.cookies.get(SESSION_COOKIE_NAME);
    assert.strictEqual(logoutCookie?.value, "");

    // 5. Cleanup test user from database
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    await prisma.$disconnect();
  });
});
