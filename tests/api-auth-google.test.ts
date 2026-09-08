import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { GET as googleAuthGet } from "../src/app/api/auth/google/route";
import { NextRequest } from "next/server";

describe("GET /api/auth/google", () => {
  test("redirects to /login?error=oauth_not_configured when credentials missing", async () => {
    const originalClientId = process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_ID;

    try {
      const req = new NextRequest("http://localhost:3000/api/auth/google");
      const res = await googleAuthGet(req);

      assert.strictEqual(res.status, 307);
      assert.ok(res.headers.get("location")?.includes("/login?error=oauth_not_configured"));
    } finally {
      if (originalClientId) process.env.GOOGLE_CLIENT_ID = originalClientId;
    }
  });

  test("generates state, sets qcet_oauth_state cookie, and redirects to accounts.google.com", async () => {
    process.env.GOOGLE_CLIENT_ID = "mock-id.apps.googleusercontent.com";
    process.env.GOOGLE_CLIENT_SECRET = "mock-secret";

    const req = new NextRequest("http://localhost:3001/api/auth/google");
    const res = await googleAuthGet(req);

    assert.strictEqual(res.status, 307);
    const location = res.headers.get("location");
    assert.ok(location?.startsWith("https://accounts.google.com/o/oauth2/v2/auth"));
    assert.ok(location?.includes("hd=cdktcnqn.edu.vn"));
    assert.ok(location?.includes("redirect_uri=http%3A%2F%2Flocalhost%3A3001%2Fapi%2Fauth%2Fcallback%2Fgoogle"));

    const stateCookie = res.cookies.get("qcet_oauth_state");
    assert.ok(stateCookie, "qcet_oauth_state cookie must be set");
    assert.strictEqual(stateCookie?.httpOnly, true);
    assert.strictEqual(stateCookie?.sameSite, "lax");
    assert.ok(stateCookie?.value && stateCookie.value.length >= 10);
    assert.ok(location?.includes(`state=${stateCookie?.value}`));
  });
});
