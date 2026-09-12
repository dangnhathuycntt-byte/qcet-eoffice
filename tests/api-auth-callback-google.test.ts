import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET as googleCallbackGet } from "../src/app/api/auth/callback/google/route";
import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySessionToken } from "../src/lib/jwt-session";
import { prisma } from "../src/lib/prisma";

describe("GET /api/auth/callback/google", () => {
  const originalEnv = { ...process.env };
  const originalFetch = globalThis.fetch;
  const originalTransaction = prisma.$transaction;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "mock-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "mock-client-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    globalThis.fetch = originalFetch;
    prisma.$transaction = originalTransaction;
  });

  test("redirects to /login?error=oauth_cancelled when error parameter present", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?error=access_denied");
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=oauth_cancelled"));
  });

  test("redirects to /login?error=oauth_state_invalid on state mismatch or missing cookie", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=fake_code&state=fake_state");
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=oauth_state_invalid"));
  });

  test("redirects to /login?error=missing_code when code parameter is missing", async () => {
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=missing_code"));
  });

  test("redirects to /login?error=oauth_not_configured when client credentials missing", async () => {
    delete process.env.GOOGLE_CLIENT_ID;
    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=fake_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=oauth_not_configured"));
  });

  test("redirects to /login?error=oauth_failed when token exchange fails", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 });
      }
      return new Response("Not Found", { status: 404 });
    };

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=bad_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=oauth_failed"));
  });

  test("redirects to /login?error=domain_not_allowed when domain is not cdktcnqn.edu.vn", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-12345",
            email: "intruder@gmail.com",
            email_verified: true,
            name: "Gmail User",
            hd: "gmail.com",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=valid_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.includes("/login?error=domain_not_allowed"));
    assert.ok(location?.includes("intruder%40gmail.com"));
  });

  test("redirects to /login?error=account_disabled when user isActive is false", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-disabled",
            email: "locked@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Locked Staff",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    // Mock prisma transaction returning disabled user
    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => ({
            id: "acc-1",
            user: {
              id: "user-disabled",
              email: "locked@cdktcnqn.edu.vn",
              name: "Locked Staff",
              role: "CHUYEN_VIEN",
              isActive: false,
              avatarUrl: null,
            },
          }),
        },
        user: {
          update: async () => {},
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=valid_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.ok(res.headers.get("location")?.includes("/login?error=account_disabled"));
  });

  test("signs in existing user with linked account, sets session cookie and redirects to /", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-access-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-existing",
            email: "teacher@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Teacher One",
            picture: "https://avatar.url/pic.jpg",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    let updatedAvatar: string | undefined;

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => ({
            id: "acc-existing",
            user: {
              id: "user-123",
              email: "teacher@cdktcnqn.edu.vn",
              name: "Teacher One",
              role: "TRUONG_PHONG",
              departmentId: "p-cntt",
              title: "Trưởng phòng CNTT",
              isActive: true,
              avatarUrl: null,
            },
          }),
        },
        user: {
          update: async ({ data }: any) => {
            updatedAvatar = data.avatarUrl;
          },
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=valid_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.strictEqual(new URL(res.headers.get("location")!).pathname, "/");
    assert.strictEqual(updatedAvatar, "https://avatar.url/pic.jpg");

    // Check session cookie
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(sessionCookie, "Session cookie must be set");
    assert.strictEqual(sessionCookie.httpOnly, true);
    assert.strictEqual(sessionCookie.sameSite, "lax");

    const payload = verifySessionToken(sessionCookie.value);
    assert.strictEqual(payload?.email, "teacher@cdktcnqn.edu.vn");
    assert.strictEqual(payload?.role, "TRUONG_PHONG");
    assert.strictEqual(payload?.departmentId, "p-cntt");
  });

  test("links Google account to existing user matching email address", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-link-token",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-link-sub",
            email: "existing@cdktcnqn.edu.vn",
            email_verified: true,
            name: "Existing Staff",
            picture: "https://avatar.url/existing.jpg",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    let createdAccountData: any;
    let updatedAvatar: string | undefined;

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => null,
          create: async ({ data }: any) => {
            createdAccountData = data;
            return data;
          },
        },
        user: {
          findUnique: async () => ({
            id: "user-link-999",
            email: "existing@cdktcnqn.edu.vn",
            name: "Existing Staff",
            role: "CHUYEN_VIEN",
            departmentId: null,
            title: "Chuyên viên",
            isActive: true,
            avatarUrl: null,
          }),
          update: async ({ data }: any) => {
            updatedAvatar = data.avatarUrl;
          },
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=valid_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.strictEqual(new URL(res.headers.get("location")!).pathname, "/");
    assert.ok(createdAccountData);
    assert.strictEqual(createdAccountData.userId, "user-link-999");
    assert.strictEqual(createdAccountData.providerAccountId, "google-link-sub");
    assert.strictEqual(updatedAvatar, "https://avatar.url/existing.jpg");

    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(sessionCookie);
    const payload = verifySessionToken(sessionCookie.value);
    assert.strictEqual(payload?.email, "existing@cdktcnqn.edu.vn");
  });

  test("auto-provisions new user and links Google account on first login", async () => {
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("oauth2.googleapis.com/token")) {
        return new Response(
          JSON.stringify({
            access_token: "mock-token-new",
            token_type: "Bearer",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      if (url.includes("googleapis.com/oauth2/v3/userinfo")) {
        return new Response(
          JSON.stringify({
            sub: "google-sub-new",
            email: "newstaff@cdktcnqn.edu.vn",
            email_verified: true,
            name: "New Staff Member",
            picture: "https://avatar.url/new.jpg",
            hd: "cdktcnqn.edu.vn",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    let createdUserData: any;

    prisma.$transaction = (async (callback: any) => {
      const txMock = {
        account: {
          findUnique: async () => null,
        },
        user: {
          findUnique: async () => null,
          create: async ({ data }: any) => {
            createdUserData = data;
            return {
              id: "new-user-id",
              email: data.email,
              name: data.name,
              role: data.role,
              departmentId: null,
              title: data.title,
              isActive: true,
              avatarUrl: data.avatarUrl,
            };
          },
        },
      };
      return callback(txMock);
    }) as any;

    const req = new NextRequest("http://localhost:3000/api/auth/callback/google?code=valid_code&state=valid_state", {
      headers: {
        cookie: "qcet_oauth_state=valid_state",
      },
    });
    const res = await googleCallbackGet(req);

    assert.strictEqual(res.status, 307);
    assert.strictEqual(new URL(res.headers.get("location")!).pathname, "/");

    // Verify created user data
    assert.ok(createdUserData, "User should be created in DB");
    assert.strictEqual(createdUserData.email, "newstaff@cdktcnqn.edu.vn");
    assert.strictEqual(createdUserData.name, "New Staff Member");
    assert.strictEqual(createdUserData.role, "CHUYEN_VIEN");
    assert.strictEqual(createdUserData.provider, "google");
    assert.strictEqual(createdUserData.isActive, true);
    assert.strictEqual(createdUserData.onboardedAt, null);
    assert.strictEqual(createdUserData.accounts.create.providerAccountId, "google-sub-new");

    // Check session cookie
    const sessionCookie = res.cookies.get(SESSION_COOKIE_NAME);
    assert.ok(sessionCookie, "Session cookie must be set");
    assert.strictEqual(sessionCookie.maxAge, 30 * 24 * 60 * 60, "Session cookie maxAge must be 30 days");
    const payload = verifySessionToken(sessionCookie.value);
    assert.strictEqual(payload?.email, "newstaff@cdktcnqn.edu.vn");
    assert.strictEqual(payload?.role, "CHUYEN_VIEN");
  });
});
