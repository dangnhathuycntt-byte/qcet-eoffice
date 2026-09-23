import { test, describe, before } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { prisma } from "../src/lib/prisma";
import { GET } from "../src/app/api/users/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

describe("API Route: /api/users", () => {
  let sampleUser: {
    id: string;
    name: string;
    email: string;
    role: string;

  };
  let authCookie: string;

  before(async () => {
    const user = await prisma.user.findFirst({
      where: {} },
      select: { id: true, name: true, email: true, role: true},
    });
    assert.ok(user, "Expected at least one user with department in database");
    sampleUser = user;
    const token = signSessionToken({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,

    });
    authCookie = `${SESSION_COOKIE_NAME}=${token}`;
  });

  test("GET /api/users returns list of users with required fields", async () => {
    const req = new NextRequest("http://localhost:3001/api/users", {
      headers: { cookie: authCookie },
    });
    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(Array.isArray(body.users), "users should be an array");
    assert.ok(body.users.length > 0, "users array should not be empty");

    const first = body.users[0];
    assert.ok(first.id, "user must have id");
    assert.ok(first.name, "user must have name");
    assert.ok(first.email, "user must have email");
    assert.ok(first.role, "user must have role");
    assert.ok("departmentId" in first, "user must have departmentId field");
    assert.ok("department" in first, "user must have department field");
    assert.ok("position" in first || "title" in first, "user must have position field");
    assert.ok("avatarUrl" in first, "user must have avatarUrl field");
  });

  test("GET /api/users?departmentId=... filters by department", async () => {
    const req = new NextRequest(
      `http://localhost:3001/api/users?departmentId=${sampleUser.departmentId}`,
      {
        headers: { cookie: authCookie },
      }
    );
    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.users.length > 0);
    for (const u of body.users) {
      assert.equal(u.departmentId, sampleUser.departmentId);
    }
  });

  test("GET /api/users?q=... filters by name or email keyword", async () => {
    const keyword = sampleUser.name.split(" ")[0].toLowerCase();
    const req = new NextRequest(
      `http://localhost:3001/api/users?q=${encodeURIComponent(keyword)}`,
      {
        headers: { cookie: authCookie },
      }
    );
    const res = await GET(req);
    assert.equal(res.status, 200);

    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.users.length > 0);
    const found = body.users.some((u: any) => u.id === sampleUser.id);
    assert.ok(found, `Expected user ${sampleUser.name} to be found with keyword ${keyword}`);
  });
});
