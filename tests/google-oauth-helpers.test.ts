import { test, describe, afterEach } from "node:test";
import assert from "node:assert/strict";
import { isAllowedDomain, getAppBaseUrl } from "../src/lib/google-oauth";

describe("Google OAuth Helper Functions", () => {
  describe("isAllowedDomain", () => {
    test("accepts valid @cdktcnqn.edu.vn emails", () => {
      assert.strictEqual(isAllowedDomain("quantrimang@cdktcnqn.edu.vn", "cdktcnqn.edu.vn"), true);
      assert.strictEqual(isAllowedDomain("GIANGVIEN@CDKTCNQN.EDU.VN"), true);
      assert.strictEqual(isAllowedDomain("nguyen.van.a@cdktcnqn.edu.vn"), true);
    });

    test("rejects personal gmail and other educational domains", () => {
      assert.strictEqual(isAllowedDomain("test@gmail.com"), false);
      assert.strictEqual(isAllowedDomain("test@qcet.edu.vn"), false);
      assert.strictEqual(isAllowedDomain("student@hcmut.edu.vn"), false);
      assert.strictEqual(isAllowedDomain("cdktcnqn.edu.vn@gmail.com"), false);
      assert.strictEqual(isAllowedDomain(null), false);
      assert.strictEqual(isAllowedDomain(""), false);
    });
  });

  describe("getAppBaseUrl", () => {
    test("respects x-forwarded-host and x-forwarded-proto headers behind reverse proxy", () => {
      const req = new Request("http://127.0.0.1:3000/api/auth/google", {
        headers: {
          "x-forwarded-host": "e-office.cdktcnqn.edu.vn",
          "x-forwarded-proto": "https",
        },
      });

      const baseUrl = getAppBaseUrl(req);
      assert.strictEqual(baseUrl, "https://e-office.cdktcnqn.edu.vn");
    });

    test("falls back to request origin if no forwarded headers", () => {
      const req = new Request("http://localhost:3001/api/auth/google");
      const baseUrl = getAppBaseUrl(req);
      assert.strictEqual(baseUrl, "http://localhost:3001");
    });
  });
});
