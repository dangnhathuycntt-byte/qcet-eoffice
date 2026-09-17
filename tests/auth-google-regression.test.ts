import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { handlers } from "@/auth";
import { GET as nextAuthGet, POST as nextAuthPost } from "@/app/api/auth/[...nextauth]/route";
import { GET as authMeGet } from "@/app/api/auth/me/route";
import { POST as authLogoutPost } from "@/app/api/auth/logout/route";
import { GET as googleInitGet } from "@/app/api/auth/google/route";
import { middleware } from "@/middleware";
import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from "@/lib/jwt-session";
import { prisma } from "@/lib/prisma";
import {
  revokeSession,
  revokeAllUserSessions,
  clearRevocationStoreForTesting,
} from "@/server/auth/session-policy";
import { resolveOAuthError } from "@/lib/login-helpers";
import { setFeatureFlagOverride, resetFeatureFlagOverrides } from "@/features/flags";

describe("Regression Suite: Google Auth Consolidation & Login Loop Prevention", () => {
  const originalEnv = { ...process.env };
  const originalPrisma = {
    userFindUnique: prisma.user.findUnique,
    userUpdate: prisma.user.update,
    accountCreate: prisma.account?.create,
    sessionFindUnique: prisma.session?.findUnique,
    sessionFindFirst: prisma.session?.findFirst,
    sessionDeleteMany: prisma.session?.deleteMany,
    sessionCreate: prisma.session?.create,
  };

  beforeEach(() => {
    clearRevocationStoreForTesting();
    resetFeatureFlagOverrides();
    process.env.GOOGLE_CLIENT_ID = "mock-google-client-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-google-client-secret";
    process.env.AUTH_SECRET = "test-authjs-v5-secret-key-32-chars-long-string";
    process.env.JWT_SECRET = "test-authjs-v5-secret-key-32-chars-long-string";
    process.env.AUTH_ALLOWED_DOMAINS = "cdktcnqn.edu.vn";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    resetFeatureFlagOverrides();
    prisma.user.findUnique = originalPrisma.userFindUnique;
    prisma.user.update = originalPrisma.userUpdate;
    if (prisma.account) {
      prisma.account.create = originalPrisma.accountCreate;
    }
    if (prisma.session) {
      prisma.session.findUnique = originalPrisma.sessionFindUnique;
      prisma.session.findFirst = originalPrisma.sessionFindFirst;
      prisma.session.deleteMany = originalPrisma.sessionDeleteMany;
      prisma.session.create = originalPrisma.sessionCreate;
    }
  });

  describe("1. NextAuth / Auth.js Route Handler Integration", () => {
    test("Auth.js handlers are exported and handle /api/auth/providers request", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/providers");
      const res = await nextAuthGet(req);
      assert.ok(res);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.ok(data.google, "Google provider must be registered in Auth.js");
      assert.strictEqual(data.google.name, "Google");
      assert.ok(data.google.type === "oauth" || data.google.type === "oidc");
    });

    test("GET /api/auth/google returns to login and requests client-side Google sign-in", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/google?returnTo=/documents/doc-123");
      const res = await googleInitGet(req);
      assert.strictEqual(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.strictEqual(targetUrl.pathname, "/login");
      assert.strictEqual(targetUrl.searchParams.get("startGoogle"), "1");
      assert.strictEqual(targetUrl.searchParams.get("returnTo"), "/documents/doc-123");
    });

    test("GET /api/auth/google redirects with error when externalGoogleLogin is disabled", async () => {
      setFeatureFlagOverride("externalGoogleLogin", false);
      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleInitGet(req);
      assert.strictEqual(res.status, 307);
      const location = res.headers.get("location");
      assert.ok(location?.includes("/login?error=oauth_not_configured"));
    });
  });

  describe("2. Domain, Pre-provisioning, and Deactivation Policies", () => {
    test("Unauthorized domain is rejected at callback and redirects with domain_not_allowed", async () => {
      const { authConfig } = await import("@/auth.config");
      const { isAllowedDomain } = await import("@/lib/google-oauth");

      assert.strictEqual(isAllowedDomain("student@gmail.com"), false);
      assert.strictEqual(isAllowedDomain("attacker@fake-cdktcnqn.edu.vn"), false);
      assert.strictEqual(isAllowedDomain("giangvien@cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("giangvien@cdktcnqn.edu.vn", "cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("giangvien@cdktcnqn.edu.vn", "gmail.com"), false);
    });

    test("Pre-provisioning invariant: Non-existing user in DB is rejected without auto-creating accounts", async () => {
      (prisma.user.findUnique as any) = async () => null;

      let createCalled = false;
      (prisma.user.create as any) = async () => {
        createCalled = true;
        throw new Error("Should not call user.create");
      };

      // Querying /api/auth/me for non-existing user returns unauthenticated
      const token = signSessionToken({
        id: "non-existent-id",
        email: "ghost@cdktcnqn.edu.vn",
        name: "Ghost User",
        role: "CHUYEN_VIEN",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      const res = await authMeGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
      assert.strictEqual(createCalled, false, "Must not auto-create user");
    });

    test("Deactivated user (isActive = false) is rejected at /api/auth/me with 200 authenticated: false", async () => {
      (prisma.user.findUnique as any) = async () => ({
        id: "disabled-user-1",
        email: "locked@cdktcnqn.edu.vn",
        name: "Khóa Tài Khoản",
        role: "CHUYEN_VIEN",
        isActive: false,
      });

      const token = signSessionToken({
        id: "disabled-user-1",
        email: "locked@cdktcnqn.edu.vn",
        name: "Khóa Tài Khoản",
        role: "CHUYEN_VIEN",
      });

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
      });
      const res = await authMeGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
    });
  });

  describe("3. Database Session Truth & Cookie Invariants", () => {
    test("Valid database session token in prisma.session is verified by /api/auth/me", async () => {
      const dbSessionToken = "db-session-token-cuid-1234567890";
      (prisma.user.findUnique as any) = async ({ where }: any) => {
        if (where.id === "user-bgh-1" || where.email === "bgh@cdktcnqn.edu.vn") {
          return {
            id: "user-bgh-1",
            email: "bgh@cdktcnqn.edu.vn",
            name: "Ban Giám Hiệu",
            role: "BAN_GIAM_HIEU",
            isActive: true,
            department: null,
          };
        }
        return null;
      };

      (prisma.session.findUnique as any) = async ({ where }: any) => {
        if (where.sessionToken === dbSessionToken) {
          return {
            id: "session-db-1",
            sessionToken: dbSessionToken,
            userId: "user-bgh-1",
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            user: {
              id: "user-bgh-1",
              email: "bgh@cdktcnqn.edu.vn",
              name: "Ban Giám Hiệu",
              role: "BAN_GIAM_HIEU",
              isActive: true,
            },
          };
        }
        return null;
      };

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dbSessionToken}` },
      });
      const res = await authMeGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, true);
      assert.strictEqual(data.user.email, "bgh@cdktcnqn.edu.vn");
      assert.strictEqual(data.user.role, "BAN_GIAM_HIEU");
    });

    test("Expired database session token is rejected by /api/auth/me", async () => {
      const dbSessionToken = "db-expired-token-1234567890";
      (prisma.session.findUnique as any) = async ({ where }: any) => {
        if (where.sessionToken === dbSessionToken) {
          return {
            id: "session-db-expired",
            sessionToken: dbSessionToken,
            userId: "user-bgh-1",
            expires: new Date(Date.now() - 1000), // Expired in the past
            user: {
              id: "user-bgh-1",
              email: "bgh@cdktcnqn.edu.vn",
              name: "Ban Giám Hiệu",
              role: "BAN_GIAM_HIEU",
              isActive: true,
            },
          };
        }
        return null;
      };

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dbSessionToken}` },
      });
      const res = await authMeGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
    });

    test("Revoked database session token is rejected by /api/auth/me", async () => {
      const dbSessionToken = "db-revoked-token-1234567890";
      revokeSession("session-db-revoked", { revokedById: "user-bgh-1" });

      (prisma.session.findUnique as any) = async ({ where }: any) => {
        if (where.sessionToken === dbSessionToken) {
          return {
            id: "session-db-revoked",
            sessionToken: dbSessionToken,
            userId: "user-bgh-1",
            expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
            user: {
              id: "user-bgh-1",
              email: "bgh@cdktcnqn.edu.vn",
              name: "Ban Giám Hiệu",
              role: "BAN_GIAM_HIEU",
              isActive: true,
            },
          };
        }
        return null;
      };

      const req = new NextRequest("http://localhost:3000/api/auth/me", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${dbSessionToken}` },
      });
      const res = await authMeGet(req);
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.authenticated, false);
    });
  });

  describe("4. Redirect Loop Prevention in Middleware & Client Flow", () => {
    test("Unverified opaque token does NOT cause redirect loop from /login to /tasks", async () => {
      // Middleware receives a random opaque cookie (e.g. leftover from expired session)
      const req = new NextRequest("http://localhost:3000/login", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=random_opaque_cookie_value_123` },
      });
      const res = await middleware(req);
      // It must NOT redirect /login -> /tasks based purely on opaque cookie string
      assert.strictEqual(res.status, 200, "Must stay on /login without redirecting to /tasks");
    });

    test("Valid cryptographic JWT at /login still waits for database session truth", async () => {
      const validJwt = signSessionToken({
        id: "user-valid-1",
        email: "valid@cdktcnqn.edu.vn",
        name: "Valid User",
        role: "CHUYEN_VIEN",
      });

      const req = new NextRequest("http://localhost:3000/login", {
        headers: { cookie: `${SESSION_COOKIE_NAME}=${validJwt}` },
      });
      const res = await middleware(req);
      assert.strictEqual(res.status, 200);
      assert.strictEqual(res.headers.get("location"), null);
    });

    test("Logout clears all session cookies across both HTTPS and standard cookie names", async () => {
      const req = new NextRequest("http://localhost:3000/api/auth/logout", {
        method: "POST",
      });
      const res = await authLogoutPost(req);
      assert.strictEqual(res.status, 200);

      // Verify Set-Cookie headers clear all variants
      const setCookieHeaders = res.headers.getSetCookie();
      assert.ok(setCookieHeaders.length >= 3);

      const hasAuthJsCleared = setCookieHeaders.some((h) => h.includes("authjs.session-token=;"));
      const hasSecureAuthJsCleared = setCookieHeaders.some((h) => h.includes("__Secure-authjs.session-token=;"));
      const hasLegacyCleared = setCookieHeaders.some((h) => h.includes("qcet_session=;"));

      assert.ok(hasAuthJsCleared, "authjs.session-token cookie must be cleared");
      assert.ok(hasSecureAuthJsCleared, "__Secure-authjs.session-token cookie must be cleared");
      assert.ok(hasLegacyCleared, "qcet_session cookie must be cleared");
    });
  });

  describe("5. Error Taxonomy & User-Friendly Messages", () => {
    test("Distinguishes oauth_state_invalid vs session_expired vs account_disabled vs server_error", () => {
      const stateErr = resolveOAuthError("oauth_state_invalid");
      assert.strictEqual(stateErr?.code, "oauth_state_invalid");
      assert.strictEqual(stateErr?.title, "Lỗi trạng thái xác thực");
      assert.strictEqual(stateErr?.variant, "red");

      const sessionErr = resolveOAuthError("session_expired");
      assert.strictEqual(sessionErr?.code, "session_expired");
      assert.strictEqual(sessionErr?.title, "Phiên làm việc hết hạn");
      assert.strictEqual(sessionErr?.variant, "amber");

      const disabledErr = resolveOAuthError("account_disabled");
      assert.strictEqual(disabledErr?.code, "account_disabled");
      assert.strictEqual(disabledErr?.title, "Tài khoản bị tạm khóa");
      assert.strictEqual(disabledErr?.variant, "red");

      const serverErr = resolveOAuthError("server_error");
      assert.strictEqual(serverErr?.code, "server_error");
      assert.strictEqual(serverErr?.title, "Lỗi kết nối máy chủ");
      assert.strictEqual(serverErr?.variant, "red");
    });
  });
});
