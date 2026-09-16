import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET as googleAuthGet } from "../src/app/api/auth/google/route";
import { GET as googleCallbackGet } from "../src/app/api/auth/callback/google/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

describe("E2E Google Workspace OAuth Integration Flow", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalTransaction = prisma.$transaction;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "e2e-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "e2e-client-secret";
    process.env.AUTH_ALLOWED_DOMAINS = "cdktcnqn.edu.vn";
    process.env.JWT_SECRET = "e2e-test-jwt-secret-key-32-chars-long";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    prisma.$transaction = originalTransaction;
  });

  test("1. Init flow: GET /api/auth/google generates state cookie and redirects to Google with correct params", async () => {
    const req = new NextRequest("http://localhost:3001/api/auth/google");
    const res = await googleAuthGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location, "Redirect location header must be present");
    assert.ok(location.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));

    const authUrl = new URL(location);
    assert.strictEqual(authUrl.searchParams.get("client_id"), "e2e-client-id.apps.googleusercontent.com");
    assert.strictEqual(authUrl.searchParams.get("redirect_uri"), "http://localhost:3001/api/auth/callback/google");
    assert.strictEqual(authUrl.searchParams.get("response_type"), "code");
    assert.strictEqual(authUrl.searchParams.get("scope"), "openid email profile");
    assert.strictEqual(authUrl.searchParams.get("hd"), "cdktcnqn.edu.vn");
    assert.strictEqual(authUrl.searchParams.get("prompt"), "select_account");
    assert.strictEqual(authUrl.searchParams.get("access_type"), "offline");

    const stateParam = authUrl.searchParams.get("state");
    assert.ok(stateParam && stateParam.length >= 16, "State param must be generated");

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(stateCookie, "qcet_oauth_state cookie must be set");
    assert.strictEqual(stateCookie.value, stateParam, "Cookie value must match state query param");
    assert.strictEqual(stateCookie.path, "/api/auth", "Cookie path must be scoped to /api/auth");
    assert.strictEqual(stateCookie.httpOnly, true, "Cookie must be httpOnly");
    assert.strictEqual(stateCookie.sameSite, "lax", "Cookie sameSite must be lax");
    assert.strictEqual(stateCookie.maxAge, 300, "Cookie maxAge must be 300s (5 minutes)");
  });

  test("2. Callback with invalid state: redirects to /login?error=oauth_state_invalid and deletes state cookie", async () => {
    const req = new NextRequest("http://localhost:3001/api/auth/callback/google?state=wrong_state&code=123", {
      headers: {
        cookie: "qcet_oauth_state=legit_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login?error=oauth_state_invalid"));

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(
      !stateCookie || stateCookie.value === "" || stateCookie.maxAge === 0,
      "State cookie must be cleared on invalid state"
    );
  });

  test("3. Callback with domain violation (user@gmail.com): redirects to /login?error=domain_not_allowed and deletes state cookie", async () => {
    const validState = "state-domain-violation-test";

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-token-gmail",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "gmail-sub-12345",
            email: "intruder@gmail.com",
            email_verified: true,
            name: "Gmail Intruder",
            hd: "gmail.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const req = new NextRequest(`http://localhost:3001/api/auth/callback/google?state=${validState}&code=gmail_code`, {
      headers: {
        cookie: `qcet_oauth_state=${validState}`,
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login?error=domain_not_allowed"));
    assert.ok(location?.includes("intruder%40gmail.com") || location?.includes("intruder@gmail.com"));

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(
      !stateCookie || stateCookie.value === "" || stateCookie.maxAge === 0,
      "State cookie must be cleared on domain rejection"
    );
  });

  test("4. Callback with disabled user: redirects to /login?error=account_disabled", async () => {
    const validState = "state-disabled-user-test";

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-token-disabled",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-disabled-sub",
            email: "disabled.staff@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Disabled Staff",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => ({
            id: "acc-disabled-1",
            provider: "google",
            providerAccountId: "google-disabled-sub",
            user: {
              id: "user-disabled-1",
              email: "disabled.staff@cdktcnqn.edu.vn",
              name: "Disabled Staff",
              role: "CHUYEN_VIEN",
              departmentId: null,
              title: "Chuyên viên",
              isActive: false, // Disabled account
              avatarUrl: null,
            },
          }),
        },
        user: {
          findUnique: async () => null,
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest(`http://localhost:3001/api/auth/callback/google?state=${validState}&code=valid_code`, {
      headers: {
        cookie: `qcet_oauth_state=${validState}`,
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login?error=account_disabled"));

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(
      !stateCookie || stateCookie.value === "" || stateCookie.maxAge === 0,
      "State cookie must be cleared on account disabled"
    );

    // Verify session cookie is NOT set
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.strictEqual(sessionCookie, undefined, "Session cookie must not be issued for disabled accounts");
  });

  test("5. Callback with unlisted user: enforces closed admission, rejects with account_not_found, and does not auto-provision", async () => {
    const validState = "state-unlisted-user-e2e-test";

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-unlisted-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-unlisted-staff-sub",
            email: "unlisted.staff@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Cán Bộ Chưa Đăng Ký",
            picture: "https://lh3.googleusercontent.com/a/unlisted-staff-photo",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    let userCreateCalled = false;

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => null,
        },
        user: {
          findUnique: async () => null,
          create: async () => {
            userCreateCalled = true;
            throw new Error("PROVISIONING_DISALLOWED");
          },
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest(`http://localhost:3001/api/auth/callback/google?state=${validState}&code=unlisted_staff_code`, {
      headers: {
        cookie: `qcet_oauth_state=${validState}`,
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login?error=account_not_found"));
    assert.strictEqual(userCreateCalled, false, "Auto-provisioning user.create must not be called for unlisted user");

    // Verify session cookie is NOT set
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.strictEqual(sessionCookie, undefined, "Session cookie must not be set for unlisted user");

    // Verify state cookie deleted
    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(
      !stateCookie || stateCookie.value === "" || stateCookie.maxAge === 0,
      "State cookie must be cleared"
    );
  });

  test("6. Callback with existing valid user: links Google account, updates avatar, issues session, and redirects to /", async () => {
    const validState = "state-existing-user-e2e-test";

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-existing-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-existing-staff-sub",
            email: "hieutruong@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Hiệu Trưởng QCET",
            picture: "https://lh3.googleusercontent.com/a/hieutruong-photo",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    let linkedAccountData: any;
    let updatedUserAvatar: string | undefined;

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => null,
          create: async ({ data }: any) => {
            linkedAccountData = data;
            return data;
          },
        },
        user: {
          findUnique: async () => ({
            id: "user-hieutruong-001",
            email: "hieutruong@cdktcnqn.edu.vn",
            name: "Hiệu Trưởng QCET",
            role: "HIEU_TRUONG",
            departmentId: "dept-bgh-001",
            title: "Hiệu trưởng",
            isActive: true,
            avatarUrl: null, // No avatar initially
          }),
          update: async ({ data }: any) => {
            updatedUserAvatar = data.avatarUrl;
          },
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest(`http://localhost:3001/api/auth/callback/google?state=${validState}&code=hieutruong_code`, {
      headers: {
        cookie: `qcet_oauth_state=${validState}`,
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.strictEqual(res.headers.get("location"), "http://localhost:3001/tasks");

    // Verify account link and avatar update
    assert.ok(linkedAccountData, "OAuth account should be linked to existing user");
    assert.strictEqual(linkedAccountData.userId, "user-hieutruong-001");
    assert.strictEqual(linkedAccountData.providerAccountId, "google-existing-staff-sub");
    assert.strictEqual(updatedUserAvatar, "https://lh3.googleusercontent.com/a/hieutruong-photo");

    // Verify session issued with correct role and department
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(sessionCookie, "Session cookie must be issued for existing user");
    const sessionData = verifySessionToken(sessionCookie.value);
    assert.strictEqual(sessionData?.email, "hieutruong@cdktcnqn.edu.vn");
    assert.strictEqual(sessionData?.role, "HIEU_TRUONG");
    assert.strictEqual(sessionData?.departmentId, "dept-bgh-001");

    // Verify state cookie deleted
    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(
      !stateCookie || stateCookie.value === "" || stateCookie.maxAge === 0,
      "State cookie must be cleared on successful callback"
    );
  });
});
