import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { GET as googleAuthGet } from "../src/app/api/auth/google/route";
import { NextRequest } from "next/server";

describe("GET /api/auth/google", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "mock-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  test("redirects through login so the Auth.js client starts Google OAuth", async () => {
    delete process.env.GOOGLE_CLIENT_ID;

    const req = new NextRequest("http://localhost:3000/api/auth/google");
    const res = await googleAuthGet(req);

    assert.strictEqual(res.status, 307);
    const location = new URL(res.headers.get("location")!);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("startGoogle"), "1");
  });

  test("preserves a safe return target for the Auth.js client flow", async () => {
    const req = new NextRequest("http://localhost:3001/api/auth/google?returnTo=%2Fdocuments");
    const res = await googleAuthGet(req);

    assert.strictEqual(res.status, 307);
    const location = new URL(res.headers.get("location")!);
    assert.equal(location.pathname, "/login");
    assert.equal(location.searchParams.get("startGoogle"), "1");
    assert.equal(location.searchParams.get("returnTo"), "/documents");
    assert.equal(res.headers.get("set-cookie"), null);
  });
});
