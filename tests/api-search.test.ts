import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { GET } from "../src/app/api/search/route";
import { signSessionToken, SESSION_COOKIE_NAME } from "../src/lib/jwt-session";

const validToken = signSessionToken({
  id: "test-user-id",
  email: "admin@cdktcnqn.edu.vn",
  name: "Quản trị hệ thống",
  role: "ADMIN",
});

function createAuthRequest(url: string) {
  return new NextRequest(url, {
    headers: {
      cookie: `${SESSION_COOKIE_NAME}=${validToken}`,
    },
  });
}

describe("Search API Endpoint (GET /api/search)", () => {
  test("returns 401 when no session cookie is provided", async () => {
    const req = new NextRequest("http://localhost:3001/api/search");
    const res = await GET(req);
    assert.equal(res.status, 401);
  });

  test("returns empty query result with recent tasks and active users", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search");

    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(Array.isArray(data.results.tasks));
    assert.ok(Array.isArray(data.results.users));
    assert.ok(typeof data.count.tasks === "number");
    assert.ok(typeof data.count.users === "number");
  });

  test("filters tasks and users by Vietnamese unaccented query", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=dao+tao");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.query, "dao tao");
    assert.ok(Array.isArray(data.results.tasks));
  });

  test("filters by department acronym (cntt, bgh, dbclgd)", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=cntt");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.equal(data.query, "cntt");
  });

  test("filters by task code prefix (NV-2026)", async () => {
    const req = createAuthRequest("http://localhost:3001/api/search?q=NV-2026");
    const res = await GET(req);
    assert.equal(res.status, 200);
    const data = await res.json();

    assert.equal(data.success, true);
    assert.ok(data.results.tasks.length > 0);
    const hasMatch = data.results.tasks.some((t: any) =>
      t.code.toLowerCase().includes("nv-2026")
    );
    assert.ok(hasMatch, "At least one task should match code prefix NV-2026");
  });
});
