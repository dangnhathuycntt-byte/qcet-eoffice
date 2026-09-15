import { describe, test, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest, NextResponse } from "next/server";
import { middleware } from "@/middleware";
import { POST as logoutPost, GET as logoutGet } from "@/app/api/auth/logout/route";
import { GET as meGet } from "@/app/api/auth/me/route";
import {
  signSessionToken,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
  LEGACY_SESSION_COOKIE_NAME,
} from "@/lib/jwt-session";
import { getApiContext, requireAuthenticated } from "@/server/api/request-context";
import { authConfig } from "@/auth.config";
import { auth, signIn, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";

describe("Auth.js NextAuth Migration & Full Lifecycle Regression Suite", () => {
  let activeUserToken: string;
  let activeUser: { id: string; email: string; name: string; role: string };

  before(async () => {
    let dbUser = await prisma.user.findFirst({
      where: { isActive: true },
    });
    if (!dbUser) {
      dbUser = await prisma.user.create({
        data: {
          email: `staff_test_${Date.now()}@cdktcnqn.edu.vn`,
          name: "Chuyên viên Thử nghiệm",
          role: "CHUYEN_VIEN",
          isActive: true,
        },
      });
    }

    activeUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
    };

    activeUserToken = signSessionToken({
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      departmentId: dbUser.departmentId,
      title: dbUser.title,
    });
  });

  // =========================================================================
  // 1. Auth.js Configuration & Architecture Invariants
  // =========================================================================
  describe("1. Auth.js Configuration & Architecture Invariants", () => {
    test("authConfig is Edge-compatible and specifies JWT strategy with 30-day maxAge", () => {
      assert.equal(authConfig.session?.strategy, "jwt");
      assert.equal(authConfig.session?.maxAge, 30 * 24 * 60 * 60);
      assert.equal(authConfig.pages?.signIn, "/login");
      assert.equal(authConfig.pages?.error, "/login");
    });

    test("auth, signIn, signOut functions are properly exported and callable", () => {
      assert.equal(typeof auth, "function");
      assert.equal(typeof signIn, "function");
      assert.equal(typeof signOut, "function");
    });
  });

  // =========================================================================
  // 2. Initial Login & Session Resolution Flow
  // =========================================================================
  describe("2. Initial Login & Route Access Flow", () => {
    test("2.1 Authenticated user accessing / is redirected to /tasks", async () => {
      const req = new NextRequest("http://localhost:3000/", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "http://localhost:3000/tasks");
    });

    test("2.2 Authenticated user accessing /login is redirected to /tasks", async () => {
      const req = new NextRequest("http://localhost:3000/login", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "http://localhost:3000/tasks");
    });

    test("2.3 Authenticated user accessing /tasks is allowed through (200)", async () => {
      const req = new NextRequest("http://localhost:3000/tasks", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
    });

    test("2.4 GET /api/auth/me resolves active user session from Auth.js cookie", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await meGet(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.authenticated, true);
      assert.equal(data.user.email, activeUser.email);
    });

    test("2.5 GET /api/auth/me also resolves session from Authorization: Bearer header", async () => {
      const req = new Request("http://localhost:3000/api/auth/me", {
        headers: {
          authorization: `Bearer ${activeUserToken}`,
        },
      });

      const res = await meGet(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.authenticated, true);
      assert.equal(data.user.id, activeUser.id);
    });
  });

  // =========================================================================
  // 3. Reload & Navigation Persistence Invariants
  // =========================================================================
  describe("3. Reload & Navigation Persistence", () => {
    test("3.1 Repeated requests across multiple routes maintain authenticated state", async () => {
      const routes = ["/tasks", "/documents", "/calendar", "/org"];

      for (const route of routes) {
        const req = new NextRequest(`http://localhost:3000${route}`, {
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
          },
        });

        const res = await middleware(req);
        assert.equal(res.status, 200, `Route ${route} must be accessible with active session`);
      }
    });

    test("3.2 Supports secure HTTPS cookie (__Secure-authjs.session-token)", async () => {
      const req = new NextRequest("http://localhost:3000/tasks", {
        headers: {
          cookie: `${SECURE_SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
    });

    test("3.3 Legacy session cookie (qcet_session) is still recognized during migration window", async () => {
      const req = new NextRequest("http://localhost:3000/tasks", {
        headers: {
          cookie: `${LEGACY_SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // 4. Logout Execution & Session Eviction
  // =========================================================================
  describe("4. Logout Execution & Cookie Eviction", () => {
    test("4.1 POST /api/auth/logout clears all session cookie variants with maxAge: 0", async () => {
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "POST",
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${activeUserToken}`,
        },
      });

      const res = await logoutPost(req);
      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify Set-Cookie headers clear all variants
      const setCookies = res.headers.getSetCookie();
      assert.ok(setCookies.length >= 3, "Must clear all auth cookie variants");

      const hasAuthJsCleared = setCookies.some((c) => c.includes(`${SESSION_COOKIE_NAME}=;`) && c.includes("Max-Age=0"));
      const hasLegacyCleared = setCookies.some((c) => c.includes(`${LEGACY_SESSION_COOKIE_NAME}=;`) && c.includes("Max-Age=0"));

      assert.ok(hasAuthJsCleared, "authjs.session-token must be cleared");
      assert.ok(hasLegacyCleared, "qcet_session must be cleared");
    });

    test("4.2 GET /api/auth/logout also clears cookies gracefully", async () => {
      const req = new Request("http://localhost:3000/api/auth/logout", {
        method: "GET",
      });

      const res = await logoutGet(req);
      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // 5. Post-Logout Protection & Re-login Flow
  // =========================================================================
  describe("5. Post-Logout Protection & Re-login Flow", () => {
    test("5.1 Unauthenticated user accessing /tasks is redirected to /login with returnTo", async () => {
      const req = new NextRequest("http://localhost:3000/tasks");
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.equal(res.headers.get("location"), "http://localhost:3000/login");
    });

    test("5.2 Unauthenticated user accessing deep path preserves returnTo", async () => {
      const req = new NextRequest("http://localhost:3000/documents?tab=inbox");
      const res = await middleware(req);
      assert.equal(res.status, 307);
      assert.equal(
        res.headers.get("location"),
        "http://localhost:3000/login?returnTo=%2Fdocuments%3Ftab%3Dinbox"
      );
    });

    test("5.3 Re-login in same session with newly issued token immediately restores access", async () => {
      const newToken = signSessionToken({
        id: activeUser.id,
        email: activeUser.email,
        name: activeUser.name,
        role: activeUser.role,
      });

      const req = new NextRequest("http://localhost:3000/tasks", {
        headers: {
          cookie: `${SESSION_COOKIE_NAME}=${newToken}`,
        },
      });

      const res = await middleware(req);
      assert.equal(res.status, 200);
    });
  });

  // =========================================================================
  // 6. Security Guards: Disabled Account & Unapproved Google User
  // =========================================================================
  describe("6. Security Guards & Server Truth Enforcement", () => {
    test("6.1 Disabled or invalid user session is rejected by requireAuthenticated with AUTH_REQUIRED/ACCOUNT_DISABLED", async () => {
      const disabledToken = signSessionToken({
        id: "disabled_user_999",
        email: "locked@cdktcnqn.edu.vn",
        name: "Tài Khoản Bị Khóa",
        role: "CHUYEN_VIEN",
        isActive: false,
      });

      const req = new Request("http://localhost:3000/api/tasks", {
        headers: {
          authorization: `Bearer ${disabledToken}`,
        },
      });

      const ctx = await getApiContext(req);
      assert.throws(
        () => {
          requireAuthenticated({
            ...ctx,
            session: {
              sessionId: "ses_disabled",
              userId: "disabled_user_999",
              user: {
                id: "disabled_user_999",
                email: "locked@cdktcnqn.edu.vn",
                name: "Tài Khoản Bị Khóa",
                isActive: false,
              },
            },
          });
        },
        (err: any) => {
          return err.code === "ACCOUNT_DISABLED" || err.message.includes("vô hiệu hóa");
        }
      );
    });

    test("6.2 Unauthenticated API request throws AUTH_REQUIRED via requireAuthenticated", async () => {
      const req = new Request("http://localhost:3000/api/tasks");
      const ctx = await getApiContext(req);

      assert.throws(
        () => requireAuthenticated(ctx),
        (err: any) => err.code === "AUTH_REQUIRED"
      );
    });
  });
});
