import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import { signSessionToken, SESSION_COOKIE_NAME, verifySessionToken } from "../src/lib/jwt-session";
import { verifySessionTokenEdge } from "../src/lib/jwt-edge";
import { POST as logoutPost, GET as logoutGet } from "../src/app/api/auth/logout/route";

describe("Complete Authentication Lifecycle & Regression Suite (Login -> Logout -> Re-login)", () => {
  const userPayload = {
    id: "cmttqafer0001vido60534eoz",
    email: "dangnhathuy@cdktcnqn.edu.vn",
    name: "ThS. Đặng Nhật Huy (Hiệu trưởng)",
    role: "BAN_GIAM_HIEU",

    title: "Hiệu trưởng",
  };

  const createRequest = (url: string, cookieToken?: string) => {
    const headers: Record<string, string> = {};
    if (cookieToken) {
      headers["cookie"] = `${SESSION_COOKIE_NAME}=${cookieToken}`;
    }
    return new NextRequest(new URL(url, "https://eoffice.qcet.edu.vn"), {
      headers,
    });
  };

  // -------------------------------------------------------------
  // Round 1: Initial Login & Active Session Invariants
  // -------------------------------------------------------------
  describe("Round 1: Initial Login Flow & Route Access", () => {
    let sessionToken: string;

    test("1.1 Token generation and cryptographic verification across Node and Edge runtimes", async () => {
      sessionToken = signSessionToken(userPayload);
      assert.ok(sessionToken && typeof sessionToken === "string");

      // Verify via Node runtime
      const nodeVerified = verifySessionToken(sessionToken);
      assert.ok(nodeVerified, "Node verifySessionToken must succeed");
      assert.equal(nodeVerified.id, userPayload.id);
      assert.equal(nodeVerified.email, userPayload.email);

      // Verify via Edge WebCrypto runtime
      const edgeVerified = await verifySessionTokenEdge(sessionToken);
      assert.ok(edgeVerified, "Edge verifySessionTokenEdge must succeed");
      assert.equal(edgeVerified.id, userPayload.id);
      assert.equal(edgeVerified.email, userPayload.email);
      assert.equal(edgeVerified.role, "BAN_GIAM_HIEU");
    });

    test("1.2 JWT at /login waits for database session truth", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login", sessionToken);
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });

    test("1.3 Authenticated user accessing / is redirected to /tasks (307)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/", sessionToken);
      const res = await middleware(req);
      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location).pathname, "/tasks");
    });

    test("1.4 Authenticated user accessing /tasks is allowed through (200)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/tasks", sessionToken);
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });

    test("1.5 Authenticated user reloading /tasks maintains active session", async () => {
      const reqReload = createRequest("https://eoffice.qcet.edu.vn/tasks", sessionToken);
      const resReload = await middleware(reqReload);
      assert.equal(resReload?.status, 200);
    });
  });

  // -------------------------------------------------------------
  // Round 2: Logout Execution & Session Eviction
  // -------------------------------------------------------------
  describe("Round 2: Logout Execution & Session Eviction", () => {
    test("2.1 POST /api/auth/logout clears qcet_session cookie with Max-Age:0 and anti-cache headers", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/api/auth/logout");
      const res = await logoutPost(req);

      assert.equal(res.status, 200);
      const data = await res.json();
      assert.equal(data.success, true);

      // Verify Set-Cookie header evicts cookie
      const setCookie = res.headers.get("set-cookie");
      assert.ok(setCookie, "Must include set-cookie header");
      assert.ok(setCookie.includes("qcet_session="), "Must set qcet_session");
      assert.ok(setCookie.includes("Max-Age=0"), "Must set Max-Age=0");
      assert.ok(setCookie.includes("Expires="), "Must set Expires header");

      // Verify anti-cache headers
      const cacheControl = res.headers.get("cache-control");
      assert.ok(cacheControl?.includes("no-cache"));
    });

    test("2.2 GET /api/auth/logout is rejected without mutating session", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/api/auth/logout");
      const res = await logoutGet(req);
      assert.equal(res.status, 405);
      assert.equal(res.headers.get("allow"), "POST");
      assert.equal(res.headers.get("set-cookie"), null);
    });
  });

  // -------------------------------------------------------------
  // Round 3: Post-Logout Route Protection & Unauthenticated Invariants
  // -------------------------------------------------------------
  describe("Round 3: Post-Logout Protection Invariants", () => {
    test("3.1 Unauthenticated user accessing /tasks redirects to /login (307)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/tasks");
      const res = await middleware(req);
      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      assert.equal(new URL(location).pathname, "/login");
    });

    test("3.2 Unauthenticated user accessing /calendar redirects to /login?returnTo=/calendar", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/calendar");
      const res = await middleware(req);
      assert.equal(res?.status, 307);
      const location = res?.headers.get("location");
      assert.ok(location);
      const targetUrl = new URL(location);
      assert.equal(targetUrl.pathname, "/login");
      assert.equal(targetUrl.searchParams.get("returnTo"), "/calendar");
    });

    test("3.3 Unauthenticated user accessing /login is allowed through (200, no redirect loop)", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login");
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });

    test("3.4 Reloading /login while unauthenticated remains on /login without redirecting", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login");
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });
  });

  // -------------------------------------------------------------
  // Round 4: Re-Login in Same Browser Session (Re-authentication)
  // -------------------------------------------------------------
  describe("Round 4: Re-Login in Same Browser Session", () => {
    let newSessionToken: string;

    test("4.1 Re-authenticating generates fresh session token", async () => {
      newSessionToken = signSessionToken({
        ...userPayload,
        name: "ThS. Đặng Nhật Huy (Hiệu trưởng - Re-logged)",
      });
      assert.ok(newSessionToken);

      const verified = await verifySessionTokenEdge(newSessionToken);
      assert.ok(verified);
      assert.equal(verified?.email, userPayload.email);
    });

    test("4.2 Re-authenticated user at /login waits for database session truth", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/login", newSessionToken);
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });

    test("4.3 Re-authenticated user accessing /tasks is allowed full access", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/tasks", newSessionToken);
      const res = await middleware(req);
      assert.equal(res?.status, 200);
      assert.equal(res?.headers.get("location"), null);
    });

    test("4.4 Second logout cleanly evicts session again without residue", async () => {
      const req = createRequest("https://eoffice.qcet.edu.vn/api/auth/logout", newSessionToken);
      const res = await logoutPost(req);
      assert.equal(res.status, 200);

      const postLogoutReq = createRequest("https://eoffice.qcet.edu.vn/tasks");
      const postLogoutRes = await middleware(postLogoutReq);
      assert.equal(postLogoutRes?.status, 307);
      assert.equal(new URL(postLogoutRes?.headers.get("location") || "").pathname, "/login");
    });
  });
});
