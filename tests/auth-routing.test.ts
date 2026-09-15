import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";
import { sanitizeRedirectUrl } from "../src/lib/login-helpers";

describe("QCET Authentication Routing & Middleware Invariants", () => {
  const validToken = signSessionToken({
    id: "user-test-123",
    email: "test@cdktcnqn.edu.vn",
    name: "Nguyễn Văn Test",
    role: "ADMIN",
    departmentId: "BGH",
  });

  const createRequest = (url: string, cookieToken?: string) => {
    const headers: Record<string, string> = {};
    if (cookieToken) {
      headers["cookie"] = `${SESSION_COOKIE_NAME}=${cookieToken}`;
    }
    const req = new NextRequest(new URL(url, "https://eoffice.qcet.edu.vn"), {
      headers,
    });
    return req;
  };

  describe("1. Unauthenticated users accessing protected routes", () => {
    test("unauthenticated access to /tasks redirects to /login", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/tasks");
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location, "Must have location header");
      assert.equal(new URL(location).pathname, "/login");
    });

    test("unauthenticated access to /tasks?scope=my preserves returnTo", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/tasks?scope=my");
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("returnTo"), "/tasks?scope=my");
    });

    test("unauthenticated access to /documents/abc-123 preserves returnTo", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/documents/abc-123");
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("returnTo"), "/documents/abc-123");
    });

    test("access to singular /task redirects to /tasks (308)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/task");
      const res = await middleware(req);

      assert.equal(res?.status, 308);
      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/tasks");
    });

    test("access to singular /task/task-123 redirects to /tasks/task-123 (308)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/task/task-123");
      const res = await middleware(req);

      assert.equal(res?.status, 308);
      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/tasks/task-123");
    });
  });

  describe("2. Cryptographic JWT Verification & Edge Runtime Invariants", () => {
    test("verifySessionToken strictly rejects tampered/invalid signature tokens", () => {
      const { verifySessionToken } = require("../src/lib/jwt-session");
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          id: "hacker-1",
          email: "hacker@cdktcnqn.edu.vn",
          role: "ADMIN",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");
      const fakeSignature = "invalid_signature_here_12345";
      const forgedToken = `${header}.${payload}.${fakeSignature}`;

      const verified = verifySessionToken(forgedToken);
      assert.equal(verified, null, "Forged token with bad signature must return null");
    });

    test("verifySessionTokenEdge verifies valid tokens using WebCrypto without Node crypto", async () => {
      const { verifySessionTokenEdge } = require("../src/lib/jwt-edge");
      const verified = await verifySessionTokenEdge(validToken);
      assert.ok(verified, "Must verify valid token");
      assert.equal(verified?.email, "test@cdktcnqn.edu.vn");
      assert.equal(verified?.role, "ADMIN");
    });

    test("verifySessionTokenEdge rejects tampered tokens", async () => {
      const { verifySessionTokenEdge } = require("../src/lib/jwt-edge");
      const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
      const payload = Buffer.from(
        JSON.stringify({
          id: "hacker-1",
          email: "hacker@cdktcnqn.edu.vn",
          role: "ADMIN",
          exp: Math.floor(Date.now() / 1000) + 3600,
        })
      ).toString("base64url");
      const fakeSignature = "invalid_signature_here_12345";
      const forgedToken = `${header}.${payload}.${fakeSignature}`;

      const verified = await verifySessionTokenEdge(forgedToken);
      assert.equal(verified, null, "Forged token must return null in edge verification");
    });
  });

  describe("3. Authenticated users opening /login", () => {
    test("authenticated user accessing /login redirects directly to /tasks", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login", validToken);
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location).pathname, "/tasks");
    });

    test("unauthenticated user accessing /login is allowed through", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login");
      const res = await middleware(req);

      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });
  });

  describe("4. Root route '/' routing", () => {
    test("authenticated user accessing '/' redirects to /tasks", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/", validToken);
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location).pathname, "/tasks");
    });

    test("unauthenticated user accessing '/' redirects to /login", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/");
      const res = await middleware(req);

      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location).pathname, "/login");
    });
  });

  describe("5. Open Redirect Protection on returnTo", () => {
    test("sanitizeRedirectUrl sanitizes dangerous returnTo parameters", () => {
      assert.equal(sanitizeRedirectUrl("https://attacker.com"), "/tasks");
      assert.equal(sanitizeRedirectUrl("//attacker.com"), "/tasks");
      assert.equal(sanitizeRedirectUrl("/\\attacker.com"), "/tasks");
      assert.equal(sanitizeRedirectUrl("javascript:alert(1)"), "/tasks");
      assert.equal(sanitizeRedirectUrl("/login"), "/tasks");
      assert.equal(sanitizeRedirectUrl("/api/auth/google"), "/tasks");
      assert.equal(sanitizeRedirectUrl("/tasks?view=kanban"), "/tasks?view=kanban");
    });

    test("unauthenticated request with dangerous target does not create open redirect", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/calendar");
      const res = await middleware(req);

      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      const returnTo = targetUrl.searchParams.get("returnTo");
      assert.equal(returnTo, "/calendar");
      assert.equal(sanitizeRedirectUrl(returnTo), "/calendar");
    });
  });
});
