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
