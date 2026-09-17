import { afterEach, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { prisma } from "@/lib/prisma";
import {
  getSessionFromRequest,
  signSessionToken,
  SESSION_COOKIE_NAME,
  SECURE_SESSION_COOKIE_NAME,
} from "@/lib/jwt-session";
import { resolveCurrentSession } from "@/server/auth/current-session";
import { middleware } from "@/middleware";
import { GET as logoutGet, POST as logoutPost } from "@/app/api/auth/logout/route";
import { POST as passwordLogin } from "@/app/api/auth/login/route";
import { POST as legacyGoogleVerify } from "@/app/api/auth/google/verify/route";
import { isVerifiedGoogleWorkspaceIdentity } from "@/lib/google-oauth";

const secret = "auth-hardening-regression-secret-32chars";
process.env.AUTH_SECRET = secret;

const activeUser = {
  id: "auth-hardening-user",
  email: "auth-hardening@cdktcnqn.edu.vn",
  name: "Auth Hardening",
  role: "CHUYEN_VIEN",
  departmentId: "CNTT",
  title: "Chuyên viên",
  isActive: true,
};

describe("authentication hardening regressions", () => {
  const originalSessionFind = prisma.session.findUnique;
  const originalSessionDeleteMany = prisma.session.deleteMany;
  const originalUserFind = prisma.user.findUnique;

  beforeEach(() => {
    (prisma.session.findUnique as any) = async () => null;
    (prisma.session.deleteMany as any) = async () => ({ count: 0 });
    (prisma.user.findUnique as any) = async () => activeUser;
  });

  afterEach(() => {
    (prisma.session.findUnique as any) = originalSessionFind;
    (prisma.session.deleteMany as any) = originalSessionDeleteMany;
    (prisma.user.findUnique as any) = originalUserFind;
  });

  test("page session resolution rejects a JWT whose database user is disabled", async () => {
    (prisma.user.findUnique as any) = async () => ({ ...activeUser, isActive: false });
    const token = signSessionToken(activeUser);

    const session = await getSessionFromRequest({
      cookies: { get: (name) => name === SESSION_COOKIE_NAME ? { value: token } : undefined },
    });

    assert.equal(session, null);
  });

  test("page session resolution refreshes role and profile fields from database", async () => {
    (prisma.user.findUnique as any) = async () => ({
      ...activeUser,
      role: "TRUONG_PHONG",
      title: "Trưởng phòng",
    });
    const token = signSessionToken({ ...activeUser, role: "CHUYEN_VIEN", title: "Chuyên viên" });

    const session = await getSessionFromRequest({
      cookies: { get: (name) => name === SESSION_COOKIE_NAME ? { value: token } : undefined },
    });

    assert.equal(session?.role, "TRUONG_PHONG");
    assert.equal(session?.title, "Trưởng phòng");
  });

  test("API session resolution skips an invalid stale cookie and accepts the valid secure cookie", async () => {
    const validToken = "valid-secure-db-session";
    (prisma.session.findUnique as any) = async ({ where }: any) =>
      where.sessionToken === validToken
        ? {
            id: "db-session-id",
            sessionToken: validToken,
            userId: activeUser.id,
            expires: new Date(Date.now() + 60_000),
            revokedAt: null,
            user: activeUser,
          }
        : null;

    const session = await resolveCurrentSession({
      cookies: {
        get: (name) => {
          if (name === SESSION_COOKIE_NAME) return { value: "invalid-stale-token" };
          if (name === SECURE_SESSION_COOKIE_NAME) return { value: validToken };
          return undefined;
        },
      },
    });

    assert.equal(session.userId, activeUser.id);
    assert.equal(session.sessionId, "db-session-id");
  });

  test("API session resolution accepts a secure-cookie JWE encoded with its cookie salt", async () => {
    const token = await encode({
      token: { id: activeUser.id, email: activeUser.email, name: activeUser.name },
      secret,
      salt: SECURE_SESSION_COOKIE_NAME,
    });

    const session = await resolveCurrentSession({
      cookies: { get: (name) => name === SECURE_SESSION_COOKIE_NAME ? { value: token } : undefined },
    });

    assert.equal(session.userId, activeUser.id);
  });

  test("middleware lets /login reach server truth instead of redirecting from JWT claims", async () => {
    const token = signSessionToken(activeUser);
    const response = await middleware(new NextRequest("https://eoffice.qcet.edu.vn/login", {
      headers: { cookie: `${SESSION_COOKIE_NAME}=${token}` },
    }));

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("location"), null);
  });

  test("logout rejects cross-site POST and does not mutate state through GET", async () => {
    const crossSite = await logoutPost(new Request("https://eoffice.qcet.edu.vn/api/auth/logout", {
      method: "POST",
      headers: { origin: "https://attacker.invalid", "sec-fetch-site": "cross-site" },
    }));
    assert.equal(crossSite.status, 403);

    const get = await logoutGet(new Request("https://eoffice.qcet.edu.vn/api/auth/logout"));
    assert.equal(get.status, 405);
    assert.equal(get.headers.get("allow"), "POST");
  });

  test("password login endpoint remains disabled even for a provisioned account", async () => {
    const response = await passwordLogin(new Request("https://eoffice.qcet.edu.vn/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: activeUser.email, password: "valid-password" }),
    }));

    assert.equal(response.status, 403);
  });

  test("legacy Google ID-token endpoint cannot issue a parallel session", async () => {
    const response = await legacyGoogleVerify(new NextRequest(
      "https://eoffice.qcet.edu.vn/api/auth/google/verify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ credential: "legacy-google-token" }),
      }
    ));

    assert.equal(response.status, 410);
    assert.equal(response.cookies.get(SESSION_COOKIE_NAME), undefined);
  });

  test("Google callback requires verified email and an explicit hosted domain", () => {
    assert.equal(isVerifiedGoogleWorkspaceIdentity({
      email: "staff@cdktcnqn.edu.vn",
      email_verified: true,
      hd: "cdktcnqn.edu.vn",
    }), true);
    assert.equal(isVerifiedGoogleWorkspaceIdentity({
      email: "staff@cdktcnqn.edu.vn",
      email_verified: true,
    }), false);
    assert.equal(isVerifiedGoogleWorkspaceIdentity({
      email: "staff@cdktcnqn.edu.vn",
      email_verified: false,
      hd: "cdktcnqn.edu.vn",
    }), false);
  });
});
